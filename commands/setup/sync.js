// ============================================================
// COMMAND: /sync — Sync slash commands to the current server
// ============================================================
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    REST,
    Routes,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');
const config = require('../../config');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Sync all GOJO slash commands to this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client) {
        if (!interaction.inGuild()) {
            return replyError(interaction, 'Run this command inside the server you want to sync.');
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return replyError(interaction, 'You need the Manage Server permission to sync commands.');
        }

        await interaction.deferReply({ flags: CV2_FLAGS | MessageFlags.Ephemeral });
        const commands = [...client.commands.values()].map(command => command.data.toJSON());
        const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);

        try {
            await rest.put(
                Routes.applicationGuildCommands(config.CLIENT_ID, interaction.guildId),
                { body: commands },
            );
            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ☑️ Server Commands Synced\nSynced **${commands.length}** slash commands to **${interaction.guild.name}**.\n\nGuild commands usually appear faster than global commands. This replaces the command list registered specifically for this server.`
                )
            );
            return interaction.editReply({ components: [container], flags: CV2_FLAGS | MessageFlags.Ephemeral });
        } catch (error) {
            console.error('[SYNC] Failed to sync guild commands:', error);
            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ❌ Sync Failed\nCould not sync commands to this server. Check the bot token, application ID, and bot permissions.\n\n\`${String(error.message || error).slice(0, 700)}\``
                )
            );
            return interaction.editReply({ components: [container], flags: CV2_FLAGS | MessageFlags.Ephemeral });
        }
    },
};
