const fs = require('fs');
const path = require('path');
const https = require('https');

const TODAY = new Date().toISOString().slice(0, 10);
const ANGLE_FILE = path.join(__dirname, '..', 'data', 'angles', TODAY + '.json');

// Nanti: baca list user Pro dari DB dan kirim satu-satu
async function getProUsers() {
  // TODO: query dari SQLite
  // SELECT telegram_id FROM users WHERE tier = 'pro'
  return [];
}

async function formatMessage(angleData) {
  let msg = `🌅 *Daily Viral Topics — ${TODAY}*\n\n`;
  msg += `Pagi! Ini ${angleData.length} topik trending hari ini yang cocok buat konten Threads kamu 👇\n\n`;

  angleData.forEach((item, i) => {
    msg += `*${i + 1}. ${item.title}*\n`;
    msg += `📂 ${item.category} · via ${item.source}\n`;
    msg += `\n`;
    item.angles.forEach(a => {
      msg += `   ${a.avatar_name}: ${a.hook}\n`;
    });
    msg += `\n`;
  });

  msg += `\n🔥 Copy prompt dari PDF, paste angle di atas, selesai!`;
  return msg;
}

function sendTelegram(botToken, chatId, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
    const opts = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function send() {
  if (!fs.existsSync(ANGLE_FILE)) {
    console.log('[sender] No angle file for today. Run generate-angles first.');
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log('[sender] No TELEGRAM_BOT_TOKEN in env');
    return;
  }

  const angleData = JSON.parse(fs.readFileSync(ANGLE_FILE, 'utf-8'));
  const msg = await formatMessage(angleData);

  // TODO: kirim ke semua user Pro
  // Sementara test ke 1 chat ID dulu:
  const testChatId = process.env.TEST_CHAT_ID;
  if (testChatId) {
    const result = await sendTelegram(botToken, testChatId, msg);
    console.log('[sender] Test send:', result.ok ? 'OK' : 'FAILED', result.description || '');
  }

  console.log('[sender] Done');
}

module.exports = { send };
