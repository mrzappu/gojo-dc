// ============================================================
//  GOJO BOT — Ticket Handler
//  Manages: create, claim, unclaim, close, reopen, delete,
//           transcript, add/remove user, log
//  Persistence: SQLite (gojo.db) via Sequelize — ZERO data loss
// ============================================================

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    AttachmentBuilder,
    MessageFlags,
    ChannelType,
} = require('discord.js');

const config  = require('../config');
const { buildTranscript } = require('../utils/transcriptBuilder');
const { ticketLogEmbed, CV2_FLAGS } = require('../utils/embedBuilder');
const db = require('../utils/database');

// ─────────────────────────────────────────────────────────────
//  Ticket control buttons row
// ─────────────────────────────────────────────────────────────
function getTicketButtonRow(claimed = false, closed = false) {
    const row = new ActionRowBuilder();

    if (!closed) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel(claimed ? 'Unclaim' : 'Claim')
                .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setDisabled(false),
            new ButtonBuilder()
                .setCustomId('ticket_add_user')
                .setLabel('Add User')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_remove_user')
                .setLabel('Remove User')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close')
                .setStyle(ButtonStyle.Danger),
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_reopen')
                .setLabel('Reopen')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_transcript')
                .setLabel('Transcript')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_delete')
                .setLabel('Delete Ticket')
                .setStyle(ButtonStyle.Danger),
        );
    }

    return row;
}

// ─────────────────────────────────────────────────────────────
//  CREATE TICKET
// ─────────────────────────────────────────────────────────────
async function createTicket(interaction) {
    const { guild, user } = interaction;

    // Check existing open ticket from DB
    const existing = await db.getOpenTicketByUser(user.id);
    if (existing) {
        return interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`❌ You already have an open ticket: <#${existing.channelId}>`)
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Always use the hardcoded open category + configured roles
    const categoryId    = '1529455858612830238';
    const supportRoleId = config.ROLES.TICKET_SUPPORT;
    const adminRoleId   = config.ROLES.TICKET_ADMIN;

    const channelName = `📜〢${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const permissionOverwrites = [
        { id: guild.id,  deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];

    if (supportRoleId && !supportRoleId.includes('_HERE')) {
        permissionOverwrites.push({
            id: supportRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
        });
    }

    if (adminRoleId && !adminRoleId.includes('_HERE')) {
        permissionOverwrites.push({
            id: adminRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels],
        });
    }

    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites,
        topic: `Ticket by ${user.tag} | User ID: ${user.id}`,
    });

    // ── Save to DB (persistent) ─────────────────────────────
    await db.saveTicket({
        channelId:  ticketChannel.id,
        userId:     user.id,
        userTag:    user.tag,
        guildId:    guild.id,
        claimedBy:  null,
        closed:     false,
    });

    // Post ticket panel in channel
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📜 Ticket — ${user.username}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `${user} opened a ticket.\n\nPlease describe your issue and a staff member will assist you shortly.\n\n-# Opened: <t:${Math.floor(Date.now() / 1000)}:F>`
        ));

    const buttonsRow = getTicketButtonRow(false, false);
    container.addActionRowComponents(buttonsRow);

    await ticketChannel.send({ components: [container], flags: CV2_FLAGS });

    // Log to open channel
    await sendTicketLog(guild, ticketLogEmbed({
        action: 'Created',
        ticket: ticketChannel,
        user:   user,
        executor: user,
    }));

    await interaction.editReply({
        components: [new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`✅ Ticket created: <#${ticketChannel.id}>`)
        )],
        flags: CV2_FLAGS,
    });
}

