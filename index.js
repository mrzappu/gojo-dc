// ============================================================
//  GOJO BOT — Entry Point
//  Loads commands, events, keep-alive server, and logs in
// ============================================================
try { require('dotenv').config(); } catch (err) { /* ignore in production */ }

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
            const bootTime = Date.now();
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>GOJO Bot | Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: radial-gradient(circle at top, #1a1e27, #0e1117); color: #c9d1d9; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
  }
  .card { 
      background: rgba(22, 27, 34, 0.8); backdrop-filter: blur(10px);
      border: 1px solid #30363d; border-radius: 16px; width: 450px;
      padding: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  h1 { font-size: 2.2rem; color: #5865F2; margin-bottom: 8px; text-align: center; }
  .status-box {
      background: rgba(46, 51, 59, 0.5); padding: 15px; border-radius: 10px;
      margin: 20px 0; text-align: center; border: 1px solid #30363d;
  }
  .dot { 
      width: 12px; height: 12px; border-radius: 50%; background: #57F287;
      display: inline-block; margin-right: 8px; animation: pulse 2s infinite; 
  }
  @keyframes pulse { 0%,100%{opacity:1; box-shadow:0 0 8px #57f287;} 50%{opacity:.4; box-shadow:none;} }
  
  .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;
  }
  .info-item {
      background: #1c2128; padding: 15px; border-radius: 8px; text-align: center;
      border: 1px solid #30363d;
  }
  .info-item h3 { font-size: 0.9rem; color: #8b949e; text-transform: uppercase; margin-bottom: 5px; }
  .info-item p { font-size: 1.2rem; font-weight: bold; color: #fff; }

  .about-us {
      background: #1c2128; padding: 20px; border-radius: 8px; text-align: center;
      border: 1px solid #30363d; margin-bottom: 20px;
  }
  .about-us h3 { color: #00d2ff; margin-bottom: 10px; }
  .about-us p { font-size: 0.95rem; color: #8b949e; line-height: 1.5; }

  .footer { text-align: center; font-size: 0.85rem; color: #484f58; margin-top: 15px; }
  .footer span { color: #5865F2; font-weight: bold; }
  
  .btn {
      display: block; width: 100%; padding: 12px; background: #ED4245; color: white;
      text-align: center; border-radius: 6px; text-decoration: none; font-weight: bold;
      transition: 0.2s; border: none; cursor: not-allowed; opacity: 0.7;
  }
  .btn:hover { opacity: 1; }
</style>
</head>
<body>
<div class="card">
  <h1>✦ GOJO ✦</h1>
  
  <div class="status-box">
      <p style="font-size: 1.1rem; font-weight: 500; color: #fff;">
          <span class="dot"></span> System Online & Active
      </p>
  </div>

  <div class="info-grid">
      <div class="info-item">
          <h3>Uptime</h3>
          <p id="uptime">00:00:00</p>
      </div>
      <div class="info-item">
          <h3>Cooldown Status</h3>
          <p style="color: #57F287;">Stable</p>
      </div>
  </div>

  <div class="about-us">
      <h3>About Us</h3>
      <p>GOJO is an advanced moderation and utility bot, built to seamlessly manage and protect your community with cutting-edge speed and reliability.</p>
  </div>

  <!-- Locked button since users shouldn't randomly restart via web without auth -->
  <button class="btn" title="Authentication Required">Maintenance / Force Restart</button>

  <div class="footer">
      Developed with ❤️ by <span>Rick</span><br>
      <div style="margin-top: 8px;">Powered by Discord.js v14</div>
  </div>
</div>

<script>
  // Live uptime counter
  const bootTime = ${bootTime};
  setInterval(() => {
      const diff = Math.floor((Date.now() - bootTime) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      document.getElementById('uptime').innerText = \`\${h}:\${m}:\${s}\`;
  }, 1000);
</script>
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
