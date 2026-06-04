const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const balanceResult = await pool.query(
      'SELECT * FROM balances WHERE user_id = $1',
      [userId]
    );

    const depositsResult = await pool.query(
      `SELECT 
        ud.id,
        ud.amount,
        ud.daily_percent,
        ud.boost_percent,
        ud.total_percent,
        ud.earned_amount,
        ud.max_return_amount,
        ud.status,
        ud.opened_at,
        ud.next_accrual_at,
        sp.code AS plan_code,
        sp.name AS plan_name
      FROM user_deposits ud
      JOIN safe_plans sp ON sp.id = ud.plan_id
      WHERE ud.user_id = $1
      ORDER BY ud.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      user: {
        id: req.user.id,
        telegram_id: req.user.telegram_id,
        telegram_username: req.user.telegram_username,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
        email: req.user.email,
        referral_code: req.user.referral_code,
        is_admin: req.user.is_admin,
        created_at: req.user.created_at,
      },
      balances: balanceResult.rows[0],
      deposits: depositsResult.rows,
    });
  } catch (error) {
    console.error('Profile error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения профиля',
    });
  }
});

router.get('/transactions', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      transactions: result.rows,
    });
  } catch (error) {
    console.error('Transactions error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения истории операций',
    });
  }
});

router.post('/transfer-to-main', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { from_balance, amount } = req.body;

    const transferAmount = Number(amount);

    if (!from_balance || !['working', 'referral'].includes(from_balance)) {
      return res.status(400).json({
        success: false,
        message: 'Можно переводить только с working или referral баланса',
      });
    }

    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Укажите корректную сумму',
      });
    }

    await client.query('BEGIN');

    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    const balance = balanceResult.rows[0];

    if (!balance) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Баланс не найден',
      });
    }

    let sourceColumn = '';
    let feePercent = 0;

    if (from_balance === 'working') {
      sourceColumn = 'working_balance';
      feePercent = 2;
    }

    if (from_balance === 'referral') {
      sourceColumn = 'referral_balance';
      feePercent = 0;
    }

    const currentSourceBalance = Number(balance[sourceColumn]);

    if (currentSourceBalance < transferAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Недостаточно средств для перевода',
      });
    }

    const feeAmount = (transferAmount * feePercent) / 100;
    const finalAmount = transferAmount - feeAmount;

    await client.query(
      `
      UPDATE balances
      SET 
        ${sourceColumn} = ${sourceColumn} - $1,
        main_balance = main_balance + $2,
        updated_at = NOW()
      WHERE user_id = $3
      `,
      [transferAmount, finalAmount, userId]
    );

    await client.query(
      `
      INSERT INTO transactions
      (user_id, type, balance_type, amount, description)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        'transfer_to_main',
        from_balance,
        transferAmount,
        `Перевод с ${from_balance} баланса на основной. Комиссия: ${feeAmount} USDT`,
      ]
    );

    if (feeAmount > 0) {
      await client.query(
        `
        INSERT INTO transactions
        (user_id, type, balance_type, amount, description)
        VALUES ($1, 'transfer_fee', $2, $3, $4)
        `,
        [
          userId,
          from_balance,
          feeAmount,
          'Комиссия за перевод с рабочего баланса на основной',
        ]
      );
    }

    const updatedBalanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Средства успешно переведены на основной баланс',
      transfer: {
        from_balance,
        amount: transferAmount,
        fee_percent: feePercent,
        fee_amount: feeAmount,
        final_amount: finalAmount,
      },
      balances: updatedBalanceResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Transfer to main error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка перевода средств',
    });
  } finally {
    client.release();
  }
});

module.exports = router;