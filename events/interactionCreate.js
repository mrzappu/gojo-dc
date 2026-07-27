// ============================================================
//  EVENT: interactionCreate
//  Routes slash commands, button clicks, and modal submissions
// ============================================================

const {
    claimTicket,
    closeTicket,
    reopenTicket,
    deleteTicket,
    transcriptTicket,
    addUser,
    removeUser,
    handleAddUserModal,
    handleRemoveUserModal,
} = require('../handlers/ticketHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {

        // ── Slash Commands ─────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (err) {
                if (err.code !== 10062) {
                    console.error(`[CMD Error] ${interaction.commandName}:`, err);
                }
                const errMsg = { content: '❌ There was an error executing this command.', flags: 64 };
                try {
                    if (!interaction.replied && !interaction.deferred) await interaction.reply(errMsg);
                    else if (interaction.deferred) await interaction.editReply(errMsg);
                } catch { /* ignore */ }
            }
            return;
        }

        // ── Button Interactions ────────────────────────────────
        if (interaction.isButton()) {
            const id = interaction.customId;

            // Ticket panel — open a new ticket
            if (id === 'ticket_create') {
                const { createTicket } = require('../handlers/ticketHandler');
                return createTicket(interaction);
            }

            // Ticket management buttons
            const ticketButtonMap = {
                ticket_claim:      claimTicket,
                ticket_close:      closeTicket,
                ticket_reopen:     reopenTicket,
                ticket_delete:     deleteTicket,
                ticket_transcript: transcriptTicket,
                ticket_add_user:   addUser,
                ticket_remove_user: removeUser,
            };

            if (ticketButtonMap[id]) {
                // Check permissions for management buttons
                if (['ticket_claim', 'ticket_close', 'ticket_reopen', 'ticket_delete', 'ticket_transcript', 'ticket_add_user', 'ticket_remove_user'].includes(id)) {
                    const isSupport = interaction.member.roles.cache.has(require('../config').ROLES.TICKET_SUPPORT)
                        || interaction.member.roles.cache.has(require('../config').ROLES.TICKET_ADMIN)
                        || interaction.member.permissions.has('ManageChannels');

                    if (!isSupport && id !== 'ticket_close') {
                        return interaction.reply({ content: '❌ You do not have permission to use this.', ephemeral: true });
                    }
                }
                return ticketButtonMap[id](interaction);
            }
        }

        // ── Modal Submissions ──────────────────────────────────
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'ticket_add_user_modal') {
                return handleAddUserModal(interaction);
            }
            if (interaction.customId === 'ticket_remove_user_modal') {
                return handleRemoveUserModal(interaction);
            }
        }
    },
};
