// ============================================================
//  COMMAND: /ban
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config = require('../../config');
const { modLogEmbed, CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for ban').setRequired(false))
        .addIntegerOption(o => o.setName('delete_days').setDescription('Delete message history (days)').setMinValue(0).setMaxValue(7)),

    async execute(interaction) {
        const target  = interaction.options.getMember('user') || interaction.options.getUser('user');
        const reason  = interaction.options.getString('reason') || 'No reason provided';
        const delDays = interaction.options.getInteger('delete_days') ?? 0;

        if (!target) return replyError(interaction, 'User not found.');
        const user = target.user || target;

        if (target.bannable === false) return replyError(interaction, 'I cannot ban this member. Check my role hierarchy.');
        if (user.id === interaction.user.id) return replyError(interaction, 'You cannot ban yourself.');

        await interaction.deferReply({ ephemeral: false });

        // DM before ban
        await user.send({
            content: `You have been **banned** from **${interaction.guild.name}**.\n**Reason:** ${reason}`,
        }).catch(() => {});

        await interaction.guild.members.ban(user.id, { reason, deleteMessageDays: delDays });

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Member Banned`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**User:** ${user.tag} (${user.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Message History Deleted:** ${delDays} day(s)`
            ));

        await interaction.editReply({ components: [container], flags: CV2_FLAGS });

        // Log
        const logChId = config.CHANNELS.MOD_LOG;
        if (logChId && !logChId.includes('_HERE')) {
            const logCh = interaction.guild.channels.cache.get(logChId);
            if (logCh) {
                await logCh.send({ embeds: [modLogEmbed({
                    action: 'Ban',
                    target: user,
                    executor: interaction.user,
                    reason,
                    color: config.ERROR_COLOR,
                })] });
            }
        }
    },
};
