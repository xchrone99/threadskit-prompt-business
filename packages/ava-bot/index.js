require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { AVATARS, getAvatar } = require('./avatars');
const counter = require('./counter');
const { generateContent, OBJECTIVES } = require('./generate');
const payment = require('./payment');
const referrals = require('./referrals');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN wajib diisi di .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const userState = {};

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
bot.on('error', (err) => console.error('Bot error:', err.message));

process.on('uncaughtException', (err) => console.error('Uncaught:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err.message));

console.log('Cuan ThreadsKit Bot started');

// ========== KEYBOARDS ==========

function mainKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        ['✨ Generate Konten', '📊 Status Saya'],
        ['👤 Pilih Avatar', '💰 Top Up Token'],
        ['🔗 Referral', '📦 Beli Paket'],
        ['❓ Bantuan'],
      ],
    },
  };
}

function avatarKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: AVATARS.map(a => [{ text: a.buttonLabel, callback_data: `avatar_${a.id}` }]),
    },
  };
}

function tokenKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: payment.TOKEN_PACKS.map(p => [
        { text: `${p.label} — Rp ${(p.price / 1000).toFixed(0)}K (${p.tokens + p.bonus} token)`, callback_data: `topup_${p.id}` },
      ]),
    },
  };
}

// ========== COMMANDS ==========

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Sobat';

  db.upsertUser(chatId, msg.from.username, name);

  // Handle referral
  const refParam = match && match[1] ? match[1].trim() : null;
  if (refParam) {
    const referrerId = referrals.parseReferralParam(refParam);
    if (referrerId && referrerId !== chatId) {
      userState[chatId] = { ...(userState[chatId] || {}), referrerId };
    }
  }

  const avatarButtons = AVATARS.map(a => [{ text: a.buttonLabel, callback_data: `avatar_${a.id}` }]);

  await bot.sendMessage(chatId,
    `Halo ${name}!\n\nSelamat datang di *Cuan ThreadsKit* — bikin konten Threads pakai AI, tinggal pencet tombol.\n\nPilih avatar kamu dulu:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: avatarButtons },
    }
  );

  await bot.sendMessage(chatId, 'Atau klik menu di bawah', mainKeyboard());
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const statusMsg = counter.getStatusMessage(chatId);
  await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/generate|gen/, async (msg) => {
  const chatId = msg.chat.id;
  const user = db.getUser(chatId);
  if (!user || !user.last_avatar) {
    return bot.sendMessage(chatId, 'Pilih avatar dulu ya!', { parse_mode: 'Markdown', ...avatarKeyboard() });
  }
  await startGenerateFlow(chatId);
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  delete userState[chatId];
  await bot.sendMessage(chatId, 'Dibatalin. Balik ke menu utama.', mainKeyboard());
});

bot.onText(/\/topup/, async (msg) => {
  const chatId = msg.chat.id;
  await showTopUp(chatId);
});

bot.onText(/\/aktivasi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const key = match[1].trim().toUpperCase();

  const record = db.getActivationKey(key);
  if (!record) {
    return bot.sendMessage(chatId, 'Kode aktivasi tidak valid. Cek lagi ya.');
  }
  if (record.status !== 'unused') {
    return bot.sendMessage(chatId, 'Kode ini sudah dipakai.');
  }

  const ok = db.useActivationKey(key, chatId);
  if (!ok) {
    return bot.sendMessage(chatId, 'Gagal aktivasi. Coba lagi.');
  }

  db.setUserTier(chatId, record.tier);
  db.setUpsellEligible(chatId);

  await bot.sendMessage(chatId,
    `Selamat! Akun kamu sekarang *${record.tier.charAt(0).toUpperCase() + record.tier.slice(1)}*.\n\nKamu bisa generate konten sekarang juga!`,
    { parse_mode: 'Markdown' }
  );

  // Upsell offer — muncul SEKALI
  const upsellKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Pro Bulanan — Rp 99K', callback_data: 'buy_pro_monthly_upsell' }],
        [{ text: 'Pro Tahunan — Rp 999K', callback_data: 'buy_pro_yearly_upsell' }],
        [{ text: 'Lewati', callback_data: 'upsell_skip' }],
      ],
    },
  };

  await bot.sendMessage(chatId,
    `Ada penawaran spesial khusus pemilik Basic:\n\n` +
    `Pro Bulanan — *Rp 99K* (hemat Rp 40K)\n` +
    `Pro Tahunan — *Rp 999K* (hemat Rp 400K)\n\n` +
    `Penawaran ini *cuma sekali* — kalo dilewati, gak bakal muncul lagi.`,
    { parse_mode: 'Markdown', ...upsellKeyboard }
  );
});

bot.onText(/\/komisi/, async (msg) => {
  const chatId = msg.chat.id;
  const user = db.getUser(chatId);
  if (!user) return bot.sendMessage(chatId, 'Ketik /start dulu ya.');

  const pending = db.getTotalCommission(chatId);
  const paid = db.getPaidCommission(chatId);
  const link = referrals.getReferralLink(chatId);
  const rate = referrals.getCommissionRate(chatId) * 100;

  await bot.sendMessage(chatId,
    `Komisi Kamu\n\n` +
    `Rate komisi: ${rate}%\n` +
    `Tertunda: Rp ${pending.toLocaleString()}\n` +
    `Dibayar: Rp ${paid.toLocaleString()}\n\n` +
    `Share link ini:\n${link}\n\n` +
    `Kalo ada yang bel lewat link kamu, komisi otomatis masuk.`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
});

bot.onText(/\/beli (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const productId = match[1].trim();
  try {
    const invoice = await payment.createInvoice(chatId, productId);
    await bot.sendMessage(chatId,
      `Pembayaran ${invoice.label}\n\nTotal: Rp ${(invoice.price / 1000).toFixed(0)}K\nReferensi: ${invoice.ref}\n\nHubungi admin buat konfirmasi pembayaran.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    await bot.sendMessage(chatId, 'Produk tidak ditemukan.');
  }
});

