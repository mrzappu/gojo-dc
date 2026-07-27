// ============================================================
//  EVENT: roleDelete
//  Logs when a role is deleted
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'roleDelete',
    async execute(role, client) {
        const logChId = config.CHANNELS.MOD_LOG;
        if (!logChId || logChId.includes('_HERE')) return;

        const logChannel = role.guild.channels.cache.get(logChId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Role Deleted')
            .setColor(config.ERROR_COLOR)
            .addFields(
                { name: 'Name', value: role.name, inline: true },
                { name: 'ID', value: role.id, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Server Logging • ${client.user.username}` });

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};
