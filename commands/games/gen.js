// ============================================================
//  COMMAND: /gen
//  Admin-only. Generates a zipped package for a Steam App ID
//  (depot manifests + Lua scripts, DLC included when available).
// ============================================================

const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
} = require('discord.js');

const { buildGenPackage, BRAND } = require('../../utils/steamManifest');
const config = require('../../config');
const { replyError } = require('../../utils/embedBuilder');

function hexToInt(hex) {
    return parseInt(String(hex).replace('#', ''), 16);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gen')
        .setDescription('Generate a package for an application')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(o =>
            o.setName('appid')
                .setDescription('Application ID')
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return replyError(interaction, 'You need Administrator permission to run this.');
        }

        const appid = interaction.options.getInteger('appid', true);

        // Public reply so the zip lands in the same channel
        await interaction.deferReply();

        try {
            const result = await buildGenPackage(appid);

            const attachment = new AttachmentBuilder(result.zipBuffer, { name: result.fileName });

            const dlcSummary = result.dlcList.length
                ? result.dlcList
                    .map(d => {
                        const count = d.depots.length;
                        const suffix = count
                            ? ` (${count} depot${count === 1 ? '' : 's'})`
                            : ' (no depots)';
                        return `• \`${d.appid}\` — ${d.name}${suffix}`;
                    })
                    .join('\n')
                : '*No DLC entries found for this app.*';

            const embed = new EmbedBuilder()
                .setColor(hexToInt(config.BOT_COLOR || '#00d2ff'))
                .setTitle('Package Ready')
                .setDescription(
                    `**App ID:** \`${appid}\`\n` +
                    `**Name:** ${result.mainName}\n` +
                    `**Main depots:** ${result.depotCount}\n` +
                    `**DLC included:** ${result.dlcList.length}\n` +
                    `**File:** \`${result.fileName}\``
                )
                .addFields({ name: 'DLC', value: dlcSummary })
                .setFooter({ text: BRAND })
                .setTimestamp();

            if (result.warnings.length) {
                embed.addFields({
                    name: 'Notes',
                    value: result.warnings.map(w => `• ${w}`).join('\n'),
                });
            }

            await interaction.editReply({
                embeds: [embed],
                files: [attachment],
            });
        } catch (err) {
            console.error('[gen] failed:', err);
            return replyError(interaction, `Could not generate package: ${err.message}`);
        }
    },
};