// ========== MESSAGE HANDLERS ==========

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const state = userState[chatId];
  if (state && state.waitingTopic) {
    return handleTopicInput(msg);
  }
  if (state && state.awaitingParameter) {
    return handleParameterInput(msg);
  }

  switch (text) {
    case '✨ Generate Konten':
      return startGenerateFlow(chatId);
    case '📊 Status Saya':
      return bot.sendMessage(chatId, counter.getStatusMessage(chatId), { parse_mode: 'Markdown' });
    case '👤 Pilih Avatar':
      return bot.sendMessage(chatId, 'Pilih avatar kamu:', avatarKeyboard());
    case '💰 Top Up Token':
      return showTopUp(chatId);
    case '🔗 Referral':
      return showReferral(chatId);
    case '📦 Beli Paket':
      return showProducts(chatId);
    case '❓ Bantuan':
      return showHelp(chatId);
    default:
      return bot.sendMessage(chatId, 'Gunakan menu di bawah ya', mainKeyboard());
  }
});

async function showReferral(chatId) {
  const link = referrals.getReferralLink(chatId);
  const rate = referrals.getCommissionRate(chatId) * 100;
  await bot.sendMessage(chatId,
    `Ajak temen, dapet komisi!\n\n` +
    `Rate kamu: ${rate}%\n` +
    `Share link ini:\n${link}\n\n` +
    `Temen klik link → beli paket → kamu dapet komisi otomatis.`,
    { parse_mode: 'Markdown' }
  );
}

