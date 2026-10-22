const {
    SlashCommandBuilder, PermissionFlagsBits,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const crypto = require('crypto');
const config = require('../../config');
const { VouchRequest } = require('../../utils/database');
const { CV2_FLAGS } = require('../../utils/embedBuilder');

function money(value) { return `₹${Number(value).toFixed(2)}`; }
function safeText(value) { return String(value ?? '').replace(/@/g, '@\u200b').replace(/[\r\n]+/g, ' ').trim(); }
function quoteProduct(value) { return safeText(value).replace(/\s+/g, ' '); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vouch-req')
        .setDescription('Prepare a purchase vouch command for the vouch channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('member').setDescription('Customer who purchased the product').setRequired(true))
        .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(true).setMaxLength(100))
        .addIntegerOption(o => o.setName('qty').setDescription('Quantity purchased').setRequired(true).setMinValue(1).setMaxValue(100000))
        .addNumberOption(o => o.setName('price').setDescription('Total price paid in INR').setRequired(true).setMinValue(0).setMaxValue(100000000))
        .addStringOption(o => o.setName('payment_method').setDescription('Payment method, e.g. UPI, PayPal, LTC').setRequired(true).setMaxLength(50))
        .addStringOption(o => o.setName('txn_id').setDescription('Transaction/order ID (optional)').setRequired(false).setMaxLength(100)),

    async execute(interaction) {
        if (!interaction.inGuild()) return interaction.reply({ content: 'Use this command inside your server or a ticket.', ephemeral: true });
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: 'Only admins with Manage Server permission can create vouch requests.', ephemeral: true });
        }
        const channelId = config.VOUCH?.CHANNEL_ID;
        if (!channelId) return interaction.reply({ content: 'Vouch channel is not configured. Set VOUCH_CHANNEL_ID in your environment.', ephemeral: true });
        const vouchChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!vouchChannel || !vouchChannel.isTextBased()) {
            return interaction.reply({ content: 'The configured VOUCH_CHANNEL_ID is invalid or is not a text channel.', ephemeral: true });
        }

        const member = interaction.options.getUser('member', true);
        const product = quoteProduct(interaction.options.getString('product', true));
        const quantity = interaction.options.getInteger('qty', true);
        const totalPrice = Number(interaction.options.getNumber('price', true).toFixed(2));
        const unitPrice = Number((totalPrice / quantity).toFixed(2));
        const paymentMethod = safeText(interaction.options.getString('payment_method', true));
        const transactionId = safeText(interaction.options.getString('txn_id') || '') || null;
        const requestId = crypto.randomUUID();

        // Store a pending request. Only an admin's matching +rep posted in the configured vouch channel can finalize it.
        await VouchRequest.create({
            id: requestId, guildId: interaction.guildId, channelId,
            messageId: `pending:${requestId}`, userId: member.id, adminId: interaction.user.id,
            productName: product, quantity, unitPrice, totalPrice, paymentMethod,
            transactionId, status: 'pending',
        });

        const repLine = `+rep ${member.id} LEGIT PURCHASED ${quantity}X ${product} FOR ${money(totalPrice)} [${paymentMethod}]`;
        const card = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🧾 Vouch Request Prepared'))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**Customer**\n<@${member.id}> · ${member.id}\n\n` +
                `**Product**\n${product}\n\n**Quantity**\n×${quantity}\n\n` +
                `**Total price**\n${money(totalPrice)} (${money(unitPrice)} each)\n\n` +
                `**Payment method**\n${paymentMethod}\n\n**Transaction ID**\n${transactionId || 'Not provided'}`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `### Next step\nCopy the command below and paste it into <#${channelId}>. The bot will replace it with the final vouch card.\n\n` +
                `\`\`\`text\n${repLine}\n\`\`\``
            ))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# This request can only be finalized once, by an admin, in the configured vouch channel.'));

        return interaction.reply({ components: [card], flags: CV2_FLAGS | MessageFlags.Ephemeral, allowedMentions: { users: [] } });
    },
};
