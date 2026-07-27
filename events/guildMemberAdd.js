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

        // ── Auto-Format Nickname (Bold Italic Serif + Butterfly 🦋) ──
        try {
            if (member.manageable) {
                const charMap = {
                    'A': '𝑨', 'B': '𝑩', 'C': '𝑪', 'D': '𝑫', 'E': '𝑬', 'F': '𝑭', 'G': '𝑮', 'H': '𝑯', 'I': '𝑰', 'J': '𝑱', 'K': '𝑲', 'L': '𝑳', 'M': '𝑴', 'N': '𝑵', 'O': '𝑶', 'P': '𝑷', 'Q': '𝑸', 'R': '𝑹', 'S': '𝑺', 'T': '𝑻', 'U': '𝑼', 'V': '𝑽', 'W': '𝑾', 'X': '𝑿', 'Y': '𝒀', 'Z': '𝒁',
                    'a': '𝒂', 'b': '𝒃', 'c': '𝒄', 'd': '𝒅', 'e': '𝒆', 'f': '𝒇', 'g': '𝒈', 'h': '𝒉', 'i': '𝒊', 'j': '𝒋', 'k': '𝒌', 'l': '𝒍', 'm': '𝒎', 'n': '𝒏', 'o': '𝒐', 'p': '𝒑', 'q': '𝒒', 'r': '𝒓', 's': '𝒔', 't': '𝒕', 'u': '𝒖', 'v': '𝒗', 'w': '𝒘', 'x': '𝒙', 'y': '𝒚', 'z': '𝒛'
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
