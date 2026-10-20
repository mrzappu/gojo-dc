// Manage persistent auto-moderation keyword lists.
const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const FILE = path.join(__dirname, '..', '..', 'data', 'automod-words.json');
const DEFAULTS = { toxic: [], scam: [] };
function readLists() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return { toxic: [], scam: [] }; }
}
function writeLists(data) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Add, remove, or list auto-mod keywords')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('action').setDescription('What to do').setRequired(true).addChoices({ name: 'Add keyword', value: 'add' }, { name: 'Remove keyword', value: 'remove' }, { name: 'List keywords', value: 'list' }))
    .addStringOption(o => o.setName('type').setDescription('Keyword category').setRequired(true).addChoices({ name: 'Toxic words', value: 'toxic' }, { name: 'Scam / giveaway', value: 'scam' }))
    .addStringOption(o => o.setName('keyword').setDescription('Keyword or phrase (not needed for list)')),
  async execute(interaction) {
    const action = interaction.options.getString('action');
    const type = interaction.options.getString('type');
    const keyword = interaction.options.getString('keyword')?.trim().toLowerCase();
    const lists = readLists();
    if (action === 'list') {
      const items = lists[type];
      const shown = items.length ? items.map(w => `• ${w}`).join('\n') : 'No custom keywords added yet.';
      return interaction.reply({ content: `**Custom ${type === 'toxic' ? 'toxic-word' : 'scam'} keywords**\n${shown}`.slice(0, 1900), flags: MessageFlags.Ephemeral });
    }
    if (!keyword || keyword.length < 2 || keyword.length > 80) return interaction.reply({ content: 'Provide a keyword or phrase between 2 and 80 characters.', flags: MessageFlags.Ephemeral });
    if (action === 'add') {
      if (lists[type].includes(keyword)) return interaction.reply({ content: 'That keyword is already in the custom list.', flags: MessageFlags.Ephemeral });
      lists[type].push(keyword);
      writeLists(lists);
      return interaction.reply({ content: `✅ Added **${keyword}** to the custom ${type} list.`, flags: MessageFlags.Ephemeral });
    }
    const index = lists[type].indexOf(keyword);
    if (index < 0) return interaction.reply({ content: 'That keyword is not in the custom list.', flags: MessageFlags.Ephemeral });
    lists[type].splice(index, 1); writeLists(lists);
    return interaction.reply({ content: `✅ Removed **${keyword}** from the custom ${type} list.`, flags: MessageFlags.Ephemeral });
  },
};
