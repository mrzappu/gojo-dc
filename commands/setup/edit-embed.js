// Edit only selected fields on a bot-authored Components V2 message.
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { replyError } = require('../../utils/embedBuilder');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-embed').setDescription('Edit selected fields without changing other fields')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(o => o.setName('channel').setDescription('Channel containing the message').setRequired(true))
    .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('New title; unset keeps current'))
    .addStringOption(o => o.setName('description').setDescription('New description; unset keeps current'))
    .addStringOption(o => o.setName('footer').setDescription('New footer; unset keeps current'))
    .addStringOption(o => o.setName('image_url').setDescription('Replace first image; unset keeps images'))
    .addStringOption(o => o.setName('button_label').setDescription('Replace first button label'))
    .addStringOption(o => o.setName('button_url').setDescription('Replace first link-button URL'))
    .addStringOption(o => o.setName('button_emoji').setDescription('Replace first button emoji')),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const id = interaction.options.getString('message_id');
    if (!channel?.isTextBased() || !channel.messages) return replyError(interaction, 'Choose a text channel.');
    const keys = ['title','description','footer','image_url','button_label','button_url','button_emoji'];
    if (!keys.some(k => interaction.options.getString(k) !== null)) return replyError(interaction, 'Set at least one field to change. Unset fields stay unchanged.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const msg = await channel.messages.fetch(id);
      if (msg.author.id !== interaction.client.user.id) return interaction.editReply('I can only edit messages sent by this bot.');
      const components = msg.components.map(c => c.toJSON());
      const textNodes = [], galleries = [], buttons = [];
      const walk = n => { if (!n || typeof n !== 'object') return; if (n.type === 10 && typeof n.content === 'string') textNodes.push(n); if (n.type === 12 && Array.isArray(n.items)) galleries.push(n); if (n.type === 1 && Array.isArray(n.components)) n.components.forEach(b => { if ([2,3].includes(b.type)) buttons.push(b); }); if (Array.isArray(n.components)) n.components.forEach(walk); };
      components.forEach(walk);
      const get = k => interaction.options.getString(k);
      const title = get('title'), desc = get('description'), footer = get('footer'), image = get('image_url');
      if (title !== null) { const n = textNodes.find(x => /^#{1,3} /.test(x.content)); if (n) n.content = `## ${title}`; else components.unshift({type:10,content:`## ${title}`}); }
      if (desc !== null) { const n = textNodes.find(x => !/^#{1,3} /.test(x.content) && !x.content.startsWith('-# ')); if (n) n.content = desc.replace(/\\n/g,'\n'); else components.push({type:10,content:desc.replace(/\\n/g,'\n')}); }
      if (footer !== null) { const n = textNodes.find(x => x.content.startsWith('-# ')); if (n) n.content = footer ? `-# ${footer}` : '-#'; else if (footer) components.push({type:10,content:`-# ${footer}`}); }
      if (image !== null) { const g = galleries[0]; if (g?.items?.length) g.items[0].media = {url:image}; else components.push({type:12,items:[{media:{url:image}}]}); }
      const label = get('button_label'), url = get('button_url'), emoji = get('button_emoji'), b = buttons[0];
      if (b && label !== null) b.label = label;
      if (b && url !== null) { if (b.style !== 5) return interaction.editReply('The first button is not a link button, so its URL cannot be changed safely.'); b.url = url; }
      if (b && emoji !== null) { const m = emoji.match(/^<a?:([\w]+):(\d+)>$/); b.emoji = m ? {name:m[1],id:m[2],animated:emoji.startsWith('<a:')} : {name:emoji}; }
      await msg.edit({components});
      return interaction.editReply(`✅ Updated selected fields on message ${id}. Other existing fields were preserved.`);
    } catch (e) { console.error('[edit-embed]',e); return interaction.editReply('❌ Could not edit that message. Check the message ID, channel, and bot permissions.'); }
  }
};
