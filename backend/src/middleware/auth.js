const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Нет токена авторизации',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Пользователь не найден',
      });
    }

    const user = result.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({
        success: false,
        message: 'Аккаунт заблокирован',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Ошибка авторизации',
    });
  }
}

module.exports = auth;