// Placeholder — implement saat API Twitter tersedia
// Saat ini fallback scraping trends24.in bisa dipake

async function scrape() {
  console.log('[twitter] Skipped — no API key configured');
  return [];
}

async function fetchTwitterTrends() {
  return [];
}

module.exports = { scrape, fetchTwitterTrends };