// ─────────────────────────────────────────────────────────────
//  CLAIM / UNCLAIM
// ─────────────────────────────────────────────────────────────
async function claimTicket(interaction) {
    const { channel, user } = interaction;
    const ticket = await db.getTicket(channel.id);

    if (!ticket) return interaction.reply({ content: 'Not a valid ticket channel.', flags: 64 });

    if (ticket.claimedBy && ticket.claimedBy !== user.id) {
        return interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`❌ This ticket is already claimed by <@${ticket.claimedBy}>.`)
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    }

    const isClaiming = ticket.claimedBy !== user.id;
    const newClaimedBy = isClaiming ? user.id : null;

    // Update DB
    await db.updateTicket(channel.id, { claimedBy: newClaimedBy });

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            isClaiming
                ? `**Ticket Claimed** by ${user}\n-# <t:${Math.floor(Date.now() / 1000)}:R>`
                : `**Ticket Unclaimed** by ${user}\n-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

    const newButtonRow = getTicketButtonRow(isClaiming, false);
    container.addActionRowComponents(newButtonRow);

    await interaction.update({ components: [container], flags: CV2_FLAGS });

    await sendTicketLog(channel.guild, ticketLogEmbed({
        action:   isClaiming ? 'Claimed' : 'Unclaimed',
        ticket:   channel,
        user:     { tag: ticket.userTag, id: ticket.userId },
        executor: user,
    }));
}

// ─────────────────────────────────────────────────────────────
//  CLOSE
// ─────────────────────────────────────────────────────────────
async function closeTicket(interaction) {
    const { channel, user, guild } = interaction;
    const ticket = await db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: 'Not a valid ticket channel.', flags: 64 });

    // Update DB
    await db.updateTicket(channel.id, {
        closed:   true,
        closedAt: new Date(),
        closedBy: user.id,
    });

    // Move to closed category if configured
    const closedCatId = config.CATEGORIES.TICKETS_CLOSED;
    if (closedCatId && !closedCatId.includes('_HERE')) {
        await channel.setParent(closedCatId, { lockPermissions: false }).catch(() => {});
    }

    // Deny send messages for ticket opener
    await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: false,
    }).catch(() => {});

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Ticket Closed`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `Closed by ${user}\n-# <t:${Math.floor(Date.now() / 1000)}:F>`
        ));

    const closedButtons = getTicketButtonRow(false, true);
    container.addActionRowComponents(closedButtons);

    await interaction.update({ components: [container], flags: CV2_FLAGS });

    // Auto-generate transcript on close
    const freshTicket = await db.getTicket(channel.id);
    await generateAndSendTranscript(channel, guild, user, freshTicket || ticket);

    // Log to close channel
    await sendTicketLog(guild, ticketLogEmbed({
        action:   'Closed',
        ticket:   channel,
        user:     { tag: ticket.userTag, id: ticket.userId },
        executor: user,
    }));
}

// ─────────────────────────────────────────────────────────────
//  REOPEN
// ─────────────────────────────────────────────────────────────
async function reopenTicket(interaction) {
    const { channel, user, guild } = interaction;
    const ticket = await db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: 'Not a valid ticket channel.', flags: 64 });

    // Update DB
    await db.updateTicket(channel.id, { closed: false, claimedBy: null });

    // Restore to open category
    const openCatId = '1529455858612830238';
    await channel.setParent(openCatId, { lockPermissions: false }).catch(() => {});

    // Re-allow ticket opener to send messages
    await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel:        true,
        SendMessages:       true,
        ReadMessageHistory: true,
    }).catch(() => {});

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Ticket Reopened`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `Reopened by ${user}\n-# <t:${Math.floor(Date.now() / 1000)}:F>`
        ));

    const openButtons = getTicketButtonRow(false, false);
    container.addActionRowComponents(openButtons);

    await interaction.update({ components: [container], flags: CV2_FLAGS });

    await sendTicketLog(guild, ticketLogEmbed({
        action:   'Reopened',
        ticket:   channel,
        user:     { tag: ticket.userTag, id: ticket.userId },
        executor: user,
    }));
}

// ─────────────────────────────────────────────────────────────
//  DELETE
// ─────────────────────────────────────────────────────────────
async function deleteTicket(interaction) {
    const { channel, user, guild } = interaction;
    const ticket = await db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: 'Not a valid ticket channel.', flags: 64 });

    await interaction.reply({
        components: [new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('🗑️ Deleting ticket in 5 seconds...')
        )],
        flags: CV2_FLAGS | MessageFlags.Ephemeral,
    });

    await sendTicketLog(guild, ticketLogEmbed({
        action:   'Deleted',
        ticket:   channel,
        user:     { tag: ticket.userTag, id: ticket.userId },
        executor: user,
    }));

    // Remove from DB
    await db.deleteTicket(channel.id);

    await new Promise(r => setTimeout(r, 5000));
    await channel.delete('Ticket deleted by staff').catch(() => {});
}

// ─────────────────────────────────────────────────────────────
//  TRANSCRIPT (manual button)
// ─────────────────────────────────────────────────────────────
async function transcriptTicket(interaction) {
    const { channel, user, guild } = interaction;
    const ticket = await db.getTicket(channel.id);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await generateAndSendTranscript(channel, guild, user, ticket || { userTag: 'Unknown', userId: '0', createdAt: new Date() });

    await interaction.editReply({
        components: [new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('✅ Transcript generated and sent to the log channel.')
        )],
        flags: CV2_FLAGS,
    });
}

