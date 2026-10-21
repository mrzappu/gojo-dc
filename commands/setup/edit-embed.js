// Selective Components V2 editor: only explicitly supplied fields are changed.
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-embed')
    .setDescription('Edit selected fields on a bot message without changing other fields')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(o => o.setName('channel').setDescription('Message channel').setRequired(true))
    .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('New title (unset keeps existing)'))
    .addStringOption(o => o.setName('description').setDescription('New description (unset keeps existing)'))
    .addStringOption(o => o.setName('footer').setDescription('New footer (unset keeps existing)'))
    .addStringOption(o => o.setName('image_url').setDescription('Replace first image (unset keeps images)'))
    .addStringOption(o => o.setName('button_label').setDescription('Replace first button label (unset keeps it)'))
    .addStringOption(o => o.setName('button_url').setDescription('Replace first link button URL (unset keeps it)'))
    .addStringOption(o => o.setName('button_emoji').setDescription('Replace first button emoji (unset keeps it)')),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const id = interaction.options.getString('message_id');
    const keys = ['title','description','footer','image_url','button_label','button_url','button_emoji'];
    const values = Object.fromEntries(keys.map(k => [k, interaction.options.getString(k)]));
    if (!keys.some(k => values[k] !== null)) return interaction.reply({content:'Choose at least one field to edit. Unset fields will stay unchanged.', flags:MessageFlags.Ephemeral});
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    try {
      const msg = await channel.messages.fetch(id);
      if (msg.author.id !== interaction.client.user.id) return interaction.editReply('I can only edit messages sent by this bot.');
      const components = msg.components.map(c => c.toJSON());
      const texts = [], galleries = [], buttons = [];
      const walk = n => { if (!n || typeof n !== 'object') return; if (n.type === 10 && typeof n.content === 'string') texts.push(n); if (n.type === 12 && Array.isArray(n.items)) galleries.push(n); if (Array.isArray(n.components)) { if (n.type === 1) n.components.forEach(b => { if ([2,3].includes(b.type)) buttons.push(b); }); n.components.forEach(walk); } };
      components.forEach(walk);
      const title = values.title, desc = values.description, footer = values.footer;
      if (title !== null) { let n = texts.find(x => /^#{1,3}\s/.test(x.content)); if (n) n.content = `## ${title}`; else components.unshift({type:10,content:`## ${title}`}); }
      if (desc !== null) { let n = texts.find(x => !/^#{1,3}\s/.test(x.content) && !x.content.startsWith('-# ')); if (n) n.content = desc.replace(/\\n/g,'\n'); else components.push({type:10,content:desc.replace(/\\n/g,'\n')}); }
      if (footer !== null) { let n = texts.find(x => x.content.startsWith('-# ')); if (n) n.content = footer ? `-# ${footer}` : ''; else if (footer) components.push({type:10,content:`-# ${footer}`}); }
      if (values.image_url !== null) { if (galleries[0]?.items?.length) galleries[0].items[0].media = {url:values.image_url}; else components.push({type:12,items:[{media:{url:values.image_url}}]}); }
      if (values.button_label !== null && buttons[0]) buttons[0].label = values.button_label;
      if (values.button_url !== null) { if (buttons[0]?.style === 5) buttons[0].url = values.button_url; else return interaction.editReply('A link button is required to edit the button URL safely.'); }
      if (values.button_emoji !== null && buttons[0]) { const e=values.button_emoji.trim().match(/^<(a?):([A-Za-z0-9_]+):(\\d+)>$/); buttons[0].emoji=e?{id:e[3],name:e[2],animated:!!e[1]}:{name:values.button_emoji}; }
      await msg.edit({components});
      return interaction.editReply(`✅ Updated selected fields on message ${id}; other components were preserved.`);
    } catch (e) { console.error('[edit-embed]',e); return interaction.editReply('Could not edit this message. Check its ID, channel, and bot permissions.'); }
  }
};
