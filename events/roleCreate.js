// ============================================================
//  EVENT: roleCreate
//  Logs when a role is created
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'roleCreate',
    async execute(role, client) {
        const logChId = config.CHANNELS.MOD_LOG;
        if (!logChId || logChId.includes('_HERE')) return;

        const logChannel = role.guild.channels.cache.get(logChId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Role Created')
            .setColor(config.SUCCESS_COLOR)
            .addFields(
                { name: 'Name', value: `<@&${role.id}> (${role.name})`, inline: true },
                { name: 'ID', value: role.id, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Server Logging • ${client.user.username}` });

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};
