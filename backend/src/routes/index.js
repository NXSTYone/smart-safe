const express = require('express');
const pool = require('../config/db');

const telegramRoutes = require('./telegram.routes');
const secretRoutes = require('./secret.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const safeRoutes = require('./safe.routes');
const depositRoutes = require('./deposit.routes');
const withdrawRoutes = require('./withdraw.routes');
const ipnRoutes = require('./ipn.routes');
const adminRoutes = require('./admin.routes');
const referralRoutes = require('./referral.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Safe API работает',
    time: new Date().toISOString(),
  });
});

router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT code, name, min_amount, max_amount, daily_percent, referral_boost_percent, max_multiplier, is_active FROM safe_plans ORDER BY min_amount ASC'
    );

    res.json({
      success: true,
      plans: result.rows,
    });
  } catch (error) {
    console.error('Plans error:', error);

    res.status(500).json({
      success: false,
      message: 'Ошибка получения тарифов',
    });
  }
});

router.use('/telegram', telegramRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/safe', safeRoutes);
router.use('/deposit', depositRoutes);
router.use('/withdraw', withdrawRoutes);
router.use('/ipn', ipnRoutes);
router.use('/admin', adminRoutes);
router.use('/referrals', referralRoutes);
router.use('/secret', secretRoutes);

module.exports = router;