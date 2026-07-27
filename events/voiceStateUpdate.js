// ============================================================
//  EVENT: voiceStateUpdate  — VC join / leave / move log
// ============================================================
const config = require('../config');
const { vcLogEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const chId = config.CHANNELS.VC_LOG;
        if (!chId || chId.includes('_HERE')) return;

        const guild = oldState.guild;
        const logCh  = guild.channels.cache.get(chId);
        if (!logCh)   return;

        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        let embed = null;

        if (!oldState.channel && newState.channel) {
            // Joined VC
            embed = vcLogEmbed({
                action:  'Joined Voice Channel',
                member,
                channel: newState.channel,
            });
        } else if (oldState.channel && !newState.channel) {
            // Left VC (or disconnected by moderator)
            let actionText = 'Left Voice Channel';
            
            // Check if they were disconnected by a mod
            try {
                const { AuditLogEvent } = require('discord.js');
                const auditLogs = await guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberDisconnect,
                });
                const log = auditLogs.entries.first();
                if (log && log.target.id === member.id && Date.now() - log.createdTimestamp < 5000) {
                    actionText = `Disconnected by ${log.executor.tag}`;
                }
            } catch {}

            embed = vcLogEmbed({
                action:  actionText,
                member,
                channel: oldState.channel,
            });
        } else if (oldState.channelId !== newState.channelId) {
            // Moved between channels
            embed = vcLogEmbed({
                action:     'Moved Voice Channel',
                member,
                channel:    newState.channel,
                oldChannel: oldState.channel,
            });
        } else if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
            // Server muted/deafened by moderator
            const status = [];
            if (oldState.serverMute !== newState.serverMute) status.push(newState.serverMute ? 'Server Muted' : 'Server Unmuted');
            if (oldState.serverDeaf !== newState.serverDeaf) status.push(newState.serverDeaf ? 'Server Deafened' : 'Server Undeafened');
            
            embed = vcLogEmbed({
                action: status.join(' & '),
                member,
                channel: newState.channel,
            });
        }

        if (embed) {
            await logCh.send({ embeds: [embed] }).catch(() => {});
        }
    },
};
