// ============================================================
//  COMMAND: /untimeout
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config = require('../../config');
const { modLogEmbed, CV2_FLAGS, replyError } = require('../../utils/embedBuilder');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove a timeout from a member (restores roles)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('Member to un-timeout').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) return replyError(interaction, 'Member not found.');
        
        // Sometimes Discord cache is weird, so we still proceed with role restoration if they have a DB record even if isCommunicationDisabled is false.
        const dbRecord = await db.getMemberTimeout(target.id, interaction.guild.id);

        if (!target.isCommunicationDisabled() && !dbRecord) {
            return replyError(interaction, 'This member is not currently timed out and has no saved roles.');
        }

        await interaction.deferReply({ ephemeral: false });

        // Remove Discord timeout if active
        if (target.isCommunicationDisabled()) {
            await target.timeout(null, reason);
        }

        const blacklistRoleId = '1531296667742244995';

        if (dbRecord) {
            try {
                const savedRoles = JSON.parse(dbRecord.roles || '[]');
                
                // Add saved roles back
                if (savedRoles.length > 0) {
                    await target.roles.add(savedRoles, 'Timeout removed (Restored roles)').catch(console.error);
                }
                
                // Remove blacklist role
                const blacklistRole = interaction.guild.roles.cache.get(blacklistRoleId);
                if (blacklistRole && target.roles.cache.has(blacklistRoleId)) {
                    await target.roles.remove(blacklistRole, 'Timeout removed').catch(console.error);
                }

                // Delete the record from DB
                await db.deleteMemberTimeout(dbRecord.id);
            } catch (err) {
                console.error('[Untimeout] Error restoring roles:', err);
            }
        } else {
             // Just try to remove blacklist role anyway if they have it
             const blacklistRole = interaction.guild.roles.cache.get(blacklistRoleId);
             if (blacklistRole && target.roles.cache.has(blacklistRoleId)) {
                 await target.roles.remove(blacklistRole, 'Timeout removed').catch(console.error);
             }
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Timeout Removed`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**User:** ${target.user.tag} (${target.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`
            ));

        await interaction.editReply({ components: [container], flags: CV2_FLAGS });

        const logChId = config.CHANNELS.MOD_LOG;
        if (logChId && !logChId.includes('_HERE')) {
            const logCh = interaction.guild.channels.cache.get(logChId);
            if (logCh) {
                await logCh.send({ embeds: [modLogEmbed({
                    action: 'Remove Timeout',
                    target: target.user,
                    executor: interaction.user,
                    reason,
                    color: config.SUCCESS_COLOR,
                })] });
            }
        }
    },
};
