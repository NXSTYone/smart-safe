const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

const MIN_WITHDRAW_AMOUNT = 10;

router.post('/create', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { network, wallet_address, amount } = req.body;

    const withdrawAmount = Number(amount);

    if (!network || !['TRC20', 'BEP20'].includes(network)) {
      return res.status(400).json({
        success: false,
        message: 'Выберите сеть TRC20 или BEP20',
      });
    }

    if (!wallet_address || wallet_address.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Укажите корректный адрес кошелька',
      });
    }

    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Укажите корректную сумму вывода',
      });
    }

    if (withdrawAmount < MIN_WITHDRAW_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Минимальная сумма вывода ${MIN_WITHDRAW_AMOUNT} USDT`,
      });
    }

    await client.query('BEGIN');

    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    const balance = balanceResult.rows[0];

    if (!balance || Number(balance.main_balance) < withdrawAmount) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Недостаточно средств на основном балансе',
      });
    }

    const feeAmount = 0;
    const finalAmount = withdrawAmount;

    const withdrawalResult = await client.query(
      `INSERT INTO withdrawals
       (user_id, network, wallet_address, amount, fee_amount, final_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        userId,
        network,
        wallet_address.trim(),
        withdrawAmount,
        feeAmount,
        finalAmount,
      ]
    );

    const withdrawal = withdrawalResult.rows[0];

    await client.query(
      `UPDATE balances
       SET main_balance = main_balance - $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [withdrawAmount, userId]
    );

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, status, description, related_id)
       VALUES ($1, 'withdraw_request', 'main', $2, 'pending', $3, $4)`,
      [
        userId,
        withdrawAmount,
        `Создана заявка на вывод ${finalAmount} USDT в сети ${network}`,
        withdrawal.id,
      ]
    );

    const updatedBalanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Заявка на вывод создана. Обработка до 24 часов.',
      withdrawal,
      balances: updatedBalanceResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Create withdrawal error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка создания заявки на вывод',
    });
  } finally {
    client.release();
  }
});

router.post('/cancel/:id', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const withdrawalId = req.params.id;

    await client.query('BEGIN');

    const withdrawalResult = await client.query(
      `SELECT *
       FROM withdrawals
       WHERE id = $1
         AND user_id = $2
       FOR UPDATE`,
      [withdrawalId, userId]
    );

    if (withdrawalResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Заявка на вывод не найдена',
      });
    }

    const withdrawal = withdrawalResult.rows[0];

    if (withdrawal.status !== 'pending') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Можно отменить только заявку в обработке',
      });
    }

    await client.query(
  `UPDATE withdrawals
   SET status = 'cancelled'
   WHERE id = $1`,
  [withdrawal.id]
);

    await client.query(
      `UPDATE balances
       SET main_balance = main_balance + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [withdrawal.amount, userId]
    );

    await client.query(
  `UPDATE transactions
   SET status = 'cancelled',
       description = description || ' / Заявка отменена пользователем'
   WHERE related_id = $1
     AND type = 'withdraw_request'
     AND user_id = $2`,
  [withdrawal.id, userId]
);

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, status, description, related_id)
       VALUES ($1, 'withdraw_cancel', 'main', $2, 'success', $3, $4)`,
      [
        userId,
        withdrawal.amount,
        `Отмена заявки на вывод. Возврат ${Number(withdrawal.amount).toFixed(
          2
        )} USDT на основной баланс`,
        withdrawal.id,
      ]
    );

    const updatedBalanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1',
      [userId]
    );

    const updatedWithdrawalResult = await client.query(
      'SELECT * FROM withdrawals WHERE id = $1',
      [withdrawal.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Заявка на вывод отменена. Средства возвращены на основной баланс.',
      withdrawal: updatedWithdrawalResult.rows[0],
      balances: updatedBalanceResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Cancel withdrawal error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка отмены заявки на вывод',
    });
  } finally {
    client.release();
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      withdrawals: result.rows,
    });
  } catch (error) {
    console.error('My withdrawals error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения заявок на вывод',
    });
  }
});

module.exports = router;