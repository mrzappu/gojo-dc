// ============================================================
//  GOJO BOT — Steam Depot / Manifest Utility
//  Uses api.steamcmd.net (public anonymous mirror) to fetch
//  app + DLC depot manifests and build SteamTools-style Lua.
//  Also generates a ZIP containing Lua + .manifest listings.
// ============================================================

const JSZip = require('jszip');

const BRAND = 'Copyright Limited Gojo Steam Lounge';
const API_BASE = 'https://api.steamcmd.net/v1/info';

// ─────────────────────────────────────────────────────────────
//  Fetch raw app info from steamcmd.net
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
//  Extract numeric depots + public manifest GID + sizes
// ─────────────────────────────────────────────────────────────
function extractDepots(appEntry) {
    const out = [];
    if (!appEntry || !appEntry.depots) return out;
    for (const [depotId, depot] of Object.entries(appEntry.depots)) {
        if (!/^\d+$/.test(depotId)) continue;
        if (depotId === '0') continue;

        const publicManifest = depot?.manifests?.public;
        const gid = publicManifest?.gid || publicManifest?.gid_string || null;
        if (!gid) continue;

        out.push({
            depotId,
            gid: String(gid),
            size: Number(publicManifest?.size || 0),
            download: Number(publicManifest?.download || 0),
            name: depot?.name || null,
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────
//  Build a Lua string for one app
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
//  Build a .manifest listing file (text) for a single depot
// ─────────────────────────────────────────────────────────────
function buildManifestFile({ appid, appName, kind, depot }) {
    const ts = new Date().toISOString();
    return [
        '============================================================',
        ` ${BRAND}`,
        '============================================================',
        ` Kind       : ${kind}`,
        ` App ID     : ${appid}`,
        ` App Name   : ${appName || 'Unknown'}`,
        ` Depot ID   : ${depot.depotId}`,
        ` Depot Name : ${depot.name || 'Unnamed'}`,
        ` Manifest   : ${depot.gid}`,
        ` Size       : ${depot.size} bytes`,
        ` Download   : ${depot.download} bytes`,
        ` Generated  : ${ts}`,
        '============================================================',
        '',
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────
//  Full pipeline
// ─────────────────────────────────────────────────────────────
async function buildGenPackage(appid) {
    const warnings = [];
    const main = await fetchAppInfo(appid);
    if (!main) {
        throw new Error(`No SteamCMD data found for App ID ${appid}. The game may not be indexed.`);
    }

    const mainName = main?.common?.name || `App ${appid}`;
    const mainDepots = extractDepots(main);
    if (!mainDepots.length) warnings.push('Main app has no public depot manifests.');

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
            dlcEntries.push({
                appid: dlcId,
                name: `DLC ${dlcId}`,
                depots: [],
                lua: null,
                manifestFiles: [],
            });
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
        const dlcManifestFiles = dlcDepots.map(d => ({
            fileName: `${d.depotId}.manifest`,
            content: buildManifestFile({
                appid: dlcId,
                appName: dlcName,
                kind: 'DLC',
                depot: d,
            }),
        }));
        dlcEntries.push({
            appid: String(dlcId),
            name: dlcName,
            depots: dlcDepots,
            lua: dlcLua,
            manifestFiles: dlcManifestFiles,
        });
    }

    // ── Build ZIP ──────────────────────────────────────────
    const zip = new JSZip();
    zip.file(`${appid}.lua`, mainLua);

    // Main manifests
    const mainManifestFolder = zip.folder('manifests');
    for (const d of mainDepots) {
        mainManifestFolder.file(
            `${d.depotId}.manifest`,
            buildManifestFile({
                appid: String(appid),
                appName: mainName,
                kind: 'MAIN APP',
                depot: d,
            })
        );
    }

    // Structured JSON summary
    const manifestsJson = {
        brand: BRAND,
        generated: new Date().toISOString(),
        app: {
            appid: String(appid),
            name: mainName,
            depots: mainDepots.map(d => ({
                depotId: d.depotId,
                gid: d.gid,
                size: d.size,
                download: d.download,
                name: d.name,
            })),
        },
        dlc: dlcEntries.map(d => ({
            appid: d.appid,
            name: d.name,
            depots: d.depots.map(x => ({
                depotId: x.depotId,
                gid: x.gid,
                size: x.size,
                download: x.download,
                name: x.name,
            })),
        })),
    };
    zip.file('manifests.json', JSON.stringify(manifestsJson, null, 2));

    // DLC Lua + manifests
    const dlcFolder = zip.folder('dlc');
    for (const d of dlcEntries) {
        if (d.lua) dlcFolder.file(`${d.appid}.lua`, d.lua);
        if (d.manifestFiles.length) {
            const dlcManifestFolder = dlcFolder.folder(`${d.appid}-manifests`);
            for (const mf of d.manifestFiles) {
                dlcManifestFolder.file(mf.fileName, mf.content);
            }
        }
    }

    // README
    const readme = [
        `${BRAND}`,
        '============================================',
        `App ID: ${appid}`,
        `Name: ${mainName}`,
        `Depots (main): ${mainDepots.length}`,
        `DLC entries: ${dlcEntries.length}`,
        `Generated: ${new Date().toISOString()}`,
        '',
        'Contents:',
        `  - ${appid}.lua`,
        `  - manifests/<depotId>.manifest`,
        `  - manifests.json`,
        `  - dlc/<dlcid>.lua`,
        `  - dlc/<dlcid>-manifests/<depotId>.manifest`,
        '',
        'Note: .manifest files are depot listings (ID + GID + size),',
        'not Steam CDN binary manifests.',
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
