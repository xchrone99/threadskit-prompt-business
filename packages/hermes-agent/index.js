require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const ANGLES_DIR = path.join(DATA_DIR, 'angles');
const LOG_DIR = path.join(__dirname, 'logs');

for (const dir of [DATA_DIR, HISTORY_DIR, ANGLES_DIR, LOG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, `hermes-${new Date().toISOString().slice(0, 10)}.log`), line + '\n');
}

const cron = require('node-cron');
const command = process.argv[2] || 'help';

const COMMANDS = {
  'scrape': async () => {
    log('Starting scrape...');
    await require('./scrapers/reddit').scrape();
    await require('./scrapers/twitter').scrape();
    log('Scrape complete');
  },
  'generate-angles': async () => {
    log('Generating angles...');
    await require('./generators/angle').generate();
    log('Angles generated');
  },
  'send-to-bot': async () => {
    log('Sending to bot...');
    await require('./senders/telegram').send();
    log('Sent to bot');
  },
  'run-all': async () => {
    await COMMANDS['scrape']();
    await COMMANDS['generate-angles']();
    await COMMANDS['send-to-bot']();
    log('Pipeline complete');
  },
  'daemon': () => {
    log('Hermes Agent daemon started — waiting for scheduled tasks...');
    log('  05:00 WIB → scrape');
    log('  05:30 WIB → generate angles');
    log('  06:50 WIB → send to bot');

    // Jadwal WIB = UTC+7, kurangi 7 jam buat UTC
    // 05:00 WIB = 22:00 UTC sehari sebelumnya
    cron.schedule('0 22 * * *', () => COMMANDS['scrape']().catch(err => log('ERROR scrape: ' + err.message)));
    cron.schedule('30 22 * * *', () => COMMANDS['generate-angles']().catch(err => log('ERROR angles: ' + err.message)));
    cron.schedule('50 23 * * *', () => COMMANDS['send-to-bot']().catch(err => log('ERROR send: ' + err.message)));

    // Biarkan proses berjalan
    process.stdin.resume();
  },
  'test-reddit': async () => {
    log('Testing Reddit scraper...');
    const topics = await require('./scrapers/reddit').fetchRedditHot();
    console.log(JSON.stringify(topics.slice(0, 3), null, 2));
    log('Reddit test OK — ' + topics.length + ' topics found');
  },
  'help': () => {
    console.log(`
Hermes Agent — Trending Topic Scraper

Commands:
  node index.js daemon           Run scheduler (cron) — jalanin otomatis tiap hari
  node index.js scrape           Scrape trending topics (manual)
  node index.js generate-angles  Generate angles for each topic (manual)
  node index.js send-to-bot      Send formatted topics to Telegram (manual)
  node index.js run-all          Run all steps sequentially (manual)
  node index.js test-reddit      Test Reddit scraper only
  node index.js help             Show this help

Scheduler (daemon) akan jalanin otomatis:
  05:00 → scrape    05:30 → generate angles    06:50 → kirim ke bot
    `);
  },
};

if (COMMANDS[command]) {
  try {
    const result = COMMANDS[command]();
    if (result && typeof result.catch === 'function') {
      result.catch(err => log('ERROR: ' + err.message));
    }
  } catch (err) {
    log('ERROR: ' + err.message);
  }
} else {
  console.log('Unknown command: ' + command);
  COMMANDS['help']();
}
