const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { publish } = require('../../utils/postCards');
module.exports = {
 data: new SlashCommandBuilder().setName('post-epic').setDescription('Post an Epic Games Store price card (Staff only)').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addNumberOption(o=>o.setName('our_price').setDescription('Your listed price in INR').setRequired(true).setMinValue(0).setMaxValue(1000000))
  .addStringOption(o=>o.setName('game_name').setDescription('Search for an Epic Games Store title').setRequired(true).setMaxLength(90).setAutocomplete(true))
  .addStringOption(o=>o.setName('template').setDescription('Card branding style').setRequired(false).addChoices({name:"Gojo's Steam Lounge",value:'gojo'},{name:'IMPOSTER NETWORK',value:'imposter'},{name:'Standard',value:'standard'})),
 async autocomplete(interaction) {
  const focused=interaction.options.getFocused().trim(); if(!focused) return interaction.respond([]);
  try { const r=await fetch(`https://store-site-backend-static.ak.epicgames.com/api/en-US/catalog/search?keywords=${encodeURIComponent(focused)}&count=25&country=IN&locale=en-US`); const d=await r.json(); const items=d?.data?.Catalog?.searchStore?.elements||d?.data?.elements||[]; return interaction.respond(items.slice(0,25).map(x=>({name:String(x.title||'Unknown').slice(0,100),value:String(x.title||'Unknown').slice(0,90)}))); } catch { return interaction.respond([]); }
 },
 async execute(interaction) { return publish(interaction,{kind:'epic',price:interaction.options.getNumber('our_price',true),name:interaction.options.getString('game_name',true),template:interaction.options.getString('template')||'gojo'}); }
};
