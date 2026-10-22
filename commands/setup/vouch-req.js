const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const crypto = require('crypto');
const config = require('../../config');
const { VouchRequest } = require('../../utils/database');
const { CV2_FLAGS } = require('../../utils/embedBuilder');

function money(value) { return `₹${Number(value).toFixed(2)}`; }
function tickEmoji() {
    const id = config.VOUCH?.TICK_EMOJI_ID;
    return id ? { id, animated: true } : { name: '✅' };
}
function vouchCard({ memberId, product, quantity, unitPrice, totalPrice, paymentMethod, transactionId, status = 'Purchase Vouch Request', adminId, confirmed = false }) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${confirmed ? '✅ LEGIT PURCHASED' : '🧾 Purchase Vouch Request'}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**Customer**\n<@${memberId}>\n\n` +
            `**Product**\n${product}\n\n` +
            `**Quantity**\n×${quantity}\n\n` +
            `**Price**\n${money(totalPrice)} total (${money(unitPrice)} each)\n\n` +
            `**Payment Method**\n${paymentMethod}\n\n` +
            `**Transaction ID**\n${transactionId || 'Not provided'}`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            confirmed
                ? `-# Purchase confirmed by <@${memberId}> • Requested by <@${adminId}> • GOJO Verified Vouch`
                : `<@${memberId}>, please check the purchase details above. Press the tick button to confirm that this purchase is yours.\n-# Vouch is added to your profile only after your confirmation.`
        ));
    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vouch-req')
        .setDescription('Request customer confirmation for a purchase vouch')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('member').setDescription('Customer who purchased the product').setRequired(true))
        .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(true).setMaxLength(100))
        .addIntegerOption(o => o.setName('quantity').setDescription('Quantity purchased').setRequired(true).setMinValue(1).setMaxValue(100000))
        .addNumberOption(o => o.setName('price').setDescription('Total price paid in INR').setRequired(true).setMinValue(0).setMaxValue(100000000))
        .addStringOption(o => o.setName('payment_method').setDescription('Payment method, e.g. UPI, PayPal, LTC').setRequired(true).setMaxLength(50))
        .addStringOption(o => o.setName('txn_id').setDescription('Transaction/order ID (optional)').setRequired(false).setMaxLength(100)),

    async execute(interaction) {
        const channelId = config.VOUCH?.CHANNEL_ID;
        if (!channelId) return interaction.reply({ content: 'Vouch system is not configured. Set VOUCH_CHANNEL_ID and restart the bot.', ephemeral: true });
        if (interaction.channelId !== channelId) return interaction.reply({ content: `Please use this command in <#${channelId}>.`, ephemeral: true });
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Only admins with Manage Server permission can request vouches.', ephemeral: true });

        const member = interaction.options.getUser('member', true);
        const product = interaction.options.getString('product', true).trim().replace(/@/g, '@\u200b');
        const quantity = interaction.options.getInteger('quantity', true);
        const totalPrice = Number(interaction.options.getNumber('price', true).toFixed(2));
        const unitPrice = Number((totalPrice / quantity).toFixed(2));
        const paymentMethod = interaction.options.getString('payment_method', true).trim();
        const transactionId = interaction.options.getString('txn_id')?.trim() || null;
        const requestId = crypto.randomUUID();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vouch_confirm:${requestId}`).setLabel('Confirm Vouch').setEmoji(tickEmoji()).setStyle(ButtonStyle.Success)
        );
        await interaction.deferReply({ ephemeral: true });
        const message = await interaction.channel.send({
            components: [vouchCard({ memberId: member.id, product, quantity, unitPrice, totalPrice, paymentMethod, transactionId, adminId: interaction.user.id }) , row],
            flags: CV2_FLAGS,
            allowedMentions: { users: [member.id] },
        });
        try {
            await VouchRequest.create({ id: requestId, guildId: interaction.guildId, channelId: interaction.channelId, messageId: message.id, userId: member.id, adminId: interaction.user.id, productName: product, quantity, unitPrice, totalPrice, paymentMethod, transactionId, status: 'pending' });
        } catch (error) {
            await message.delete().catch(() => {});
            throw error;
        }
        await interaction.editReply({ content: `Purchase confirmation request posted for ${member.tag}.` });
    },
};
