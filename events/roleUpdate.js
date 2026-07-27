// ============================================================
//  EVENT: roleUpdate
//  Logs when a role is modified (name, color, hoist, etc.)
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'roleUpdate',
    async execute(oldRole, newRole, client) {
        const logChId = config.CHANNELS.MOD_LOG;
        if (!logChId || logChId.includes('_HERE')) return;

        const logChannel = newRole.guild.channels.cache.get(logChId);
        if (!logChannel) return;

        let changes = [];
        if (oldRole.name !== newRole.name) {
            changes.push(`**Name:** \`${oldRole.name}\` ➔ \`${newRole.name}\``);
        }
        if (oldRole.hexColor !== newRole.hexColor) {
            changes.push(`**Color:** \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
        }
        if (oldRole.hoist !== newRole.hoist) {
            changes.push(`**Hoisted:** \`${oldRole.hoist}\` ➔ \`${newRole.hoist}\``);
        }

        if (changes.length === 0) return; // Ignore permission changes for simplicity

        const embed = new EmbedBuilder()
            .setTitle('📝 Role Updated')
            .setColor(config.WARN_COLOR)
            .setDescription(`Role: <@&${newRole.id}> (${newRole.id})\n\n${changes.join('\n')}`)
            .setTimestamp()
            .setFooter({ text: `Server Logging • ${client.user.username}` });

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};
