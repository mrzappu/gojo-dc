// ============================================================
//  GOJO BOT — Auto-Mod Handler
//  Handles: toxic words, mass mentions, MrBeast/scam detection
//  All violations → delete message + 5min timeout + log
// ============================================================

const { AttachmentBuilder } = require('discord.js');
const config = require('../config');
const { autoModEmbed } = require('../utils/embedBuilder');

const db = require('../utils/database');

// ─────────────────────────────────────────────────────────────
//  Timeout helper — applies timeout + saves roles + adds blacklist
// ─────────────────────────────────────────────────────────────
async function applyTimeout(member, durationMs, reason) {
    try {
        if (!member.moderatable) return false;
        
        // 1. Apply Discord Timeout
        await member.timeout(durationMs, reason);

        // 2. Blacklist Role Logic
        const blacklistRoleId = '1531296667742244995';
        const guild = member.guild;
        const me = guild.members.me;
        
        const savedRoles = [];
        const rolesToRemove = [];
        
        member.roles.cache.forEach(role => {
            if (role.id !== guild.id && !role.managed && me.roles.highest.position > role.position) {
                savedRoles.push(role.id);
                rolesToRemove.push(role);
            }
        });

        const expiresAt = new Date(Date.now() + durationMs);
        
        await db.saveMemberTimeout({
            userId: member.id,
            guildId: guild.id,
            roles: JSON.stringify(savedRoles),
            expiresAt: expiresAt,
        });

        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove, 'Auto-Mod Timeout').catch(() => {});
        }
        
        const blacklistRole = guild.roles.cache.get(blacklistRoleId);
        if (blacklistRole) {
            await member.roles.add(blacklistRole, 'Auto-Mod Timeout (Blacklisted)').catch(() => {});
        }

        return true;
    } catch (err) {
        console.error('[AutoMod Timeout Error]', err);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
//  Send log to auto-mod log channel (or text log as fallback)
// ─────────────────────────────────────────────────────────────
async function sendAutoModLog(guild, embed) {
    const channelId = config.AUTOMOD.LOG_CHANNEL || config.CHANNELS.TEXT_LOG;
    if (!channelId || channelId.includes('_HERE')) return;
    try {
        const ch = guild.channels.cache.get(channelId);
        if (ch) await ch.send({ embeds: [embed] });
    } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────
//  Warn the user in DMs
// ─────────────────────────────────────────────────────────────
async function warnUser(member, reason) {
    try {
        await member.user.send({
            content: `> **[${member.guild.name}] Auto-Mod Warning**\n> ${reason}\n> You have been timed out for **5 minutes**.`
        });
    } catch { /* DMs may be closed */ }
}

// ─────────────────────────────────────────────────────────────
//  TOXIC WORD CHECK
// ─────────────────────────────────────────────────────────────
async function checkToxicWords(message) {
    if (!config.AUTOMOD.ENABLED) return false;
    if (!config.AUTOMOD.TOXIC_WORDS.length) return false;

    const content = message.content.toLowerCase();
    const found = config.AUTOMOD.TOXIC_WORDS.some(word => content.includes(word.toLowerCase()));

    if (!found) return false;

    // Delete
    try { await message.delete(); } catch { /* already deleted */ }

    // Timeout
    const timedOut = await applyTimeout(
        message.member,
        config.AUTOMOD.TIMEOUT_DURATION_MS,
        'Auto-Mod: Toxic language detected'
    );

    // Warn user
    await warnUser(message.member, 'Toxic / banned word detected in your message.');

    // Log
    const embed = autoModEmbed({
        type: 'Toxic Word',
        member: message.member,
        reason: 'Banned word detected in message',
        action: timedOut ? `Timed out for ${config.AUTOMOD.TIMEOUT_DURATION_MS / 60000} minutes` : 'Message deleted (timeout failed)',
    });
    await sendAutoModLog(message.guild, embed);

    return true;
}

// ─────────────────────────────────────────────────────────────
//  MASS MENTION CHECK
// ─────────────────────────────────────────────────────────────
async function checkMassMention(message) {
    if (!config.AUTOMOD.ENABLED) return false;

    const totalMentions =
        message.mentions.users.size +
        message.mentions.roles.size +
        (message.mentions.everyone ? 1 : 0);

    if (totalMentions < config.AUTOMOD.MASS_MENTION_THRESHOLD) return false;

    // Delete
    try { await message.delete(); } catch { /* already deleted */ }

    // Timeout
    const timedOut = await applyTimeout(
        message.member,
        config.AUTOMOD.TIMEOUT_DURATION_MS,
        'Auto-Mod: Mass mention spam'
    );

    // Warn user
    await warnUser(message.member, `Mass mention spam detected (${totalMentions} mentions).`);

    // Log
    const embed = autoModEmbed({
        type: 'Mass Mention',
        member: message.member,
        reason: `Sent ${totalMentions} mention(s) in a single message`,
        action: timedOut ? `Timed out for ${config.AUTOMOD.TIMEOUT_DURATION_MS / 60000} minutes` : 'Message deleted (timeout failed)',
    });
    await sendAutoModLog(message.guild, embed);

    return true;
}

// ─────────────────────────────────────────────────────────────
//  SCAM / IMAGE SCAM CHECK
//  Checks message text + attachment filenames + image URLs
// ─────────────────────────────────────────────────────────────
async function checkScam(message) {
    if (!config.AUTOMOD.ENABLED) return false;
    if (!config.AUTOMOD.SCAM_KEYWORDS.length) return false;

    const content = message.content.toLowerCase();

    // Build full text to scan (message + attachment names + urls)
    const attachmentText = [...message.attachments.values()]
        .map(a => `${a.name} ${a.url}`)
        .join(' ')
        .toLowerCase();

    const embedText = message.embeds
        .map(e => `${e.title || ''} ${e.description || ''} ${e.url || ''}`)
        .join(' ')
        .toLowerCase();

    const fullText = `${content} ${attachmentText} ${embedText}`;
    const found = config.AUTOMOD.SCAM_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()));

    if (!found) return false;

    // Delete
    try { await message.delete(); } catch { /* already deleted */ }

    // Timeout
    const timedOut = await applyTimeout(
        message.member,
        config.AUTOMOD.TIMEOUT_DURATION_MS,
        'Auto-Mod: Scam / phishing content detected'
    );

    // Warn user
    await warnUser(message.member, 'Scam or phishing content detected in your message.');

    // Log
    const embed = autoModEmbed({
        type: 'Scam / Image Scam',
        member: message.member,
        reason: 'Scam/phishing keyword matched in message or attachment',
        action: timedOut ? `Timed out for ${config.AUTOMOD.TIMEOUT_DURATION_MS / 60000} minutes` : 'Message deleted (timeout failed)',
    });
    await sendAutoModLog(message.guild, embed);

    return true;
}

// ─────────────────────────────────────────────────────────────
//  Main auto-mod runner — call this from messageCreate event
// ─────────────────────────────────────────────────────────────
async function runAutoMod(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;
    if (!message.member)    return;

    // Skip admins / moderators
    if (message.member.permissions.has('Administrator')) return;
    if (message.member.permissions.has('ManageMessages')) return;

    // Run checks in order (stop after first violation)
    if (await checkToxicWords(message))  return;
    if (await checkMassMention(message)) return;
    if (await checkScam(message))        return;
}

module.exports = { runAutoMod, checkToxicWords, checkMassMention, checkScam };
