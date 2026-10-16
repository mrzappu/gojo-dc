// ============================================================
//  COMMAND: /post-steam
//  Staff-only public game price card
//  Options: our_price (required), game_name OR game_id, template
//  Posts a public Components V2 card with Buy Game button
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

const { steamSearch, steamSearchById, rupees } = require('../../utils/steamLookup');
const db = require('../../utils/database');
const config = require('../../config');

// ─────────────────────────────────────────────────────────────
//  Staff check: owner, Manage Channels, Admin, or support role
// ─────────────────────────────────────────────────────────────
function isStaff(interaction) {
    if (!interaction.guild) return false;
    if (interaction.guild.ownerId === interaction.user.id) return true;

    const perms = interaction.memberPermissions;
    if (perms?.has(PermissionFlagsBits.ManageChannels)) return true;
    if (perms?.has(PermissionFlagsBits.Administrator)) return true;

    const supportRole = config.ROLES?.TICKET_SUPPORT;
    const adminRole   = config.ROLES?.TICKET_ADMIN;
    const member      = interaction.member;
    if (member?.roles?.cache) {
        if (supportRole && member.roles.cache.has(supportRole)) return true;
        if (adminRole   && member.roles.cache.has(adminRole))   return true;
    }
    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('post-steam')
        .setDescription('Post a public game price card (Staff only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addNumberOption(o =>
            o.setName('our_price')
                .setDescription('Your listed price in INR')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(1000000)
        )
        .addStringOption(o =>
            o.setName('game_name')
                .setDescription('Search for a Steam game')
                .setAutocomplete(true)
                .setRequired(false)
                .setMaxLength(90)
        )
        .addStringOption(o =>
            o.setName('game_id')
                .setDescription('Steam App/Game ID (use this or Game name)')
                .setRequired(false)
                .setMaxLength(20)
        )
        .addStringOption(o =>
            o.setName('template')
                .setDescription('Card branding style')
                .setRequired(false)
                .addChoices(
                    { name: "Gojo's Steam Lounge", value: 'gojo' },
                    { name: 'IMPOSTER NETWORK',    value: 'imposter' },
                    { name: 'Standard',            value: 'standard' }
                )
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'game_name') return interaction.respond([]);
        try {
            const response = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(focused.value)}&l=english&cc=in`);
            const data = response.ok ? await response.json() : { items: [] };
            return interaction.respond((data.items || []).slice(0, 25).map(item => ({ name: `${item.name} (Steam)`.slice(0, 100), value: item.name.slice(0, 90) })));
        } catch { return interaction.respond([]); }
    },

    async execute(interaction) {
        // Staff gate
        if (!isStaff(interaction)) {
            return interaction.reply({
                content: 'Only staff or the server owner can publish game price cards.',
                ephemeral: true,
            });
        }

        const gameName = interaction.options.getString('game_name');
        const gameId   = interaction.options.getString('game_id');
        const ourPrice = interaction.options.getNumber('our_price', true);
        const template = interaction.options.getString('template') || 'gojo';

        if (Boolean(gameName) === Boolean(gameId)) {
            return interaction.reply({
                content: 'Provide exactly one option: Game name OR Game ID.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const game = gameId
                ? await steamSearchById(gameId.trim())
                : await steamSearch(gameName.trim());

            if (!game) {
                return interaction.editReply(
                    'No Steam game found. Check the game name or Steam App ID and try again.'
                );
            }

            // Save / update price in DB so /game uses the same value
            await db.saveGamePrice({
                appId:     game.appId,
                gameName:  game.name,
                ourPrice:  ourPrice,
                updatedBy: interaction.user.id,
            });

            const brand =
                template === 'gojo'     ? "GOJO'S STEAM LOUNGE" :
                template === 'imposter' ? 'IMPOSTER NETWORK'    :
                                          'GAME PRICE LIST';

            // Build the card (matches /game style — no coloured embed sidebar)
            const card = new ContainerBuilder();

            card.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${game.name}`)
            );
            card.addSeparatorComponents(new SeparatorBuilder());

            card.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `🟢 **OUR PRICE = ${rupees(ourPrice)}**  |  🔴 STEAM PRICE = ${game.steamPrice}`
                )
            );
            card.addSeparatorComponents(new SeparatorBuilder());

            if (game.header) {
                card.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(game.header)
                            .setDescription(game.name)
                    )
                );
                card.addSeparatorComponents(new SeparatorBuilder());
            }

            const buyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setEmoji({ name: 'ArrowShow', id: '1558870569066168360', animated: true })
                    .setLabel('Buy Game')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.com/channels/1519204760316809297/1526896976505864214')
            );
            card.addActionRowComponents(buyRow);
            card.addSeparatorComponents(new SeparatorBuilder());

            card.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# © ${brand} • All rights reserved.`
                )
            );

            const target = interaction.channel;
            await target.send({
                flags: MessageFlags.IsComponentsV2,
                components: [card],
                allowedMentions: { parse: [] },
            });

            return interaction.editReply(`Published **${game.name}** in this channel.`);
        } catch (e) {
            console.error('/post game card failed:', e?.stack || e);
            return interaction.editReply(
                'Could not publish the game card. Check the logs and try again.'
            );
        }
    },
};
