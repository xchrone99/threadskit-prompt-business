const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, '..', 'data', 'raw_trending.json');
const ANGLE_FILE = path.join(__dirname, '..', 'data', 'angles', new Date().toISOString().slice(0, 10) + '.json');

const AVATAR_DESCRIPTIONS = [
  { id: 'emak_cerdas', name: 'Emak Cerdas', desc: 'Parenting, hemat, rumah tangga — hangat dan praktis' },
  { id: 'bapak_santuy', name: 'Bapak-Bapak Santuy', desc: 'Investasi, karir, financial planning — santuy tapi bijak' },
  { id: 'mahasiswa_kreatif', name: 'Mahasiswa Kreatif', desc: 'Side hustle, lifestyle, produktif — anak muda banget' },
  { id: 'influencer_digital', name: 'Influencer Digital', desc: 'Review produk, affiliate, personal branding — pede dan informatif' },
  { id: 'bunda_umkm', name: 'Bunda UMKM', desc: 'Jualan online, bisnis rumahan, reseller — ramah dan semangat' },
];

function generateAngleFallback(topic) {
  return AVATAR_DESCRIPTIONS.map(a => {
    const hooks = {
      emak_cerdas: `"Dari ${topic.title}, ini yang saya terapin di rumah..."`,
      bapak_santuy: `"${topic.title} — perspektif yang jarang dibahas..."`,
      mahasiswa_kreatif: `"${topic.title} bisa jadi side hustle? Iyah dong."`,
      influencer_digital: `"Review: ${topic.title}. Niche banget buat konten."`,
      bunda_umkm: `"${topic.title} — ini dampaknya buat jualan online kamu."`,
    };
    return {
      avatar_id: a.id,
      avatar_name: a.name,
      hook: hooks[a.id] || `"${topic.title} — cocok buat konten ${a.name}"`,
    };
  });
}

async function generate() {
  if (!fs.existsSync(RAW_FILE)) {
    console.log('[angle] No raw_trending.json found. Run scrape first.');
    return;
  }

  const topics = JSON.parse(fs.readFileSync(RAW_FILE, 'utf-8'));

  // TODO: Pake OpenRouter API untuk generate angle yang lebih relevan
  // Sementara pake fallback sederhana:
  const result = topics.map(topic => ({
    title: topic.title,
    category: topic.category,
    source: topic.source,
    url: topic.url,
    angles: generateAngleFallback(topic),
  }));

  fs.writeFileSync(ANGLE_FILE, JSON.stringify(result, null, 2));
  console.log(`[angle] Generated angles for ${result.length} topics → ${ANGLE_FILE}`);
  return result;
}

module.exports = { generate };
