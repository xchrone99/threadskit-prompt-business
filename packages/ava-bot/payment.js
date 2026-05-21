const db = require('./db');

const TOKEN_PACKS = [
  { id: 'starter', label: '🎒 Starter', price: 5000, tokens: 10, bonus: 0 },
  { id: 'populer', label: '🔥 Populer', price: 10000, tokens: 20, bonus: 5 },
  { id: 'power', label: '⚡ Power', price: 25000, tokens: 50, bonus: 15 },
  { id: 'max', label: '🚀 Max', price: 50000, tokens: 100, bonus: 40 },
];

const SUBSCRIPTION_PLANS = [
  { id: 'pro_monthly', label: 'Pro Bulanan', price: 49000, tokens: 0, durationDays: 30, tier: 'pro' },
  { id: 'pro_yearly', label: 'Pro Tahunan', price: 499000, tokens: 0, durationDays: 365, tier: 'pro' },
];

async function createInvoice(telegramId, packId, paymentMethod = 'QRIS') {
  const pack = TOKEN_PACKS.find(p => p.id === packId)
    || SUBSCRIPTION_PLANS.find(p => p.id === packId);

  if (!pack) throw new Error('Invalid pack ID');

  const totalTokens = pack.tokens + (pack.bonus || 0);
  const ref = `CUAN-${Date.now()}-${telegramId}`;

  db.addTransaction(
    telegramId,
    pack.tier === 'pro' ? 'subscription' : 'topup',
    pack.price,
    totalTokens,
    ref,
    paymentMethod
  );

  return {
    ref,
    price: pack.price,
    label: pack.label,
    tokens: totalTokens,
    qris: null,
    isSubscription: !!pack.tier,
  };
}

async function handlePaymentSuccess(paymentRef) {
  const txn = db.getDb().prepare('SELECT * FROM transactions WHERE payment_ref = ?').get(paymentRef);
  if (!txn || txn.status === 'success') return;

  db.updateTransactionStatus(paymentRef, 'success');

  if (txn.type === 'topup' && txn.tokens > 0) {
    db.addTokens(txn.user_id, txn.tokens);
  }

  if (txn.type === 'subscription') {
    const plan = SUBSCRIPTION_PLANS.find(p => p.price === txn.amount);
    if (plan) {
      db.getDb().prepare(`
        INSERT INTO subscriptions (user_id, tier, expires_at, status)
        VALUES (?, ?, datetime('now', '+' || ? || ' days'), 'active')
      `).run(txn.user_id, plan.tier, plan.durationDays);

      db.getDb().prepare('UPDATE users SET tier = ? WHERE id = ?').run(plan.tier, txn.user_id);
    }
  }

  if (txn.type === 'purchase_entry') {
    db.getDb().prepare('UPDATE users SET tier = ? WHERE id = ?').run('entry', txn.user_id);
  }

  return txn;
}

module.exports = {
  TOKEN_PACKS,
  SUBSCRIPTION_PLANS,
  createInvoice,
  handlePaymentSuccess,
};
