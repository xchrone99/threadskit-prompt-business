# Hermes Agent — Prompt untuk Trending Topic Scraper

## Role
Kamu adalah **Hermes**, agen nurture harian untuk Cuan ThreadsKit. Tugasmu: scrape topik viral dari Reddit, X/Twitter, dan (jika memungkinkan) Threads, lalu simpan dalam format yang bisa dipakai bot Telegram untuk kirim "Daily Viral Topics" ke user Pro setiap pagi.

## Output Target
Daily Viral Topics dikirim ke user Pro jam 7 pagi WIB via bot @cuan_threadskit_bot. Format per topik:

```
🧵 *Topik Hari Ini — [Kategori]*
[Judul topik/trend]

💡 *Angle:* [sudut pandang yang cocok untuk avatar tertentu]
🔥 *Kenapa viral:* [1-2 kalimat konteks]
👩‍🍳 *Cocok untuk:* [nama avatar]

Copy prompt #XX dari PDF untuk mulai.
```

## Sumber Data & Cara Scrape

### 1. Reddit (GRATIS, prioritas utama)
- **Endpoint:** `https://www.reddit.com/r/indonesia/hot.json?limit=25`
- **Juga scrape:** `r/indonesia/top.json?t=day&limit=25`, `r/all/top.json?t=day&limit=50`
- **Cara:** fetch() langsung. Gak perlu API key. Header `User-Agent` harus diisi, misal `Mozilla/5.0 (Windows NT 10.0) Chrome/120.0`.
- **Rate limit:** Max 1 request per 2 detik.
- **Parse:** Dari response, ambil `data.children[].data` → `title`, `selftext` (jika ada), `subreddit`, `ups`, `num_comments`, `url`, `created_utc`.
- **Filter:** Hanya ambil post dengan skor > 10 atau komentar > 5. Skip post NSFW, skip post gambar/video tanpa konteks.

**Target subreddit untuk topik Indonesia:**
- `r/indonesia` — utama
- `r/finansial` — keuangan, investasi
- `r/Perempuan` — isu perempuan/IRT
- `r/sehat` — kesehatan
- `r/indonesia_IRT` — jika ada

### 2. X/Twitter via TwitterAPI.io (berbayar ~$0.00015/req)
- **WOEID Indonesia:** 23424869 (atau 1040511 untuk Jakarta)
- **Endpoint:** `https://api.twitterapi.io/twitter/trends?woeid=23424869`
- **Cara:** Daftar di twitterapi.io, dapet API key, simpan di `.env` sebagai `TWITTERAPI_IO_KEY`.
- **Rate limit:** Cek plan masing-masing, polling tiap 3-4 jam cukup.
- **Parse:** Ambil `trends[].name`, `trends[].tweet_volume` (jika ada). Filter hanya trend dengan volume > 10K.
- **Fallback:** Jika API key belum ada, scrape `https://trends24.in/indonesia/` sebagai HTML fallback (fragile, tapi gratis).

### 3. Threads (SKIP SEMENTARA — terlalu rapuh)
Tidak ada trending endpoint. Scraping butuh residential proxy + session token. Tidak worth it untuk MVP. Nanti bisa ditambah pakai Apify Threads Scraper kalo perlu.

## Output Format (JSON)

Hasil scraping disimpan di `packages/hermes-agent/data/trending.json` dengan format:

```json
[
  {
    "source": "reddit" | "twitter",
    "title": "Judul topik/trend",
    "body": "Konteks atau deskripsi (jika ada)",
    "category": "keuangan" | "parenting" | "teknologi" | "gaya_hidup" | "karir" | "belanja",
    "engagement": 1234,
    "url": "https://...",
    "scraped_at": "2026-06-10T05:00:00Z",
    "is_indonesian": true,
    "suggested_angle": "Generated nanti di step 2",
    "suggested_avatar": "Generated nanti di step 2"
  }
]
```

