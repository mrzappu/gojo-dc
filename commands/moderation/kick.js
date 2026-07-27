// ============================================================
//  COMMAND: /kick
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const config = require('../../config');
const { modLogEmbed, CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for kick').setRequired(false)),

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) return replyError(interaction, 'Member not found.');
        if (!target.kickable) return replyError(interaction, 'I cannot kick this member. Check my role hierarchy.');
        if (target.id === interaction.user.id) return replyError(interaction, 'You cannot kick yourself.');

        await interaction.deferReply({ ephemeral: false });

        // DM the user before kicking
        await target.user.send({
            content: `You have been **kicked** from **${interaction.guild.name}**.\n**Reason:** ${reason}`,
        }).catch(() => {});

        await target.kick(reason);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Member Kicked`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**User:** ${target.user.tag} (${target.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`
            ));

        await interaction.editReply({ components: [container], flags: CV2_FLAGS });

        // Log
        const logChId = config.CHANNELS.MOD_LOG;
        if (logChId && !logChId.includes('_HERE')) {
            const logCh = interaction.guild.channels.cache.get(logChId);
            if (logCh) {
                await logCh.send({ embeds: [modLogEmbed({
                    action: 'Kick',
                    target: target.user,
                    executor: interaction.user,
                    reason,
                    color: config.WARN_COLOR,
                })] });
            }
        }
    },
};
