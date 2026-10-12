// ============================================================
//  GOJO BOT — Steam Depot / Manifest Utility
//  Fetches depot manifests from api.steamcmd.net and depot
//  decryption keys from public ManifestHub depotkeys.json
//  mirrors. Builds SteamTools Lua + password-protected ZIP.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
    ZipWriter,
    BlobWriter,
    TextReader,
    Uint8ArrayReader,
} = require('@zip.js/zip.js');

const BRAND = 'Copyright Limited Gojo Steam Lounge';
const API_BASE = 'https://api.steamcmd.net/v1/info';
const EXE_PATH = path.join(__dirname, '..', 'assets', 'steam_lounge.exe');
const EXE_NAME = 'steam_lounge.exe';

// ─────────────────────────────────────────────────────────────
//  Public depotkeys.json mirrors (ManifestHub forks)
//  These are raw.githubusercontent URLs. Fetched and merged.
// ─────────────────────────────────────────────────────────────
const DEPOTKEY_SOURCES = [
    'https://raw.githubusercontent.com/fylsdy/ManifestHub/main/depotkeys.json',
    'https://raw.githubusercontent.com/wsxsdyx/ManifestHub1/main/depotkeys.json',
    'https://raw.githubusercontent.com/SteamAutoCracks/ManifestHub/main/depotkeys.json',
];

// ─────────────────────────────────────────────────────────────
//  Random password generator (no confusing chars)
// ─────────────────────────────────────────────────────────────
function generatePassword(len = 8) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
    return out;
}

// ─────────────────────────────────────────────────────────────
//  Load the bundled EXE (returns Buffer or null)
// ─────────────────────────────────────────────────────────────
function loadExe() {
    try {
        if (!fs.existsSync(EXE_PATH)) {
            console.warn(`[steamManifest] EXE not found at ${EXE_PATH} — zip will be built without it.`);
            return null;
        }
        return fs.readFileSync(EXE_PATH);
    } catch (e) {
        console.warn('[steamManifest] Failed to read EXE:', e.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  Fetch + merge depotkeys.json from all sources
//  Returns Map<depotId(string), hexKey(string)>
// ─────────────────────────────────────────────────────────────
async function fetchDepotKeys() {
    const merged = new Map();

    for (const url of DEPOTKEY_SOURCES) {
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': 'GOJO-Steam-Manifest/1.0' },
            });
            if (!r.ok) {
                console.warn(`[steamManifest] depotkeys source HTTP ${r.status}: ${url}`);
                continue;
            }
            const json = await r.json();
            if (!json || typeof json !== 'object') continue;

            let added = 0;
            for (const [depotId, key] of Object.entries(json)) {
                if (!/^\d+$/.test(depotId)) continue;
                if (typeof key !== 'string') continue;
                if (!/^[0-9a-fA-F]{64}$/.test(key)) continue;
                if (!merged.has(depotId)) {
                    merged.set(depotId, key);
                    added++;
                }
            }
            console.log(`[steamManifest] Loaded ${added} keys from ${url} (total ${merged.size})`);
        } catch (e) {
            console.warn(`[steamManifest] depotkeys fetch failed (${url}):`, e.message);
        }
    }

    return merged;
}

