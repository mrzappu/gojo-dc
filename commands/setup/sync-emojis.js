// ============================================================
// COMMAND: /sync-emojis — Upload the included light-blue icon pack
// ============================================================
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

const EMOJI_DIR = path.join(__dirname, '../../assets/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-emojis')
        .setDescription('Upload the included light-blue icons as server emojis')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return replyError(interaction, 'Run this command inside the server where you want the emojis.');
        }
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return replyError(interaction, 'You need the Manage Server permission to upload emojis.');
        }
        const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
            return replyError(interaction, 'Give the bot the Manage Expressions permission so it can manage server emojis.');
        }

        await interaction.deferReply({ flags: CV2_FLAGS | MessageFlags.Ephemeral });
        const files = fs.existsSync(EMOJI_DIR)
            ? fs.readdirSync(EMOJI_DIR).filter(file => /^icon_\d+\.png$/i.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            : [];
        if (!files.length) {
            const empty = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('## ❌ No Emoji Files Found\nNo usable icon files were found in `assets/emojis`.'));
            return interaction.editReply({ components: [empty], flags: CV2_FLAGS | MessageFlags.Ephemeral });
        }
        await interaction.guild.emojis.fetch().catch(() => {});

        let created = 0;
        let existed = 0;
        let failed = 0;
        let full = false;
        const failures = [];
        const existingNames = new Set(interaction.guild.emojis.cache.map(emoji => emoji.name));
        const maxEmojis = interaction.guild.maximumEmojis || ({ 0: 50, 1: 100, 2: 150, 3: 250 }[interaction.guild.premiumTier] || 50);

        for (const file of files) {
            const name = `gojo_${file.replace(/\.png$/i, '').toLowerCase()}`;
            if (existingNames.has(name)) {
                existed++;
                continue;
            }
            if (interaction.guild.emojis.cache.size + created >= maxEmojis) {
                full = true;
                break;
            }
            try {
                await interaction.guild.emojis.create({
                    attachment: path.join(EMOJI_DIR, file),
                    name,
                    reason: `GOJO light-blue icon pack synced by ${interaction.user.tag}`,
                });
                created++;
                existingNames.add(name);
            } catch (error) {
                failed++;
                if (failures.length < 4) failures.push(`${name}: ${String(error.message || error).slice(0, 120)}`);
                if (error.code === 30008 || /maximum number|emoji limit/i.test(String(error.message || ''))) {
                    full = true;
                    break;
                }
            }
        }

        const remaining = Math.max(0, files.length - created - existed);
        const lines = [
            '## 🩵 GOJO Emoji Sync',
            `**Uploaded:** ${created}`,
            `**Already present:** ${existed}`,
            `**Failed:** ${failed}`,
            `**Pack icons:** ${files.length}`,
        ];
        if (full || remaining > 0) {
            lines.push('', `⚠️ **${remaining} icon(s) were not uploaded.** Your server may not have enough emoji slots. Remove unused emojis or increase the server's emoji capacity, then run **/sync-emojis** again.`);
        }
        if (failures.length) lines.push('', '**First errors**', failures.map(value => `• ${value}`).join('\n'));
        const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
        return interaction.editReply({ components: [container], flags: CV2_FLAGS | MessageFlags.Ephemeral });
    },
};
