// ============================================================
//  COMMAND: /embed  — Build & send custom embed messages
//  Supports: title, description, image (url/attachment),
//            footer, channel target, and a link button
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
    MessageFlags,
    EmbedBuilder,
} = require('discord.js');
const config = require('../../config');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Build & send a custom embed message to any channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

        // ── Required ──
        .addChannelOption(o =>
            o.setName('channel')
            .setDescription('Where to send the embed')
            .setRequired(true)
        )
        // ── Optional Text ──
        .addStringOption(o => o.setName('title').setDescription('Embed title (Markdown allowed)'))
        .addStringOption(o => o.setName('description').setDescription('Main text (Use \\n for newlines)'))
        .addStringOption(o => o.setName('footer').setDescription('Small footer text'))
        // ── Optional Image ──
        .addAttachmentOption(o => o.setName('image_upload').setDescription('Upload an image file'))
        .addStringOption(o => o.setName('image_url').setDescription('Or paste an image URL'))
        // ── Optional Link Button ──
        .addStringOption(o => o.setName('button_label').setDescription('Text on the button (e.g. Go To Ticket)'))
        .addStringOption(o => o.setName('button_url').setDescription('URL for the button'))
        .addStringOption(o => o.setName('button_emoji').setDescription('Emoji for the button')),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel');
        
        const title       = interaction.options.getString('title');
        const rawDesc     = interaction.options.getString('description');
        const footer      = interaction.options.getString('footer');
        const imageUpload = interaction.options.getAttachment('image_upload');
        const imageUrl    = interaction.options.getString('image_url');
        
        const buttonLabel = interaction.options.getString('button_label');
        const buttonUrl   = interaction.options.getString('button_url');
        const buttonEmoji = interaction.options.getString('button_emoji');

        // Validation
        if (!targetChannel.isTextBased()) {
            return replyError(interaction, 'Please select a text-based channel.');
        }

        if (!title && !rawDesc && !imageUpload && !imageUrl) {
            return replyError(interaction, 'Provide at least a **title**, **description**, or **image**.');
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const description = rawDesc ? rawDesc.replace(/\\n/g, '\n') : null;
        const finalImage = imageUpload ? imageUpload.url : imageUrl;

        // ── Build the Container (Components V2) ─────────────
        const container = new ContainerBuilder();

        // Title
        if (title) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${title}`)
            );
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
                    .setDivider(true)
            );
        }

        // Description
        if (description) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(description)
            );
        }

        // Link Button
        if (buttonLabel) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            const btn = new ButtonBuilder()
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Link)
                .setURL(buttonUrl || 'https://discord.com');

            if (buttonEmoji) {
                btn.setEmoji(buttonEmoji);
            }

            container.addActionRowComponents(
                new ActionRowBuilder().addComponents(btn)
            );
        }

        // Footer
        if (footer) {
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
                    .setDivider(true)
            );
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${footer}`)
            );
        }

        // ── Image via Standard Embed ───────────────────────
        // By adding the image as an embed alongside the CV2 components, 
        // it renders as a large full-width banner instead of a small gallery item!
        const embeds = [];
        if (finalImage) {
            embeds.push(new EmbedBuilder().setImage(finalImage).setColor(config.BOT_COLOR));
        }

        // ── Send ────────────────────────────────────────────
        try {
            await targetChannel.send({
                components: [container],
                embeds: embeds,
                flags: CV2_FLAGS,
            });

            await interaction.editReply({
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`✅ Embed sent to <#${targetChannel.id}>`)
                )],
                flags: CV2_FLAGS,
            });
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
