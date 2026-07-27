// ============================================================
//  GOJO BOT — Console Logger
//  Matches the colorful style from Infinity Music Bot
// ============================================================

const colors = {
    CYAN:   '\x1b[96m',
    PURPLE: '\x1b[95m',
    PINK:   '\x1b[38;5;213m',
    BLUE:   '\x1b[94m',
    GREEN:  '\x1b[92m',
    YELLOW: '\x1b[93m',
    RED:    '\x1b[91m',
    WHITE:  '\x1b[97m',
    GRAY:   '\x1b[90m',
    BOLD:   '\x1b[1m',
    DIM:    '\x1b[2m',
    RESET:  '\x1b[0m',
};

function printHeader() {
    console.log(`\n${colors.CYAN}╭─────────────────────────────────────────────────────────────╮${colors.RESET}`);
    console.log(`${colors.CYAN}│${colors.RESET}                    ${colors.BOLD}${colors.PURPLE}✦  GOJO BOT  ✦${colors.RESET}                     ${colors.CYAN}│${colors.RESET}`);
    console.log(`${colors.CYAN}│${colors.RESET}          ${colors.DIM}${colors.WHITE}Moderation • Tickets • Auto-Mod • Logging${colors.RESET}         ${colors.CYAN}│${colors.RESET}`);
    console.log(`${colors.CYAN}╰─────────────────────────────────────────────────────────────╯${colors.RESET}\n`);
}

function printSeparator() {
    const sep = `${colors.CYAN}─${colors.PURPLE}─${colors.BLUE}─${colors.RESET}`;
    console.log(`   ${sep.repeat(20)}`);
}

function printLoading(msg) {
    console.log(`${colors.BLUE}◆${colors.RESET} ${colors.DIM}Loading${colors.RESET} ${colors.WHITE}${msg}${colors.RESET}${colors.DIM}...${colors.RESET}`);
}

function printSuccess(msg) {
    console.log(`${colors.GREEN}✓${colors.RESET} ${colors.WHITE}${msg}${colors.RESET}`);
}

function printError(msg) {
    console.log(`${colors.RED}✗${colors.RESET} ${colors.BOLD}Error:${colors.RESET} ${msg}`);
}

function printInfo(msg) {
    console.log(`${colors.PURPLE}ⓘ${colors.RESET} ${colors.WHITE}${msg}${colors.RESET}`);
}

function printWarn(msg) {
    console.log(`${colors.YELLOW}⚠${colors.RESET} ${colors.WHITE}${msg}${colors.RESET}`);
}

function printReady(tag, guilds) {
    printSeparator();
    console.log(`\n   ${colors.BOLD}${colors.PURPLE}✦ GOJO Online ✦${colors.RESET}`);
    console.log(`   ${colors.DIM}${colors.WHITE}Logged in as ${colors.PURPLE}${tag}${colors.RESET}`);
    console.log(`   ${colors.DIM}${colors.GRAY}Serving ${guilds} guild(s)${colors.RESET}\n`);
    printSeparator();
    console.log();
}

module.exports = { printHeader, printLoading, printSuccess, printError, printInfo, printWarn, printReady, printSeparator, colors };
