// ============================================================
//  COMMAND: /gen
//  Admin-only. Generates a zipped package for a Steam App ID
//  (depot manifests + Lua scripts, DLC included when available).
// ============================================================

const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    AttachmentBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');

const { buildGenPackage, BRAND } = require('../../utils/steamManifest');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

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
        // Runtime admin gate (in addition to default perms)
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
                ? result.dlcList.map(d =>
                    `• \`${d.appid}\` — ${d.name}${d.depots.length ? ` (${d.depots.length} depot${d.depots.length === 1 ? '' : 's'})` : ' (no depots)'}`
                ).join('\n')
                : '*No DLC entries found for this app.*';

            const warnText = result.warnings.length
                ? `\n\n**Notes**\n${result.warnings.map(w => `• ${w}`).join('\n')}`
                : '';

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Package Ready`))
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**App ID:** \`${appid}\`\n` +
                    `**Name:** ${result.mainName}\n` +
                    `**Main depots:** ${result.depotCount}\n` +
                    `**DLC included:** ${result.dlcList.length}\n` +
                    `**File:** \`${result.fileName}\``
                ))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**DLC**\n${dlcSummary}${warnText}`
                ))
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `-# ${BRAND}`
                ));

            await interaction.editReply({
                components: [container],
                files: [attachment],
                flags: CV2_FLAGS,
            });
        } catch (err) {
            console.error('[gen] failed:', err);
            return replyError(interaction, `Could not generate package: ${err.message}`);
        }
    },
};
