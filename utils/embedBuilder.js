// ============================================================
//  GOJO BOT — Embed Builder Utility
//  Uses Discord.js Components V2 (ContainerBuilder style)
//  matching Infinity Music Bot aesthetics. NO emojis on buttons.
// ============================================================

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const config = require('../config');

// ─────────────────────────────────────────────────────────────
//  Helper: resolve hex → integer
// ─────────────────────────────────────────────────────────────
function hexToInt(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

// ─────────────────────────────────────────────────────────────
//  buildContainer  — generic Components V2 container
//  opts: { title, description, fields[], footer, color }
// ─────────────────────────────────────────────────────────────
function buildContainer(opts = {}) {
    const { title, description, fields = [], footer } = opts;

    const container = new ContainerBuilder();

    if (title) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${title}`)
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
    }

    if (description) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description)
        );
    }

    for (const field of fields) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${field.name}**\n${field.value}`)
        );
    }

    if (footer) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${footer}`)
        );
    }

    return container;
}

// ─────────────────────────────────────────────────────────────
//  buildEmbed  — standard EmbedBuilder (used for logs)
//  opts: { title, description, fields[], color, footer, thumbnail, image, timestamp }
// ─────────────────────────────────────────────────────────────
function buildEmbed(opts = {}) {
    const embed = new EmbedBuilder()
        .setColor(hexToInt(opts.color || config.BOT_COLOR))
        .setTimestamp();

    if (opts.title)       embed.setTitle(opts.title);
    if (opts.description) embed.setDescription(opts.description);
    if (opts.thumbnail)   embed.setThumbnail(opts.thumbnail);
    if (opts.image)       embed.setImage(opts.image);
    if (opts.footer)      embed.setFooter({ text: opts.footer });

    if (opts.fields && opts.fields.length) {
        embed.addFields(opts.fields.map(f => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false,
        })));
    }

    return embed;
}

// ─────────────────────────────────────────────────────────────
//  Quick success / error containers (ephemeral replies)
// ─────────────────────────────────────────────────────────────
function successContainer(message) {
    return new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`✅ ${message}`)
    );
}

function errorContainer(message) {
    return new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`❌ ${message}`)
    );
}

function warnContainer(message) {
    return new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`⚠️ ${message}`)
    );
}

// ─────────────────────────────────────────────────────────────
//  ComponentsV2 flags shortcut
// ─────────────────────────────────────────────────────────────
const CV2_FLAGS = MessageFlags.IsPersistent | MessageFlags.IsComponentsV2;

// ─────────────────────────────────────────────────────────────
//  replySuccess / replyError — quick ephemeral replies
// ─────────────────────────────────────────────────────────────
async function replySuccess(interaction, message, ephemeral = true) {
    const payload = {
        components: [successContainer(message)],
        flags: ephemeral ? CV2_FLAGS | MessageFlags.Ephemeral : CV2_FLAGS,
    };
    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(payload);
    }
    return interaction.reply(payload);
}

async function replyError(interaction, message, ephemeral = true) {
    const payload = {
        components: [errorContainer(message)],
        flags: ephemeral ? CV2_FLAGS | MessageFlags.Ephemeral : CV2_FLAGS,
    };
    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(payload);
    }
    return interaction.reply(payload);
}

// ─────────────────────────────────────────────────────────────
//  Moderation log embed
// ─────────────────────────────────────────────────────────────
function modLogEmbed(opts) {
    // opts: { action, target, executor, reason, duration, color }
    const fields = [
        { name: 'Target', value: `${opts.target.tag} (${opts.target.id})`, inline: true },
        { name: 'Moderator', value: `${opts.executor.tag} (${opts.executor.id})`, inline: true },
    ];
    if (opts.duration) fields.push({ name: 'Duration', value: opts.duration, inline: true });
    if (opts.reason)   fields.push({ name: 'Reason', value: opts.reason, inline: false });

    return buildEmbed({
        title: `Moderation — ${opts.action}`,
        color: opts.color || config.BOT_COLOR,
        fields,
        footer: `Case logged at`,
    });
}

// ─────────────────────────────────────────────────────────────
//  VC log embed
// ─────────────────────────────────────────────────────────────
function vcLogEmbed(opts) {
    // opts: { action, member, channel, oldChannel }
    const fields = [
        { name: 'Member', value: `${opts.member.user.tag} (${opts.member.id})`, inline: true },
        { name: 'Action', value: opts.action, inline: true },
    ];
    if (opts.channel)    fields.push({ name: 'Channel', value: `<#${opts.channel.id}>`, inline: true });
    if (opts.oldChannel) fields.push({ name: 'From', value: `<#${opts.oldChannel.id}>`, inline: true });

    return buildEmbed({
        title: 'Voice Channel Log',
        color: config.INFO_COLOR,
        fields,
        thumbnail: opts.member.user.displayAvatarURL({ dynamic: true }),
        footer: 'Voice Log',
    });
}