async function showProducts(chatId) {
  const isUpsell = db.isUpsellAvailable(chatId);
  const keyboard = payment.getProductsKeyboard(isUpsell);
  await bot.sendMessage(chatId,
    `Pilih Paket\n\n` +
    `Basic: Rp 69K (sekali) — 21x generate/minggu\n` +
    `Pro: Rp 139K/bln — 105x generate/minggu + broadcast harian\n` +
    `Agency: Rp 999K (sekali) — 210x generate/minggu + komisi 40%`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

async function showHelp(chatId) {
  await bot.sendMessage(chatId,
    `Bantuan Cuan ThreadsKit\n\n` +
    `Apa itu?\nBot yang bantu kamu bikin konten Threads pake AI.\n\n` +
    `5 Avatar:\n` +
    `${AVATARS.map(a => `${a.emoji} ${a.name} — ${a.niche}`).join('\n')}\n\n` +
    `Batas Pemakaian (per minggu):\n` +
    `Basic: 21x generate\n` +
    `Pro: 105x generate\n` +
    `Agency: 210x generate\n\n` +
    `Token:\n` +
    `${payment.TOKEN_PACKS.map(p => `Rp ${(p.price / 1000).toFixed(0)}K = ${p.tokens + p.bonus} token`).join('\n')}\n\n` +
    `/aktivasi [kode] — Aktivasi kode pembelian\n` +
    `/komisi — Cek komisi referral\n` +
    `/beli [produk] — Beli paket (basic/pro/agency)`,
    { parse_mode: 'Markdown' }
  );
}

async function showTopUp(chatId) {
  await bot.sendMessage(chatId,
    'Top Up Token\n\n1 token = 1 kali generate\nToken gak pernah kedaluwarsa.\n\nPilih paket:',
    { parse_mode: 'Markdown', ...tokenKeyboard() }
  );
}

async function askForTopic(chatId, avatarId) {
  const user = db.getUser(chatId);
  if (!user) {
    return bot.sendMessage(chatId, 'Ketik /start dulu ya.');
  }

  avatarId = avatarId || user.last_avatar;
  if (!avatarId) {
    return bot.sendMessage(chatId, 'Pilih avatar dulu:', avatarKeyboard());
  }

  const avatar = getAvatar(avatarId);
  if (!avatar) {
    return bot.sendMessage(chatId, 'Avatar tidak ditemukan. Pilih ulang:', avatarKeyboard());
  }

  db.getDb().prepare('UPDATE users SET last_avatar = ? WHERE id = ?').run(avatarId, chatId);

  userState[chatId] = {
    waitingTopic: true,
    avatarId,
    isPro: (user.tier === 'pro' || user.tier === 'agency'),
  };

  await bot.sendMessage(chatId,
    `Topik konten hari ini?\n\nAvatar: ${avatar.emoji} ${avatar.name}\nNiche: ${avatar.niche}\n\nKetik topiknya, atau kirim *-* buat random.`,
    { parse_mode: 'Markdown' }
  );
}

async function startGenerateFlow(chatId) {
  const check = counter.checkGenerateAvailability(chatId);
  if (!check.ok) {
    const msg = check.reason === 'token_habis'
      ? `Jatah minggu ini habis. Beli token buat lanjut:`
      : `Kamu belum terdaftar. Ketik /start dulu ya.`;
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    if (check.reason === 'token_habis') {
      await showTopUp(chatId);
    }
    return;
  }

  const user = db.getUser(chatId);
  if (!user || !user.last_avatar) {
    return bot.sendMessage(chatId, 'Pilih avatar dulu:', { parse_mode: 'Markdown', ...avatarKeyboard() });
  }

  await askForTopic(chatId);
}

async function handleTopicInput(msg) {
  const chatId = msg.chat.id;
  const state = userState[chatId];
  if (!state || !state.waitingTopic) return;

  const topic = msg.text;
  if (!topic || topic.startsWith('/')) return;

  const topicClean = topic === '-' ? '' : topic;

  if (state.isPro) {
    userState[chatId] = { ...state, waitingTopic: false, awaitingObjective: true, topic: topicClean };
    return showObjectiveSelection(chatId);
  }

  delete userState[chatId];
  await bot.sendMessage(chatId, 'Lagih nulis...');
  await doGenerate(chatId, state.avatarId, topicClean, false);
}

async function handleParameterInput(msg) {
  const chatId = msg.chat.id;
  const state = userState[chatId];
  if (!state || !state.awaitingParameter) return;

  const paramText = msg.text;
  if (!paramText || paramText.startsWith('/')) return;

  delete userState[chatId];

  const customParams = {};
  if (paramText && paramText !== '-') {
    const matchAudience = paramText.match(/(?:target|audiens)\s*[:]\s*([^,]+)/i);
    if (matchAudience) customParams.audience = matchAudience[1].trim();
    const matchMood = paramText.match(/(?:mood|nada|gaya)\s*[:]\s*([^,]+)/i);
    if (matchMood) customParams.mood = matchMood[1].trim();
    const matchLength = paramText.match(/(\d+)\s*post/i);
    if (matchLength) customParams.length = matchLength[1] + ' post';
    if (/curiosity|hook/i.test(paramText)) customParams.format = 'curiosity';
    if (!matchAudience && !matchMood && !matchLength && !customParams.format && paramText.length < 100) {
      customParams.audience = paramText.trim();
    }
  }

  await bot.sendMessage(chatId, 'Lagih nulis...');
  await doGenerate(chatId, state.avatarId, state.topic, true, state.objective || null, customParams);
}

async function showObjectiveSelection(chatId) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        ...Object.entries(OBJECTIVES).map(([key, obj]) => [
          { text: `${obj.emoji} ${obj.label} — ${obj.desc}`, callback_data: `obj_${key}` }
        ]),
        [{ text: 'Skip (default)', callback_data: 'obj_skip' }],
      ],
    },
  };
  await bot.sendMessage(chatId,
    'Pilih objektif konten kamu:\n\n' +
    '• Engagement — biar banyak komen\n' +
    '• Reach — biar banyak dilihat\n' +
    '• Community — bangun pengikut setia\n' +
    '• Authority — jadi trusted expert\n' +
    '• Selling — soft selling affiliate',
    keyboard
  );
}