// ─────────────────────────────────────────────────────────────
//  ADD USER (shows modal)
// ─────────────────────────────────────────────────────────────
async function addUser(interaction) {
    const { channel } = interaction;
    const ticket = await db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: 'Not a valid ticket channel.', flags: 64 });

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
        .setCustomId('ticket_add_user_modal')
        .setTitle('Add User to Ticket');

    const input = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter user ID (e.g. 123456789012345678)');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

// ─────────────────────────────────────────────────────────────
//  REMOVE USER (shows modal)
// ─────────────────────────────────────────────────────────────
async function removeUser(interaction) {
    const { channel } = interaction;
    const ticket = await db.getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: 'Not a valid ticket channel.', flags: 64 });

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
        .setCustomId('ticket_remove_user_modal')
        .setTitle('Remove User from Ticket');

    const input = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('User ID to Remove')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter user ID (e.g. 123456789012345678)');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
}

// ─────────────────────────────────────────────────────────────
//  Handle add/remove user modal submissions
// ─────────────────────────────────────────────────────────────
async function handleAddUserModal(interaction) {
    const { channel, guild } = interaction;
    const rawId = interaction.fields.getTextInputValue('user_id_input').replace(/[<@!>]/g, '');

    try {
        const member = await guild.members.fetch(rawId);
        await channel.permissionOverwrites.edit(member.id, {
            ViewChannel:        true,
            SendMessages:       true,
            ReadMessageHistory: true,
        });
        await interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`✅ Added ${member.user.tag} to the ticket.`)
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    } catch {
        await interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent('❌ User not found. Make sure you entered a valid user ID.')
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    }
}

async function handleRemoveUserModal(interaction) {
    const { channel } = interaction;
    const ticket = await db.getTicket(channel.id);
    const rawId  = interaction.fields.getTextInputValue('user_id_input').replace(/[<@!>]/g, '');

    if (ticket && rawId === ticket.userId) {
        return interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent('❌ You cannot remove the ticket owner.')
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    }

    try {
        await channel.permissionOverwrites.delete(rawId);
        await interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent('✅ User removed from the ticket.')
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    } catch {
        await interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent('❌ Failed to remove user.')
            )],
            flags: CV2_FLAGS | MessageFlags.Ephemeral,
        });
    }
}

// ─────────────────────────────────────────────────────────────
//  GENERATE + SEND TRANSCRIPT
// ─────────────────────────────────────────────────────────────
async function generateAndSendTranscript(channel, guild, executor, ticket) {
    try {
        const messages  = await channel.messages.fetch({ limit: 100 });
        const html = buildTranscript(messages, {
            ticketName: channel.name,
            guildName:  guild.name,
            createdAt:  ticket.createdAt,
            closedBy:   executor.tag || executor.username || 'Unknown',
        });

        const attachment = new AttachmentBuilder(Buffer.from(html, 'utf-8'), {
            name: `transcript-${channel.name}.html`,
        });

        const transcriptChId = config.CHANNELS.TICKET_TRANSCRIPT;
        if (transcriptChId) {
            const transcriptCh = guild.channels.cache.get(transcriptChId);
            if (transcriptCh) {
                const embed = ticketLogEmbed({
                    action:   'Transcript',
                    ticket:   channel,
                    user:     { tag: ticket.userTag, id: ticket.userId },
                    executor,
                });
                await transcriptCh.send({ embeds: [embed], files: [attachment] });
            }
        }
    } catch (err) {
        console.error('[TicketHandler] Transcript error:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────
//  SEND TICKET LOG (routes by action)
// ─────────────────────────────────────────────────────────────
async function sendTicketLog(guild, embed) {
    let chId = config.CHANNELS.TICKET_LOG;  // open / claim / unclaim

    // Route close/delete logs to dedicated close channel
    if (embed.data && embed.data.title &&
        (embed.data.title.includes('Closed') || embed.data.title.includes('Deleted'))) {
        chId = config.CHANNELS.TICKET_CLOSE_LOG || config.CHANNELS.TICKET_LOG;
    }

    if (!chId) return;
    try {
        const ch = guild.channels.cache.get(chId);
        if (ch) await ch.send({ embeds: [embed] });
    } catch (err) {
        console.error('[TicketHandler] Error sending ticket log:', err.message);
    }
}

module.exports = {
    createTicket,
    claimTicket,
    closeTicket,
    reopenTicket,
    deleteTicket,
    transcriptTicket,
    addUser,
    removeUser,
    handleAddUserModal,
    handleRemoveUserModal,
};
