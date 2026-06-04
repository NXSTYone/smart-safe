const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const generateReferralCode = require('../utils/generateReferralCode');

const router = express.Router();

router.post('/telegram', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      telegram_id,
      telegram_username,
      first_name,
      last_name,
      referral_code,
    } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        success: false,
        message: 'telegram_id обязателен',
      });
    }

    await client.query('BEGIN');

    let userResult = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegram_id]
    );

    let user = userResult.rows[0];

    if (!user) {
      let invitedBy = null;

      if (referral_code) {
        const refResult = await client.query(
          'SELECT id FROM users WHERE referral_code = $1',
          [referral_code]
        );

        if (refResult.rows.length > 0) {
          invitedBy = refResult.rows[0].id;
        }
      }

      const newReferralCode = generateReferralCode(telegram_id);

      const createUserResult = await client.query(
        `INSERT INTO users 
        (telegram_id, telegram_username, first_name, last_name, referral_code, invited_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          telegram_id,
          telegram_username || null,
          first_name || null,
          last_name || null,
          newReferralCode,
          invitedBy,
        ]
      );

      user = createUserResult.rows[0];

      await client.query(
        `INSERT INTO balances (user_id)
         VALUES ($1)`,
        [user.id]
      );
    } else {
      await client.query(
        `UPDATE users 
         SET telegram_username = $1, first_name = $2, last_name = $3, updated_at = NOW()
         WHERE id = $4`,
        [
          telegram_username || user.telegram_username,
          first_name || user.first_name,
          last_name || user.last_name,
          user.id,
        ]
      );
    }

    if (user.is_blocked) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Аккаунт заблокирован',
      });
    }

    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1',
      [user.id]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      {
        id: user.id,
        telegram_id: user.telegram_id,
        is_admin: user.is_admin,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        telegram_username: user.telegram_username,
        first_name: user.first_name,
        last_name: user.last_name,
        referral_code: user.referral_code,
        is_admin: user.is_admin,
      },
      balances: balanceResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Telegram auth error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка авторизации',
    });
  } finally {
    client.release();
  }
});

module.exports = router;