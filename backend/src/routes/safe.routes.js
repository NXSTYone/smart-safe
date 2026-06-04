const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

async function payReferralRewards(client, userId, depositId, depositAmount) {
  const levels = [
    { level: 1, percent: 10 },
    { level: 2, percent: 5 },
    { level: 3, percent: 3 },
  ];

  let currentUserId = userId;

  for (const item of levels) {
    const inviterResult = await client.query(
      `SELECT invited_by FROM users WHERE id = $1`,
      [currentUserId]
    );

    const inviterId = inviterResult.rows[0]?.invited_by;

    if (!inviterId) break;

    const rewardAmount = (depositAmount * item.percent) / 100;

    await client.query(
      `UPDATE balances
       SET referral_balance = referral_balance + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [rewardAmount, inviterId]
    );

    await client.query(
      `INSERT INTO referral_rewards
       (user_id, from_user_id, deposit_id, level, percent, amount)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [inviterId, userId, depositId, item.level, item.percent, rewardAmount]
    );

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, description, related_id)
       VALUES ($1, 'referral_reward', 'referral', $2, $3, $4)`,
      [
        inviterId,
        rewardAmount,
        `Реферальное начисление ${item.level} линии: ${item.percent}%`,
        depositId,
      ]
    );

    currentUserId = inviterId;
  }
}

router.post('/open', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { plan_code, amount } = req.body;

    const depositAmount = Number(amount);

    if (!plan_code || !depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Укажите тариф и сумму депозита',
      });
    }

    await client.query('BEGIN');

    const planResult = await client.query(
      'SELECT * FROM safe_plans WHERE code = $1 AND is_active = true',
      [plan_code]
    );

    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Тариф не найден или отключен',
      });
    }

    const plan = planResult.rows[0];

    if (depositAmount < Number(plan.min_amount) || depositAmount > Number(plan.max_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Сумма для ${plan.name}: от ${plan.min_amount} до ${plan.max_amount} USDT`,
      });
    }

    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    const balance = balanceResult.rows[0];

    if (!balance || Number(balance.main_balance) < depositAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Недостаточно средств на основном балансе',
      });
    }

    const activeSamePlanResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM user_deposits ud
       JOIN safe_plans sp ON sp.id = ud.plan_id
       WHERE ud.user_id = $1 AND sp.code = $2 AND ud.status = 'active'`,
      [userId, plan_code]
    );

    if (activeSamePlanResult.rows[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'У вас уже есть активный депозит на этом тарифе',
      });
    }

    const boostResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM users ref
       JOIN user_deposits rd ON rd.user_id = ref.id
       JOIN safe_plans sp ON sp.id = rd.plan_id
       WHERE ref.invited_by = $1
         AND sp.code = $2
         AND rd.status = 'active'`,
      [userId, plan_code]
    );

    const activeRefsCount = boostResult.rows[0].count;
    const boostPercent = activeRefsCount * Number(plan.referral_boost_percent);
    const totalPercent = Number(plan.daily_percent) + boostPercent;
    const maxReturnAmount = depositAmount * Number(plan.max_multiplier);

    const depositResult = await client.query(
      `INSERT INTO user_deposits
       (user_id, plan_id, amount, daily_percent, boost_percent, total_percent, max_return_amount, next_accrual_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '24 hours')
       RETURNING *`,
      [
        userId,
        plan.id,
        depositAmount,
        plan.daily_percent,
        boostPercent,
        totalPercent,
        maxReturnAmount,
      ]
    );

    const deposit = depositResult.rows[0];

    await client.query(
      `UPDATE balances
       SET main_balance = main_balance - $1,
           total_deposited = total_deposited + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [depositAmount, userId]
    );

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, description, related_id)
       VALUES ($1, 'open_safe', 'main', $2, $3, $4)`,
      [userId, depositAmount, `Открыт ${plan.name}`, deposit.id]
    );

    await payReferralRewards(client, userId, deposit.id, depositAmount);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${plan.name} успешно открыт`,
      deposit,
      boost: {
        active_refs_count: activeRefsCount,
        boost_percent: boostPercent,
        total_percent: totalPercent,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Open safe error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка открытия SAFE',
    });
  } finally {
    client.release();
  }
});

module.exports = router;