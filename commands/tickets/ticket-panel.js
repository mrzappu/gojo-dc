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
        )
        .addStringOption(o =>
            o.setName('button-label')
                .setDescription('Custom text shown on the ticket button')
                .setMaxLength(80)
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('button-emoji')
                .setDescription('Button emoji: Unicode emoji or custom emoji like <:name:id> / <a:name:id>')
                .setMaxLength(100)
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('footer')
                .setDescription('Custom footer/note text (leave unset to use the default note)')
                .setMaxLength(1000)
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const title = interaction.options.getString('title') || 'Support Tickets';
        const desc  = interaction.options.getString('description') ||
            'Need help? Click the button below to open a private support ticket.\n\nOur staff team will assist you as soon as possible.';
        const buttonLabel = interaction.options.getString('button-label') || 'Create Ticket';
        const buttonEmoji = interaction.options.getString('button-emoji') || '1531286917755179220';
        const footer = interaction.options.getString('footer') ||
            'Note: Tickets are private. Only staff members can view and assist.';

        if (!targetChannel.isTextBased()) {
            return replyError(interaction, 'Please select a text channel.');
        }

        // Build the panel
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));

        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_create')
                .setLabel(buttonLabel)
                .setEmoji(parseButtonEmoji(buttonEmoji))
                .setStyle(ButtonStyle.Secondary)
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

// Accept Unicode emoji, full custom emoji markup, or a custom emoji ID.
function parseButtonEmoji(value) {
    const input = String(value || '').trim();
    const custom = input.match(/^<(?:(a):)?([A-Za-z0-9_]+):(\d+)>$/);
    if (custom) return { id: custom[3], name: custom[2], animated: Boolean(custom[1]) };
    if (/^\d{17,20}$/.test(input)) return { id: input };
    return input;
}
