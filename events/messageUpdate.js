// ============================================================
//  EVENT: messageUpdate  — Text log (edited messages)
// ============================================================
const config = require('../config');
const { messageEditEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.guild) return;
        if (oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // embed unfurl, ignore

        const chId = config.CHANNELS.TEXT_LOG;
        if (!chId || chId.includes('_HERE')) return;

        const logCh = oldMessage.guild.channels.cache.get(chId);
        if (!logCh) return;

        const embed = messageEditEmbed({ oldMsg: oldMessage, newMsg: newMessage });
        await logCh.send({ embeds: [embed] }).catch(() => {});
    },
};
