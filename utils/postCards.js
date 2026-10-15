const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const { steamSearch, steamSearchById, rupees } = require('./steamLookup');
const config = require('../config');
const db = require('./database');

function isStaff(interaction) {
  if (!interaction.guild) return false;
  if (interaction.guild.ownerId === interaction.user.id) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = interaction.member?.roles?.cache;
  return !!roles && [config.ROLES?.TICKET_SUPPORT, config.ROLES?.TICKET_ADMIN].some(id => id && roles.has(id));
}
async function epicSearch(query) {
  const url = `https://store-site-backend-static.ak.epicgames.com/api/en-US/catalog/search?keywords=${encodeURIComponent(query)}&count=10&country=IN&locale=en-US`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'GOJO-Discord-Bot/1.0' } });
    if (!r.ok) return null;
    const data = await r.json();
    const items = data?.data?.Catalog?.searchStore?.elements || data?.data?.elements || [];
    if (!items.length) return null;
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const item = items.find(x => norm(x.title) === norm(query)) || items[0];
    const image = (item.keyImages || []).find(x => /DieselGameBox|OfferImageWide|Thumbnail|VaultClosed|DieselStoreFrontWide/i.test(x.type)) || (item.keyImages || [])[0];
    const price = item.price?.totalPrice?.fmtPrice?.discountPrice ?? item.price?.totalPrice?.fmtPrice?.originalPrice;
    return { appId: String(item.id || item.offerId || item.title), name: item.title || query, steamPrice: price ? (String(price).startsWith('₹') ? price : `₹${price}`) : 'Check Epic Games Store', header: image?.url || null, storeUrl: item.productSlug ? `https://store.epicgames.com/en-US/p/${item.productSlug}` : 'https://store.epicgames.com/' };
  } catch (e) { console.warn('Epic lookup failed:', e.message); return null; }
}
const OTT = {
  Netflix: { image: 'https://logo.clearbit.com/netflix.com', url: 'https://www.netflix.com/' },
  'Amazon Prime Video': { image: 'https://logo.clearbit.com/primevideo.com', url: 'https://www.primevideo.com/' },
  'JioHotstar': { image: 'https://logo.clearbit.com/jiohotstar.com', url: 'https://www.hotstar.com/' },
  'ZEE5': { image: 'https://logo.clearbit.com/zee5.com', url: 'https://www.zee5.com/' },
  'Sony LIV': { image: 'https://logo.clearbit.com/sonyliv.com', url: 'https://www.sonyliv.com/' },
  'Spotify': { image: 'https://logo.clearbit.com/spotify.com', url: 'https://www.spotify.com/' }
};
function branding(template) { return template === 'imposter' ? 'IMPOSTER NETWORK' : template === 'standard' ? 'PRICE LIST' : "GOJO'S STEAM LOUNGE"; }
async function publish(interaction, { kind, price, name, id, template = 'gojo' }) {
  if (!isStaff(interaction)) return interaction.reply({ content: 'Only staff or the server owner can publish price cards.', ephemeral: true });
  if (kind !== 'ott' && Boolean(name) === Boolean(id)) return interaction.reply({ content: 'Provide exactly one option: name OR ID.', ephemeral: true });
  if (kind === 'ott' && !name) return interaction.reply({ content: 'Choose an OTT service.', ephemeral: true });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    let item;
    if (kind === 'steam') item = id ? await steamSearchById(id.trim()) : await steamSearch(name.trim());
    else if (kind === 'epic') item = await epicSearch(name.trim());
    else {
      const service = OTT[name];
      if (!service) return interaction.editReply('Service not found. Choose a listed OTT service.');
      item = { name, header: service.image, steamPrice: 'Subscription pricing varies', storeUrl: service.url, appId: name };
    }
    if (!item) return interaction.editReply(`No ${kind === 'epic' ? 'Epic Games Store' : 'Steam'} result found. Try a more exact title.`);
    if (kind === 'steam') await db.saveGamePrice({ appId: item.appId, gameName: item.name, ourPrice: price, updatedBy: interaction.user.id });
    const brand = branding(template);
    const card = new ContainerBuilder();
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${item.name}`));
    card.addSeparatorComponents(new SeparatorBuilder());
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🟢 **OUR PRICE = ${rupees(price)}**  |  🔴 **${kind === 'steam' ? 'STEAM PRICE' : kind === 'epic' ? 'EPIC STORE PRICE' : 'SERVICE'} = ${item.steamPrice}**`));
    card.addSeparatorComponents(new SeparatorBuilder());
    if (item.header) {
      card.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(item.header).setDescription(item.name)));
      card.addSeparatorComponents(new SeparatorBuilder());
    }
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(kind === 'ott' ? 'Open Service' : 'Buy Game').setStyle(ButtonStyle.Link).setURL(kind === 'steam' ? 'https://discord.com/channels/1519204760316809297/1526896976505864214' : item.storeUrl || 'https://store.epicgames.com/'));
    card.addActionRowComponents(row); card.addSeparatorComponents(new SeparatorBuilder());
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# © ${brand} • All rights reserved.`));
    await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: [card], allowedMentions: { parse: [] } });
    return interaction.editReply(`Published **${item.name}** in this channel.`);
  } catch (e) { console.error(`/${kind === 'ott' ? 'postott' : `post-${kind}`} failed:`, e?.stack || e); return interaction.editReply('Could not publish the price card. Check the logs and try again.'); }
}
module.exports = { isStaff, publish, OTT };
