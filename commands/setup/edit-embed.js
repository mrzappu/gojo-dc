// Edit an existing GOJO Components V2 message by channel and message ID.
const {
  SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-embed')
    .setDescription('Edit a message previously posted with /embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(o => o.setName('channel').setDescription('Channel containing the message').setRequired(true))
    .addStringOption(o => o.setName('message_id').setDescription('ID of the message to edit').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('New title; leave blank to remove'))
    .addStringOption(o => o.setName('description').setDescription('New description; use \\n for new lines'))
    .addStringOption(o => o.setName('footer').setDescription('New footer; leave blank to remove'))
    .addStringOption(o => o.setName('image_url').setDescription('New image URL; leave blank to remove'))
    .addStringOption(o => o.setName('button_label').setDescription('New link button label; leave blank to remove'))
    .addStringOption(o => o.setName('button_url').setDescription('URL for the link button'))
    .addStringOption(o => o.setName('button_emoji').setDescription('Button emoji (Unicode or custom emoji)')),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const messageId = interaction.options.getString('message_id');
    if (!channel?.isTextBased() || !channel.messages) return replyError(interaction, 'Choose a text channel.');
    await interaction.deferReply({ ephemeral: true });
    try {
      const message = await channel.messages.fetch(messageId);
      if (message.author.id !== interaction.client.user.id) return replyError(interaction, 'I can only edit messages sent by this bot.');
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const footer = interaction.options.getString('footer');
      const image = interaction.options.getString('image_url');
      const label = interaction.options.getString('button_label');
      const url = interaction.options.getString('button_url');
      const emoji = interaction.options.getString('button_emoji');
      const container = new ContainerBuilder();
      if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`)).addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
      if (desc) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(desc.replace(/\\n/g, '\n')));
      if (image) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)));
      if (label) {
        const button = new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url || 'https://discord.com');
        if (emoji) button.setEmoji(emoji);
        container.addActionRowComponents(new ActionRowBuilder().addComponents(button));
      }
      if (footer) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)).addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
      if (!title && !desc && !image && !label && !footer) return replyError(interaction, 'Provide at least one field to build the edited card.');
      await message.edit({ content: null, embeds: [], components: [container], flags: CV2_FLAGS });
      await interaction.editReply({ content: `✅ Updated message [${messageId}] in <#${channel.id}>.` });
    } catch (error) {
      console.error('[edit-embed]', error);
      await interaction.editReply({ content: '❌ Could not edit that message. Check the message ID, channel, and bot permissions.' });
    }
  },
};
