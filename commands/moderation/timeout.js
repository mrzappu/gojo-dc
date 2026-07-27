// ============================================================
//  COMMAND: /timeout
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config = require('../../config');
const { modLogEmbed, CV2_FLAGS, replyError } = require('../../utils/embedBuilder');
const db = require('../../utils/database');

// Duration string parser  (e.g. "10m", "1h", "2d")
function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return val * mult[unit];
}

function formatDuration(ms) {
    const s = ms / 1000;
    if (s < 60)         return `${s}s`;
    if (s < 3600)       return `${s / 60}m`;
    if (s < 86400)      return `${s / 3600}h`;
    return `${s / 86400}d`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member (removes roles, adds blacklist role)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 5m, 1h, 2d — max 28d)').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for timeout')),

    async execute(interaction) {
        const target   = interaction.options.getMember('user');
        const durStr   = interaction.options.getString('duration');
        const reason   = interaction.options.getString('reason') || 'No reason provided';

        if (!target) return replyError(interaction, 'Member not found.');
        if (!target.moderatable) return replyError(interaction, 'I cannot timeout this member.');
        if (target.id === interaction.user.id) return replyError(interaction, 'You cannot timeout yourself.');

        const durationMs = parseDuration(durStr);
        if (!durationMs) return replyError(interaction, 'Invalid duration. Use format: `5m`, `1h`, `2d` (max 28d).');
        if (durationMs > 28 * 24 * 60 * 60 * 1000) return replyError(interaction, 'Maximum timeout duration is 28 days.');

        await interaction.deferReply({ ephemeral: false });

        // Apply Discord timeout
        await target.timeout(durationMs, reason);

        const blacklistRoleId = '1531296667742244995';
        const guildId = interaction.guild.id;

        // Collect removable roles (ignore @everyone, managed roles like bots, or roles higher than the bot)
        const me = interaction.guild.members.me;
        const savedRoles = [];
        const rolesToRemove = [];
        
        target.roles.cache.forEach(role => {
            if (role.id !== guildId && !role.managed && me.roles.highest.position > role.position) {
                savedRoles.push(role.id);
                rolesToRemove.push(role);
            }
        });

        // Save original roles to the database
        const expiresAt = new Date(Date.now() + durationMs);
        await db.saveMemberTimeout({
            userId: target.id,
            guildId: guildId,
            roles: JSON.stringify(savedRoles),
            expiresAt: expiresAt,
        });

        // Update member's roles
        if (rolesToRemove.length > 0) {
            await target.roles.remove(rolesToRemove, 'Timeout applied').catch(console.error);
        }
        
        const blacklistRole = interaction.guild.roles.cache.get(blacklistRoleId);
        if (blacklistRole) {
            await target.roles.add(blacklistRole, 'Timeout applied (Blacklisted)').catch(console.error);
        }

        // DM the user
        await target.user.send({
            content: `You have been **timed out** in **${interaction.guild.name}** for **${durStr}**.\n**Reason:** ${reason}`,
        }).catch(() => {});

        const until = Math.floor(expiresAt.getTime() / 1000);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Member Timed Out`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**User:** ${target.user.tag} (${target.id})\n**Moderator:** ${interaction.user.tag}\n**Duration:** ${durStr}\n**Expires:** <t:${until}:R>\n**Reason:** ${reason}`
            ));

        await interaction.editReply({ components: [container], flags: CV2_FLAGS });

        const logChId = config.CHANNELS.MOD_LOG;
        if (logChId && !logChId.includes('_HERE')) {
            const logCh = interaction.guild.channels.cache.get(logChId);
            if (logCh) {
                await logCh.send({ embeds: [modLogEmbed({
                    action: 'Timeout',
                    target: target.user,
                    executor: interaction.user,
                    reason,
                    duration: durStr,
                    color: config.WARN_COLOR,
                })] });
            }
        }
    },
};
