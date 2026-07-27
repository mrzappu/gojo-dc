// ============================================================
//  EVENT: guildMemberAdd  — Welcome message + auto-role
// ============================================================
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const { guild, user } = member;

        // ── Auto-Role ──────────────────────────────────────────
        const roleId = config.ROLES.AUTO_ROLE;
        if (roleId && !roleId.includes('_HERE')) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                await member.roles.add(role).catch(() => {});
            }
        }

        // ── Auto-Format Nickname (Italic Serif + Butterfly 🦋) ──
        try {
            if (member.manageable) {
                const charMap = {
                    'A': '𝒜', 'B': 'ℬ', 'C': '𝒞', 'D': '𝒟', 'E': 'ℰ', 'F': 'ℱ', 'G': '𝒢', 'H': 'ℋ', 'I': 'ℐ', 'J': '𝒥', 'K': '𝒦', 'L': 'ℒ', 'M': 'ℳ', 'N': '𝒩', 'O': '𝒪', 'P': '𝒫', 'Q': '𝒬', 'R': 'ℛ', 'S': '𝒮', 'T': '𝒯', 'U': '𝒰', 'V': '𝒱', 'W': '𝒲', 'X': '𝒳', 'Y': '𝒴', 'Z': '𝒵'
                };
                let uppercaseUser = user.username.toUpperCase();
                let formattedName = uppercaseUser.split('').map(char => charMap[char] || char).join('');
                let finalNickname = `${formattedName} 🦋`;
                if (finalNickname.length <= 32) {
                    await member.setNickname(finalNickname, 'Auto-format nickname on join');
                }
            }
        } catch (err) {
            console.error('[NicknameFormat] Failed to set nickname:', err.message);
        }

        // ── Welcome Channel Embed ──────────────────────────────
        const welcomeChId = config.CHANNELS.WELCOME;
        if (config.WELCOME.ENABLED && welcomeChId && !welcomeChId.includes('_HERE')) {
            const ch = guild.channels.cache.get(welcomeChId);
            if (ch) {
                const memberCount = guild.memberCount;
                const msg = config.WELCOME.MESSAGE
                    .replace('{user}', member.toString())
                    .replace('{username}', user.username)
                    .replace('{guild}', guild.name)
                    .replace('{count}', memberCount.toLocaleString());

                const embed = new EmbedBuilder()
                    .setColor(config.BOT_COLOR)
                    .setDescription(msg)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));

                if (config.WELCOME.FOOTER_TEXT) {
                    embed.setFooter({ 
                        text: config.WELCOME.FOOTER_TEXT
                    });
                }

                if (config.WELCOME.BANNER_URL) {
                    embed.setImage(config.WELCOME.BANNER_URL);
                }

                await ch.send({ content: member.toString(), embeds: [embed] }).catch(() => {});
            }
        }

        // ── DM Welcome ─────────────────────────────────────────
        if (config.WELCOME.DM_ENABLED) {
            const dmMsg = config.WELCOME.DM_MESSAGE
                .replace('{user}', user.toString())
                .replace('{username}', user.username)
                .replace('{guild}', guild.name);

            const dmEmbed = new EmbedBuilder()
                .setColor(config.BOT_COLOR)
                .setTitle(`Welcome to ${guild.name}!`)
                .setDescription(dmMsg)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setTimestamp();

            await user.send({ embeds: [dmEmbed] }).catch(() => {});
        }
    },
};
