// ============================================================
// COMMAND: /help — GOJO help panel using Components V2 (no color bar)
// ============================================================
const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require('discord.js');
const { CV2_FLAGS } = require('../../utils/embedBuilder');

const GROUPS = [
    { title: '🎮 Games & Store', names: ['post-steam', '4x4', 'game', 'gen'] },
    { title: '🎫 Tickets', names: ['ticket-panel', 'ticket', 'ticket-manage'] },
    { title: '🛠️ Setup & Configuration', names: ['embed', 'config-view', 'rolesetup'] },
    { title: '🛡️ Moderation', names: ['ban', 'kick', 'timeout', 'untimeout', 'unban'] },
    { title: '⚙️ Server Tools', names: ['sync'] },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show GOJO bot commands and quick usage help'),

    async execute(interaction, client) {
        const available = new Map([...client.commands.values()].map(command => [
            command.data.name,
            command.data.description || 'No description provided.',
        ]));
        const used = new Set();
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# 🩵 GOJO BOT — HELP\nBrowse the available commands below. Commands marked admin-only require the relevant server permissions.`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        for (const group of GROUPS) {
            const rows = group.names
                .filter(name => available.has(name))
                .map(name => {
                    used.add(name);
                    const description = available.get(name).replace(/\s+/g, ' ').trim();
                    return `**/${name}** — ${description}`;
                });
            if (rows.length) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${group.title}**\n${rows.join('\n')}`));
            }
        }

        const other = [...available.entries()]
            .filter(([name]) => !used.has(name))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, description]) => `**/${name}** — ${description.replace(/\s+/g, ' ').trim()}`);
        if (other.length) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**📚 Other Commands**\n${other.join('\n')}`));
        }
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `-# Total commands: ${available.size} • Use /sync to register commands to this server`
        ));

        return interaction.reply({ components: [container], flags: CV2_FLAGS | MessageFlags.Ephemeral });
    },
};
