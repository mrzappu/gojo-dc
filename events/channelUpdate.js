// ============================================================
//  EVENT: channelUpdate
//  Logs when a channel is modified (name, topic, etc.)
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel, client) {
        if (!newChannel.guild) return;

        const logChId = config.CHANNELS.MOD_LOG;
        if (!logChId || logChId.includes('_HERE')) return;

        const logChannel = newChannel.guild.channels.cache.get(logChId);
        if (!logChannel) return;

        let changes = [];
        if (oldChannel.name !== newChannel.name) {
            changes.push(`**Name:** \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
        }
        if (oldChannel.topic !== newChannel.topic) {
            changes.push(`**Topic:** \`${oldChannel.topic || 'None'}\` ➔ \`${newChannel.topic || 'None'}\``);
        }
        if (oldChannel.type !== newChannel.type) {
            changes.push(`**Type:** \`${oldChannel.type}\` ➔ \`${newChannel.type}\``);
        }
        if (oldChannel.parentId !== newChannel.parentId) {
            const oldCat = oldChannel.parent ? oldChannel.parent.name : 'None';
            const newCat = newChannel.parent ? newChannel.parent.name : 'None';
            changes.push(`**Category:** \`${oldCat}\` ➔ \`${newCat}\``);
        }

        if (changes.length === 0) return; // No notable changes

        const embed = new EmbedBuilder()
            .setTitle('📝 Channel Updated')
            .setColor(config.WARN_COLOR)
            .setDescription(`Channel: <#${newChannel.id}> (${newChannel.id})\n\n${changes.join('\n')}`)
            .setTimestamp()
            .setFooter({ text: `Server Logging • ${client.user.username}` });

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};
