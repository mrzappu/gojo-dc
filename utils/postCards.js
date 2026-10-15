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
const EPIC_FALLBACK_TITLES = [
  'Fortnite', 'Rocket League', 'Fall Guys', 'Grand Theft Auto V Enhanced', 'Red Dead Redemption 2',
  'Hogwarts Legacy', 'Alan Wake 2', 'Cyberpunk 2077', 'EA SPORTS FC 26', 'Marvel Rivals',
  'The Sims 4', 'Genshin Impact', 'Zenless Zone Zero', 'Dead by Daylight', 'Among Us',
  'Sifu', 'Control', 'Borderlands 3', 'Assassin’s Creed Valhalla', 'Far Cry 6', 'Watch Dogs: Legion'
];
const normalizeTitle = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
async function epicCatalogSearch(query, country = 'US') {
  const url = `https://store-site-backend-static.ak.epicgames.com/api/en-US/catalog/search?keywords=${encodeURIComponent(query)}&count=25&country=${country}&locale=en-US`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 GOJO-Discord-Bot/1.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Epic search HTTP ${r.status}`);
  const data = await r.json();
  const items = data?.data?.Catalog?.searchStore?.elements || data?.data?.elements || data?.elements || [];
  return Array.isArray(items) ? items : [];
}
async function epicSuggestions(query) {
  const q = String(query || '').trim();
  if (!q) return EPIC_FALLBACK_TITLES.slice(0, 25).map(name => ({ name, value: name.slice(0, 90) }));
  let items = [];
  for (const country of ['IN', 'US']) {
    try { items = await epicCatalogSearch(q, country); if (items.length) break; } catch (e) { console.warn('Epic suggestions lookup:', e.message); }
  }
  const results = items.map(x => String(x.title || x.productName || '')).filter(Boolean);
  const fallbacks = EPIC_FALLBACK_TITLES.filter(x => normalizeTitle(x).includes(normalizeTitle(q)) || normalizeTitle(q).includes(normalizeTitle(x)));
  const combined = [...new Set([...results, ...fallbacks])].slice(0, 25);
  return combined.map(name => ({ name: name.slice(0, 100), value: name.slice(0, 90) }));
}
async function epicSearch(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  let items = [];
  for (const country of ['IN', 'US']) {
    try { items = await epicCatalogSearch(q, country); if (items.length) break; } catch (e) { console.warn('Epic lookup failed:', e.message); }
  }
  if (!items.length) return null;
  const wanted = normalizeTitle(q);
  const item = items.find(x => normalizeTitle(x.title) === wanted)
    || items.find(x => normalizeTitle(x.title).includes(wanted) || wanted.includes(normalizeTitle(x.title)))
    || items[0];
  const images = Array.isArray(item.keyImages) ? item.keyImages : [];
  const image = images.find(x => /DieselGameBox|OfferImageWide|Thumbnail|VaultClosed|DieselStoreFrontWide|OfferImageTall/i.test(x.type || '')) || images.find(x => /^https?:/i.test(x.url || ''));
  const fmt = item.price?.totalPrice?.fmtPrice;
  const price = fmt?.discountPrice || fmt?.originalPrice || item.price?.totalPrice?.discountPrice || item.price?.totalPrice?.originalPrice;
  const slug = item.productSlug || item.offerMappings?.[0]?.pageSlug || item.catalogNs?.mappings?.[0]?.pageSlug;
  return {
    appId: String(item.id || item.offerId || item.title || q),
    name: item.title || q,
    steamPrice: price ? (String(price).startsWith('₹') ? String(price) : `₹${price}`) : 'Check Epic Games Store',
    header: image?.url || null,
    storeUrl: slug ? `https://store.epicgames.com/en-US/p/${slug}` : `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(item.title || q)}`
  };
}

const OTT = {
  Netflix: { image: 'https://www.google.com/s2/favicons?domain=netflix.com&sz=256', url: 'https://www.netflix.com/' },
  'Amazon Prime Video': { image: 'https://www.google.com/s2/favicons?domain=primevideo.com&sz=256', url: 'https://www.primevideo.com/' },
  'JioHotstar': { image: 'https://www.google.com/s2/favicons?domain=jiohotstar.com&sz=256', url: 'https://www.hotstar.com/' },
  'ZEE5': { image: 'https://www.google.com/s2/favicons?domain=zee5.com&sz=256', url: 'https://www.zee5.com/' },
  'Sony LIV': { image: 'https://www.google.com/s2/favicons?domain=sonyliv.com&sz=256', url: 'https://www.sonyliv.com/' },
  'Spotify': { image: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=256', url: 'https://www.spotify.com/' }
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
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Order').setStyle(ButtonStyle.Link).setURL('https://discord.com/channels/1519204760316809297/1526896976505864214'));
    card.addActionRowComponents(row); card.addSeparatorComponents(new SeparatorBuilder());
    card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# © ${brand} • All rights reserved.`));
    await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: [card], allowedMentions: { parse: [] } });
    return interaction.editReply(`Published **${item.name}** in this channel.`);
  } catch (e) { console.error(`/${kind === 'ott' ? 'postott' : `post-${kind}`} failed:`, e?.stack || e); return interaction.editReply('Could not publish the price card. Check the logs and try again.'); }
}
module.exports = { isStaff, publish, OTT, epicSuggestions };