// ─────────────────────────────────────────────────────────────
//  Message log embeds
// ─────────────────────────────────────────────────────────────
function messageDeleteEmbed(opts) {
    // opts: { message }
    const msg = opts.message;
    return buildEmbed({
        title: 'Message Deleted',
        color: config.ERROR_COLOR,
        description: msg.content ? `**Content:**\n${msg.content.slice(0, 1000)}` : '*No text content*',
        fields: [
            { name: 'Author',  value: `${msg.author?.tag || 'Unknown'} (${msg.author?.id || '?'})`, inline: true },
            { name: 'Channel', value: `<#${msg.channelId}>`, inline: true },
        ],
        thumbnail: msg.author?.displayAvatarURL({ dynamic: true }),
        footer: 'Message Log',
    });
}

function messageEditEmbed(opts) {
    // opts: { oldMsg, newMsg }
    return buildEmbed({
        title: 'Message Edited',
        color: config.WARN_COLOR,
        fields: [
            { name: 'Author',  value: `${opts.oldMsg.author?.tag || 'Unknown'} (${opts.oldMsg.author?.id || '?'})`, inline: true },
            { name: 'Channel', value: `<#${opts.oldMsg.channelId}>`, inline: true },
            { name: 'Before',  value: (opts.oldMsg.content || '*empty*').slice(0, 512), inline: false },
            { name: 'After',   value: (opts.newMsg.content || '*empty*').slice(0, 512), inline: false },
        ],
        thumbnail: opts.oldMsg.author?.displayAvatarURL({ dynamic: true }),
        footer: 'Message Log',
    });
}

// ─────────────────────────────────────────────────────────────
//  Auto-mod log embed
// ─────────────────────────────────────────────────────────────
function autoModEmbed(opts) {
    // opts: { type, member, reason, action }
    return buildEmbed({
        title: `Auto-Mod — ${opts.type}`,
        color: config.ERROR_COLOR,
        fields: [
            { name: 'Member',  value: `${opts.member.user.tag} (${opts.member.id})`, inline: true },
            { name: 'Reason',  value: opts.reason, inline: true },
            { name: 'Action',  value: opts.action, inline: true },
        ],
        thumbnail: opts.member.user.displayAvatarURL({ dynamic: true }),
        footer: 'Auto-Mod',
    });
}

// ─────────────────────────────────────────────────────────────
//  Ticket log embed
// ─────────────────────────────────────────────────────────────
function ticketLogEmbed(opts) {
    // opts: { action, ticket (channel), user, executor, reason }
    const fields = [
        { name: 'Ticket Name', value: opts.ticket?.name ? `#${opts.ticket.name}` : 'Unknown', inline: true },
        { name: 'Ticket ID', value: opts.ticket?.id || 'Unknown', inline: true },
        { name: 'User / Creator', value: opts.user ? `<@${opts.user.id}> (${opts.user.tag || opts.user.id})` : 'Unknown', inline: false }
    ];
    
    if (opts.executor) {
        fields.push({ name: 'Performed By', value: `<@${opts.executor.id}> (${opts.executor.tag || opts.executor.username})`, inline: true });
    }
    
    fields.push({ name: 'Logged Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true });
    
    if (opts.reason) {
        fields.push({ name: 'Reason', value: opts.reason, inline: false });
    }

    // Dynamic colors based on action
    let embedColor = config.BOT_COLOR;
    if (opts.action === 'Created' || opts.action === 'Reopened') embedColor = config.SUCCESS_COLOR;
    if (opts.action === 'Closed' || opts.action === 'Deleted') embedColor = config.ERROR_COLOR;
    if (opts.action === 'Claimed') embedColor = config.WARN_COLOR;

    const embedOpts = {
        title: `🎫 Ticket System Log — Action: ${opts.action}`,
        color: embedColor,
        fields,
        footer: 'GØJO\'S STEAM LOUNGE • Ticket System Logs',
    };

    // If we have user/executor avatar, add it as thumbnail
    if (opts.user && typeof opts.user.displayAvatarURL === 'function') {
        embedOpts.thumbnail = opts.user.displayAvatarURL({ dynamic: true });
    } else if (opts.executor && typeof opts.executor.displayAvatarURL === 'function') {
        embedOpts.thumbnail = opts.executor.displayAvatarURL({ dynamic: true });
    }

    return buildEmbed(embedOpts);
}

module.exports = {
    buildContainer,
    buildEmbed,
    successContainer,
    errorContainer,
    warnContainer,
    replySuccess,
    replyError,
    modLogEmbed,
    vcLogEmbed,
    messageDeleteEmbed,
    messageEditEmbed,
    autoModEmbed,
    ticketLogEmbed,
    CV2_FLAGS,
    hexToInt,
};
