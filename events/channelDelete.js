// ============================================================
//  EVENT: channelDelete
//  Logs when a channel is deleted
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'channelDelete',
    async execute(channel, client) {
        if (!channel.guild) return;

        const logChId = config.CHANNELS.MOD_LOG;
        if (!logChId || logChId.includes('_HERE')) return;

        const logChannel = channel.guild.channels.cache.get(logChId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Channel Deleted')
            .setColor(config.ERROR_COLOR)
            .addFields(
                { name: 'Name', value: channel.name || 'Unknown', inline: true },
                { name: 'Type', value: channel.type.toString(), inline: true },
                { name: 'ID', value: channel.id, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Server Logging • ${client.user.username}` });

        if (channel.parent) {
            embed.addFields({ name: 'Category', value: channel.parent.name, inline: true });
        }

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};
