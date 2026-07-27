// ============================================================
//  EVENT: messageDelete  — Text log (deleted messages)
// ============================================================
const config = require('../config');
const { messageDeleteEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        // Ignore DMs, bots, empty messages (uncached)
        if (!message.guild) return;
        if (message.author?.bot) return;

        const chId = config.CHANNELS.TEXT_LOG;
        if (!chId || chId.includes('_HERE')) return;

        const logCh = message.guild.channels.cache.get(chId);
        if (!logCh) return;

        // Build and send embed — skip if no content & no attachments
        if (!message.content && !message.attachments?.size) return;

        const embed = messageDeleteEmbed({ message });

        const files = message.attachments?.size
            ? [...message.attachments.values()].map(a => a.url)
            : [];

        await logCh.send({ embeds: [embed] }).catch(() => {});
    },
};
