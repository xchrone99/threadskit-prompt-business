require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { AVATARS, getAvatar } = require('./avatars');
const counter = require('./counter');
const { generateContent } = require('./generate');
const payment = require('./payment');

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

console.log('🤖 Cuan ThreadsKit Bot started');

// ========== KEYBOARDS ==========

function mainKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        ['✨ Generate Konten', '📊 Status Saya'],
        ['👤 Pilih Avatar', '💰 Top Up Token'],
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

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Sobat';

  db.upsertUser(chatId, msg.from.username, name);

  const avatarButtons = AVATARS.map(a => [{ text: a.buttonLabel, callback_data: `avatar_${a.id}` }]);

  await bot.sendMessage(chatId,
    `🎉 *Halo ${name}!*\n\nSelamat datang di *Cuan ThreadsKit* — bikin konten Threads pakai AI, tinggal pencet tombol.\n\n📌 *Pertama, pilih avatar kamu dulu:*`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: avatarButtons },
    }
  );

  await bot.sendMessage(chatId, 'Atau klik menu di bawah ⬇️', mainKeyboard());
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
    return bot.sendMessage(chatId, '📌 *Pilih avatar dulu ya!*', { parse_mode: 'Markdown', ...avatarKeyboard() });
  }
  await startGenerateFlow(chatId);
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  delete userState[chatId];
  await bot.sendMessage(chatId, '👌 Dibatalin. Balik ke menu utama.', mainKeyboard());
});

bot.onText(/\/topup/, async (msg) => {
  const chatId = msg.chat.id;
  await showTopUp(chatId);
});

async function showTopUp(chatId) {
  await bot.sendMessage(chatId,
    '💰 *Top Up Token*\n\n1 token = 1 kali generate konten\nToken gak pernah kedaluwarsa.\n\nPilih paket:',
    { parse_mode: 'Markdown', ...tokenKeyboard() }
  );
}

// ========== MESSAGE HANDLERS ==========

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const state = userState[chatId];
  if (state && state.waitingTopic) {
    return handleTopicInput(msg);
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
    case '❓ Bantuan':
      return showHelp(chatId);
    default:
      return bot.sendMessage(chatId, 'Gunakan menu di bawah ya ⬇️', mainKeyboard());
  }
});

async function showHelp(chatId) {
  await bot.sendMessage(chatId,
    `❓ *Bantuan Cuan ThreadsKit*

🧑‍🌾 *Apa itu Cuan ThreadsKit?*
Bot Telegram yang bantu kamu bikin konten Threads pakai AI. Tinggal pilih avatar, masukkin topik, generate, copy, posting.

🎭 *5 Avatar:*
${AVATARS.map(a => `• ${a.emoji} ${a.name} — ${a.niche}`).join('\n')}

📊 *Batas Pemakaian:*
• Gratis: 3x generate per hari
• Token: beli tambahan kalo abis
• Pro: unlimited generate

💰 *Harga Token:*
${payment.TOKEN_PACKS.map(p => `• Rp ${(p.price / 1000).toFixed(0)}K = ${p.tokens + p.bonus} token`).join('\n')}

💡 *Tips:*
• Makin sering input topik sendiri, makin relevan hasilnya
• Coba avatar beda-beda buat variasi konten`,
    { parse_mode: 'Markdown' }
  );
}

async function askForTopic(chatId, avatarId) {
  const user = db.getUser(chatId);
  if (!user) {
    return bot.sendMessage(chatId, '❌ Ketik /start dulu ya.');
  }

  avatarId = avatarId || user.last_avatar;
  if (!avatarId) {
    return bot.sendMessage(chatId, '🎭 Pilih avatar dulu:', avatarKeyboard());
  }

  const avatar = getAvatar(avatarId);
  db.getDb().prepare('UPDATE users SET last_avatar = ? WHERE id = ?').run(avatarId, chatId);

  userState[chatId] = {
    waitingTopic: true,
    avatarId,
    isPro: (user.tier === 'pro' || user.tier === 'agency'),
  };

  await bot.sendMessage(chatId,
    `📝 *Topik konten hari ini?*\n\nAvatar: ${avatar.emoji} ${avatar.name}\nNiche: ${avatar.niche}\n\nKetik topiknya, atau kirim *-* buat random.\nKetik /cancel buat batal.`,
    { parse_mode: 'Markdown' }
  );
}