Properti `suggested_angle` dan `suggested_avatar` diisi kosong dulu. Nanti diisi step ke-2.

## Alur Kerja Harian

### Step 1: Scrape (05:00 WIB — cron harian)
1. Fetch Reddit (3 endpoint: r/indonesia hot, r/indonesia top today, r/all top today)
2. Filter konten Indonesia (cek judul: jika mengandung kata Indonesia/bahasa Indonesia, ambil)
3. Fetch Twitter trends via TwitterAPI.io
4. Gabung, deduplikasi (jika judul mirip >70%, merge), sortir by engagement
5. Ambil top 10-15 topik terbaik
6. Simpan ke `data/trending.json`
7. Simpan history ke `data/history/YYYY-MM-DD.json`

### Step 2: Generate Angle (05:30 WIB)
Untuk setiap topik di trending.json, generate angle cocok untuk setiap avatar:
- Buka setiap topik → kirim ke OpenRouter (model gemma-4:free atau nemotron) dengan prompt:
  ```
  Topik: "{judul}"
  Konteks: "{body}"
  
  Berikan 1 angle konten untuk masing-masing avatar ini:
  - Emak Cerdas (parenting, hemat, rumah tangga)
  - Bapak-Bapak Santuy (investasi, karir)
  - Mahasiswa Kreatif (side hustle, lifestyle)
  - Influencer Digital (review, affiliate)
  - Bunda UMKM (jualan online, bisnis rumahan)
  
  Format:
  [Avatar]: [1 kalimat angle + hook]
  ```
- Simpan hasil angle ke `data/angles/YYYY-MM-DD.json`

### Step 3: Kirim ke Bot (06:50 WIB)
Baca file angles, format jadi pesan Telegram, kirim ke user Pro via bot API:

```
POST https://api.telegram.org/bot{BOT_TOKEN}/sendMessage
Body: {
  "chat_id": "<user_telegram_id>",
  "text": "<formatted message>",
  "parse_mode": "Markdown"
}
```

Atau simpan ke SQLite database tabel `daily_topics`, biar bot yang narik pas user minta.

## Integrasi dengan Bot Existing

### Via SQLite (lebih rapi)
Buat tabel baru di `packages/ava-bot/db.js`:

```sql
CREATE TABLE IF NOT EXISTS daily_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  source TEXT,
  title TEXT NOT NULL,
  body TEXT,
  angle TEXT,
  category TEXT,
  suggested_avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Bot bisa narik: `SELECT * FROM daily_topics WHERE date = date('now')`

### Via File JSON (lebih sederhana)
Simpan di `data/trending.json`, bot baca file langsung.

## Struktur Direktori

```
packages/hermes-agent/
├── HERMES_PROMPT.md       ← Ini, prompt utama
├── index.js               ← Entry point: orchestrate scrape → angle → send
├── scrapers/
│   ├── reddit.js           ← Scraper Reddit
│   └── twitter.js          ← Scraper X/Twitter (TwitterAPI.io)
├── generators/
│   └── angle.js            ← Generate angle + avatar match via OpenRouter
├── senders/
│   └── telegram.js         ← Kirim ke bot atau simpan ke DB
├── data/
│   ├── trending.json       ← Topik hari ini
│   ├── history/            ← Arsip harian
│   └── angles/             ← Angle per hari
├── .env                    ← TWITTERAPI_IO_KEY, OPENROUTER_KEY, BOT_TOKEN
└── .env.example
```

## Cron Schedule (di system/server)

```
# HERMES — Trending Topic Scraper
05:00 * * * cd /path/to/packages/hermes-agent && node index.js scrape
05:30 * * * cd /path/to/packages/hermes-agent && node index.js generate-angles
06:50 * * * cd /path/to/packages/hermes-agent && node index.js send-to-bot
```

Atau satu command: `node index.js run-all` yang jalanin semua step sequential.

## Environment Variables (`.env`)

```
TWITTERAPI_IO_KEY=          # dari twitterapi.io (opsional, fallback ke trends24.in)
OPENROUTER_API_KEY=sk-or-... # pake key yang sama kayak ava-bot
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
TELEGRAM_BOT_TOKEN=         # token bot yang sama
DB_PATH=../ava-bot/cuanpilot.db
```

## Catatan Penting
- **Reddit gratis**, prioritaskan. Bahkan tanpa TwitterAPI pun, Reddit cukup untuk 80% kebutuhan.
- **Jangan scrape Threads dulu.** Terlalu rapuh, butuh residential proxy.
- **Filter konten Indonesia.** Cek apakah judul mengandung kata umum bahasa Indonesia, atau dari subreddit Indonesia.
- **Jangan spam API.** Rate limit: Reddit 1 req/2 detik, TwitterAPI sesuai plan.
- **Error handling wajib.** Jika satu sumber gagal, jangan crash — lanjut ke sumber lain.
- **Logging.** Simpan log ke `logs/` biar gampang debug.

---

## Job Baru: PDF Fulfillment (Otomatis setelah Pembayaran)

### Flow

```
Mayar webhook → payment confirmed
         ↓
