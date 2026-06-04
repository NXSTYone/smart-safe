const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');

const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

function normalizeIpnPayload(body) {
  const payload = body || {};

  return {
    raw: payload,

    sign: payload.sign || payload.signature || null,

    chain:
      payload.chain ||
      payload.blockchain ||
      payload.network ||
      null,

    currency:
      payload.currency ||
      payload.token ||
      null,

    type:
      payload.type ||
      payload.status ||
      null,

    amount: Number(payload.amount || 0),

    fee: Number(payload.fee || 0),

    from:
      payload.from ||
      payload.from_address ||
      null,

    to:
      payload.to ||
      payload.address ||
      payload.to_address ||
      null,

    txid:
      payload.txid ||
      payload.tx_hash ||
      payload.hash ||
      null,

    label:
      payload.label ||
      null,

    uniqueId:
      payload.uniqID ||
      payload.uniqueID ||
      payload.unique_id ||
      null,

    confirmation:
      payload.confirmation ||
      payload.confirmations ||
      null,

    sendId:
      payload.id ||
      payload.send_id ||
      payload.result ||
      null,
  };
}

function mapChainToNetwork(chain) {
  const value = String(chain || '').toLowerCase();

  if (value.includes('tron') || value === 'trx' || value === 'trc20') {
    return 'TRC20';
  }

  if (value.includes('bsc') || value.includes('bnb') || value === 'bep20') {
    return 'BEP20';
  }

  return String(chain || '').toUpperCase();
}

function verifySignatureIfConfigured(req) {
  const secret = process.env.CRYPTOCURRENCYAPI_IPN_SECRET;

  if (!secret) {
    return true;
  }

  const incomingSign =
    req.body?.sign ||
    req.body?.signature ||
    req.headers['x-signature'] ||
    req.headers['x-sign'];

  if (!incomingSign) {
    return false;
  }

  const payload = { ...req.body };
  delete payload.sign;
  delete payload.signature;

  const sortedString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('&');

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(sortedString)
    .digest('hex');

  return hmac === incomingSign;
}

