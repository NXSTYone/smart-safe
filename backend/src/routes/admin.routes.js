const express = require('express');
const axios = require('axios');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

const BALANCE_FIELDS = {
  main: 'main_balance',
  referral: 'referral_balance',
  working: 'working_balance',
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function writeAdminLog(client, adminId, targetUserId, action, oldValue, newValue, comment) {
  await client.query(
    `INSERT INTO admin_logs
     (admin_id, target_user_id, action, old_value, new_value, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      adminId,
      targetUserId || null,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      comment || null,
    ]
  );
}


function getCryptoApiConfig() {
  const apiKey = process.env.CRYPTOCURRENCYAPI_KEY;
  const baseUrl =
    process.env.CRYPTOCURRENCYAPI_BASE_URL ||
    'https://new.cryptocurrencyapi.net';

  if (!apiKey) {
    throw new Error('CRYPTOCURRENCYAPI_KEY is not set in .env');
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
  };
}

function getPublicApiUrl() {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.CRYPTOCURRENCYAPI_STATUS_URL ||
    ''
  ).replace(/\/$/, '');
}

function getWithdrawApiNetwork(network) {
  if (network === 'TRC20') return 'trx';
  if (network === 'BEP20') return 'bsc';

  throw new Error('Unsupported withdraw network');
}

async function sendWithdrawalToCryptoApi(withdrawal) {
  const cryptoConfig = getCryptoApiConfig();
  const apiNetwork = getWithdrawApiNetwork(withdrawal.network);
  const publicApiUrl = getPublicApiUrl();

  if (!publicApiUrl) {
    throw new Error('PUBLIC_API_URL is not set in .env');
  }

  const label = `withdraw_${withdrawal.id}`;
  const uniqueID = label;
  const amount = Number(withdrawal.final_amount || withdrawal.amount);

  const response = await axios.get(
    `${cryptoConfig.baseUrl}/api/${apiNetwork}/.send`,
    {
      params: {
        key: cryptoConfig.apiKey,
        token: 'USDT',
        to: withdrawal.wallet_address,
        amount,
        label,
        uniqueID,
        statusURL: `${publicApiUrl}/api/ipn/cryptocurrency`,
      },
      timeout: 30000,
    }
  );

  const result = response.data?.result;

  if (!result) {
    throw new Error(
      `CryptocurrencyAPI send did not return result: ${JSON.stringify(response.data)}`
    );
  }

  return {
    providerSendId: String(result),
    providerPayload: response.data,
    label,
    uniqueID,
  };
}

async function findUserByIdentifier(client, identifier) {
  if (!identifier) return null;

  const value = String(identifier).trim();

  const result = await client.query(
    `SELECT *
     FROM users
     WHERE id::text = $1
        OR telegram_id::text = $1
        OR referral_code = $1
        OR LOWER(COALESCE(telegram_username, '')) = LOWER(REPLACE($1, '@', ''))
     LIMIT 1`,
    [value]
  );

  return result.rows[0] || null;
}

router.get('/stats', auth, admin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE is_blocked = true) AS blocked_users,
        (SELECT COUNT(*) FROM users WHERE is_admin = true) AS admins,
        (SELECT COUNT(*) FROM user_deposits WHERE status = 'active') AS active_safes,
        (SELECT COALESCE(SUM(main_balance), 0) FROM balances) AS total_main_balance,
        (SELECT COALESCE(SUM(working_balance), 0) FROM balances) AS total_working_balance,
        (SELECT COALESCE(SUM(referral_balance), 0) FROM balances) AS total_referral_balance,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_deposits WHERE status = 'completed') AS total_deposits,
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'completed') AS total_withdrawals,
        (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') AS pending_withdrawals,
        (SELECT COUNT(*) FROM payment_deposits WHERE status = 'pending') AS pending_payment_deposits
    `);

    res.json({
      success: true,
      stats: result.rows[0],
    });
  } catch (error) {
    console.error('Admin stats error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики',
    });
  }
});

