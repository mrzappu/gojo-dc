// ============================================================
//  COMMAND: /embed  — Build & send custom embed messages
//  Supports: title, description, image (url/attachment),
//            footer, channel target, and a link button
// ============================================================

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');
const config = require('../../config');
const { replyError, replySuccess } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Build & send a custom embed message to any channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

        // ── Required ──
        .addChannelOption(o =>
            o.setName('channel')
                .setDescription('Channel to send the embed in')
                .setRequired(true)
        )

        // ── Content ──
        .addStringOption(o =>
            o.setName('title')
                .setDescription('Embed title (supports markdown)')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('description')
                .setDescription('Embed description / body text (use \\n for new lines)')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('footer')
                .setDescription('Footer text at the bottom')
                .setRequired(false)
        )

        // ── Image ──
        .addStringOption(o =>
            o.setName('image')
                .setDescription('Image URL (png/jpg/gif link)')
                .setRequired(false)
        )
        .addAttachmentOption(o =>
            o.setName('image_upload')
                .setDescription('Or drag & drop an image here')
                .setRequired(false)
        )

        // ── Button ──
        .addStringOption(o =>
            o.setName('button_label')
                .setDescription('Link button label (e.g. "Order Now")')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('button_url')
                .setDescription('Link button URL (defaults to ticket channel)')
                .setRequired(false)
        )
        .addStringOption(o =>
            o.setName('button_emoji')
                .setDescription('Button emoji (e.g. 🎮 or custom emoji ID)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel');
        const title         = interaction.options.getString('title');
        const rawDesc       = interaction.options.getString('description');
        const footer        = interaction.options.getString('footer');
        const imageUrl      = interaction.options.getString('image');
        const imageUpload   = interaction.options.getAttachment('image_upload');
        const buttonLabel   = interaction.options.getString('button_label');
        const buttonUrl     = interaction.options.getString('button_url') || 'https://discord.com/channels/1519204760316809297/1526896976505864214';
        const buttonEmoji   = interaction.options.getString('button_emoji');

        // Must be a text channel
        if (!targetChannel.isTextBased()) {
            return replyError(interaction, 'Please select a text channel.');
        }

        // Need at least one content field
        if (!title && !rawDesc && !imageUrl && !imageUpload) {
            return replyError(interaction, 'Provide at least a **title**, **description**, or **image**.');
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Replace literal \n with actual newlines in description
        const description = rawDesc ? rawDesc.replace(/\\n/g, '\n') : null;

        // Resolve image — uploaded attachment takes priority
        const finalImage = imageUpload ? imageUpload.url : imageUrl;

        // ── Build the Standard Embed ─────────────
        const embed = new EmbedBuilder().setColor(config.BOT_COLOR);

        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        if (finalImage) embed.setImage(finalImage);
        if (footer) embed.setFooter({ text: footer });

        // Link Button
        const components = [];
        if (buttonLabel) {
            const btn = new ButtonBuilder()
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Link)
                .setURL(buttonUrl);

            if (buttonEmoji) {
                btn.setEmoji(buttonEmoji);
            }

            const row = new ActionRowBuilder().addComponents(btn);
            components.push(row);
        }

        // ── Send ────────────────────────────────────────────
        try {
            await targetChannel.send({
                embeds: [embed],
                components: components.length > 0 ? components : [],
            });

            await replySuccess(interaction, `Embed successfully sent to <#${targetChannel.id}>`);
        } catch (err) {
            console.error('[Embed Command] Send error:', err);
            await interaction.editReply({
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`❌ Failed to send embed: ${err.message}`)
                )],
                flags: CV2_FLAGS,
            });
        }
    },
};
