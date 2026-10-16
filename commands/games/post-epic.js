// ============================================================
//  COMMAND: /post
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

const { rupees } = require('../../utils/steamLookup');
const { epicSearch } = require('../../utils/epicLookup');
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
        .setName('post-epic')
        .setDescription('Post an Epic Games Store price card (Staff only)')
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
                .setDescription('Search for an Epic Games Store title')
                .setAutocomplete(true)
                .setRequired(true)
                .setMaxLength(90)
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
            const results = await epicSearch(focused.value);
            return interaction.respond(results.slice(0, 25).map(item => ({ name: item.name.slice(0, 100), value: item.name.slice(0, 90) })));
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
        const gameId   = null;
        const ourPrice = interaction.options.getNumber('our_price', true);
        const template = interaction.options.getString('template') || 'gojo';

        if (!gameName) return interaction.reply({ content: 'Enter an Epic game title.', ephemeral: true });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const results = await epicSearch(gameName || gameId);
            const game = results.find(x => !x.fallback) || results[0];

            if (!game) {
                return interaction.editReply(
                    'Could not load Epic catalog details. Try the full game title; the Order button can still be used to request it.'
                );
            }


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
                    `🟢 **OUR PRICE = ${rupees(ourPrice)}**  |  🔴 EPIC STORE PRICE = Check Store`
                )
            );
            card.addSeparatorComponents(new SeparatorBuilder());

            if (game.image || game.header) {
                card.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(game.image || game.header)
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

            return interaction.editReply(`Published Epic Store card for **${game.name}** in this channel.`);
        } catch (e) {
            console.error('/post-epic game card failed:', e?.stack || e);
            return interaction.editReply(
                'Could not publish the game card. Check the logs and try again.'
            );
        }
    },
};