router.get('/users', auth, admin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Number(req.query.limit || 100), 300);

    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search.replace('@', '')}%`);
      where = `
        WHERE u.id::text ILIKE $1
           OR u.telegram_id::text ILIKE $1
           OR COALESCE(u.telegram_username, '') ILIKE $1
           OR COALESCE(u.first_name, '') ILIKE $1
           OR COALESCE(u.last_name, '') ILIKE $1
           OR COALESCE(u.referral_code, '') ILIKE $1
      `;
    }

    params.push(limit);

    const result = await pool.query(
      `SELECT
        u.id,
        u.telegram_id,
        u.telegram_username,
        u.first_name,
        u.last_name,
        u.email,
        u.referral_code,
        u.invited_by,
        u.is_blocked,
        u.is_admin,
        u.created_at,
        u.updated_at,
        b.main_balance,
        b.working_balance,
        b.referral_balance,
        b.total_deposited,
        b.total_withdrawn,
        b.total_earned,
        ref.telegram_username AS invited_by_username,
        ref.telegram_id AS invited_by_telegram_id
       FROM users u
       LEFT JOIN balances b ON b.user_id = u.id
       LEFT JOIN users ref ON ref.id = u.invited_by
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error('Admin users error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения пользователей',
    });
  }
});

router.get('/users/:id', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      `SELECT
        u.*,
        b.main_balance,
        b.working_balance,
        b.referral_balance,
        b.total_deposited,
        b.total_withdrawn,
        b.total_earned,
        ref.telegram_username AS invited_by_username,
        ref.telegram_id AS invited_by_telegram_id,
        ref.referral_code AS invited_by_referral_code
       FROM users u
       LEFT JOIN balances b ON b.user_id = u.id
       LEFT JOIN users ref ON ref.id = u.invited_by
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден',
      });
    }

    const depositsResult = await pool.query(
      `SELECT
        d.*,
        p.code AS plan_code,
        p.name AS plan_name
       FROM user_deposits d
       LEFT JOIN safe_plans p ON p.id = d.plan_id
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC`,
      [id]
    );

    const withdrawalsResult = await pool.query(
      `SELECT *
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const paymentDepositsResult = await pool.query(
      `SELECT *
       FROM payment_deposits
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const transactionsResult = await pool.query(
      `SELECT *
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [id]
    );

    const partnersResult = await pool.query(
      `SELECT
        u.id,
        u.telegram_id,
        u.telegram_username,
        u.first_name,
        u.last_name,
        u.created_at,
        b.total_deposited
       FROM users u
       LEFT JOIN balances b ON b.user_id = u.id
       WHERE u.invited_by = $1
       ORDER BY u.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      user: userResult.rows[0],
      deposits: depositsResult.rows,
      withdrawals: withdrawalsResult.rows,
      payment_deposits: paymentDepositsResult.rows,
      transactions: transactionsResult.rows,
      partners: partnersResult.rows,
    });
  } catch (error) {
    console.error('Admin user detail error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения пользователя',
    });
  }
});

router.post('/users/:id/balance', auth, admin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const targetUser = await findUserByIdentifier(client, id);
if (!targetUser) {
  return res.status(404).json({
    success: false,
    message: 'Пользователь не найден',
  });
}
const targetUserId = targetUser.id;
    const { balance_type, operation, amount, comment } = req.body;

    const field = BALANCE_FIELDS[balance_type];
    const value = toNumber(amount);

    if (!field) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный тип баланса',
      });
    }

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректная операция. Используйте add, subtract или set',
      });
    }

    if (value < 0) {
      return res.status(400).json({
        success: false,
        message: 'Сумма не может быть отрицательной',
      });
    }

    if (!comment || comment.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Укажите причину изменения баланса',
      });
    }

    await client.query('BEGIN');

    const balanceResult = await client.query(
      `SELECT *
       FROM balances
       WHERE user_id = $1
       FOR UPDATE`,
      [targetUserId]
    );

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Баланс пользователя не найден',
      });
    }

    const oldBalance = balanceResult.rows[0];
    const currentValue = toNumber(oldBalance[field]);

    let newValue = currentValue;

    if (operation === 'add') newValue = currentValue + value;
    if (operation === 'subtract') newValue = currentValue - value;
    if (operation === 'set') newValue = value;

    if (newValue < 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Баланс не может стать отрицательным',
      });
    }

    const updatedBalanceResult = await client.query(
      `UPDATE balances
       SET ${field} = $1,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [newValue, targetUserId]
    );

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, status, description, related_id)
       VALUES ($1, 'admin_balance_change', $2, $3, 'success', $4, NULL)`,
      [
        targetUserId,
        balance_type,
        operation === 'subtract' ? -value : value,
        `Ручное изменение баланса администратором: ${operation}, ${value} USDT. Причина: ${comment}`,
      ]
    );

    await writeAdminLog(
      client,
      req.user.id,
      targetUserId,
      'balance_change',
      oldBalance,
      updatedBalanceResult.rows[0],
      comment
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Баланс успешно изменён',
      balance: updatedBalanceResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Admin balance change error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка изменения баланса',
    });
  } finally {
    client.release();
  }
});

router.post('/users/:id/block', auth, admin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { is_blocked, comment } = req.body;

    await client.query('BEGIN');

    const oldResult = await client.query(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден',
      });
    }

    const oldUser = oldResult.rows[0];

    const updatedResult = await client.query(
      `UPDATE users
       SET is_blocked = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [Boolean(is_blocked), id]
    );

    await writeAdminLog(
      client,
      req.user.id,
      id,
      Boolean(is_blocked) ? 'user_block' : 'user_unblock',
      oldUser,
      updatedResult.rows[0],
      comment
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: Boolean(is_blocked) ? 'Пользователь заблокирован' : 'Пользователь разблокирован',
      user: updatedResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Admin block error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка изменения блокировки',
    });
  } finally {
    client.release();
  }
});

