// ============================================================
//  COMMAND: /ticket-panel  — Admin: Post ticket panel in a channel
// ============================================================

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Post the ticket panel in a channel (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(o =>
            o.setName('channel')
                .setDescription('Channel to post the panel in (defaults to current channel)')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('title')
                .setDescription('Custom panel title')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('description')
                .setDescription('Custom panel description')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const title = interaction.options.getString('title') || 'Support Tickets';
        const desc  = interaction.options.getString('description') ||
            'Need help? Click the button below to open a private support ticket.\n\nOur staff team will assist you as soon as possible.';

        if (!targetChannel.isTextBased()) {
            return replyError(interaction, 'Please select a text channel.');
        }

        // Build the panel
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                '-# Note: Tickets are private. Only staff members can view and assist.'
            ));

        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_create')
                .setLabel('Order Game')
                .setEmoji('1531286917755179220')
                .setStyle(ButtonStyle.Primary)
        );

        container.addActionRowComponents(buttonRow);

        await targetChannel.send({ components: [container], flags: CV2_FLAGS });

        await interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`✅ Ticket panel posted in <#${targetChannel.id}>`)
            )],
            flags: CV2_FLAGS | 64,
        });
    },
};
