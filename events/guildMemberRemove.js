// ============================================================
//  EVENT: guildMemberRemove  — Leave log
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        const { guild, user } = member;

        const chId = config.CHANNELS.MOD_LOG;
        if (!chId || chId.includes('_HERE')) return;

        const ch = guild.channels.cache.get(chId);
        if (!ch) return;

        const embed = new EmbedBuilder()
            .setColor(config.ERROR_COLOR)
            .setTitle('Member Left')
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
            .addFields(
                { name: 'User',    value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Members', value: guild.memberCount.toLocaleString(), inline: true },
                { name: 'Joined',  value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
            )
            .setFooter({ text: `ID: ${user.id}` })
            .setTimestamp();

        await ch.send({ embeds: [embed] }).catch(() => {});
    },
};
