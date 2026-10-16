// Epic Games Store catalog lookup with a web-search fallback.
// Uses Epic's public storefront GraphQL search; no API key required.
const BASE = 'https://store.epicgames.com/graphql';
const norm = v => String(v || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

async function epicSearch(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const gql = `{ Catalog { searchStore(keywords: ${JSON.stringify(q)}, namespace: "d5241c76f178492ea1540fce45616757", start: 0, count: 10) { elements { title productSlug keyImages { type url } } } } }`;
  try {
    const response = await fetch(`${BASE}?query=${encodeURIComponent(gql)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GOJOStoreBot/1.0)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const json = await response.json();
      const elements = json?.data?.Catalog?.searchStore?.elements || json?.data?.catalog?.searchStore?.elements || [];
      const results = elements.filter(x => x?.title).map(x => {
        const images = Array.isArray(x.keyImages) ? x.keyImages : [];
        const image = images.find(i => /DieselGameBoxTall|OfferImageTall|Thumbnail/i.test(i.type || ''))?.url || images[0]?.url || null;
        const slug = x.productSlug || '';
        return { name: x.title, image, url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(x.title)}` };
      });
      if (results.length) return rank(results, q);
    }
  } catch (e) {
    console.warn('[Epic lookup] storefront search failed:', e.message);
  }
  // Last-resort web search link: avoids falsely claiming the game does not exist.
  let fallbackImage = null;
  try { const { steamSearch } = require('./steamLookup'); const steam = await steamSearch(q); fallbackImage = steam?.header || null; } catch {}
  return [{ name: q, image: fallbackImage, url: `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(q)}`, fallback: true }];
}
function rank(items, query) {
  const wanted = norm(query);
  return items.sort((a, b) => Number(norm(b.name) === wanted) - Number(norm(a.name) === wanted));
}
module.exports = { epicSearch };