async function startGenerateFlow(chatId) {
  const check = counter.checkGenerateAvailability(chatId);
  if (!check.ok) {
    const msg = check.reason === 'token_habis'
      ? `⚠️ *Jatah gratis hari ini habis (3x).*\nBeli token buat lanjut:`
      : `❌ *Kamu belum terdaftar.* Ketik /start dulu ya.`;
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    if (check.reason === 'token_habis') {
      await showTopUp(chatId);
    }
    return;
  }

  const user = db.getUser(chatId);
  if (!user || !user.last_avatar) {
    return bot.sendMessage(chatId, '🎭 *Pilih avatar dulu:*', { parse_mode: 'Markdown', ...avatarKeyboard() });
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
  delete userState[chatId];

  await bot.sendMessage(chatId, `⏳ Lagih nulis... tunggu bentar ya`);
  await doGenerate(chatId, state.avatarId, topicClean, state.isPro);
}

// ========== CALLBACK QUERIES ==========

bot.on('callback_query', async (query) => {
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

  if (data === 'gen_random') {
    await doGenerate(chatId, null, '');
  }

  if (data === 'gen_back') {
    delete userState[chatId];
    await bot.sendMessage(chatId, '👌 Balik ke menu utama.', mainKeyboard());
  }

  if (data === 'gen_switch_avatar') {
    delete userState[chatId];
    await bot.sendMessage(chatId, '🎭 *Ganti Avatar* — pilih avatar lain:', { parse_mode: 'Markdown', ...avatarKeyboard() });
  }

  if (data.startsWith('topup_')) {
    const packId = data.replace('topup_', '');
    try {
      const invoice = await payment.createInvoice(chatId, packId);

      await bot.sendMessage(chatId,
        `💰 *Pembayaran ${invoice.label}*\n\nTotal: *Rp ${(invoice.price / 1000).toFixed(0)}K*\nDapat: *${invoice.tokens} token*\n\nReferensi: \`${invoice.ref}\`\n\n📌 *Pembayaran QRIS akan segera aktif.*\nHubungi admin buat konfirmasi manual sementara.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await bot.sendMessage(chatId, '❌ Error bikin invoice. Coba lagi nanti.');
    }
  }

  if (data === 'done') {
    delete userState[chatId];
    await bot.sendMessage(chatId, '📋 Udah di-copy? Tinggal paste ke Threads ya!', mainKeyboard());
  }
});

// ========== GENERATE ==========

async function doGenerate(chatId, avatarId, topic, isPro) {
  const user = db.getUser(chatId);
  avatarId = avatarId || user?.last_avatar;
  if (!avatarId) return bot.sendMessage(chatId, '❌ Pilih avatar dulu.');

  const avatar = getAvatar(avatarId);
  if (!avatar) return bot.sendMessage(chatId, '❌ Avatar gak ditemukan.');

  isPro = (isPro !== undefined) ? isPro : (user?.tier === 'pro' || user?.tier === 'agency');

  const check = counter.checkGenerateAvailability(chatId);
  if (!check.ok) {
    const msg = check.reason === 'token_habis'
      ? '❌ Jatah gratis habis. Ketik /topup buat beli token.'
      : '❌ Jatah generate habis. Ketik /topup buat beli token.';
    return bot.sendMessage(chatId, msg);
  }

  const success = counter.consumeGenerate(chatId, avatarId, topic || '', isPro ? 'premium' : 'free');
  if (!success) {
    return bot.sendMessage(chatId, '❌ Gagal. Coba lagi.');
  }

  try {
    const result = await generateContent(avatar, topic || '', isPro);

    const header =
      `🧑‍🌾 *${avatar.emoji} ${avatar.name}*\n` +
      `📝 ${topic ? `Topik: ${topic}` : 'Random (trending)'}\n` +
      `🤖 ${result.model}\n\n`;

    const threadText = result.posts.map((p, i) => `${i + 1}. ${p}`).join('\n\n');
    const footer = `\n\n━━━━━━━━━━━━━━━━\n📋 *Copy semua post di atas, paste ke Threads!*`;

    await bot.sendMessage(chatId, header + threadText + footer, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Lagi (avatar sama)', callback_data: 'gen_topic' }],
          [{ text: '🎭 Ganti Avatar', callback_data: 'gen_switch_avatar' }],
          [{ text: '✅ Selesai', callback_data: 'done' }],
        ],
      },
    });
  } catch (e) {
    console.error('Generate error:', e.message);
    await bot.sendMessage(chatId,
      `❌ *Gagal generate konten.*\n\n${e.message}\n\nCoba lagi nanti atau pilih avatar lain.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// ========== GRACEFUL SHUTDOWN ==========

process.on('SIGINT', () => {
  console.log('\n🛑 Bot stopped');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  process.exit(0);
});
