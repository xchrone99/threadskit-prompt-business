const OpenAI = require('openai');

const FREE_MODEL_CHAIN = [
  { model: 'google/gemma-4-26b-a4b-it:free', retries: 3, delay: 3000 },
  { model: 'nvidia/nemotron-3-super-120b-a12b:free', retries: 2, delay: 2000 },
  { model: 'liquid/lfm-2.5-1.2b-instruct:free', retries: 1, delay: 1000 },
  { model: 'openrouter/free', retries: 1, delay: 1000 },
];

let openai;

function getClient() {
  if (!openai) {
    openai = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://cuanpilot.com',
        'X-Title': 'Cuan ThreadsKit',
      },
    });
  }
  return openai;
}

function buildPrompt(avatar, topic, isPro = false) {
  const topicLine = topic && topic.trim()
    ? `\n\nTopik hari ini:\n${topic.trim()}`
    : '\n\n(Pilih topik yang relevan dengan niche dan trending saat ini)';

  const formatRule = avatar.postRules || '';
  const lengthGuide = isPro ? '(sesuai preferensi)' : '(3-4 post)';

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
• JANGAN pake markdown berlebihan`;
}

function cleanReasoning(text) {
  if (!text) return '';
  const thinkEnd = text.indexOf('<｜end▁of▁thinking｜>\n');
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

async function generateContent(avatar, topic, isPro = false) {
  const prompt = buildPrompt(avatar, topic, isPro);
  const client = getClient();

  const messages = [
    { role: 'system', content: 'Kamu adalah asisten penulis konten Threads. Tugasmu menulis thread Indonesia yang engaging, natural, dan siap diposting. Gunakan bahasa Indonesia yang natural sesuai persona yang diberikan.' },
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

module.exports = { generateContent, buildPrompt, parseResponse };
