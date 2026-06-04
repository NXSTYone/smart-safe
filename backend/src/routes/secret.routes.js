const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

router.get('/info', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM secret_safe_settings WHERE id = 1'
    );

    res.json({
      success: true,
      secret_safe: result.rows[0],
    });
  } catch (error) {
    console.error('Secret info error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения Secret Safe',
    });
  }
});

router.post('/activate', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Введите код Secret Safe',
      });
    }

    await client.query('BEGIN');

    const codeResult = await client.query(
      `SELECT *
       FROM secret_safe_codes
       WHERE code = $1
       FOR UPDATE`,
      [code.trim()]
    );

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Код не найден',
      });
    }

    const secretCode = codeResult.rows[0];

    if (secretCode.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Этот код привязан к другому пользователю',
      });
    }

    if (secretCode.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Код уже использован или отключён',
      });
    }

    if (secretCode.expires_at && new Date(secretCode.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Срок действия кода истёк',
      });
    }

    await client.query(
      `UPDATE balances
       SET main_balance = main_balance + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [secretCode.amount, userId]
    );

    await client.query(
      `UPDATE secret_safe_codes
       SET status = 'used',
           used_at = NOW()
       WHERE id = $1`,
      [secretCode.id]
    );

    await client.query(
      `UPDATE secret_safe_settings
       SET displayed_fund = GREATEST(displayed_fund - $1, 0),
           updated_at = NOW()
       WHERE id = 1`,
      [secretCode.amount]
    );

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, description, related_id)
       VALUES ($1, 'secret_safe_bonus', 'main', $2, $3, $4)`,
      [
        userId,
        secretCode.amount,
        `Бонус Secret Safe по коду ${secretCode.code}`,
        secretCode.id,
      ]
    );

    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Secret Safe открыт. Бонус начислен на основной баланс.',
      amount: secretCode.amount,
      balances: balanceResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Secret activate error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка активации Secret Safe',
    });
  } finally {
    client.release();
  }
});

router.post('/admin/fund', auth, admin, async (req, res) => {
  try {
    const { displayed_fund } = req.body;
    const fund = Number(displayed_fund);

    if (Number.isNaN(fund) || fund < 0) {
      return res.status(400).json({
        success: false,
        message: 'Укажите корректную сумму фонда',
      });
    }

    const oldResult = await pool.query(
      'SELECT * FROM secret_safe_settings WHERE id = 1'
    );

    const result = await pool.query(
      `UPDATE secret_safe_settings
       SET displayed_fund = $1,
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [fund]
    );

    await pool.query(
      `INSERT INTO admin_logs
       (admin_id, action, old_value, new_value, comment)
       VALUES ($1, 'secret_fund_update', $2, $3, $4)`,
      [
        req.user.id,
        JSON.stringify(oldResult.rows[0]),
        JSON.stringify(result.rows[0]),
        'Изменение отображаемого фонда Secret Safe',
      ]
    );

    res.json({
      success: true,
      message: 'Фонд Secret Safe обновлён',
      secret_safe: result.rows[0],
    });
  } catch (error) {
    console.error('Secret fund update error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка обновления фонда Secret Safe',
    });
  }
});

router.post('/admin/codes', auth, admin, async (req, res) => {
  try {
    const { user_id, code, amount, expires_at } = req.body;

    const bonusAmount = Number(amount);

    if (!user_id || !code || !bonusAmount || bonusAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Укажите пользователя, код и сумму',
      });
    }

    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден',
      });
    }

    const result = await pool.query(
      `INSERT INTO secret_safe_codes
       (user_id, code, amount, expires_at, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [user_id, code.trim(), bonusAmount, expires_at || null]
    );

    await pool.query(
      `INSERT INTO admin_logs
       (admin_id, target_user_id, action, new_value, comment)
       VALUES ($1, $2, 'secret_code_create', $3, $4)`,
      [
        req.user.id,
        user_id,
        JSON.stringify(result.rows[0]),
        'Создание кода Secret Safe',
      ]
    );

    res.json({
      success: true,
      message: 'Код Secret Safe создан',
      secret_code: result.rows[0],
    });
  } catch (error) {
    console.error('Secret code create error:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Такой код уже существует',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка создания кода Secret Safe',
    });
  }
});

router.get('/admin/codes', auth, admin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ssc.*,
        u.telegram_id,
        u.telegram_username,
        u.first_name,
        u.last_name
       FROM secret_safe_codes ssc
       JOIN users u ON u.id = ssc.user_id
       ORDER BY ssc.created_at DESC`
    );

    res.json({
      success: true,
      codes: result.rows,
    });
  } catch (error) {
    console.error('Secret codes list error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения кодов Secret Safe',
    });
  }
});

module.exports = router;