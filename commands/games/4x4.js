// ============================================================
// COMMAND: /4x4 — Publish four Steam games in one Components V2 card
// Four equal-size gallery images, editable title/description/footer. Game names are used only to fetch images.
// This is a separate command and does not modify /post-steam.
// ============================================================
const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');
const { steamSearch } = require('../../utils/steamLookup');
const config = require('../../config');

function isStaff(interaction) {
    if (!interaction.guild) return false;
    if (interaction.guild.ownerId === interaction.user.id) return true;
    const perms = interaction.memberPermissions;
    if (perms?.has(PermissionFlagsBits.ManageChannels) || perms?.has(PermissionFlagsBits.Administrator)) return true;
    const member = interaction.member;
    const supportRole = config.ROLES?.TICKET_SUPPORT;
    const adminRole = config.ROLES?.TICKET_ADMIN;
    return Boolean(member?.roles?.cache && ((supportRole && member.roles.cache.has(supportRole)) || (adminRole && member.roles.cache.has(adminRole))));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('4x4')
        .setDescription('Post four Steam games with four equal-size images in one card (Staff only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o.setName('game1').setDescription('First Steam game').setAutocomplete(true).setRequired(true).setMaxLength(90))
        .addStringOption(o => o.setName('game2').setDescription('Second Steam game').setAutocomplete(true).setRequired(true).setMaxLength(90))
        .addStringOption(o => o.setName('game3').setDescription('Third Steam game').setAutocomplete(true).setRequired(true).setMaxLength(90))
        .addStringOption(o => o.setName('game4').setDescription('Fourth Steam game').setAutocomplete(true).setRequired(true).setMaxLength(90))
        .addStringOption(o => o.setName('title').setDescription('Editable card title').setRequired(false).setMaxLength(150))
        .addStringOption(o => o.setName('description').setDescription('Editable text shown under the title').setRequired(false).setMaxLength(1000))
        .addStringOption(o => o.setName('footer').setDescription('Editable footer text').setRequired(false).setMaxLength(200)),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        try {
            const response = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(focused.value)}&l=english&cc=in`);
            const data = response.ok ? await response.json() : { items: [] };
            return interaction.respond((data.items || []).slice(0, 25).map(item => ({ name: `${item.name} (Steam)`.slice(0, 100), value: item.name.slice(0, 90) })));
        } catch {
            return interaction.respond([]);
        }
    },

    async execute(interaction) {
        if (!isStaff(interaction)) {
            return interaction.reply({ content: 'Only staff or the server owner can publish game cards.', ephemeral: true });
        }
        const names = [1, 2, 3, 4].map(i => interaction.options.getString(`game${i}`, true).trim());
        const title = interaction.options.getString('title') || '🎮 STEAM GAME COLLECTION';
        const description = interaction.options.getString('description') || 'Choose your favourite game from our collection.';
        const footer = interaction.options.getString('footer') || "© GOJO'S STEAM LOUNGE • All rights reserved.";

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const games = await Promise.all(names.map(name => steamSearch(name)));
            const missing = games.map((game, i) => game ? null : names[i]).filter(Boolean);
            if (missing.length) return interaction.editReply(`Could not find these Steam games: **${missing.join(', ')}**. Check the titles and try again.`);

            const card = new ContainerBuilder();
            card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`));
            card.addSeparatorComponents(new SeparatorBuilder());
            card.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
            card.addSeparatorComponents(new SeparatorBuilder());

            const missingImages = games.map((game, i) => game.header ? null : names[i]).filter(Boolean);
            if (missingImages.length) {
                return interaction.editReply(`Steam did not return an image for: **${missingImages.join(', ')}**. Try a different game title.`);
            }
            // Always add all four images, in the same gallery, so Discord displays them together.
            const galleryItems = games.map((game, i) =>
                new MediaGalleryItemBuilder().setURL(game.header).setDescription(`Game image ${i + 1}`)
            );
            card.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...galleryItems));
            card.addSeparatorComponents(new SeparatorBuilder());

            const buyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setEmoji({ name: 'ArrowShow', id: '1558870569066168360', animated: true })
                    .setLabel('Buy Game')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.com/channels/1519204760316809297/1526896976505864214')
            );
            card.addSeparatorComponents(new SeparatorBuilder());
            card.addActionRowComponents(buyRow);
            card.addSeparatorComponents(new SeparatorBuilder());
            card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));

            await interaction.channel.send({
                flags: MessageFlags.IsComponentsV2,
                components: [card],
                allowedMentions: { parse: [] },
            });
            return interaction.editReply('Published the 4-image card successfully.');
        } catch (error) {
            console.error('/4x4 card failed:', error?.stack || error);
            return interaction.editReply('Could not publish the 4-game card. Check the bot logs and try again.');
        }
    },
};
