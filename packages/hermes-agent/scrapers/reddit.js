const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'raw_trending.json');
const USER_AGENT = 'HermesAgent/1.0 (CuanThreadsKit; +https://t.me/cuan_threadskit_bot)';

const SOURCES = [
  { url: 'https://www.reddit.com/r/indonesia/hot.json?limit=25', name: 'r/indonesia hot' },
  { url: 'https://www.reddit.com/r/indonesia/top.json?t=day&limit=25', name: 'r/indonesia top today' },
  { url: 'https://www.reddit.com/r/all/top.json?t=day&limit=50', name: 'r/all top today' },
];

const CATEGORY_KEYWORDS = {
  keuangan: ['uang', 'harga', 'ekonomi', 'inflasi', 'gaji', 'tabungan', 'investasi', 'saham', 'reksadana', 'pajak', 'finansial'],
  parenting: ['anak', 'ibu', 'parenting', 'sekolah', 'keluarga', 'rumah tangga'],
  teknologi: ['ai', 'chatgpt', 'digital', 'aplikasi', 'tech', 'hp', 'laptop', 'internet'],
  gaya_hidup: ['makanan', 'resep', 'kuliner', 'fashion', 'beauty', 'skincare', 'travel', 'liburan'],
  karir: ['kerja', 'karir', 'bisnis', 'startup', 'freelance', 'side hustle', 'usaha'],
  belanja: ['belanja', 'shopee', 'tokopedia', 'diskon', 'cashback', 'promo', 'murah'],
};

function categorize(title, body) {
  const text = (title + ' ' + (body || '')).toLowerCase();
  let bestCat = 'gaya_hidup';
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(k => text.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestCat = cat; }
  }
  return bestCat;
}

function isIndonesian(text) {
  const indoWords = ['yang', 'di', 'ke', 'dan', 'saya', 'kamu', 'gak', 'tidak', 'ada', 'bisa', 'dengan', 'untuk', 'dari', 'ini', 'itu', 'juga', 'sudah', 'akan', 'telah', 'lebih', 'sangat', 'banyak', 'orang', 'tahu', 'baru', 'setelah', 'karena', 'kalau', 'kalau', 'pada', 'tapi', 'harga', 'beli', 'jual', 'murah', 'mahal'];
  const lower = text.toLowerCase();
  const matchCount = indoWords.filter(w => lower.includes(w)).length;
  return matchCount >= 3;
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function fetchRedditHot() {
  const allPosts = [];
  const seen = new Set();

  for (const source of SOURCES) {
    try {
      const data = await fetchJson(source.url);
      const posts = data.data.children.map(c => c.data).filter(p => {
        if (p.over_18) return false;
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      for (const p of posts) {
        allPosts.push({
          source: 'reddit',
          title: p.title,
          body: (p.selftext || '').slice(0, 500),
          category: categorize(p.title, p.selftext),
          engagement: p.ups + p.num_comments,
          url: 'https://reddit.com' + p.permalink,
          subreddit: p.subreddit,
          scraped_at: new Date().toISOString(),
          is_indonesian: isIndonesian(p.title + ' ' + (p.selftext || '')),
        });
      }
    } catch (err) {
      console.error(`[reddit] Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  allPosts.sort((a, b) => b.engagement - a.engagement);
  return allPosts;
}

async function scrape() {
  console.log('[reddit] Fetching...');
  const posts = await fetchRedditHot();
  console.log(`[reddit] Got ${posts.length} posts total`);

  const indo = posts.filter(p => p.is_indonesian);
  const top = indo.length >= 10 ? indo : posts;

  const final = top.slice(0, 15);
  fs.writeFileSync(DATA_FILE, JSON.stringify(final, null, 2));
  console.log(`[reddit] Saved ${final.length} topics to data/raw_trending.json`);
  return final;
}

module.exports = { scrape, fetchRedditHot };
