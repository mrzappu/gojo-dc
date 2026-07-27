# ✦ GOJO BOT

> A full-featured Discord moderation bot — Welcome, Auto-Role, Logging, Moderation, Auto-Mod, and a complete Ticket System with transcripts.

---

## 📁 File & Folder Structure

```
GOJO BOT SRC/
│
├── index.js                         ← Main entry point (loads everything)
├── config.js                        ← ALL configuration (tokens, IDs, settings)
├── package.json                     ← Dependencies
├── render.yaml                      ← Render free-tier deployment config
│
├── commands/
│   ├── moderation/
│   │   ├── kick.js                  ← /kick
│   │   ├── ban.js                   ← /ban
│   │   ├── unban.js                 ← /unban
│   │   ├── timeout.js               ← /timeout
│   │   └── untimeout.js             ← /untimeout
│   │
│   ├── setup/
│   │   ├── rolesetup.js             ← /rolesetup all|autorole|ticketsupport|ticketadmin|view
│   │   └── config-view.js           ← /config
│   │
│   └── tickets/
│       ├── ticket.js                ← /ticket create
│       ├── ticket-panel.js          ← /ticket-panel (admin — posts the button panel)
│       └── ticket-manage.js         ← /ticket-manage claim|close|reopen|delete|transcript|add|remove
│
├── events/
│   ├── ready.js                     ← Bot startup
│   ├── guildMemberAdd.js            ← Welcome + auto-role
│   ├── guildMemberRemove.js         ← Leave log
│   ├── voiceStateUpdate.js          ← VC join/leave/move log
│   ├── messageCreate.js             ← Auto-mod trigger
│   ├── messageDelete.js             ← Deleted message log
│   ├── messageUpdate.js             ← Edited message log
│   └── interactionCreate.js         ← Routes all slash cmds + button clicks + modals
│
├── handlers/
│   ├── autoModHandler.js            ← Toxic word filter, mass mention, scam detection
│   └── ticketHandler.js             ← All ticket logic (create, claim, close, etc.)
│
└── utils/
    ├── logger.js                    ← Colorful console logger
    ├── embedBuilder.js              ← All embed/container builders
    └── transcriptBuilder.js         ← HTML transcript generator
```

---

## ⚙️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure `config.js`
Open `config.js` and fill in every value marked `_HERE`:

