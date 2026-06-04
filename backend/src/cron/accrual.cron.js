const cron = require('node-cron');
const pool = require('../config/db');

async function calculateCurrentBoost(client, userId, planCode, referralBoostPercent) {
  const result = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM users ref
    JOIN user_deposits rd ON rd.user_id = ref.id
    JOIN safe_plans sp ON sp.id = rd.plan_id
    WHERE ref.invited_by = $1
      AND sp.code = $2
      AND rd.status = 'active'
    `,
    [userId, planCode]
  );

  const activeRefsCount = Number(result.rows[0]?.count || 0);
  const boostPercent = activeRefsCount * Number(referralBoostPercent || 0);

  return {
    activeRefsCount,
    boostPercent,
  };
}

cron.schedule('* * * * *', async () => {
  const client = await pool.connect();

  try {
    console.log('Accrual cron started:', new Date().toISOString());

    await client.query('BEGIN');

    const depositsResult = await client.query(`
      SELECT 
        ud.*,
        sp.code AS plan_code,
        sp.name AS plan_name,
        sp.daily_percent AS base_daily_percent,
        sp.referral_boost_percent
      FROM user_deposits ud
      JOIN safe_plans sp ON sp.id = ud.plan_id
      WHERE ud.status = 'active'
        AND ud.next_accrual_at <= NOW()
      FOR UPDATE
    `);

    const deposits = depositsResult.rows;

    console.log(`Found ${deposits.length} deposits for accrual`);

    for (const deposit of deposits) {
      const { activeRefsCount, boostPercent } = await calculateCurrentBoost(
        client,
        deposit.user_id,
        deposit.plan_code,
        deposit.referral_boost_percent
      );

      const basePercent = Number(deposit.base_daily_percent || 0);
      const totalPercent = basePercent + boostPercent;

      const dailyProfit =
        (Number(deposit.amount) * Number(totalPercent)) / 100;

      let finalProfit = dailyProfit;

      const totalAfterAccrual =
        Number(deposit.earned_amount) + dailyProfit;

      if (totalAfterAccrual >= Number(deposit.max_return_amount)) {
        finalProfit =
          Number(deposit.max_return_amount) -
          Number(deposit.earned_amount);
      }

      const newEarnedAmount =
        Number(deposit.earned_amount) + finalProfit;

      const isFinished =
        newEarnedAmount >= Number(deposit.max_return_amount);

      await client.query(
        `
        UPDATE user_deposits
        SET
          daily_percent = $1,
          boost_percent = $2,
          total_percent = $3,
          earned_amount = $4,
          next_accrual_at = NOW() + INTERVAL '24 hours',
          status = $5,
          closed_at = $6,
          updated_at = NOW()
        WHERE id = $7
        `,
        [
          basePercent,
          boostPercent,
          totalPercent,
          newEarnedAmount,
          isFinished ? 'completed' : 'active',
          isFinished ? new Date() : null,
          deposit.id,
        ]
      );

      await client.query(
        `
        UPDATE balances
        SET
          working_balance = working_balance + $1,
          total_earned = total_earned + $1,
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [finalProfit, deposit.user_id]
      );

      await client.query(
        `
        INSERT INTO transactions
        (user_id, type, balance_type, amount, description, related_id)
        VALUES ($1, 'daily_profit', 'working', $2, $3, $4)
        `,
        [
          deposit.user_id,
          finalProfit,
          `Начисление прибыли ${deposit.plan_name}. Процент: ${totalPercent.toFixed(
            2
          )}% (${basePercent.toFixed(2)}% базовый + ${boostPercent.toFixed(
            2
          )}% усиление, активных партнёров: ${activeRefsCount})`,
          deposit.id,
        ]
      );

      console.log(
        `Deposit ${deposit.id} accrued ${finalProfit} USDT. Percent: ${totalPercent}%`
      );
    }

    await client.query('COMMIT');

    console.log('Accrual cron finished');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Accrual cron error:', error);
  } finally {
    client.release();
  }
});