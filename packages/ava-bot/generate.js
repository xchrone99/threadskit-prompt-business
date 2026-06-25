const OpenAI = require('openai');

const FREE_MODEL_CHAIN = [
  { model: 'google/gemma-4-26b-a4b-it:free', retries: 3, delay: 3000 },
  { model: 'nvidia/nemotron-3-super-120b-a12b:free', retries: 2, delay: 2000 },
  { model: 'google/gemma-4-9b-it:free', retries: 2, delay: 2000 },
];

const OBJECTIVES = {
  engagement: {
    label: 'Engagement',
    emoji: '🔥',
    desc: 'Bikin orang komen & diskusi',
    prompt: 'BUAT THREAD YANG ENGAGING. Akhiri tiap post dengan pertanyaan atau ajakan diskusi. Hook bikin orang pengen komen. Target: banyak reply dan diskusi di kolom komentar.',
  },
  reach: {
    label: 'Reach',
    emoji: '🌊',
    desc: 'Banyak dilihat & di-share',
    prompt: 'BUAT THREAD YANG VIRAL. Hook super kuat di post pertama. Format mudah dicerna dan di-share. Topik yang relate ke banyak orang. Target: dilihat dan di-share sebanyak mungkin.',
  },
  community: {
    label: 'Community',
    emoji: '👥',
    desc: 'Bangun pengikut setia',
    prompt: 'BUAT THREAD YANG MEMBANGUN KONEKSI. Cerita personal yang relate. Bahasa hangat dan dekat. Bikin pembaca merasa "ini gue banget". Target: pengikut merasa terhubung dan balik lagi.',
  },
  authority: {
    label: 'Authority',
    emoji: '🏆',
    desc: 'Jadi trusted expert',
    prompt: 'BUAT THREAD YANG MEYAKINKAN. Data, pengalaman, insight. Tone percaya diri tapi gak menggurui. Tampilkan keahlian tanpa pamer. Target: pembaca percaya dan nonton sampe akhir.',
  },
  selling: {
    label: 'Selling',
    emoji: '💰',
    desc: 'Soft selling via affiliate',
    prompt: 'BUAT THREAD SOFT SELLING. Cerita natural yang mengarah ke produk/rekomendasi. Jangan kaya sales. Sertakan ajakan klik link/CToA yang halus. Target: affiliate link diklik tanpa kelihatan jualan.',
  },
};

let openai;

function getClient() {
  if (!openai) {
    openai = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://cuanaffiliate.online',
        'X-Title': 'Cuan ThreadsKit',
      },
    });
  }
  return openai;
}

function buildPrompt(avatar, topic, isPro = false, objective = null, customParams = {}) {
  const topicLine = topic && topic.trim()
    ? `\n\nTopik hari ini:\n${topic.trim()}`
    : '\n\n(Pilih topik yang relevan dengan niche dan trending saat ini)';

  const formatRule = avatar.postRules || '';
  const lengthGuide = !isPro ? '(3-4 post)' : '';

  let objectiveSection = '';
  if (isPro && objective && OBJECTIVES[objective]) {
    objectiveSection = `\n\nOBJEKTIF KONTEN: ${OBJECTIVES[objective].prompt}`;
  }

  let customSection = '';
  if (isPro && customParams) {
    const parts = [];
    if (customParams.audience) parts.push(`Target audiens: ${customParams.audience}`);
    if (customParams.mood) parts.push(`Mood/nada: ${customParams.mood}`);
    if (customParams.length) parts.push(`Jumlah post: ${customParams.length}`);
    if (customParams.format === 'curiosity') {
      parts.push(`FORMAT STRUKTUR:
• Post 1 — Curiosity hook (judul bikin penasaran)
• Post 2 — Subtitle penjelas
• Post 3-4 — Build tension (1-2 kalimat)
• Post terakhir — Akhiri dengan pertanyaan (siapa, dimana, kapan) atau "INI CERITANYA"`);
    }
    if (parts.length > 0) customSection = `\n\n${parts.join('\n')}`;
  }

  return `${avatar.systemPrompt}

${avatar.format} ${lengthGuide}

Aturan nulis post:
${formatRule}

TULIS THREAD LENGKAP (bukan outline, bukan draft, tapi full text yang siap diposting).${topicLine}

Pastikan:
• Setiap post cukup pendek (max 300 karakter per post Indonesia)
• Hook di post pertama bikin penasaran
• Thread flow natural — tiap post nyambung
• Akhiri dengan CTA yang natural
• JANGAN pake hashtag
• JANGAN pake markdown berlebihan${objectiveSection}${customSection}`;
}

