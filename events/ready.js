// ============================================================
//  EVENT: ready
// ============================================================
const { ActivityType } = require('discord.js');
const { printReady } = require('../utils/logger');
const db = require('../utils/database');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        printReady(client.user.tag, client.guilds.cache.size);
        client.user.setActivity("GØJO's STEAM LOUNGE", { type: ActivityType.Watching });

        // Start background loop to check for expired timeouts
        setInterval(async () => {
            try {
                const expired = await db.getExpiredTimeouts();
                if (!expired || expired.length === 0) return;

                for (const record of expired) {
                    const guild = client.guilds.cache.get(record.guildId);
                    if (!guild) {
                        // Delete record if guild no longer exists
                        await db.deleteMemberTimeout(record.id);
                        continue;
                    }

                    try {
                        const member = await guild.members.fetch(record.userId).catch(() => null);
                        if (member) {
                            const savedRoles = JSON.parse(record.roles || '[]');
                            const blacklistRoleId = '1531296667742244995';

                            // Add old roles back
                            if (savedRoles.length > 0) {
                                await member.roles.add(savedRoles, 'Timeout expired (Restored roles)').catch(() => {});
                            }
                            
                            // Remove blacklist role
                            if (member.roles.cache.has(blacklistRoleId)) {
                                await member.roles.remove(blacklistRoleId, 'Timeout expired').catch(() => {});
                            }
                        }
                    } catch (err) {
                        console.error(`[TimeoutRestore] Error restoring roles for ${record.userId}:`, err.message);
                    }

                    // Delete record to clean database
                    await db.deleteMemberTimeout(record.id);
                }
            } catch (err) {
                console.error('[TimeoutRestore] Loop error:', err.message);
            }
        }, 60 * 1000); // Check every minute
    },
};
