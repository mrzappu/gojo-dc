const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { publish } = require('../../utils/postCards');
module.exports = {
 data: new SlashCommandBuilder().setName('post-steam').setDescription('Post a Steam game price card (Staff only)').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addNumberOption(o=>o.setName('our_price').setDescription('Your listed price in INR').setRequired(true).setMinValue(0).setMaxValue(1000000))
  .addStringOption(o=>o.setName('game_name').setDescription('Search for a Steam game').setRequired(false).setMaxLength(90).setAutocomplete(true))
  .addStringOption(o=>o.setName('game_id').setDescription('Steam App/Game ID (use name or ID)').setRequired(false).setMaxLength(20))
  .addStringOption(o=>o.setName('template').setDescription('Card branding style').setRequired(false).addChoices({name:"Gojo's Steam Lounge",value:'gojo'},{name:'IMPOSTER NETWORK',value:'imposter'},{name:'Standard',value:'standard'})),
 async autocomplete(interaction) {
  const focused=interaction.options.getFocused().trim(); if(!focused) return interaction.respond([]);
  try { const r=await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(focused)}&l=english&cc=in`); const d=await r.json(); return interaction.respond((d.items||[]).slice(0,25).map(x=>({name:String(x.name).slice(0,100),value:String(x.name).slice(0,90)}))); } catch { return interaction.respond([]); }
 },
 async execute(interaction) { return publish(interaction,{kind:'steam',price:interaction.options.getNumber('our_price',true),name:interaction.options.getString('game_name'),id:interaction.options.getString('game_id'),template:interaction.options.getString('template')||'gojo'}); }
};
