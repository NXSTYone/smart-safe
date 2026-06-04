function admin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Доступ только для администратора',
    });
  }

  next();
}

module.exports = admin;