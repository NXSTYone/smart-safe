const express = require('express');
const router = express.Router();
const BOT_USERNAME = 'smart_safe_crypto_bot';
const MINI_APP_SHORT_NAME = 'app';
router.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message;
    if (!message || !message.chat || !message.text) {
      return res.json({ ok: true });
    }
    const chatId = message.chat.id;
    const text = message.text || '';
    if (!text.startsWith('/start')) {
      return res.json({ ok: true });
    }
    const parts = text.split(' ');
    const referralCode = parts[1] || '';
    const appUrl = referralCode
      ? `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT_NAME}?startapp=${encodeURIComponent(referralCode)}`
      : `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT_NAME}`;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Добро пожаловать в SMART SAFE. Нажмите кнопку ниже, чтобы открыть приложение.',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Открыть SMART SAFE',
                url: appUrl,
              },
            ],
          ],
        },
      }),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return res.json({ ok: true });
  }
});
module.exports = router;