router.post('/users/:id/admin', auth, admin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { is_admin, comment } = req.body;

    await client.query('BEGIN');

    const oldResult = await client.query(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден',
      });
    }

    const oldUser = oldResult.rows[0];

    const updatedResult = await client.query(
      `UPDATE users
       SET is_admin = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [Boolean(is_admin), id]
    );

    await writeAdminLog(
      client,
      req.user.id,
      id,
      Boolean(is_admin) ? 'admin_grant' : 'admin_revoke',
      oldUser,
      updatedResult.rows[0],
      comment
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: Boolean(is_admin) ? 'Пользователь назначен администратором' : 'Права администратора сняты',
      user: updatedResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Admin role error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка изменения прав администратора',
    });
  } finally {
    client.release();
  }
});

router.post('/users/:id/change-referrer', auth, admin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { referrer, comment } = req.body;

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT * FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден',
      });
    }

    const oldUser = userResult.rows[0];

    let newReferrerId = null;

    if (referrer && String(referrer).trim()) {
      const refUser = await findUserByIdentifier(client, referrer);

      if (!refUser) {
        await client.query('ROLLBACK');

        return res.status(404).json({
          success: false,
          message: 'Новый пригласитель не найден',
        });
      }

      if (refUser.id === id) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Пользователь не может быть своим пригласителем',
        });
      }

      const cycleResult = await client.query(
        `WITH RECURSIVE structure AS (
          SELECT id, invited_by
          FROM users
          WHERE invited_by = $1

          UNION ALL

          SELECT u.id, u.invited_by
          FROM users u
          JOIN structure s ON u.invited_by = s.id
        )
        SELECT id FROM structure WHERE id = $2 LIMIT 1`,
        [id, refUser.id]
      );

      if (cycleResult.rows.length > 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Нельзя перенести пользователя под его нижнюю структуру',
        });
      }

      newReferrerId = refUser.id;
    }

    const updatedResult = await client.query(
      `UPDATE users
       SET invited_by = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newReferrerId, id]
    );

    await writeAdminLog(
      client,
      req.user.id,
      id,
      'change_referrer',
      oldUser,
      updatedResult.rows[0],
      comment || `Новый пригласитель: ${newReferrerId || 'без пригласителя'}`
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Пригласитель пользователя изменён',
      user: updatedResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Admin change referrer error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка переноса пользователя',
    });
  } finally {
    client.release();
  }
});

router.get('/payment-deposits', auth, admin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        pd.*,
        u.telegram_id,
        u.telegram_username,
        u.first_name,
        u.last_name
       FROM payment_deposits pd
       JOIN users u ON u.id = pd.user_id
       ORDER BY pd.created_at DESC`
    );

    res.json({
      success: true,
      deposits: result.rows,
    });
  } catch (error) {
    console.error('Admin payment deposits error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения пополнений',
    });
  }
});

router.get('/user-deposits', auth, admin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        d.*,
        u.telegram_id,
        u.telegram_username,
        u.first_name,
        u.last_name,
        p.code AS plan_code,
        p.name AS plan_name
       FROM user_deposits d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN safe_plans p ON p.id = d.plan_id
       ORDER BY d.created_at DESC`
    );

    res.json({
      success: true,
      deposits: result.rows,
    });
  } catch (error) {
    console.error('Admin user deposits error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения сейфов',
    });
  }
});

