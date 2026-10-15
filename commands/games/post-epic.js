const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { publish, epicSuggestions } = require('../../utils/postCards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-epic')
    .setDescription('Post an Epic Games Store price card (Staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addNumberOption(o => o.setName('our_price').setDescription('Your listed price in INR').setRequired(true).setMinValue(0).setMaxValue(1000000))
    .addStringOption(o => o.setName('game_name').setDescription('Search for an Epic Games Store title').setRequired(true).setMaxLength(90).setAutocomplete(true))
    .addStringOption(o => o.setName('template').setDescription('Card branding style').setRequired(false).addChoices(
      { name: "Gojo's Steam Lounge", value: 'gojo' },
      { name: 'IMPOSTER NETWORK', value: 'imposter' },
      { name: 'Standard', value: 'standard' }
    )),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().trim();
    try {
      const suggestions = await epicSuggestions(focused);
      return interaction.respond(suggestions.slice(0, 25));
    } catch (error) {
      console.warn('[Epic autocomplete]', error.message);
      return interaction.respond([]);
    }
  },
  async execute(interaction) {
    return publish(interaction, {
      kind: 'epic',
      price: interaction.options.getNumber('our_price', true),
      name: interaction.options.getString('game_name', true),
      template: interaction.options.getString('template') || 'gojo'
    });
  }
};
