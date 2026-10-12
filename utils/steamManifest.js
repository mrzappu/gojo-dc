// ============================================================
//  GOJO BOT — Steam Depot / Manifest Utility
//  Uses api.steamcmd.net (public anonymous mirror) to fetch
//  app + DLC depot manifests and build SteamTools-style Lua.
//  Also generates a ZIP buffer containing all Lua files.
// ============================================================

const JSZip = require('jszip');

const BRAND = 'Copyright Limited Gojo Steam Lounge';
const API_BASE = 'https://api.steamcmd.net/v1/info';

// ─────────────────────────────────────────────────────────────
//  Fetch raw app info from steamcmd.net
//  Returns: { appid, common, depots, ... } or null
// ─────────────────────────────────────────────────────────────
async function fetchAppInfo(appid) {
    try {
        const r = await fetch(`${API_BASE}/${encodeURIComponent(String(appid))}`, {
            headers: { 'User-Agent': 'GOJO-Steam-Manifest/1.0' },
        });
        if (!r.ok) return null;
        const json = await r.json();
        const entry = json?.data?.[String(appid)];
        if (!entry) return null;
        return entry;
    } catch (e) {
        console.warn(`[steamManifest] fetchAppInfo(${appid}) failed:`, e.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  Fetch DLC app IDs from Steam storefront appdetails
//  Returns: array of string appids
// ─────────────────────────────────────────────────────────────
async function fetchDlcAppIds(appid) {
    try {
        const r = await fetch(
            `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(String(appid))}&cc=in&l=english`,
            { headers: { 'User-Agent': 'GOJO-Steam-Manifest/1.0' } }
        );
        if (!r.ok) return [];
        const j = await r.json();
        const data = j?.[String(appid)]?.data;
        if (!data) return [];
        const dlc = Array.isArray(data.dlc) ? data.dlc.map(String) : [];
        return dlc;
    } catch (e) {
        console.warn(`[steamManifest] fetchDlcAppIds(${appid}) failed:`, e.message);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
//  Extract numeric depots + public manifest GIDs from an app entry
// ─────────────────────────────────────────────────────────────
function extractDepots(appEntry) {
    const out = [];
    if (!appEntry || !appEntry.depots) return out;
    for (const [depotId, depot] of Object.entries(appEntry.depots)) {
        // Skip non-numeric keys (branches, baselanguages, etc.) and depot 0
        if (!/^\d+$/.test(depotId)) continue;
        if (depotId === '0') continue;

        const gid = depot?.manifests?.public?.gid
            || depot?.manifests?.public?.gid_string
            || null;

        // Some entries only have a "manifests" object with no public branch
        if (!gid) continue;

        out.push({ depotId, gid: String(gid) });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────
//  Build a single Lua string for one app (with its depots)
// ─────────────────────────────────────────────────────────────
function buildLua({ appid, name, depots, kind = 'APP' }) {
    const ts = new Date().toISOString();
    const lines = [];
    lines.push('-- ============================================================');
    lines.push(`--  ${BRAND}`);
    lines.push(`--  Type: ${kind}`);
    lines.push(`--  App ID: ${appid}`);
    lines.push(`--  Name: ${name || 'Unknown'}`);
    lines.push(`--  Generated: ${ts}`);
    lines.push('-- ============================================================');
    lines.push('');
    lines.push(`addappid(${appid})`);
    if (depots.length) {
        lines.push('');
        for (const d of depots) {
            lines.push(`addappid(${d.depotId}, 1, "${d.gid}")`);
            lines.push(`setManifestid(${d.depotId}, "${d.gid}")`);
        }
    } else {
        lines.push('');
        lines.push('-- No public depot manifests were available from the API.');
        lines.push('-- The app id has been registered above.');
    }
    lines.push('');
    lines.push(`-- ${BRAND}`);
    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
//  Full pipeline: given a main appid, return
//  { zipBuffer, fileName, mainName, depotCount, dlcList, warnings }
// ─────────────────────────────────────────────────────────────
async function buildGenPackage(appid) {
    const warnings = [];
    const main = await fetchAppInfo(appid);
    if (!main) {
        throw new Error(`No SteamCMD data found for App ID ${appid}. The game may not be indexed.`);
    }

    const mainName = main?.common?.name || `App ${appid}`;
    const mainDepots = extractDepots(main);
    if (!mainDepots.length) warnings.push(`Main app has no public depot manifests.`);

    const mainLua = buildLua({
        appid: String(appid),
        name: mainName,
        depots: mainDepots,
        kind: 'MAIN APP',
    });

    // ── DLC lookup ─────────────────────────────────────────
    const dlcIds = await fetchDlcAppIds(appid);
    const dlcEntries = [];

    for (const dlcId of dlcIds) {
        const dlcInfo = await fetchAppInfo(dlcId);
        if (!dlcInfo) {
            dlcEntries.push({ appid: dlcId, name: `DLC ${dlcId}`, depots: [], lua: null });
            continue;
        }
        const dlcName = dlcInfo?.common?.name || `DLC ${dlcId}`;
        const dlcDepots = extractDepots(dlcInfo);
        const dlcLua = buildLua({
            appid: String(dlcId),
            name: dlcName,
            depots: dlcDepots,
            kind: 'DLC',
        });
        dlcEntries.push({ appid: String(dlcId), name: dlcName, depots: dlcDepots, lua: dlcLua });
    }

    // ── Build ZIP ──────────────────────────────────────────
    const zip = new JSZip();
    zip.file(`${appid}.lua`, mainLua);

    const dlcFolder = zip.folder('dlc');
    for (const d of dlcEntries) {
        if (d.lua) dlcFolder.file(`${d.appid}.lua`, d.lua);
    }

    // Small README inside the zip for brand + metadata
    const readme = [
        `${BRAND}`,
        `============================================`,
        `App ID: ${appid}`,
        `Name: ${mainName}`,
        `Depots (main): ${mainDepots.length}`,
        `DLC entries: ${dlcEntries.length}`,
        `Generated: ${new Date().toISOString()}`,
        ``,
        `Contents:`,
        `  - ${appid}.lua         (main app)`,
        `  - dlc/*.lua            (per-DLC lua files, if any)`,
        ``,
        `Drop the .lua files into your SteamTools / DepotDownloader config folder.`,
    ].join('\n');
    zip.file('README.txt', readme);

    const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
    });

    return {
        zipBuffer,
        fileName: `gen-${appid}.zip`,
        mainName,
        depotCount: mainDepots.length,
        dlcList: dlcEntries,
        warnings,
    };
}

module.exports = { buildGenPackage, BRAND };