// ========== CALLBACK QUERIES ==========

bot.on('callback_query', async (query) => {
  try {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);

    if (data.startsWith('avatar_')) {
      const avatarId = data.replace('avatar_', '');
      const avatar = getAvatar(avatarId);
      if (!avatar) return;
      db.getDb().prepare('UPDATE users SET last_avatar = ? WHERE id = ?').run(avatarId, chatId);
      await askForTopic(chatId, avatarId);
    }

    if (data === 'gen_topic') {
      await askForTopic(chatId);
    }

    if (data === 'gen_back') {
      delete userState[chatId];
      await bot.sendMessage(chatId, 'Balik ke menu utama.', mainKeyboard());
    }

    if (data === 'gen_switch_avatar') {
      delete userState[chatId];
      await bot.sendMessage(chatId, 'Ganti Avatar — pilih avatar lain:', { parse_mode: 'Markdown', ...avatarKeyboard() });
    }

    if (data.startsWith('topup_')) {
    const packId = data.replace('topup_', '');
    try {
      const invoice = await payment.createInvoice(chatId, packId);
      await bot.sendMessage(chatId,
        `Pembayaran ${invoice.label}\n\nTotal: Rp ${(invoice.price / 1000).toFixed(0)}K\nDapat: ${invoice.tokens} token\nReferensi: ${invoice.ref}\n\nHubungi admin buat konfirmasi.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await bot.sendMessage(chatId, 'Error bikin invoice. Coba lagi.');
    }
  }

  // Buy products
  if (data.startsWith('buy_')) {
    const productId = data.replace('buy_', '');
    try {
      const invoice = await payment.createInvoice(chatId, productId);
      const type = invoice.isSubscription ? ' /langganan' : '';
      await bot.sendMessage(chatId,
        `Pembayaran ${invoice.label}\n\nTotal: Rp ${(invoice.price / 1000).toFixed(0)}K${type}\nReferensi: ${invoice.ref}\n\nHubungi admin buat konfirmasi.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await bot.sendMessage(chatId, 'Error. Coba lagi.');
    }
  }

  if (data === 'upsell_skip') {
    db.markUpsellUsed(chatId);
    await bot.sendMessage(chatId, 'Oke, penawaran spesial ini udah lewat. Kapan-kapan kalo mau upgrade, harga normal ya.', mainKeyboard());
  }

  if (data.startsWith('obj_')) {
    const objective = data.replace('obj_', '');
    const state = userState[chatId];
    if (!state) return;
    userState[chatId] = { ...state, objective: objective === 'skip' ? null : objective, awaitingObjective: false, awaitingCustomizeChoice: true };
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Customize Parameter', callback_data: 'custom_yes' }],
          [{ text: 'Generate Sekarang', callback_data: 'custom_no' }],
        ],
      },
    };
    await bot.sendMessage(chatId,
      'Mau atur parameter tambahan?\n\n' +
      'Contoh: target audiens, mood, jumlah post.\n\n' +
      'Atau langsung generate aja.',
      keyboard
    );
  }

  if (data === 'custom_yes') {
    const state = userState[chatId];
    if (!state) return;
    userState[chatId] = { ...state, awaitingCustomizeChoice: false, awaitingParameter: true };
    await bot.sendMessage(chatId,
      'Ketik parameter tambahan. Contoh:\n\n' +
      '"target: ibu muda, mood: inspiratif, 5 post"\n\n' +
      'Atau ketik "curiosity" buat pake format hook + build tension + pertanyaan.\n\n' +
      'Ketik "-" buat skip.');
  }

  if (data === 'custom_no') {
    const state = userState[chatId];
    if (!state) return;
    delete userState[chatId];
    await bot.sendMessage(chatId, 'Lagih nulis...');
    await doGenerate(chatId, state.avatarId, state.topic, true, state.objective || null, {});
  }

  if (data === 'done') {
    delete userState[chatId];
    await bot.sendMessage(chatId, 'Udah di-copy? Tinggal paste ke Threads ya!', mainKeyboard());
  }
  } catch (e) {
    console.error('Callback error:', e.message);
  }
});

