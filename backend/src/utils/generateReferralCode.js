function generateReferralCode(telegramId) {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SS${telegramId}${random}`;
}

module.exports = generateReferralCode;