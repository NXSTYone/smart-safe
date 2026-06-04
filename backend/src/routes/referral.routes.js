const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

function getUserDisplayName(user) {
  if (user.telegram_username) return `@${user.telegram_username}`;
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return `ID ${String(user.telegram_id || '').slice(0, 6)}***`;
}

function getSafeColor(planCode) {
  if (planCode === 'basic') return '#39FF14';
  if (planCode === 'standard') return '#00E5FF';
  if (planCode === 'vip') return '#7C3AED';
  return '#00E5FF';
}

async function getLevels(userId) {
  const level1 = await pool.query(
    `SELECT id, telegram_id, telegram_username, first_name, last_name, created_at
     FROM users
     WHERE invited_by = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const level1Ids = level1.rows.map((u) => u.id);

  let level2 = { rows: [] };
  let level3 = { rows: [] };

  if (level1Ids.length > 0) {
    level2 = await pool.query(
      `SELECT id, telegram_id, telegram_username, first_name, last_name, invited_by, created_at
       FROM users
       WHERE invited_by = ANY($1::uuid[])
       ORDER BY created_at DESC`,
      [level1Ids]
    );
  }

  const level2Ids = level2.rows.map((u) => u.id);

  if (level2Ids.length > 0) {
    level3 = await pool.query(
      `SELECT id, telegram_id, telegram_username, first_name, last_name, invited_by, created_at
       FROM users
       WHERE invited_by = ANY($1::uuid[])
       ORDER BY created_at DESC`,
      [level2Ids]
    );
  }

  return {
    level_1: level1.rows,
    level_2: level2.rows,
    level_3: level3.rows,
  };
}

async function getDepositsForUsers(userIds) {
  if (!userIds.length) return [];

  const result = await pool.query(
    `SELECT 
      ud.user_id,
      ud.amount,
      ud.status,
      ud.earned_amount,
      ud.max_return_amount,
      sp.code AS plan_code,
      sp.name AS plan_name
     FROM user_deposits ud
     JOIN safe_plans sp ON sp.id = ud.plan_id
     WHERE ud.user_id = ANY($1::uuid[])
     ORDER BY ud.created_at DESC`,
    [userIds]
  );

  return result.rows;
}

function buildLine(lineNumber, users, allDeposits, color) {
  const userIds = users.map((u) => u.id);

  const lineDeposits = allDeposits.filter((d) =>
    userIds.includes(d.user_id)
  );

  const activeUsers = new Set(
    lineDeposits
      .filter((d) => d.status === 'active')
      .map((d) => d.user_id)
  );

  const turnover = lineDeposits.reduce(
    (sum, d) => sum + Number(d.amount || 0),
    0
  );

  const members = users.map((user) => {
    const deposits = allDeposits
      .filter((d) => d.user_id === user.id)
      .map((d) => ({
        safe: d.plan_name,
        plan_code: d.plan_code,
        deposit: `${Number(d.amount || 0).toFixed(2)} USDT`,
        amount: Number(d.amount || 0),
        status: d.status,
        color: getSafeColor(d.plan_code),
      }));

    const totalDeposit = deposits.reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0
    );

    const hasActive = deposits.some((d) => d.status === 'active');

    return {
      id: user.id,
      user: getUserDisplayName(user),
      status: hasActive ? 'Активен' : 'Без активного сейфа',
      color: hasActive ? color : '#7E8DAA',
      total_deposit: totalDeposit,
      deposits,
      created_at: user.created_at,
    };
  });

  return {
    line: `${lineNumber} линия`,
    level: lineNumber,
    partners: `${users.length} партнёров`,
    partners_count: users.length,
    active_partners_count: activeUsers.size,
    turnover: `${turnover.toFixed(2)} USDT`,
    turnover_amount: turnover,
    color,
    members,
  };
}

router.get('/structure', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const levels = await getLevels(userId);

    const rewards = await pool.query(
      `SELECT 
        rr.*,
        u.telegram_username,
        u.first_name,
        u.last_name
       FROM referral_rewards rr
       JOIN users u ON u.id = rr.from_user_id
       WHERE rr.user_id = $1
       ORDER BY rr.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      referral_link: `https://t.me/smart_safe_crypto_bot/app?startapp=${req.user.referral_code}`,
      referral_code: req.user.referral_code,
      structure: levels,
      stats: {
        level_1_count: levels.level_1.length,
        level_2_count: levels.level_2.length,
        level_3_count: levels.level_3.length,
        total_count:
          levels.level_1.length + levels.level_2.length + levels.level_3.length,
      },
      rewards: rewards.rows,
    });
  } catch (error) {
    console.error('Referral structure error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения реферальной структуры',
    });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const levels = await getLevels(userId);

    const allUsers = [
      ...levels.level_1,
      ...levels.level_2,
      ...levels.level_3,
    ];

    const allUserIds = allUsers.map((u) => u.id);
    const allDeposits = await getDepositsForUsers(allUserIds);

    const rewardsResult = await pool.query(
      `SELECT 
        rr.*,
        u.telegram_username,
        u.first_name,
        u.last_name
       FROM referral_rewards rr
       JOIN users u ON u.id = rr.from_user_id
       WHERE rr.user_id = $1
       ORDER BY rr.created_at DESC`,
      [userId]
    );

    const rewards = rewardsResult.rows;

    const totalReferralIncome = rewards.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    const totalStructureTurnover = allDeposits.reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0
    );

    const activePartnerIds = new Set(
      allDeposits
        .filter((d) => d.status === 'active')
        .map((d) => d.user_id)
    );

    const basicActive = allDeposits.filter(
      (d) => d.status === 'active' && d.plan_code === 'basic'
    ).length;

    const standardActive = allDeposits.filter(
      (d) => d.status === 'active' && d.plan_code === 'standard'
    ).length;

    const vipActive = allDeposits.filter(
      (d) => d.status === 'active' && d.plan_code === 'vip'
    ).length;

    const lines = [
      buildLine(1, levels.level_1, allDeposits, '#39FF14'),
      buildLine(2, levels.level_2, allDeposits, '#00E5FF'),
      buildLine(3, levels.level_3, allDeposits, '#7C3AED'),
    ];

    const recentPartners = allUsers
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map((user) => {
        const deposits = allDeposits.filter((d) => d.user_id === user.id);
        const activeDeposit = deposits.find((d) => d.status === 'active');
        const totalDeposit = deposits.reduce(
          (sum, d) => sum + Number(d.amount || 0),
          0
        );

        return {
          id: user.id,
          user: getUserDisplayName(user),
          safe: activeDeposit?.plan_name || 'Нет активного сейфа',
          deposit: `${totalDeposit.toFixed(2)} USDT`,
          status: activeDeposit ? 'Активен' : 'Без активного сейфа',
          color: activeDeposit ? getSafeColor(activeDeposit.plan_code) : '#7E8DAA',
          created_at: user.created_at,
        };
      });

    res.json({
      success: true,
      referral_link: `https://t.me/smart_safe_crypto_bot/app?startapp=${req.user.referral_code}`,
      referral_code: req.user.referral_code,

      stats: {
        total_partners: allUsers.length,
        active_partners: activePartnerIds.size,
        structure_turnover: totalStructureTurnover,
        referral_income: totalReferralIncome,
      },

      tariff_boosts: [
        {
          name: 'BASIC SAFE',
          plan_code: 'basic',
          active_partners: basicActive,
          boost: basicActive * 0.1,
          note: '+0.1% за активного партнёра',
          color: '#39FF14',
        },
        {
          name: 'STANDARD SAFE',
          plan_code: 'standard',
          active_partners: standardActive,
          boost: standardActive * 0.3,
          note: '+0.3% за активного партнёра',
          color: '#00E5FF',
        },
        {
          name: 'VIP SAFE',
          plan_code: 'vip',
          active_partners: vipActive,
          boost: vipActive * 0.5,
          note: '+0.5% за активного партнёра',
          color: '#7C3AED',
        },
      ],

      lines,
      recent_partners: recentPartners,
      rewards,
    });
  } catch (error) {
    console.error('Referral dashboard error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения партнёрской панели',
    });
  }
});

module.exports = router;