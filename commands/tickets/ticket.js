// ============================================================
//  COMMAND: /ticket  — User-facing ticket creation
// ============================================================

const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { createTicket } = require('../../handlers/ticketHandler');
const { CV2_FLAGS } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage tickets')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new support ticket')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === 'create') {
            return createTicket(interaction);
        }
    },
};
