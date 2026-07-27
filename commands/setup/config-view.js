// ============================================================
//  COMMAND: /config  — View current bot configuration
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const config  = require('../../config');
const { CV2_FLAGS } = require('../../utils/embedBuilder');

function chDisplay(id) {
    return (!id || id.includes('_HERE')) ? '*Not set*' : `<#${id}>`;
}
function roleDisplay(id) {
    return (!id || id.includes('_HERE')) ? '*Not set*' : `<@&${id}>`;
}
function catDisplay(id) {
    return (!id || id.includes('_HERE')) ? '*Not set*' : `\`${id}\``;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('View current GOJO Bot configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## GOJO Bot Configuration`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**Channels**\n` +
                `• Welcome: ${chDisplay(config.CHANNELS.WELCOME)}\n` +
                `• VC Log: ${chDisplay(config.CHANNELS.VC_LOG)}\n` +
                `• Text Log: ${chDisplay(config.CHANNELS.TEXT_LOG)}\n` +
                `• Mod Log: ${chDisplay(config.CHANNELS.MOD_LOG)}\n` +
                `• Ticket Log: ${chDisplay(config.CHANNELS.TICKET_LOG)}\n` +
                `• Ticket Transcript: ${chDisplay(config.CHANNELS.TICKET_TRANSCRIPT)}`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**Roles**\n` +
                `• Auto Role: ${roleDisplay(config.ROLES.AUTO_ROLE)}\n` +
                `• Ticket Support: ${roleDisplay(config.ROLES.TICKET_SUPPORT)}\n` +
                `• Ticket Admin: ${roleDisplay(config.ROLES.TICKET_ADMIN)}`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**Categories**\n` +
                `• Open Tickets: ${catDisplay(config.CATEGORIES.TICKETS_OPEN)}\n` +
                `• Closed Tickets: ${catDisplay(config.CATEGORIES.TICKETS_CLOSED)}`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**Auto-Mod**\n` +
                `• Enabled: \`${config.AUTOMOD.ENABLED}\`\n` +
                `• Mass Mention Threshold: \`${config.AUTOMOD.MASS_MENTION_THRESHOLD}\`\n` +
                `• Timeout Duration: \`${config.AUTOMOD.TIMEOUT_DURATION_MS / 60000} minutes\`\n` +
                `• Toxic Words: \`${config.AUTOMOD.TOXIC_WORDS.length} word(s)\`\n` +
                `• Scam Keywords: \`${config.AUTOMOD.SCAM_KEYWORDS.length} keyword(s)\``
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `-# All values can be changed in \`config.js\`. Use \`/rolesetup\` to update role IDs at runtime.`
            ));

        await interaction.reply({ components: [container], flags: CV2_FLAGS | 64 });
    },
};
