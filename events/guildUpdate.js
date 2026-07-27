// ============================================================
//  EVENT: guildUpdate
//  Logs when the server is modified (name, icon, etc.)
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'guildUpdate',
    async execute(oldGuild, newGuild, client) {
        const logChId = config.CHANNELS.MOD_LOG;
        if (!logChId || logChId.includes('_HERE')) return;

        const logChannel = newGuild.channels.cache.get(logChId);
        if (!logChannel) return;

        let changes = [];
        if (oldGuild.name !== newGuild.name) {
            changes.push(`**Name:** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
        }
        if (oldGuild.iconURL() !== newGuild.iconURL()) {
            changes.push(`**Icon Changed:** [Old Icon](${oldGuild.iconURL()}) ➔ [New Icon](${newGuild.iconURL()})`);
        }
        if (oldGuild.bannerURL() !== newGuild.bannerURL()) {
            changes.push(`**Banner Changed:** [Old Banner](${oldGuild.bannerURL()}) ➔ [New Banner](${newGuild.bannerURL()})`);
        }
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
            changes.push(`**Vanity URL:** \`${oldGuild.vanityURLCode || 'None'}\` ➔ \`${newGuild.vanityURLCode || 'None'}\``);
        }

        if (changes.length === 0) return; // Ignore other minor changes

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Server Settings Updated')
            .setColor(config.WARN_COLOR)
            .setDescription(changes.join('\n'))
            .setTimestamp()
            .setFooter({ text: `Server Logging • ${client.user.username}` });

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    },
};
