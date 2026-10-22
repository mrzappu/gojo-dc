// ============================================================
//  EVENT: messageCreate  — Auto-mod runner
// ============================================================
const { runAutoMod } = require('../handlers/autoModHandler');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author?.bot) return;
        if (!message.guild) return;

        // Admin-only negative feedback: -rep @member reason (configured vouch channel only).
        if (/^-rep(?:\s|$)/i.test(message.content.trim())) {
            const config = require('../config');
            const channelId = config.VOUCH?.CHANNEL_ID;
            if (!channelId || message.channelId !== channelId) {
                if (channelId) await message.reply(`Negative feedback can only be recorded in <#${channelId}>.`).catch(() => {});
                return;
            }
            if (!message.member?.permissions?.has('ManageGuild')) {
                await message.reply('Only admins with Manage Server permission can record negative feedback.').catch(() => {});
                return;
            }
            const target = message.mentions.users.first() || (message.content.trim().match(/\b\d{17,20}\b/) && await message.client.users.fetch(message.content.trim().match(/\b\d{17,20}\b/)[0]).catch(() => null));
            const remainder = message.content.trim().replace(/^-rep\s*/i, '').replace(/<@!?\d{17,20}>|\b\d{17,20}\b/, '').trim();
            if (!target || !remainder) {
                await message.reply('Usage: `-rep @member brief factual reason`').catch(() => {});
                return;
            }
            const { VouchFeedback } = require('../utils/database');
            const reason = remainder.slice(0, 1000).replace(/@/g, '@\u200b');
            await VouchFeedback.create({ guildId: message.guildId, userId: target.id, adminId: message.author.id, reason });
            const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
            const { CV2_FLAGS } = require('../utils/embedBuilder');
            const card = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('## ⚠️ Admin-Recorded Negative Feedback'))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Member**\n<@${target.id}> · ID: ${target.id}\n\n**Feedback**\n${reason}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Recorded by <@${message.author.id}> • GOJO feedback record`));
            await message.channel.send({ components: [card], flags: CV2_FLAGS, allowedMentions: { users: [] } }).catch(() => {});
            await message.delete().catch(() => {});
            return;
        }

        // Prefix lookup: -p @member (restricted to the configured vouch channel).
        if (/^-p(?:\s|$)/i.test(message.content.trim())) {
            const config = require('../config');
            const channelId = config.VOUCH?.CHANNEL_ID;
            if (!channelId || message.channelId !== channelId) {
                if (channelId) await message.reply(`Vouch lookups are only available in <#${channelId}>.`).catch(() => {});
                return;
            }
            const target = message.mentions.users.first() || (message.content.trim().match(/\b\d{17,20}\b/) && await message.client.users.fetch(message.content.trim().match(/\b\d{17,20}\b/)[0]).catch(() => null));
            if (!target) {
                await message.reply('Usage: `-p @member` or `-p DISCORD_USER_ID`').catch(() => {});
                return;
            }
            const { Vouch } = require('../utils/database');
            const { EmbedBuilder } = require('discord.js');
            const records = await Vouch.findAll({ where: { guildId: message.guildId, userId: target.id }, order: [['createdAt', 'DESC']] }).catch(() => []);
            const totalQty = records.reduce((sum, row) => sum + Number(row.quantity), 0);
            const totalSpent = records.reduce((sum, row) => sum + Number(row.totalPrice), 0);
            const byProduct = new Map();
            for (const row of records) {
                const current = byProduct.get(row.productName) || { qty: 0, amount: 0, maxUnitPrice: 0 };
                current.qty += Number(row.quantity);
                current.amount += Number(row.totalPrice);
                current.maxUnitPrice = Math.max(current.maxUnitPrice, Number(row.unitPrice));
                byProduct.set(row.productName, current);
            }
            const productLines = [...byProduct.entries()].slice(0, 15).map(([name, item]) => `• **${name}** — Qty: ${item.qty} · Total: ₹${item.amount.toFixed(2)} · Max unit price: ₹${item.maxUnitPrice.toFixed(2)}`);
            const embed = new EmbedBuilder().setTitle('🧾 Member Vouch Details').setThumbnail(target.displayAvatarURL()).setDescription(`Member: <@${target.id}>\nVouch entries: **${records.length}**\nTotal product quantity: **${totalQty}**\nTotal recorded amount: **₹${totalSpent.toFixed(2)}**\n\n**Product details**\n${productLines.length ? productLines.join('\n') : 'No confirmed vouches found.'}`).setFooter({ text: 'GOJO • Customer-confirmed purchase records' }).setTimestamp();
            await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => {});
            return;
        }

        await runAutoMod(message);
    },
};