router.post('/cryptocurrency', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!verifySignatureIfConfigured(req)) {
      return res.status(403).json({
        success: false,
        message: 'Некорректная подпись IPN',
      });
    }

    const ipn = normalizeIpnPayload(req.body);
    const network = mapChainToNetwork(ipn.chain);

    await client.query('BEGIN');

    const isDepositIpn =
      Boolean(ipn.label || ipn.uniqueId) &&
      String(ipn.label || ipn.uniqueId).startsWith('deposit_');

    const isWithdrawIpn =
      Boolean(ipn.label || ipn.uniqueId) &&
      String(ipn.label || ipn.uniqueId).startsWith('withdraw_');

    if (isDepositIpn) {
      const depositKey = ipn.label || ipn.uniqueId;

      const depositResult = await client.query(
        `SELECT *
         FROM payment_deposits
         WHERE label = $1 OR unique_id = $1
         FOR UPDATE`,
        [depositKey]
      );

      if (depositResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Заявка на пополнение не найдена',
        });
      }

      const deposit = depositResult.rows[0];

      if (deposit.status === 'completed') {
        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'Пополнение уже было обработано',
        });
      }

      const paidAmount = Number(ipn.amount || deposit.amount || 0);

      if (!paidAmount || paidAmount <= 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Некорректная сумма пополнения',
        });
      }

      const updatedDepositResult = await client.query(
        `UPDATE payment_deposits
         SET status = 'completed',
             amount = $1,
             tx_hash = $2,
             confirmed_at = NOW(),
             provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $3::jsonb
         WHERE id = $4
         RETURNING *`,
        [
          paidAmount,
          ipn.txid,
          JSON.stringify({ ipn: ipn.raw }),
          deposit.id,
        ]
      );

      await client.query(
        `UPDATE balances
         SET main_balance = main_balance + $1,
             total_deposited = total_deposited + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [paidAmount, deposit.user_id]
      );

      await client.query(
        `INSERT INTO transactions
         (user_id, type, balance_type, amount, status, description, related_id)
         VALUES ($1, 'deposit', 'main', $2, 'success', $3, $4)`,
        [
          deposit.user_id,
          paidAmount,
          `Пополнение ${paidAmount.toFixed(2)} USDT через ${network}`,
          deposit.id,
        ]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Пополнение обработано и зачислено',
        deposit: updatedDepositResult.rows[0],
      });
    }

    if (isWithdrawIpn) {
      const withdrawKey = ipn.label || ipn.uniqueId;
      const withdrawalId = withdrawKey.replace('withdraw_', '');

      const withdrawalResult = await client.query(
        `SELECT *
         FROM withdrawals
         WHERE id = $1
         FOR UPDATE`,
        [withdrawalId]
      );

      if (withdrawalResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Заявка на вывод не найдена',
        });
      }

      const withdrawal = withdrawalResult.rows[0];

      if (withdrawal.status === 'completed') {
        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'Вывод уже был обработан',
        });
      }

      const ipnType = String(ipn.type || '').toLowerCase();
      const isErrorIpn =
        ipnType.includes('error') ||
        ipnType.includes('fail') ||
        ipnType.includes('reject') ||
        ipnType.includes('cancel');

      if (isErrorIpn) {
        const updatedWithdrawalResult = await client.query(
          `UPDATE withdrawals
           SET status = 'rejected',
               admin_comment = COALESCE(admin_comment, '') || ' | Ошибка отправки CryptocurrencyAPI',
               processed_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [withdrawal.id]
        );

        await client.query(
          `UPDATE balances
           SET main_balance = main_balance + $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [withdrawal.amount, withdrawal.user_id]
        );

        await client.query(
          `UPDATE transactions
           SET status = 'rejected',
               description = description || ' | Ошибка отправки CryptocurrencyAPI'
           WHERE related_id = $1
             AND type = 'withdraw_request'`,
          [withdrawal.id]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'Вывод отклонён по IPN ошибки, средства возвращены',
          withdrawal: updatedWithdrawalResult.rows[0],
        });
      }

      if (!ipn.txid) {
        const updatedWithdrawalResult = await client.query(
          `UPDATE withdrawals
           SET status = 'processing',
               admin_comment = COALESCE(admin_comment, '') || ' | IPN CryptocurrencyAPI получен, ожидаем txid',
               processed_at = COALESCE(processed_at, NOW())
           WHERE id = $1
           RETURNING *`,
          [withdrawal.id]
        );

        await client.query(
          `UPDATE transactions
           SET status = 'processing'
           WHERE related_id = $1
             AND type = 'withdraw_request'`,
          [withdrawal.id]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'IPN вывода получен, ожидаем txid',
          withdrawal: updatedWithdrawalResult.rows[0],
        });
      }

      const updatedWithdrawalResult = await client.query(
        `UPDATE withdrawals
         SET status = 'completed',
             tx_hash = $1,
             admin_comment = COALESCE(admin_comment, '') || ' | Выполнено через CryptocurrencyAPI',
             processed_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [ipn.txid, withdrawal.id]
      );

      await client.query(
        `UPDATE balances
         SET total_withdrawn = total_withdrawn + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [withdrawal.amount, withdrawal.user_id]
      );

      await client.query(
        `UPDATE transactions
         SET status = 'completed',
             description = description || ' | TX: ' || $1
         WHERE related_id = $2
           AND type = 'withdraw_request'`,
        [ipn.txid || '', withdrawal.id]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Вывод обработан',
        withdrawal: updatedWithdrawalResult.rows[0],
      });
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'IPN получен, но не относится к заявкам Smart Safe',
      payload: ipn.raw,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Cryptocurrency IPN error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка обработки IPN',
    });
  } finally {
    client.release();
  }
});

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'IPN route works',
    time: new Date().toISOString(),
  });
});

module.exports = router;