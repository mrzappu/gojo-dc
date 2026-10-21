// ============================================================
// COMMAND: /reset-all-nicknames
// Clears server nickname overrides so members display their normal usernames.
// Requires Manage Nicknames and the bot's role must be above affected members.
// ============================================================
const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { CV2_FLAGS } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-all-nicknames')
        .setDescription('Reset manageable members to their normal Discord usernames')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addBooleanOption(option => option
            .setName('confirm')
            .setDescription('Confirm resetting server nicknames for all manageable members')
            .setRequired(true)),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({ content: 'You need the Manage Nicknames permission.', ephemeral: true });
        }
        if (!interaction.options.getBoolean('confirm')) {
            return interaction.reply({ content: 'Cancelled. Run the command again with confirm: True to reset nicknames.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        let members;
        try {
            members = await interaction.guild.members.fetch();
        } catch (error) {
            console.error('[ResetNicknames] Could not fetch guild members:', error);
            return interaction.editReply('Could not fetch all server members. Check the bot has the Server Members intent enabled.');
        }

        let reset = 0;
        let skipped = 0;
        let failed = 0;
        for (const member of members.values()) {
            if (member.user.bot || !member.nickname) { skipped++; continue; }
            if (!member.manageable) { skipped++; continue; }
            try {
                await member.setNickname(null, `Bulk nickname reset requested by ${interaction.user.tag}`);
                reset++;
            } catch (error) {
                failed++;
                console.error(`[ResetNicknames] Failed for ${member.id}:`, error.message);
            }
        }

        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Nickname Reset Complete\n` +
                `Members reset to their normal Discord usernames: **${reset}**\n` +
                `Skipped (no nickname, bots, or role hierarchy): **${skipped}**\n` +
                `Failed: **${failed}**\n\n` +
                `-# Discord usernames were not changed. Members the bot cannot manage must be reset manually or moved below the bot's highest role.`
            )
        );
        return interaction.editReply({ components: [container], flags: CV2_FLAGS | MessageFlags.Ephemeral });
    },
};
