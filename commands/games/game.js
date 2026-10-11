// ============================================================
//  COMMAND: /game
//  Public Steam game price lookup
//  Shows: header image, name, Steam price, Our price, Game ID
// ============================================================

const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} = require('discord.js');

const { steamSearch, rupees } = require('../../utils/steamLookup');
const db = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Check a Steam game price (public)')
        .addStringOption(o =>
            o.setName('game_name')
                .setDescription('Game name to search on Steam')
                .setRequired(true)
                .setMaxLength(90)
        ),

    async execute(interaction) {
        // Public (non-ephemeral) reply
        await interaction.deferReply();

        const name = interaction.options.getString('game_name', true).trim();

        try {
            const game = await steamSearch(name);
            if (!game) {
                return interaction.editReply({
                    content: `No Steam game found for **${name}**. Check the title and try again.`,
                });
            }

            const priceRow = await db.getGamePrice(game.appId);

            const container = new ContainerBuilder();

            if (game.header) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(game.header)
                            .setDescription(game.name)
                    )
                );
            }

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${game.name}\n` +
                    `**Steam Price:** ${game.steamPrice}\n` +
                    `**Our Price:** ${priceRow ? rupees(priceRow.ourPrice) : 'Not listed'}\n` +
                    `**Game ID:** ${game.appId}`
                )
            );

            return interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container],
            });
        } catch (e) {
            console.error('Public /game lookup failed:', e?.stack || e);
            return interaction.editReply({
                content: 'Could not fetch Steam details right now. Please try again shortly.',
            });
        }
    },
};
