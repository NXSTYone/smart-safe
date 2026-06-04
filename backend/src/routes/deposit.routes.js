const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(express.json());

const MIN_DEPOSIT_AMOUNT = 10;
const CURRENCY = 'USDT';

const NETWORKS = {
  TRC20: {
    apiNetwork: 'trx',
    dbNetwork: 'TRC20',
    title: 'USDT TRC20',
  },
  BEP20: {
    apiNetwork: 'bsc',
    dbNetwork: 'BEP20',
    title: 'USDT BEP20',
  },
};

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

function getStatusUrl() {
  return (
    process.env.CRYPTOCURRENCYAPI_STATUS_URL ||
    process.env.DEPOSIT_STATUS_URL ||
    process.env.PUBLIC_API_URL ||
    ''
  );
}

function normalizeStatusUrl(value) {
  if (!value) return null;

  if (value.endsWith('/api/ipn/cryptocurrency')) {
    return value;
  }

  return `${value.replace(/\/$/, '')}/api/ipn/cryptocurrency`;
}

function normalizeNetwork(network) {
  const normalized = String(network || '').trim().toUpperCase();
  return NETWORKS[normalized] ? normalized : null;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getIpnValue(req, key) {
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
    return req.body[key];
  }

  if (req.query && Object.prototype.hasOwnProperty.call(req.query, key)) {
    return req.query[key];
  }

  return undefined;
}

async function requestPaymentAddress({ network, label, uniqueId }) {
  const cryptoConfig = getCryptoApiConfig();
  const networkConfig = NETWORKS[network];
  const statusUrl = normalizeStatusUrl(getStatusUrl());

  const params = {
    key: cryptoConfig.apiKey,
    token: CURRENCY,
    label,
    uniqueID: uniqueId,
    period: 30,
    reusable: 0,
  };

  if (statusUrl) {
    params.statusURL = statusUrl;
  }

  const url = `${cryptoConfig.baseUrl}/api/${networkConfig.apiNetwork}/.give`;

  const response = await axios.get(url, {
    params,
    timeout: 20000,
  });

  const result = response.data?.result || response.data;

  if (!result || !result.address) {
    throw new Error(
      `CryptocurrencyAPI did not return payment address: ${JSON.stringify(
        response.data
      )}`
    );
  }

  return {
    address: result.address,
    publicKey: result.publicKey || null,
    providerPayload: response.data,
  };
}

router.post('/create', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const network = normalizeNetwork(req.body.network);
    const amount = toNumber(req.body.amount);

    if (!network) {
      return res.status(400).json({
        success: false,
        message: 'Выберите сеть TRC20 или BEP20',
      });
    }

    if (!amount || amount < MIN_DEPOSIT_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Минимальная сумма пополнения ${MIN_DEPOSIT_AMOUNT} USDT`,
      });
    }

    const depositId = randomUUID();
    const uniqueId = `deposit_${depositId}`;
    const label = uniqueId;

    const payment = await requestPaymentAddress({
      network,
      label,
      uniqueId,
    });

    await client.query('BEGIN');

    const depositResult = await client.query(
      `INSERT INTO payment_deposits
       (id, user_id, network, currency, amount, address, tx_hash, status, provider_payload, created_at, confirmed_at, label, unique_id)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, 'pending', $7, NOW(), NULL, $8, $9)
       RETURNING *`,
      [
        depositId,
        userId,
        network,
        CURRENCY,
        amount,
        payment.address,
        JSON.stringify(payment.providerPayload),
        label,
        uniqueId,
      ]
    );

    await client.query(
      `INSERT INTO transactions
       (user_id, type, balance_type, amount, status, description, related_id)
       VALUES ($1, 'deposit_request', 'main', $2, 'pending', $3, $4)`,
      [
        userId,
        amount,
        `Создана заявка на пополнение ${amount.toFixed(
          2
        )} USDT в сети ${network}`,
        depositId,
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Адрес для пополнения создан. Отправьте USDT на указанный адрес.',
      deposit: depositResult.rows[0],
      payment: {
        network,
        currency: CURRENCY,
        amount,
        address: payment.address,
        label,
        unique_id: uniqueId,
        expires_in_minutes: 30,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Create deposit error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка создания заявки на пополнение',
    });
  } finally {
    client.release();
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM payment_deposits
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      deposits: result.rows,
    });
  } catch (error) {
    console.error('My deposits error:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка получения заявок на пополнение',
    });
  }
});

module.exports = router;