// ─────────────────────────────────────────────────────────────
//  SteamCMD API helpers
// ─────────────────────────────────────────────────────────────
async function fetchAppInfo(appid) {
    try {
        const r = await fetch(`${API_BASE}/${encodeURIComponent(String(appid))}`, {
            headers: { 'User-Agent': 'GOJO-Steam-Manifest/1.0' },
        });
        if (!r.ok) return null;
        const json = await r.json();
        return json?.data?.[String(appid)] || null;
    } catch (e) {
        console.warn(`[steamManifest] fetchAppInfo(${appid}) failed:`, e.message);
        return null;
    }
}

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
        return Array.isArray(data.dlc) ? data.dlc.map(String) : [];
    } catch (e) {
        console.warn(`[steamManifest] fetchDlcAppIds(${appid}) failed:`, e.message);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
//  Normalize a decryption key — 64 hex chars, else "0"
// ─────────────────────────────────────────────────────────────
function normalizeKey(raw) {
    if (typeof raw !== 'string') return '0';
    const s = raw.trim();
    if (/^[0-9a-fA-F]{64}$/.test(s)) return s;
    return '0';
}

// ─────────────────────────────────────────────────────────────
//  Extract depots — key resolution order:
//    1. steamcmd.net depot.config.key / depot.key
//    2. merged depotkeys.json map (depotId)
//    3. "0"
// ─────────────────────────────────────────────────────────────
function extractDepots(appEntry, keyMap) {
    const out = [];
    if (!appEntry || !appEntry.depots) return out;
    for (const [depotId, depot] of Object.entries(appEntry.depots)) {
        if (!/^\d+$/.test(depotId)) continue;
        if (depotId === '0') continue;

        const publicManifest = depot?.manifests?.public;
        const gid = publicManifest?.gid || publicManifest?.gid_string || null;
        if (!gid) continue;

        const apiKey = normalizeKey(depot?.config?.key || depot?.key || null);
        const mapKey = keyMap.get(depotId) || null;
        const decryptionKey = apiKey !== '0' ? apiKey : (mapKey ? normalizeKey(mapKey) : '0');

        out.push({
            depotId,
            gid: String(gid),
            decryptionKey,
            size: Number(publicManifest?.size || 0),
            download: Number(publicManifest?.download || 0),
            name: depot?.name || null,
            encrypted: decryptionKey !== '0',
        });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────
//  Lua builder — matches the working format:
//    addappid(APPID)
//    addappid(DEPOTID, 1, "DECRYPTION_KEY")
//    setManifestid(DEPOTID, "MANIFEST_GID", SIZE)
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
            lines.push(`addappid(${d.depotId}, 1, "${d.decryptionKey}")`);
            lines.push(`setManifestid(${d.depotId}, "${d.gid}", ${d.size || 0})`);
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
        ` Key        : ${depot.decryptionKey === '0' ? 'not available' : depot.decryptionKey}`,
        ` Encrypted  : ${depot.encrypted ? 'yes' : 'no'}`,
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

    // ── Fetch depot key map first ──────────────────────────
    console.log('[steamManifest] Fetching depot keys from public mirrors...');
    const keyMap = await fetchDepotKeys();
    if (keyMap.size === 0) {
        warnings.push('Could not load any depot key mirrors — decryption keys may be missing.');
    }

    const main = await fetchAppInfo(appid);
    if (!main) {
        throw new Error(`No SteamCMD data found for App ID ${appid}. The game may not be indexed.`);
    }

    const mainName = main?.common?.name || `App ${appid}`;
    const mainDepots = extractDepots(main, keyMap);
    if (!mainDepots.length) warnings.push('Main app has no public depot manifests.');

    const missingKeys = mainDepots.filter(d => d.decryptionKey === '0').length;
    if (missingKeys > 0) {
        warnings.push(`${missingKeys} depot(s) have no decryption key — content may stay encrypted.`);
    }

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
        const dlcDepots = extractDepots(dlcInfo, keyMap);
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

    // ── Load EXE ───────────────────────────────────────────
    const exeBuffer = loadExe();
    if (!exeBuffer) {
        warnings.push(`Bundled EXE not found at assets/${EXE_NAME} — zip will not include it.`);
    }

    // ── Password ───────────────────────────────────────────
    const password = generatePassword(8);

    // ── Build ZIP (AES-256 encrypted) ──────────────────────
    const blobWriter = new BlobWriter('application/zip');
    const zipWriter = new ZipWriter(blobWriter, {
        password,
        encryptionStrength: 3,
    });

    await zipWriter.add(`${appid}.lua`, new TextReader(mainLua));

    for (const d of mainDepots) {
        await zipWriter.add(
            `manifests/${d.depotId}.manifest`,
            new TextReader(buildManifestFile({
                appid: String(appid),
                appName: mainName,
                kind: 'MAIN APP',
                depot: d,
            }))
        );
    }

    const manifestsJson = {
        brand: BRAND,
        generated: new Date().toISOString(),
        app: {
            appid: String(appid),
            name: mainName,
            depots: mainDepots.map(d => ({
                depotId: d.depotId,
                gid: d.gid,
                key: d.decryptionKey,
                encrypted: d.encrypted,
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
                key: x.decryptionKey,
                encrypted: x.encrypted,
                size: x.size,
                download: x.download,
                name: x.name,
            })),
        })),
    };
    await zipWriter.add('manifests.json', new TextReader(JSON.stringify(manifestsJson, null, 2)));

    if (exeBuffer) {
        await zipWriter.add(EXE_NAME, new Uint8ArrayReader(exeBuffer));
    }

    for (const d of dlcEntries) {
        if (d.lua) {
            await zipWriter.add(`dlc/${d.appid}.lua`, new TextReader(d.lua));
        }
        for (const mf of d.manifestFiles) {
            await zipWriter.add(`dlc/${d.appid}-manifests/${mf.fileName}`, new TextReader(mf.content));
        }
        if (exeBuffer) {
            await zipWriter.add(`dlc/${EXE_NAME}`, new Uint8ArrayReader(exeBuffer));
        }
    }

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
        `  - ${EXE_NAME}`,
        `  - dlc/<dlcid>.lua`,
        `  - dlc/<dlcid>-manifests/<depotId>.manifest`,
        `  - dlc/${EXE_NAME}`,
        '',
        'HOW TO EXTRACT:',
        '  This archive is AES-256 password-protected.',
        '  The password is shown in the Discord message that delivered this zip.',
        '',
        '  Use 7-Zip (https://7-zip.org) or WinRAR to extract.',
        '',
        'LUA FORMAT:',
        '  addappid(APPID)',
        '  addappid(DEPOTID, 1, "DECRYPTION_KEY")',
        '  setManifestid(DEPOTID, "MANIFEST_GID", SIZE)',
        '',
        'SOURCES:',
        '  Manifests: api.steamcmd.net',
        '  Keys: ManifestHub public depotkeys.json mirrors',
        '  (fylsdy/ManifestHub, wsxsdyx/ManifestHub1, SteamAutoCracks/ManifestHub)',
    ].join('\n');
    await zipWriter.add('README.txt', new TextReader(readme));

    await zipWriter.close();
    const blob = await blobWriter.getData();
    const zipBuffer = Buffer.from(await blob.arrayBuffer());

    return {
        zipBuffer,
        fileName: `gen-${appid}.zip`,
        password,
        mainName,
        depotCount: mainDepots.length,
        dlcList: dlcEntries,
        hasExe: Boolean(exeBuffer),
        warnings,
    };
}

module.exports = { buildGenPackage, BRAND };
