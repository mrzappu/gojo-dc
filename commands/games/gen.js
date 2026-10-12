// ============================================================
//  COMMAND: /gen
//  Admin-only. Generates a password-protected zipped package
//  for a Steam App ID (Lua + manifests + DLC + loader EXE).
// ============================================================

const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    FileBuilder,
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
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return replyError(interaction, 'You need Administrator permission to run this.');
        }

        const appid = interaction.options.getInteger('appid', true);

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

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## Package Ready')
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**App ID:** \`${appid}\`\n` +
                    `**Name:** ${result.mainName}\n` +
                    `**Main depots:** ${result.depotCount}\n` +
                    `**DLC included:** ${result.dlcList.length}\n` +
                    `**File:** \`${result.fileName}\`\n` +
                    `**Loader EXE:** ${result.hasExe ? 'Included' : 'Missing (place at assets/steam_lounge.exe)'}`
                ))
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**ZIP Password**\n\`\`\`\n${result.password}\n\`\`\`\n-# Save this password. It is required to extract the archive.`
                ))
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**DLC**\n${dlcSummary}`
                ));

            if (result.warnings.length) {
                container.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                );
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**Notes**\n${result.warnings.map(w => `• ${w}`).join('\n')}`
                ));
            }

            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );
            container.addFileComponents(
                new FileBuilder().setURL(`attachment://${result.fileName}`)
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            );
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
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
