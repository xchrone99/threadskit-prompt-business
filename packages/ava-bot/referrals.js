const db = require('./db');

const COMMISSION_RATES = {
  basic: 0.20,
  agency: 0.40,
};

function getCommissionRate(telegramId) {
  const user = db.getUser(telegramId);
  if (!user) return 0;
  const tier = user.tier || 'basic';
  return COMMISSION_RATES[tier] || COMMISSION_RATES.basic;
}

function processReferralPurchase(referrerId, refereeId, productTier, amountPaid) {
  const rate = getCommissionRate(referrerId);
  const commissionAmount = Math.round(amountPaid * rate);

  db.createReferral(referrerId, refereeId, productTier, commissionAmount);

  db.getDb().prepare(`
    INSERT INTO commissions (user_id, amount, referral_id, status)
    VALUES (?, ?, last_insert_rowid(), 'pending')
  `).run(referrerId, commissionAmount);

  return commissionAmount;
}

function getReferralLink(telegramId, username) {
  const botUsername = process.env.BOT_USERNAME || 'cuan_threadskit_bot';
  return `https://t.me/${botUsername}?start=ref_${telegramId}`;
}

function parseReferralParam(text) {
  if (!text || !text.startsWith('ref_')) return null;
  const id = parseInt(text.replace('ref_', ''), 10);
  return isNaN(id) ? null : id;
}

module.exports = {
  getCommissionRate,
  processReferralPurchase,
  getReferralLink,
  parseReferralParam,
};