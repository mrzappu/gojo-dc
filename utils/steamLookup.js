// ============================================================
//  GOJO BOT — Steam Lookup Utility
//  Provides: steamSearch, steamSearchById, rupees
//  Used by: /game, /post
// ============================================================

// ─────────────────────────────────────────────────────────────
//  INR formatter (Indian numbering — ₹1,23,456.78)
// ─────────────────────────────────────────────────────────────
function rupees(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────
//  Steam Store search by name
//  Returns: { appId, name, steamPrice, description, header, storeUrl, steamDbUrl }
// ─────────────────────────────────────────────────────────────
async function steamSearch(query) {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=in`;
    const response = await fetch(url, { headers: { 'User-Agent': 'GOJO-Steam-Lookup-Bot/1.0' } });
    if (!response.ok) throw new Error(`Steam search HTTP ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) return null;

    const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const wanted = norm(query);
    const item = items.find(x => norm(x.name) === wanted)
        || items.find(x => norm(x.name).includes(wanted) || wanted.includes(norm(x.name)))
        || items[0];

    const appId = String(item.id);
    let detail = null;
    try {
        const detailResponse = await fetch(
            `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&cc=in&l=english`,
            { headers: { 'User-Agent': 'GOJO-Steam-Lookup-Bot/1.0' } }
        );
        if (detailResponse.ok) {
            const d = await detailResponse.json();
            if (d[appId]?.success) detail = d[appId].data;
        }
    } catch (e) {
        console.warn('Steam app details lookup failed:', e.message);
    }

    let steamPrice = 'Not available';
    if (detail?.is_free) steamPrice = 'Free to Play';
    else if (detail?.price_overview?.final_formatted) steamPrice = detail.price_overview.final_formatted;
    else if (item.price?.final_formatted) steamPrice = item.price.final_formatted;
    else if (item.price?.final != null) steamPrice = `₹${(Number(item.price.final) / 100).toFixed(2)}`;

    return {
        appId,
        name: detail?.name || item.name || query,
        steamPrice,
        description: String(detail?.short_description || '').replace(/<[^>]*>/g, '').slice(0, 350),
        header: detail?.header_image || item.tiny_image || null,
        storeUrl: `https://store.steampowered.com/app/${appId}/`,
        steamDbUrl: `https://steamdb.info/app/${appId}/`,
    };
}

// ─────────────────────────────────────────────────────────────
//  Steam Store lookup by App/Game ID
//  Returns: same shape as steamSearch, or null
// ─────────────────────────────────────────────────────────────
async function steamSearchById(appId) {
    try {
        const r = await fetch(
            `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&cc=in&l=english`,
            { headers: { 'User-Agent': 'GOJO-Steam-Lookup-Bot/1.0' } }
        );
        if (!r.ok) return null;
        const d = await r.json();
        const item = d[String(appId)];
        if (!item?.success) return null;
        const x = item.data;
        return {
            appId: String(appId),
            name: x.name || `Steam App ${appId}`,
            steamPrice: x.is_free ? 'Free to Play' : (x.price_overview?.final_formatted || 'Not available'),
            description: x.short_description || '',
            header: x.header_image || null,
            storeUrl: `https://store.steampowered.com/app/${appId}/`,
            steamDbUrl: `https://steamdb.info/app/${appId}/`,
        };
    } catch (e) {
        console.error('Steam app lookup failed:', e.message);
        return null;
    }
}

module.exports = { steamSearch, steamSearchById, rupees };