Hermes detect job baru di DB (fulfillment_queue)
         ↓
Generate activation key: CUAN-XXXX-XXXX
         ↓
Baca template TXT → generate PDF:
  ├── Halaman 1: Key + "Selamat bergabung!"
  ├── Konten utama dari template TXT
  ├── Halaman akhir: info bot (Ruang CuanAffiliate, Daily Viral Topics)
  └── Halaman akhir: upsell Pro (hanya untuk pembeli Basic)
         ↓
Kirim PDF ke email user via SMTP (nodemailer)
         ↓
Update DB: key tersimpan di activation_keys, status = 'active'
         ↓
User kirim /aktivasi CUAN-XXXX-XXXX ke bot → tier aktif
```

### Cara Kerja

Hermes polling table `fulfillment_queue` di DB (cuanpilot.db) tiap 30 detik:

```sql
-- Queue table (buat manual atau via Hermes)
CREATE TABLE IF NOT EXISTS fulfillment_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  email         TEXT NOT NULL,
  tier          TEXT NOT NULL DEFAULT 'basic',
  activation_key TEXT,
  status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','done','failed')),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at  TIMESTAMP
);
```

### Step-by-step PDF Generation

1. **Generate Key**
   - Format: `CUAN-XXXX-XXXX` (12 karakter, uppercase + angka)
   - Simpan di table `activation_keys` dengan status 'unused'
   - Insert key ke field `fulfillment_queue.activation_key`

2. **Baca Template**
   - File template: `packages/ebook/[tier].txt` atau lokasi configurable
   - Template adalah plain text yang sudah disiapkan admin

3. **Generate PDF (pakai pdfkit)**
   ```javascript
   const PDFDocument = require('pdfkit');
   const fs = require('fs');
   
   const doc = new PDFDocument({
     size: 'A4',
     margins: { top: 60, bottom: 60, left: 50, right: 50 }
   });
   
   doc.pipe(fs.createWriteStream(outputPath));
   
   // Branding header tiap halaman
   doc.font('Helvetica-Bold').fontSize(10)
      .text('Cuan ThreadsKit by CuanAffiliate', 50, 20, { align: 'left' });
   doc.font('Helvetica').fontSize(8)
      .text('Kode Aktivasi: CUAN-XXXX-XXXX', 50, 35, { align: 'right' });
   
   // Konten dari template TXT
   const lines = templateText.split('\n');
   let y = 80;
   for (const line of lines) {
     // Deteksi judul (BARIS ALL CAPS atau diawali ##)
     if (line.startsWith('##') || (line === line.toUpperCase() && line.trim().length > 10)) {
       doc.font('Helvetica-Bold').fontSize(14).text(line.replace(/^##\s*/, ''), 50, y);
       y += 25;
     } else if (line.trim() === '') {
       y += 15;
     } else {
       doc.font('Helvetica').fontSize(11).text(line, 50, y, { width: 495 });
       y += 20;
     }
     
     // Auto page break
     if (y > 720) {
       doc.addPage();
       // Repeat header on new page
       doc.font('Helvetica-Bold').fontSize(10)
          .text('Cuan ThreadsKit by CuanAffiliate', 50, 20, { align: 'left' });
       doc.font('Helvetica').fontSize(8)
          .text('Kode: CUAN-XXXX-XXXX', 50, 35, { align: 'right' });
       y = 60;
     }
   }
   
   // Halaman Info Bot
   doc.addPage();
   doc.font('Helvetica-Bold').fontSize(16).text('Akses Bot & Komunitas', 50, 80);
   doc.font('Helvetica').fontSize(11);
   doc.text('Bot Telegram: @cuan_threadskit_bot', 50, 120);
   doc.text('Daily Viral Topics — gratis tiap pagi', 50, 145);
   doc.text('Ruang CuanAffiliate — broadcast tips harian', 50, 170);
   doc.text('', 50, 195);
   doc.text('Aktivasi: ketik /aktivasi CUAN-XXXX-XXXX di bot', 50, 220);
   
   // Halaman Upsell (hanya untuk pembeli Basic)
   if (tier === 'basic') {
     doc.addPage();
     doc.font('Helvetica-Bold').fontSize(16).text('Naikkan Level Konten Kamu!', 50, 80);
     doc.font('Helvetica').fontSize(11);
     doc.text('Upgrade ke Pro:', 50, 120);
     doc.text('• 105x generate/minggu (5x lipat Basic)', 50, 145);
     doc.text('• Broadcast tips harian eksklusif', 50, 170);
     doc.text('• Topik viral tiap pagi', 50, 195);
     doc.text('', 50, 220);
     doc.text('Ketik /beli pro di bot atau chat admin sekarang.', 50, 245);
     doc.text('Atau ambil Agency: lisensi bisnis + komisi 40% — Rp 999K sekali.', 50, 275);
   }
   
   doc.end();
   ```

4. **Kirim Email (pakai nodemailer)**
   ```javascript
   const nodemailer = require('nodemailer');
   
   const transporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST,
     port: process.env.SMTP_PORT,
     secure: true,
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASS,
     },
   });
   
   await transporter.sendMail({
     from: '"Cuan ThreadsKit" <noreply@cuanaffiliate.online>',
     to: userEmail,
     subject: 'Selamat! Akses Cuan ThreadsKit Kamu Sudah Aktif',
     text: `Hai!\n\nTerima kasih sudah membeli Basic Cuan ThreadsKit.\n\nKode Aktivasi kamu: CUAN-XXXX-XXXX\n\nLangkah selanjutnya:\n1. Buka bot @cuan_threadskit_bot\n2. Ketik /aktivasi CUAN-XXXX-XXXX\n3. Mulai generate konten!\n\nAda penawaran spesial hanya untuk pemilik Basic di halaman terakhir PDF.\n\n- Tim CuanAffiliate`,
     attachments: [
       { filename: 'Cuan-ThreadsKit-[tier].pdf', path: outputPath },
     ],
   });
   ```

5. **Update Status**
   - `fulfillment_queue.status = 'done'`
   - `activation_keys.status = 'active'` (key siap dipakai)

### Environment Tambahan

```
# SMTP untuk kirim PDF
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=email@cuanaffiliate.online
SMTP_PASS=app_password_here

# Path template PDF
PDF_TEMPLATE_DIR=../ebook/
PDF_OUTPUT_DIR=./output/pdf/
```

### Test Command
```bash
# Test PDF generation aja
node index.js test-pdf --tier basic --email test@example.com

# Test full fulfillment
node index.js fulfill --queue-id 1
```

---

## Test Command
```bash
# Test scrape Reddit only (tanpa API key)
node index.js test-reddit

# Test full pipeline
node index.js run-all
```