| Key | Description |
|---|---|
| `BOT_TOKEN` | Your bot token from [Discord Developer Portal](https://discord.com/developers/applications) |
| `CLIENT_ID` | Your bot's Application/Client ID |
| `OWNER_ID` | Your Discord user ID |
| `CHANNELS.WELCOME` | Channel ID for welcome messages |
| `CHANNELS.VC_LOG` | Channel ID for voice channel logs |
| `CHANNELS.TEXT_LOG` | Channel ID for message delete/edit logs |
| `CHANNELS.MOD_LOG` | Channel ID for moderation actions |
| `CHANNELS.TICKET_LOG` | Channel ID for ticket action logs |
| `CHANNELS.TICKET_TRANSCRIPT` | Channel ID where transcripts are posted |
| `CATEGORIES.TICKETS_OPEN` | Category ID for open ticket channels |
| `CATEGORIES.TICKETS_CLOSED` | Category ID for closed ticket channels |
| `ROLES.AUTO_ROLE` | Role ID given to every new member on join |
| `ROLES.TICKET_SUPPORT` | Role ID that can claim/close tickets |
| `ROLES.TICKET_ADMIN` | Role ID with full ticket control |
| `AUTOMOD.TOXIC_WORDS` | Array of banned words |
| `AUTOMOD.SCAM_KEYWORDS` | Keywords for scam/phishing detection |
| `AUTOMOD.MASS_MENTION_THRESHOLD` | Max mentions before auto-timeout (default: 5) |
| `AUTOMOD.TIMEOUT_DURATION_MS` | Timeout duration in ms (default: 300000 = 5 min) |

### 3. Run Locally
```bash
node index.js
# or for auto-restart on changes:
npx nodemon index.js
```

---

## 🤖 Bot Permissions Required

When inviting the bot, make sure these permissions are granted:

- ✅ Manage Roles
- ✅ Kick Members
- ✅ Ban Members
- ✅ Moderate Members (Timeout)
- ✅ Manage Channels
- ✅ View Channels
- ✅ Send Messages
- ✅ Manage Messages
- ✅ Read Message History
- ✅ Embed Links
- ✅ Attach Files (for transcripts)

**Privileged Gateway Intents** (enable in Developer Portal → Bot):
- ✅ Server Members Intent
- ✅ Message Content Intent

---

## 💬 Slash Commands

### Moderation
| Command | Permission | Description |
|---|---|---|
| `/kick @user [reason]` | Kick Members | Kick a member |
| `/ban @user [reason] [delete_days]` | Ban Members | Ban a member |
| `/unban <user_id> [reason]` | Ban Members | Unban a user by ID |
| `/timeout @user <duration> [reason]` | Moderate Members | Timeout (e.g. `5m`, `1h`, `2d`) |
| `/untimeout @user [reason]` | Moderate Members | Remove a timeout |

### Setup
| Command | Permission | Description |
|---|---|---|
| `/rolesetup all <autorole> <support> <admin>` | Manage Roles | Set all roles at once |
| `/rolesetup autorole <role>` | Manage Roles | Set auto-role for new members |
| `/rolesetup ticketsupport <role>` | Manage Roles | Set ticket support role |
| `/rolesetup ticketadmin <role>` | Manage Roles | Set ticket admin role |
| `/rolesetup view` | Manage Roles | View current role config |
| `/config` | Manage Guild | View full bot configuration |

### Tickets
| Command | Permission | Description |
|---|---|---|
| `/ticket create` | Everyone | Open a new ticket |
| `/ticket-panel [channel] [title] [desc]` | Manage Guild | Post ticket button panel |
| `/ticket-manage claim` | Support Role | Claim/unclaim a ticket |
| `/ticket-manage close [reason]` | Support Role | Close a ticket (generates transcript) |
| `/ticket-manage reopen` | Support Role | Reopen a closed ticket |
| `/ticket-manage delete` | Support Role | Delete ticket channel |
| `/ticket-manage transcript` | Support Role | Manually generate transcript |
| `/ticket-manage add @user` | Support Role | Add user to ticket |
| `/ticket-manage remove @user` | Support Role | Remove user from ticket |

---

## 🎫 Ticket System Flow

```
Admin runs /ticket-panel → Panel posted with [Open a Ticket] button
         ↓
User clicks button → Private ticket-username channel created
         ↓
Ticket panel posted with: [Claim] [Add User] [Remove User] [Close]
         ↓
Staff clicks [Claim] → Panel updates to [Unclaim] + ticket assigned
         ↓
Staff clicks [Close] → Transcript generated → Posted in #transcript-log
                     → Channel moved to closed category
                     → Buttons change to: [Reopen] [Transcript] [Delete Ticket]
         ↓
[Reopen] → Ticket reopened in open category
[Delete Ticket] → Channel deleted after 5 seconds
```

---

## 🛡️ Auto-Mod Rules

| Trigger | Action |
|---|---|
| Message contains a **toxic/banned word** | Delete message → DM warning → 5-min timeout → Log |
| Message has **≥5 @mentions** (users/roles) | Delete message → DM warning → 5-min timeout → Log |
| Message/attachment contains **scam keywords** (MrBeast, free nitro, etc.) | Delete message → DM warning → 5-min timeout → Log |

> **Admins and Manage Messages moderators are exempt from auto-mod.**

---

## 📋 Logging

| Log Type | Channel | What's Logged |
|---|---|---|
| Voice Log | `CHANNELS.VC_LOG` | Member joins/leaves/moves voice channels |
| Text Log | `CHANNELS.TEXT_LOG` | Deleted messages, edited messages, auto-mod actions |
| Mod Log | `CHANNELS.MOD_LOG` | Kick, ban, unban, timeout, untimeout, member leave |
| Ticket Log | `CHANNELS.TICKET_LOG` | Ticket created/claimed/closed/deleted |
| Transcripts | `CHANNELS.TICKET_TRANSCRIPT` | HTML file attached on ticket close |

---

## 🚀 Hosting on Render (Free Tier)

1. Push your bot folder to a **GitHub repository**
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render will detect `render.yaml` automatically
5. In the **Environment** section, add all your env variables:
   - `BOT_TOKEN`
   - `CLIENT_ID`
   - `OWNER_ID`
   - All channel IDs, role IDs, etc.
6. Click **Deploy**

> **Keep-alive:** The bot runs a built-in HTTP server on the configured port.  
> Use [UptimeRobot](https://uptimerobot.com) (free) — set a monitor to ping `https://your-render-url.onrender.com/ping` every **5 minutes** to prevent the free tier from sleeping.

---

## 🌐 UptimeRobot Setup

1. Create a free account at [uptimerobot.com](https://uptimerobot.com)
2. Click **Add New Monitor**
3. Type: **HTTP(s)**
4. URL: `https://your-app-name.onrender.com/ping`
5. Monitoring interval: **5 minutes**
6. Save — your bot will now stay online 24/7!

---

## 📝 Notes

- **Role IDs set with `/rolesetup`** apply for the current session only. To make them permanent, copy the IDs into `config.js`.
- Ticket data is stored **in-memory**. If the bot restarts, ticket state (claim, open/closed) resets. For persistence, add a database (e.g. SQLite, PostgreSQL).
- Transcript HTML files are self-contained dark-theme pages — save them locally or host them.

---

*GOJO Bot — Built with Discord.js v14 • Matching Infinity Music Bot aesthetics*
