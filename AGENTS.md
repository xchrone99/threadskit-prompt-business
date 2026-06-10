# Cuan ThreadsKit by CuanPilot — Project Summary

## Core Direction
Jual **akses ke AI untuk ibu rumah tangga Indonesia** — tanpa laptop, tanpa bisa Inggris, tanpa show face. Cuma modal HP, 3 pencetan, konten Threads jadi.

Target utama: **Ibu Rumah Tangga** yang butuh tambahan income di tengah harga naik.

---

## Business Proposition
**"Modal HP. 3 pencetan. Konten Threads jadi."**

Bukan jual ilmu. Bukan jual PDF. **Kasih akses ke teknologi yang tadinya cuma buat anak IT:**

- Gak perlu laptop — Telegram doang
- Gak perlu ngerti AI — pencet tombol aja
- Gak perlu show face — 100% text-first avatar persona
- 3x generate/hari cukup buat 1 akun (Starter)
- Safety: bot cuma bisa bikin konten — gak bisa diabuse

---

## Target Audience (Prioritas)

| Priority | Siapa | Pain | Kenapa cocok |
|----------|-------|------|-------------|
| **#1** | **Ibu Rumah Tangga** | Harga naik, butuh income, HP doang, gaptek | Paling cocok — HP selalu di tangan, trust tinggi ke referral |
| #2 | Mahasiswa | Cari uang jajan | Melek tech dikit, cepat adaptasi |
| #3 | Karyawan | Mau tambah penghasilan | Punya laptop, tapi sibuk |
| #4 | Affiliate pemula | Udah tahu konsep tapi stuck | Bisa langsung scaling |

---

## Value Stack per Tier

| Fitur | Starter | Pro | Agency |
|-------|---------|-----|--------|
| 📈 **Growth** — cara dapet followers | ✅ | ✅ | ✅ |
| 💬 **Engagement** — bikin orang komen | ❌ | ✅ | ✅ |
| 🏆 **Authority** — jadi trusted | ❌ | ✅ | ✅ |
| 👥 **Community** — grup Telegram | ❌ | ✅ | ✅ |
| 💰 **Selling** — closing komisi | ❌ | ❌ | ✅ |

---

## Produk & Pricing Final

| Tier | Harga | Limit Generate/hari | Komisi | Untuk siapa |
|------|-------|--------------------|--------|-------------|
| **Starter** | **Rp 69K** sekali | 3x | 20% (Starter-only) | Coba dulu, resiko kecil |
| **Pro** | **Rp 89K/bulan** | 15x | — | Yang serius |
| Pro 3 bln | Rp 249K | 15x | — | Hemat 2 bulan |
| Pro 6 bln | Rp 479K | 15x | — | Hemat 5 bulan |
| Pro 12 bln | **Rp 899K** | 15x | — | Hemat 3 bulan gratis |
| **Agency** | **Rp 299K** sekali | 30x | **40%** (all produk) | Yang mau bisnis sendiri |

**Catatan:** Pro 3/6/12 bln — ditampilkan di bot & PDF, landing page cuma tampilkan bulanan + tahunan.

---

## Komisi/Referral System

| Punya Produk | Komisi dari referral |
|-------------|---------------------|
| **Starter** doang | 20% — hanya dari penjualan **Starter** |
| **Starter + Pro** | 20% — tetap cuma dari referral **Starter** |
| **Agency** (dengan/tanpa Pro) | **40%** — dari SEMUA produk (Starter + Pro) |

**Rules:**
- Referral hanya dari penjualan produk yang tier referral-nya UNIVERSAL
- Agency dapet 40% dari semua produk karena dia bayar white-label
- Payout: request manual via bot (`/komisi` → hitung saldo → hubungi admin)

---

## Daily Limit & Token System

| Tier | Generate Gratis/hari | Abis? |
|------|---------------------|-------|
| **Starter** | 3x | Beli token ⚡ |
| **Pro** | 15x | Beli token ⚡ |
| **Agency** | 30x | Beli token ⚡ |

### Token Packs

| Harga | Token | Bonus | Total | Per generate |
|-------|-------|-------|-------|-------------|
| Rp 5K | 10 | — | 10 | Rp 500 |
| Rp 10K | 20 | 5 | **25** | Rp 400 |
| Rp 25K | 50 | 15 | **65** | Rp 385 |
| Rp 50K | 100 | 40 | **140** | Rp 357 |

1 token = 1 generate (berapa pun panjang thread-nya — flat rate).

---

## Guardrails — 3 Layer Safety

Layer 1 — **Input Gate:**
- User cuma bisa kirim topik (bukan instruksi bebas)
- Kalo user kirim `prompt: ...` → masuk mode advance: input diselipin di antara instruksi kaku
- Batas panjang input: max 500 karakter

Layer 2 — **Prompt Fortress:**
- System prompt = FIXED — gak bisa diubah user
- User input diapit aturan ketat: "TULIS THREAD. JANGAN lakukan apapun selain menulis konten."
- Semua prompt dibangun oleh bot, bukan oleh user langsung

Layer 3 — **Output Filter:**
- Output berisi code/JSON/function? → Reject
- Output cuma 1 baris? → Reject
- Output bukan bahasa Indonesia mayoritas? → Reject

---

## Positioning Messaging