function cleanReasoning(text) {
  if (!text) return '';
  const thinkEnd = text.indexOf(' response\n');
  if (thinkEnd !== -1) return text.slice(thinkEnd + 10).trim();
  const screeningStart = text.search(/\*\*(Tips|Post|Thread|Berikut)/);
  if (screeningStart !== -1) return text.slice(screeningStart).trim();
  const lines = text.split('\n').filter(l => {
    const t = l.trim();
    return !/^(Hmm|Okay|Let me|I need|I should|Saya perlu|Aku perlu|User|Kamu adalah|Sebagai)\.?\s/i.test(t);
  });
  return lines.join('\n').trim();
}

function parseResponse(text) {
  const posts = [];
  const lines = text.split('\n');
  let currentPost = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+[\.\)]/.test(trimmed) || /^Post\s+\d+/i.test(trimmed)) {
      if (currentPost.length > 0) {
        posts.push(currentPost.join('\n').trim());
        currentPost = [];
      }
      continue;
    }
    if (trimmed) currentPost.push(trimmed);
  }

  if (currentPost.length > 0) {
    posts.push(currentPost.join('\n').trim());
  }

  if (posts.length === 0) {
    posts.push(text.trim());
  }

  return posts;
}

function qualityCheck(text, posts) {
  if (!text || text.length < 20) return false;
  if (posts.length < 2) return false;
  if (posts.some(p => (p.match(/[^a-zA-Z0-9 .,!?\-'()"\n]/g) || []).length > p.length * 0.3)) return false;
  return true;
}

async function tryModel(client, model, messages) {
  const completion = await client.chat.completions.create({ model, messages, temperature: 0.8, max_tokens: 2048 });
  const msg = completion.choices[0]?.message || {};
  const text = msg.content || cleanReasoning(msg.reasoning || '');
  const posts = parseResponse(text);
  return { text, posts, model, usage: completion.usage };
}

async function generateContent(avatar, topic, isPro = false, objective = null, customParams = {}) {
  const prompt = buildPrompt(avatar, topic, isPro, objective, customParams);
  const client = getClient();

  const sysMsg = isPro && objective
    ? `Kamu adalah asisten penulis konten Threads. Tugasmu menulis thread Indonesia sesuai objektif "${OBJECTIVES[objective].label}" — ${OBJECTIVES[objective].desc}. Gunakan bahasa Indonesia yang natural sesuai persona yang diberikan.`
    : 'Kamu adalah asisten penulis konten Threads. Tugasmu menulis thread Indonesia yang engaging, natural, dan siap diposting. Gunakan bahasa Indonesia yang natural sesuai persona yang diberikan.';

  const messages = [
    { role: 'system', content: sysMsg },
    { role: 'user', content: prompt },
  ];

  const models = isPro
    ? [{ model: process.env.PREMIUM_MODEL || 'google/gemini-2.5-pro', retries: 1, delay: 1000 }]
    : FREE_MODEL_CHAIN;

  let lastError;

  for (const entry of models) {
    for (let attempt = 0; attempt < entry.retries; attempt++) {
      try {
        const result = await tryModel(client, entry.model, messages);
        if (qualityCheck(result.text, result.posts)) {
          return { text: result.text, posts: result.posts, model: result.model, usage: result.usage };
        }
      } catch (e) {
        lastError = e;
        const retriable = e.status === 429 || e.status === 404 || e.status === 503 || e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT';
        if (retriable && attempt < entry.retries - 1) {
          await new Promise(r => setTimeout(r, entry.delay));
          continue;
        }
      }
      break;
    }
  }

  throw new Error(lastError
    ? `Semua model sibuk. Coba lagi nanti ya.`
    : 'Gagal generate konten. Coba lagi.');
}

module.exports = { generateContent, buildPrompt, parseResponse, OBJECTIVES };