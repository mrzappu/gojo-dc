// ============================================================
//  GOJO BOT — Master Configuration File
//  All settings, tokens, IDs, thresholds are here.
//  Fill in your values before starting the bot.
// ============================================================

module.exports = {

    // ─────────────────────────────────────────────────────────
    //  BOT CREDENTIALS
    // ─────────────────────────────────────────────────────────
    BOT_TOKEN:  process.env.BOT_TOKEN  || '',
    CLIENT_ID:  process.env.CLIENT_ID  || '1531045656767103006',
    OWNER_ID:   process.env.OWNER_ID   || '1456549998438121556',

    // ─────────────────────────────────────────────────────────
    //  BOT APPEARANCE
    // ─────────────────────────────────────────────────────────
    BOT_NAME:   'GOJO',
    BOT_COLOR:  '#00d2ff',   // Main accent colour (sky blue)
    SUCCESS_COLOR: '#57F287',
    ERROR_COLOR:   '#ED4245',
    WARN_COLOR:    '#FEE75C',
    INFO_COLOR:    '#5865F2',

    // ─────────────────────────────────────────────────────────
    //  CHANNEL IDs  — fill all of these after inviting the bot
    // ─────────────────────────────────────────────────────────
    CHANNELS: {
        WELCOME:      process.env.WELCOME_CHANNEL      || '1526270118949163098',
        VC_LOG:       process.env.VC_LOG_CHANNEL       || '1531265569087557732',
        TEXT_LOG:     process.env.TEXT_LOG_CHANNEL     || '1531265620841070612',
        MOD_LOG:      process.env.MOD_LOG_CHANNEL      || '1531265662113288262',
        TICKET_LOG:   process.env.TICKET_LOG_CHANNEL   || '1529455978142240949', // Open & Claim Logs
        TICKET_CLOSE_LOG: process.env.TICKET_CLOSE_LOG_CHANNEL || '1529476478608216246', // Close logs
        TICKET_TRANSCRIPT: process.env.TICKET_TRANSCRIPT_CHANNEL || '1531265726084808815', // HTML transcripts
    },

    // ─────────────────────────────────────────────────────────
    //  CATEGORY IDs
    // ─────────────────────────────────────────────────────────
    CATEGORIES: {
        TICKETS_OPEN:   process.env.TICKETS_OPEN_CATEGORY   || '1529455858612830238',
        TICKETS_CLOSED: process.env.TICKETS_CLOSED_CATEGORY || 'TICKETS_CLOSED_CATEGORY_ID_HERE',
    },

    // ─────────────────────────────────────────────────────────
    //  ROLE IDs
    // ─────────────────────────────────────────────────────────
    ROLES: {
        AUTO_ROLE:      process.env.AUTO_ROLE_ID      || '1525961584676049038',      // Given on join
        MUTED_ROLE:     process.env.MUTED_ROLE_ID     || '1531296667742244995',     // Muted role (optional)
        TICKET_SUPPORT: process.env.TICKET_SUPPORT_ROLE || 'TICKET-ID', // Can see tickets
        TICKET_ADMIN:   process.env.TICKET_ADMIN_ROLE || 'TICKET_ADMIN_ROLE_ID_HERE',    // Full ticket control
    },

    // ─────────────────────────────────────────────────────────
    //  AUTO-MODERATION SETTINGS
    // ─────────────────────────────────────────────────────────
    AUTOMOD: {
        ENABLED: true,
        // Toxic words are managed only through /automod and data/automod-words.json.
        TOXIC_WORDS: [],

        // Mass mention threshold — any message with this many or more @mentions
        MASS_MENTION_THRESHOLD: 5,

        // Auto-timeout duration in milliseconds (default: 5 minutes)
        TIMEOUT_DURATION_MS: 5 * 60 * 1000,  // 300 000 ms = 5 min

        // MrBeast / image scam keyword detection
        SCAM_KEYWORDS: [
            'mrbeast',
            'mr beast',
            'free nitro',
            'claim prize',
            'click here to claim',
            'you won',
            'you have been selected',
            'discord nitro giveaway',
            'steam gift card',
            'free robux',
            '100 subscribers',
            'giveaway bot',
            'bit.ly',
            'tinyurl',
            'grab.tc',
        ],

        // Log channel for auto-mod actions (falls back to TEXT_LOG if not set)
        LOG_CHANNEL: process.env.AUTOMOD_LOG_CHANNEL || null,
    },

    // ─────────────────────────────────────────────────────────
    //  VOUCH SYSTEM — set VOUCH_CHANNEL_ID in your environment
    // ─────────────────────────────────────────────────────────
    VOUCH: {
        CHANNEL_ID: process.env.VOUCH_CHANNEL_ID || '',
        // Optional custom animated tick emoji ID; leave empty to use a normal check mark.
        TICK_EMOJI_ID: process.env.VOUCH_TICK_EMOJI_ID || '',
    },

    // ─────────────────────────────────────────────────────────
    //  TICKET SETTINGS
    // ─────────────────────────────────────────────────────────
    TICKETS: {
        MAX_PER_USER: 1,                // Max open tickets per user
        TRANSCRIPT_STYLE: 'html',       // 'html' — rich HTML file
    },

    // ─────────────────────────────────────────────────────────
    //  WELCOME MESSAGE
    // ─────────────────────────────────────────────────────────
    WELCOME: {
        ENABLED: true,
        // The custom message template matching your layout and using your specific emoji IDs
        MESSAGE: '◆━━━━━━━━━━━━◆\nWelcome {user}\n◆━━━━━━━━━━━━◆\n\n<a:RunningFallGuys:1531269224864022548> **GET STARTED**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n<a:ArrowRed:1531269240961892422> 📖 Read                <#1526270047893586170> **&** <#1531310355127730310>  \n<a:ArrowRed:1531269240961892422> 📢 Check              <#1529475366165680249>  \n<a:ArrowRed:1531269240961892422> 🛒 Browse            <#1556299276655792238>  \n<a:ArrowRed:1531269240961892422> 🎫 Open Ticket   <#1526896976505864214>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n<a:black_verified:1531269261186830336> Games added to your **Steam Library**  \n<a:black_verified:1531269261186830336> Fast delivery within **5–15 minutes**  \n<a:black_verified:1531269261186830336> **Lifetime support** & **trusted service** \n<a:black_verified:1531269261186830336> No **Steam Tool** method\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nEnjoy your stay at **GØJO\'S STEAM LOUNGE** ✨',
        DM_ENABLED: true,
        DM_MESSAGE: 'Hey {username}! Welcome to **{guild}**. We hope you enjoy your time here!',
        BANNER_URL: 'https://cdn.discordapp.com/attachments/1457735777697009758/1529891653735809247/p8kxbk1.gif?ex=6a683362&is=6a66e1e2&hm=0c79a22f289304f8621c21246812476dc6af12e04722fd9868d16d591717fdb9&',
        FOOTER_TEXT: 'Check out our deals—you won\'t be disappointed! ✨',
    },

    // ─────────────────────────────────────────────────────────
    //  KEEP-ALIVE  (for Render free tier)
    // ─────────────────────────────────────────────────────────
    KEEPALIVE: {
        ENABLED: true,
        PORT: process.env.PORT || 3000,
    },
};
