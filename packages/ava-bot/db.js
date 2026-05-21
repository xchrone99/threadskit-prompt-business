const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cuanpilot.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    try { db.exec('ALTER TABLE users ADD COLUMN last_avatar TEXT'); } catch (e) { /* already exists */ }
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY,
      telegram_id   INTEGER UNIQUE NOT NULL,
      username      TEXT,
      first_name    TEXT,
      tier          TEXT DEFAULT 'entry',
      status        TEXT DEFAULT 'active',
      joined_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_active   TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      date          TEXT NOT NULL DEFAULT (date('now')),
      count         INTEGER DEFAULT 0,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS token_balances (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) UNIQUE,
      balance       INTEGER DEFAULT 0,
      lifetime_earned INTEGER DEFAULT 0,
      lifetime_used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      type          TEXT NOT NULL CHECK(type IN ('topup','subscription','purchase_entry','purchase_agency','generate_use')),
      amount        INTEGER,
      tokens        INTEGER,
      payment_ref   TEXT,
      payment_method TEXT,
      status        TEXT DEFAULT 'pending',
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      tier          TEXT NOT NULL CHECK(tier IN ('pro','agency')),
      started_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at    TIMESTAMP NOT NULL,
      auto_renew    BOOLEAN DEFAULT 0,
      status        TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS generation_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      avatar_id     TEXT NOT NULL,
      topic         TEXT,
      token_cost    INTEGER DEFAULT 1,
      model_used    TEXT,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function upsertUser(telegramId, username, firstName) {
  const stmt = getDb().prepare(`
    INSERT INTO users (id, telegram_id, username, first_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = COALESCE(excluded.username, users.username),
      first_name = COALESCE(excluded.first_name, users.first_name),
      last_active = CURRENT_TIMESTAMP
  `);
  stmt.run(telegramId, telegramId, username, firstName);
}

function getUser(telegramId) {
  return getDb().prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
}

function getDailyUsage(telegramId) {
  return getDb().prepare(`
    SELECT count FROM daily_usage 
    WHERE user_id = ? AND date = date('now')
  `).get(telegramId);
}

function incrementDailyUsage(telegramId) {
  const stmt = getDb().prepare(`
    INSERT INTO daily_usage (user_id, date, count) VALUES (?, date('now'), 1)
    ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
  `);
  stmt.run(telegramId);
}

function getTokenBalance(telegramId) {
  const row = getDb().prepare(`
    SELECT balance FROM token_balances WHERE user_id = ?
  `).get(telegramId);
  return row ? row.balance : 0;
}

function deductToken(telegramId, amount = 1) {
  const stmt = getDb().prepare(`
    UPDATE token_balances 
    SET balance = balance - ?, lifetime_used = lifetime_used + ?
    WHERE user_id = ? AND balance >= ?
  `);
  const result = stmt.run(amount, amount, telegramId, amount);
  return result.changes > 0;
}

function addTokens(telegramId, tokens) {
  const stmt = getDb().prepare(`
    INSERT INTO token_balances (user_id, balance, lifetime_earned)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      balance = balance + ?,
      lifetime_earned = lifetime_earned + ?
  `);
  stmt.run(telegramId, tokens, tokens, tokens, tokens);
}

function getActiveSubscription(telegramId) {
  return getDb().prepare(`
    SELECT * FROM subscriptions 
    WHERE user_id = ? AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
    ORDER BY expires_at DESC LIMIT 1
  `).get(telegramId);
}

function logGeneration(telegramId, avatarId, topic, modelUsed) {
  getDb().prepare(`
    INSERT INTO generation_log (user_id, avatar_id, topic, model_used)
    VALUES (?, ?, ?, ?)
  `).run(telegramId, avatarId, topic, modelUsed);
}

function addTransaction(telegramId, type, amount, tokens, paymentRef, paymentMethod) {
  getDb().prepare(`
    INSERT INTO transactions (user_id, type, amount, tokens, payment_ref, payment_method)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(telegramId, type, amount, tokens, paymentRef, paymentMethod);
}

function updateTransactionStatus(paymentRef, status) {
  getDb().prepare(`
    UPDATE transactions SET status = ? WHERE payment_ref = ?
  `).run(status, paymentRef);
}

module.exports = {
  getDb,
  upsertUser,
  getUser,
  getDailyUsage,
  incrementDailyUsage,
  getTokenBalance,
  deductToken,
  addTokens,
  getActiveSubscription,
  logGeneration,
  addTransaction,
  updateTransactionStatus,
};
