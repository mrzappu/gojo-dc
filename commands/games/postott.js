const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { publish, OTT } = require('../../utils/postCards');
module.exports = {
 data: new SlashCommandBuilder().setName('postott').setDescription('Post an OTT subscription price card (Staff only)').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addNumberOption(o=>o.setName('our_price').setDescription('Your listed price in INR').setRequired(true).setMinValue(0).setMaxValue(1000000))
  .addStringOption(o=>o.setName('service').setDescription('Search for an OTT or streaming service').setRequired(true).setAutocomplete(true))
  .addStringOption(o=>o.setName('template').setDescription('Card branding style').setRequired(false).addChoices({name:"Gojo's Steam Lounge",value:'gojo'},{name:'IMPOSTER NETWORK',value:'imposter'},{name:'Standard',value:'standard'})),
 async autocomplete(interaction) { const q=interaction.options.getFocused().toLowerCase(); return interaction.respond(Object.keys(OTT).filter(x=>x.toLowerCase().includes(q)).slice(0,25).map(x=>({name:x,value:x}))); },
 async execute(interaction) { return publish(interaction,{kind:'ott',price:interaction.options.getNumber('our_price',true),name:interaction.options.getString('service',true),template:interaction.options.getString('template')||'gojo'}); }
};