// ========== GENERATE ==========

async function doGenerate(chatId, avatarId, topic, isPro, objective = null, customParams = {}) {
  const user = db.getUser(chatId);
  avatarId = avatarId || user?.last_avatar;
  if (!avatarId) return bot.sendMessage(chatId, 'Pilih avatar dulu.');

  const avatar = getAvatar(avatarId);
  if (!avatar) return bot.sendMessage(chatId, 'Avatar gak ditemukan.');

  isPro = (isPro !== undefined) ? isPro : (user?.tier === 'pro' || user?.tier === 'agency');

  const check = counter.checkGenerateAvailability(chatId);
  if (!check.ok) {
    const msg = check.reason === 'token_habis'
      ? 'Jatah gratis habis. Ketik /topup buat beli token.'
      : 'Jatah generate habis. Ketik /topup buat beli token.';
    return bot.sendMessage(chatId, msg);
  }

  const success = counter.consumeGenerate(chatId, avatarId, topic || '', isPro ? 'premium' : 'free');
  if (!success) {
    return bot.sendMessage(chatId, 'Gagal. Coba lagi.');
  }

  try {
    const result = await generateContent(avatar, topic || '', isPro, objective, customParams);

    const header =
      `${avatar.emoji} ${avatar.name}\n` +
      `${topic ? 'Topik: ' + topic : 'Random (trending)'}\n` +
      `${result.model}\n\n`;

    const threadText = result.posts.map((p, i) => `${i + 1}. ${p}`).join('\n\n');
    const footer = `\n\nCopy semua post di atas, paste ke Threads!`;

    const remaining = check.free ? check.remaining : 'token';

    await bot.sendMessage(chatId, header + threadText + footer, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Lagi (avatar sama)', callback_data: 'gen_topic' }],
          [{ text: 'Ganti Avatar', callback_data: 'gen_switch_avatar' }],
          [{ text: 'Selesai', callback_data: 'done' }],
        ],
      },
    });
  } catch (e) {
    console.error('Generate error:', e.message);
    await bot.sendMessage(chatId, `Gagal generate konten.\n\nCoba lagi nanti atau pilih avatar lain.`);
  }
}

// ========== GRACEFUL SHUTDOWN ==========

process.on('SIGINT', () => {
  console.log('\nBot stopped');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  process.exit(0);
});