// ============================================================
//  COMMAND: /ticket-manage  — Staff ticket management commands
// ============================================================

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
} = require('discord.js');

const {
    claimTicket,
    closeTicket,
    reopenTicket,
    deleteTicket,
    transcriptTicket,
} = require('../../handlers/ticketHandler');

const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');
const config = require('../../config');

function isStaff(member) {
    return member.permissions.has('ManageChannels')
        || member.roles.cache.has(config.ROLES.TICKET_SUPPORT)
        || member.roles.cache.has(config.ROLES.TICKET_ADMIN);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-manage')
        .setDescription('Manage tickets (staff only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub.setName('claim').setDescription('Claim this ticket'))
        .addSubcommand(sub => sub.setName('unclaim').setDescription('Unclaim this ticket'))
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close this ticket')
                .addStringOption(o => o.setName('reason').setDescription('Reason for closing'))
        )
        .addSubcommand(sub => sub.setName('reopen').setDescription('Reopen this ticket'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete this ticket channel'))
        .addSubcommand(sub => sub.setName('transcript').setDescription('Generate a transcript for this ticket'))
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a user to this ticket')
                .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a user from this ticket')
                .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true))
        ),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return replyError(interaction, 'You need the Ticket Support or Ticket Admin role to use this command.');
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'claim' || sub === 'unclaim') {
            return claimTicket(interaction);
        }

        if (sub === 'close') {
            return closeTicket(interaction);
        }

        if (sub === 'reopen') {
            return reopenTicket(interaction);
        }

        if (sub === 'delete') {
            return deleteTicket(interaction);
        }

        if (sub === 'transcript') {
            return transcriptTicket(interaction);
        }

        if (sub === 'add') {
            const user   = interaction.options.getUser('user');
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) return replyError(interaction, 'Member not found.');

            await interaction.channel.permissionOverwrites.edit(member.id, {
                ViewChannel:        true,
                SendMessages:       true,
                ReadMessageHistory: true,
            });

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ Added ${user} to this ticket.`));

            return interaction.reply({ components: [container], flags: CV2_FLAGS | 64 });
        }

        if (sub === 'remove') {
            const user = interaction.options.getUser('user');
            await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ Removed ${user} from this ticket.`));

            return interaction.reply({ components: [container], flags: CV2_FLAGS | 64 });
        }
    },
};
