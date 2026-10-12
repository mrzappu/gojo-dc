// ============================================================
//  GOJO BOT — Steam Depot / Manifest Utility
//  Uses api.steamcmd.net (public anonymous mirror) to fetch
//  app + DLC depot manifests and build SteamTools-style Lua.
//  Bundles a Windows loader EXE + password-protected ZIP.
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
//  SteamTools/OpenSteamTool expect this as the 3rd addappid arg.
//  If a depot has no key, "0" is the correct placeholder.
// ─────────────────────────────────────────────────────────────
function normalizeKey(raw) {
    if (typeof raw !== 'string') return '0';
    const s = raw.trim();
    if (/^[0-9a-fA-F]{64}$/.test(s)) return s;
    return '0';
}

function extractDepots(appEntry) {
    const out = [];
    if (!appEntry || !appEntry.depots) return out;
    for (const [depotId, depot] of Object.entries(appEntry.depots)) {
        if (!/^\d+$/.test(depotId)) continue;
        if (depotId === '0') continue;

        const publicManifest = depot?.manifests?.public;
        const gid = publicManifest?.gid || publicManifest?.gid_string || null;
        if (!gid) continue;

        // Decryption key locations seen in steamcmd.net output:
        //   depot.config.key   (most common)
        //   depot.key          (fallback)
        const rawKey = depot?.config?.key || depot?.key || null;
        const decryptionKey = normalizeKey(rawKey);

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
//  Lua builder — correct format for SteamTools/OpenSteamTool:
//    addappid(APPID)
//    addappid(DEPOTID, 1, "DECRYPTION_KEY_HEX_64")
//    setManifestid(DEPOTID, "MANIFEST_GID")
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
            // 3rd arg = depot decryption key (64 hex) or "0" if unencrypted
            lines.push(`addappid(${d.depotId}, 1, "${d.decryptionKey}")`);
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
        ` Key        : ${depot.decryptionKey === '0' ? 'not available (public)' : depot.decryptionKey}`,
        ` Encrypted  : ${depot.encrypted ? 'yes' : 'no'}`,
        ` Size       : ${depot.size} bytes`,
        ` Download   : ${depot.download} bytes`,
        ` Generated  : ${ts}`,
        '============================================================',
        '',
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────
//  Full pipeline — build the encrypted ZIP
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

    const encryptedMain = mainDepots.filter(d => d.encrypted).length;
    if (encryptedMain === 0 && mainDepots.length > 0) {
        warnings.push('No depot decryption keys were exposed by the API for this app. Content may remain encrypted.');
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
        encryptionStrength: 3, // 3 = AES-256
    });

    // Main lua
    await zipWriter.add(`${appid}.lua`, new TextReader(mainLua));

    // Main manifests
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

    // Structured JSON
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

    // Main EXE (root)
    if (exeBuffer) {
        await zipWriter.add(EXE_NAME, new Uint8ArrayReader(exeBuffer));
    }

    // DLC folder + per-DLC EXE copy
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

    // README (no extract.bat anymore)
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
        `  - ${EXE_NAME}  (loader)`,
        `  - dlc/<dlcid>.lua`,
        `  - dlc/<dlcid>-manifests/<depotId>.manifest`,
        `  - dlc/${EXE_NAME}  (duplicate, for DLC-only extraction)`,
        '',
        'HOW TO EXTRACT:',
        '  This archive is AES-256 password-protected.',
        '  The password is shown in the Discord message that delivered this zip.',
        '',
        '  Option A (recommended):',
        '    1. Install 7-Zip (https://7-zip.org)',
        '    2. Right-click the .zip > 7-Zip > Extract Here',
        '    3. Enter the password when prompted',
        '',
        '  Option B:',
        '    Open the .zip in WinRAR, enter the password, extract.',
        '',
        'LUA FORMAT:',
        '  addappid(APPID)',
        '  addappid(DEPOTID, 1, "DECRYPTION_KEY")',
        '  setManifestid(DEPOTID, "MANIFEST_GID")',
        '  The 3rd argument on addappid is the depot decryption key.',
        '  If a depot is unencrypted, the key is "0".',
        '',
        '  .manifest files are depot listings (ID + key + GID + size),',
        '  not Steam CDN binary manifests.',
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
