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
        // Slash-command autocomplete (Steam game title suggestions)
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && typeof command.autocomplete === 'function') {
                try { await command.autocomplete(interaction); }
                catch (err) { console.error(`[Autocomplete Error] ${interaction.commandName}:`, err); try { await interaction.respond([]); } catch {} }
            } else {
                try { await interaction.respond([]); } catch {}
            }
            return;
        }

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

            // Customer confirmation for an admin-created purchase vouch.
            if (id.startsWith('vouch_confirm:')) {
                const { Vouch, VouchRequest } = require('../utils/database');
                const requestId = id.slice('vouch_confirm:'.length);
                const request = await VouchRequest.findByPk(requestId);
                if (!request || request.guildId !== interaction.guildId || request.channelId !== interaction.channelId) {
                    return interaction.reply({ content: 'This vouch request could not be found. Ask an admin to create a new one.', ephemeral: true });
                }
                if (interaction.user.id !== request.userId) {
                    return interaction.reply({ content: 'Only the customer named in this request can confirm it.', ephemeral: true });
                }
                if (request.status !== 'pending') {
                    return interaction.reply({ content: request.status === 'confirmed' ? 'This vouch has already been confirmed.' : 'This vouch request is no longer active.', ephemeral: true });
                }
                if (request.transactionId) {
                    const existing = await Vouch.findOne({ where: { guildId: request.guildId, userId: request.userId, transactionId: request.transactionId } });
                    if (existing) {
                        await request.update({ status: 'duplicate' });
                        return interaction.reply({ content: 'This transaction ID already has a vouch recorded. No duplicate was added.', ephemeral: true });
                    }
                }
                await Vouch.create({
                    guildId: request.guildId,
                    userId: request.userId,
                    adminId: request.adminId,
                    productName: request.productName,
                    quantity: request.quantity,
                    unitPrice: request.unitPrice,
                    totalPrice: request.totalPrice,
                    paymentMethod: request.paymentMethod || 'Not specified',
                    transactionId: request.transactionId,
                });
                await request.update({ status: 'confirmed' });

                const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
                const confirmedCard = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## ✅ LEGIT PURCHASED'))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `**Customer**\n<@${request.userId}>\n\n` +
                        `**Product**\n${request.productName}\n\n` +
                        `**Quantity**\n×${request.quantity}\n\n` +
                        `**Total Price**\n₹${Number(request.totalPrice).toFixed(2)} (₹${Number(request.unitPrice).toFixed(2)} each)\n\n` +
                        `**Payment Method**\n${request.paymentMethod || 'Not specified'}\n\n` +
                        `**Transaction ID**\n${request.transactionId || 'Not provided'}`
                    ))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `**Copyable Vouch Format**\n` +
                        `\`+rep ${request.userId} LEGIT PURCHASED ${request.quantity}X ${String(request.productName).replace(/[\r\n]/g, ' ').toUpperCase()} FOR ₹${Number(request.totalPrice).toFixed(2)} [${String(request.paymentMethod || 'PAYMENT').replace(/[\r\n\[\]]/g, ' ')}]\`\n\n` +
                        `-# Purchase confirmed by <@${request.userId}> • Vouch requested by <@${request.adminId}> • GOJO Verified Vouch`
                    ));
                await interaction.update({ components: [confirmedCard] });
                await interaction.user.send(`Your purchase vouch has been confirmed and added to your profile.\nProduct: ${request.productName} ×${request.quantity}\nTotal: ₹${Number(request.totalPrice).toFixed(2)}\nPayment: ${request.paymentMethod || 'Not specified'}\nThank you!`).catch(() => {});
                return;
            }

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
                    const roles = require('../config').ROLES;
                    const memberRoles = interaction.member?.roles?.cache;
                    const isSupport = interaction.memberPermissions?.has('ManageChannels')
                        || (roles.TICKET_SUPPORT && memberRoles?.has(roles.TICKET_SUPPORT))
                        || (roles.TICKET_ADMIN && memberRoles?.has(roles.TICKET_ADMIN));

                    if (!isSupport && id !== 'ticket_close') {
                        return interaction.reply({ content: '❌ You do not have permission to use this.', ephemeral: true });
                    }
                }
                try {
                    return await ticketButtonMap[id](interaction);
                } catch (err) {
                    console.error(`[Ticket Button Error] ${id}:`, err);
                    const payload = { content: '❌ This ticket action failed. Please check the bot permissions and try again.', ephemeral: true };
                    try { if (interaction.deferred || interaction.replied) await interaction.followUp(payload); else await interaction.reply(payload); } catch {}
                    return;
                }
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