router.get('/withdrawals', auth, admin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        w.*,
        u.telegram_id,
        u.telegram_username,
        u.first_name,
        u.last_name
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ORDER BY w.created_at DESC`
    );

    res.json({
      success: true,
      withdrawals: result.rows,
    });
  } catch (error) {
    console.error('Admin withdrawals error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения заявок на вывод',
    });
  }
});

router.post('/withdrawals/:id/complete', auth, admin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { admin_comment } = req.body;

    await client.query('BEGIN');

    const withdrawalResult = await client.query(
      `SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (withdrawalResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена',
      });
    }

    const withdrawal = withdrawalResult.rows[0];

    if (withdrawal.status !== 'pending') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Заявка уже обработана',
      });
    }

    const sendResult = await sendWithdrawalToCryptoApi(withdrawal);

    const updatedWithdrawalResult = await client.query(
      `UPDATE withdrawals
       SET status = 'processing',
           admin_comment = $1,
           processed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [
        `${admin_comment || 'Вывод подтверждён администратором'} | CryptoAPI send id: ${sendResult.providerSendId}`,
        id,
      ]
    );

    await client.query(
      `UPDATE transactions
       SET status = 'processing',
           description = description || ' | Отправка создана в CryptocurrencyAPI: ' || $1
       WHERE related_id = $2
         AND type = 'withdraw_request'`,
      [sendResult.providerSendId, id]
    );

    await writeAdminLog(
      client,
      req.user.id,
      withdrawal.user_id,
      'withdraw_send_created',
      withdrawal,
      {
        withdrawal: updatedWithdrawalResult.rows[0],
        cryptoapi: sendResult,
      },
      admin_comment || null
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Заявка отправлена в CryptocurrencyAPI. Ожидаем IPN подтверждение.',
      withdrawal: updatedWithdrawalResult.rows[0],
      cryptoapi: {
        send_id: sendResult.providerSendId,
        label: sendResult.label,
        unique_id: sendResult.uniqueID,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Complete withdrawal auto send error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка автоматической отправки вывода',
      error: error.message,
    });
  } finally {
    client.release();
  }
});

router.post('/withdrawals/:id/reject', auth, admin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { admin_comment } = req.body;

    await client.query('BEGIN');

    const withdrawalResult = await client.query(
      `SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (withdrawalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена',
      });
    }

    const withdrawal = withdrawalResult.rows[0];

    if (withdrawal.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Заявка уже обработана',
      });
    }

    const updatedWithdrawalResult = await client.query(
      `UPDATE withdrawals
       SET status = 'rejected',
           admin_comment = $1,
           processed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [admin_comment || null, id]
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
           description = description || ' | Отклонено админом'
       WHERE related_id = $1 AND type = 'withdraw_request'`,
      [id]
    );

    await writeAdminLog(
      client,
      req.user.id,
      withdrawal.user_id,
      'withdraw_reject',
      withdrawal,
      updatedWithdrawalResult.rows[0],
      admin_comment || null
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Заявка отклонена, средства возвращены на основной баланс',
      withdrawal: updatedWithdrawalResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject withdrawal error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка отклонения вывода',
    });
  } finally {
    client.release();
  }
});

router.get('/logs', auth, admin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        l.*,
        a.telegram_username AS admin_username,
        a.telegram_id AS admin_telegram_id,
        t.telegram_username AS target_username,
        t.telegram_id AS target_telegram_id
       FROM admin_logs l
       LEFT JOIN users a ON a.id = l.admin_id
       LEFT JOIN users t ON t.id = l.target_user_id
       ORDER BY l.created_at DESC
       LIMIT 300`
    );

    res.json({
      success: true,
      logs: result.rows,
    });
  } catch (error) {
    console.error('Admin logs error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения логов',
    });
  }
});

module.exports = router;