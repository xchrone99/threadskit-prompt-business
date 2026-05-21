const db = require('./db');

const FREE_DAILY_LIMIT = 3;
const AGENCY_DAILY_LIMIT = 30;

function checkGenerateAvailability(telegramId) {
  const user = db.getUser(telegramId);
  if (!user) return { ok: false, reason: 'unregistered' };

  db.upsertUser(telegramId, user.username, user.first_name);

  if (user.tier === 'pro') {
    const sub = db.getActiveSubscription(telegramId);
    if (sub) return { ok: true, tier: 'pro', unlimited: true };
  }

  if (user.tier === 'agency') {
    const sub = db.getActiveSubscription(telegramId);
    if (sub) {
      const usage = db.getDailyUsage(telegramId);
      const used = usage ? usage.count : 0;
      if (used < AGENCY_DAILY_LIMIT) {
        return { ok: true, tier: 'agency', free: true, remaining: AGENCY_DAILY_LIMIT - used, unlimited: false };
      }
      const balance = db.getTokenBalance(telegramId);
      if (balance > 0) return { ok: true, tier: 'agency', token: true, remaining: balance, unlimited: false };
      return { ok: false, tier: 'agency', reason: 'token_habis' };
    }
  }

  const usage = db.getDailyUsage(telegramId);
  const used = usage ? usage.count : 0;

  if (used < FREE_DAILY_LIMIT) {
    return { ok: true, tier: 'entry', free: true, remaining: FREE_DAILY_LIMIT - used, unlimited: false };
  }

  const balance = db.getTokenBalance(telegramId);
  if (balance > 0) {
    return { ok: true, tier: 'entry', token: true, remaining: balance, unlimited: false };
  }

  return { ok: false, tier: 'entry', reason: 'token_habis' };
}

function consumeGenerate(telegramId, avatarId, topic, modelUsed) {
  const check = checkGenerateAvailability(telegramId);
  if (!check.ok) return false;

  if (check.unlimited) {
    db.logGeneration(telegramId, avatarId, topic, modelUsed);
    return true;
  }

  if (check.free) {
    db.incrementDailyUsage(telegramId);
    db.logGeneration(telegramId, avatarId, topic, modelUsed);
    return true;
  }

  if (check.token) {
    const deducted = db.deductToken(telegramId);
    if (deducted) {
      db.incrementDailyUsage(telegramId);
      db.logGeneration(telegramId, avatarId, topic, modelUsed);
      db.addTransaction(telegramId, 'generate_use', null, 1, null, null);
      return true;
    }
  }

  return false;
}

function getStatusMessage(telegramId) {
  const check = checkGenerateAvailability(telegramId);
  const balance = db.getTokenBalance(telegramId);

  if (check.ok && check.unlimited) {
    return '🏆 *Pro Unlimited* — Kamu bisa generate tanpa batas!';
  }

  let msg = '';

  if (!check.ok && check.reason === 'token_habis') {
    msg = '⚠️ *Token kamu habis!*\n\nKamu udah pake 3x gratis hari ini. Beli token buat lanjut generate:\n';
    const amounts = [
      { label: 'Rp 5K = 10 token', tokens: 10, price: 5000 },
      { label: 'Rp 10K = 25 token', tokens: 25, price: 10000 },
      { label: 'Rp 25K = 65 token', tokens: 65, price: 25000 },
      { label: 'Rp 50K = 140 token', tokens: 140, price: 50000 },
    ];
    msg += amounts.map(a => `• ${a.label}`).join('\n');
    return msg;
  }

  msg += `📊 *Sisa hari ini:* ${check.free ? check.remaining : 0}x gratis`;
  if (balance > 0) {
    msg += `\n💰 *Token:* ${balance}`;
  }
  if (check.ok && !check.unlimited) {
    msg += '\n\nTap *✨ Generate* untuk mulai!';
  }

  return msg;
}

module.exports = {
  checkGenerateAvailability,
  consumeGenerate,
  getStatusMessage,
  FREE_DAILY_LIMIT,
};
