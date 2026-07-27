// ============================================================
//  GOJO BOT — Entry Point
//  Loads commands, events, keep-alive server, and logs in
// ============================================================
require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
const http = require('http');

const config = require('./config');
const { initDatabase } = require('./utils/database');
const {
    printHeader,
    printLoading,
    printSuccess,
    printError,
    printInfo,
    printWarn,
    colors,
} = require('./utils/logger');

// ─────────────────────────────────────────────────────────────
//  Print startup banner
// ─────────────────────────────────────────────────────────────
printHeader();

// ─────────────────────────────────────────────────────────────
//  Discord Client
// ─────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildModeration,
    ],
});

client.commands = new Collection();

// ─────────────────────────────────────────────────────────────
//  Load Commands  (recursive — walks all subdirectories)
// ─────────────────────────────────────────────────────────────
printLoading('Command modules');

function loadCommandsFrom(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            loadCommandsFrom(fullPath);
        } else if (entry.name.endsWith('.js')) {
            const command = require(fullPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                printWarn(`Skipped invalid command file: ${entry.name}`);
            }
        }
    }
}

loadCommandsFrom(path.join(__dirname, 'commands'));
printSuccess(`Commands loaded (${client.commands.size} total)`);

// ─────────────────────────────────────────────────────────────
//  Load Events
// ─────────────────────────────────────────────────────────────
printLoading('Event handlers');

const eventsPath = path.join(__dirname, 'events');
let loadedEvents = 0;

if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
        const event = require(path.join(eventsPath, file));
        if (!event.name || !event.execute) {
            printWarn(`Skipped invalid event: ${file}`);
            continue;
        }
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        loadedEvents++;
    }
}

printSuccess(`Event handlers loaded (${loadedEvents} events)`);

// ─────────────────────────────────────────────────────────────
//  Register Slash Commands with Discord API
// ─────────────────────────────────────────────────────────────
async function registerCommands() {
    const commands = [...client.commands.values()].map(c => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);

    printLoading('Slash commands (Discord API)');
    await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });
    printSuccess(`Slash commands registered (${commands.length})`);
}

// ─────────────────────────────────────────────────────────────
//  Keep-Alive HTTP Server  (Render free tier stays awake)
// ─────────────────────────────────────────────────────────────
if (config.KEEPALIVE.ENABLED) {
    const server = http.createServer((req, res) => {
        if (req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('GOJO Bot is alive!');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>GOJO Bot</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #0e1117; color: #c9d1d9; font-family: 'Segoe UI', sans-serif; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px;
          padding: 40px 56px; text-align: center; }
  h1 { font-size: 2rem; color: #5865F2; margin-bottom: 8px; }
  p  { color: #8b949e; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #57F287;
         display: inline-block; margin-right: 8px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
</style>
</head>
<body>
<div class="card">
  <h1>✦ GOJO Bot</h1>
  <p><span class="dot"></span>Online and Running</p>
  <p style="margin-top:16px; font-size:13px; color:#30363d;">Powered by Discord.js v14</p>
</div>
</body>
</html>`);
        }
    });

    server.listen(config.KEEPALIVE.PORT, () => {
        printSuccess(`Keep-alive server on port ${config.KEEPALIVE.PORT}`);
    });
}

// ─────────────────────────────────────────────────────────────
//  Ready event hook — register commands after login
// ─────────────────────────────────────────────────────────────
client.once('ready', async () => {
    try {
        await registerCommands();
    } catch (err) {
        printError(`Failed to register commands: ${err.message}`);
    }
});

// ─────────────────────────────────────────────────────────────
//  Error handling
// ─────────────────────────────────────────────────────────────
client.on('error', err => printError(`Client error: ${err.message}`));

process.on('unhandledRejection', err => {
    if (err?.code === 10062 || err?.message?.includes('Unknown interaction')) return;
    printError(`Unhandled rejection: ${err?.message}`);
    console.error(err);
});

process.on('uncaughtException', err => {
    printError(`Uncaught exception: ${err.message}`);
    console.error(err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log(`\n${colors.YELLOW}⚠${colors.RESET}  Shutting down GOJO Bot...`);
    client.destroy();
    process.exit(0);
});

// ─────────────────────────────────────────────────────────────
//  Startup — Init DB first, then login
// ─────────────────────────────────────────────────────────────
async function startup() {
    try {
        printLoading('SQLite database (gojo.db)');
        await initDatabase();
        printSuccess('Database ready — gojo.db');
    } catch (err) {
        printError(`Database init failed: ${err.message}`);
        process.exit(1);
    }

    printLoading('Discord authentication');
    client.login(config.BOT_TOKEN).catch(err => {
        printError(`Failed to login: ${err.message}`);
        process.exit(1);
    });
}

startup();
