// ============================================================
//  EVENT: messageCreate  — Auto-mod runner
// ============================================================
const { runAutoMod } = require('../handlers/autoModHandler');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author?.bot) return;
        if (!message.guild)      return;
        await runAutoMod(message);
    },
};
