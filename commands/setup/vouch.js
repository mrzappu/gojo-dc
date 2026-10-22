const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { Vouch, VouchFeedback } = require('../../utils/database');
const { CV2_FLAGS } = require('../../utils/embedBuilder');
function money(value) { return `₹${Number(value).toFixed(2)}`; }
module.exports = {
    data: new SlashCommandBuilder()
        .setName('vouch')
        .setDescription('View a member’s verified purchase history in any channel')
        .addUserOption(o => o.setName('member').setDescription('Member to look up').setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('member', true);
        const records = await Vouch.findAll({ where: { guildId: interaction.guildId, userId: user.id }, order: [['createdAt', 'DESC']] });
        const feedback = await VouchFeedback.findAll({ where: { guildId: interaction.guildId, userId: user.id }, order: [['createdAt', 'DESC']] });
        const totalQty = records.reduce((sum, v) => sum + Number(v.quantity), 0);
        const totalSpent = records.reduce((sum, v) => sum + Number(v.totalPrice), 0);
        const products = new Map();
        for (const v of records) {
            const item = products.get(v.productName) || { qty: 0, amount: 0, maxUnitPrice: 0, methods: new Set() };
            item.qty += Number(v.quantity);
            item.amount += Number(v.totalPrice);
            item.maxUnitPrice = Math.max(item.maxUnitPrice, Number(v.unitPrice));
            if (v.paymentMethod) item.methods.add(v.paymentMethod);
            products.set(v.productName, item);
        }
        const productLines = [...products.entries()].slice(0, 15).map(([name, item]) => `**${name}**\nQty: ×${item.qty} · Total: ${money(item.amount)} · Highest unit price: ${money(item.maxUnitPrice)}\nPayment: ${[...item.methods].join(', ') || 'Not specified'}`);
        const recent = records.slice(0, 8).map(v => `• ${v.productName} ×${v.quantity} — ${money(v.totalPrice)} · ${v.paymentMethod || 'Payment not specified'}${v.transactionId ? ` · TXN: ${v.transactionId}` : ''} · <t:${Math.floor(new Date(v.createdAt).getTime()/1000)}:d>`);
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🧾 Verified Vouch Profile'))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Member**\n<@${user.id}> · ID: ${user.id}\n\n**Confirmed Purchase Vouches**\n${records.length}\n\n**Negative Feedback Reports**\n${feedback.length}\n\n**Products Purchased**\n×${totalQty}\n\n**Total Recorded Spend**\n${money(totalSpent)}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Product Breakdown\n${productLines.length ? productLines.join('\n\n') : 'No confirmed vouches found for this member.'}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Recent Purchases\n${recent.length ? recent.join('\n') : 'No purchase history available.'}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Negative Feedback\n${feedback.length ? feedback.slice(0, 5).map(v => `• ${v.reason} · <t:${Math.floor(new Date(v.createdAt).getTime()/1000)}:d>`).join('\n') : 'No negative feedback recorded.'}\n\n-# GOJO • Confirmed purchases and admin-recorded feedback.`));
        return interaction.reply({ components: [container], flags: CV2_FLAGS });
    },
};