| Platform | Copy |
|----------|------|
| **Landing Hero** | "Modal HP. 3 pencetan. Konten Threads jadi." |
| **Sub** | "Buat ibu rumah tangga yang mau dapet income dari rumah — tanpa laptop, tanpa bisa Inggris, tanpa show face." |
| **Bridge** | "Bukan jualan ilmu. Ini kasih kamu akses ke teknologi yang tadinya cuma buat anak IT." |
| **Risk Reversal** | "Rp 69K doang — setara 2 bungkus sembako. Kalo gak cocok, tinggal bilang." |
| **Social Media** | "Dulu saya kira AI cuma buat anak IT. Ternyata cuma modal HP, konten Threads jadi tiap hari." |

---

## Revenue Model

```
REVENUE STREAMS:
  ├── Entry (Starter) — Rp 69K one-time
  ├── Subscription (Pro) — Rp 89K/bulan recurring
  ├── License (Agency) — Rp 299K one-time
  ├── Microtransaction (Token) — Rp 5K-50K
  └── Referral commission — 20%/40% (growth engine)

COST STRUCTURE:
  ├── Iklan (CAC) — Rp 35K/orang (nanti)
  ├── API — Rp 0 (free tier) → ~Rp 14/hari/user (berbayar)
  ├── Bot hosting — minimal (same machine)
  └── Payment gateway — ~2-3% per transaksi

UNIT EKONOMI (Pro, sebelum komisi):
  Revenue: Rp 89.000
  API cost (free): Rp 0
  API cost (berbayar): ~Rp 2.250/bln
  Profit: Rp 51.000 - 53.400/customer/bulan
```

---

## Flywheel

```
FREE VALUE (Lead Magnet)
  "5 Prompt Threads Viral Gratis — coba langsung di bot"
         ↓
    PURCHASE STARTER (Rp 69K)
  Customer beli, langsung bisa generate
         ↓
 DAILY VALUE (Bot + Telegram)
  • 3x generate gratis tiap hari
  • (Pro) Topik viral tiap pagi
  • (Pro) Komunitas Telegram
         ↓
 CUSTOMER RESULTS
  • Konten jadi tiap hari
  • Affiliate link diklik
  • Komisi mulai masuk
         ↓
   SOCIAL PROOF
  Screenshot hasil → testimoni
         ↓
 VIRAL LOOP (Share + Earn)
  • Referral: 20% (Starter) / 40% (Agency)
  • IRT share link ke grup arisan/WA
  • Testimoni → FOMO → beli
```

---

## Architecture Overview

```
Telegram API (polling)
     │
     ▼
┌──────────────┐     ┌─────────────┐
│   index.js   │────▶│  generate.js│────▶ OpenRouter API
│  (Router)    │     │  (AI Chain) │     (Gemma-4, Nemotron, dll)
└──────┬───────┘     └─────────────┘
       │
       ├──▶ counter.js ──▶ db.js ──▶ SQLite
       ├──▶ payment.js ──▶ db.js
       ├──▶ avatars.js (5 personas)
       └──▶ referrals.js (tracking)
```

---

## Database Tables

```sql
users            — id, telegram_id, username, first_name, tier, last_avatar, joined_at
daily_usage      — user_id, date, count
token_balances   — user_id, balance, lifetime_earned, lifetime_used
transactions     — user_id, type, amount, tokens, payment_ref, status
subscriptions    — user_id, tier, expires_at, auto_renew, status
generation_log   — user_id, avatar_id, topic, token_cost, model_used
referrals        — referrer_id, referee_id, tier_sold, commission_amount, status
commissions      — user_id, amount, referral_id, status, paid_at
```

---

## Key Files & Structure

```
threads-prompt-business/
├── AGENTS.md                    ← Business plan
├── .gitignore
├── landing/
│   ├── index.html               ← Landing page (self-contained CSS + JS)
│   └── server.js                ← HTTP server (port 8080)
└── packages/
    └── ava-bot/
        ├── index.js             ← Telegram bot entry (350 lines)
        ├── generate.js          ← AI generation (retry chain + quality gate)
        ├── counter.js           ← Daily limits + token logic
        ├── payment.js           ← Token packs + subscriptions + invoices
        ├── avatars.js           ← 5 persona definitions
        ├── db.js                ← SQLite interface (6 tables + referrals)
        ├── referrals.js         ← Referral tracking + commissions
        ├── .env                 ← Live secrets
        └── .env.example         ← Template
```

---

## Phase 2 — Scale (Post-Launch)

Setelah launch dan traction terbukti:

| Item | Plan |
|------|------|
| **Database** | SQLite → PostgreSQL (udah ada di port 5432) |
| **AI Model** | OpenRouter free → Gemini Flash / GPT-4o-mini berbayar |
| **Payment** | Manual → Xendit QRIS otomatis |
| **Nurture** | Ava bot → Hermes Agent + cron scheduler |
| **Revenue** | One-time + subscription → SaaS bulanan dominan |

---

## Key Metrics Launch

| Metric | Target |
|--------|--------|
| Copies sold | 50+ |
| Revenue | Rp 3.45 - 13.45 juta (tergantung mix) |
| Telegram member | 30+ |
| Leads captured | 200+ |
| Referral conversion | 10% dari pembeli |

---

## Next Steps

1. ✅ Business plan updated
2. [ ] Landing page — copy baru (pain, value, offer, pricing update)
3. [ ] Bot — limit 15/30 di counter.js
4. [ ] Bot — auto offer top-up kalo abis quota
5. [ ] Referral system — handler `/start=ref_{id}`, tracking, payout
6. [ ] Guardrails — prompt fortress + output filter
7. [ ] PDF (150 prompts + lead magnet)
8. [ ] Xendit integration
