// ============================================================
//  COMMAND: /rolesetup  — Configure auto-role on member join
// ============================================================

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
} = require('discord.js');
const config  = require('../../config');
const { CV2_FLAGS, replyError } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolesetup')
        .setDescription('Configure server roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('autorole')
                .setDescription('Set the auto-role given to new members')
                .addRoleOption(o => o.setName('role').setDescription('Role to assign on join').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('ticketsupport')
                .setDescription('Set the ticket support role')
                .addRoleOption(o => o.setName('role').setDescription('Support role').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('ticketadmin')
                .setDescription('Set the ticket admin role')
                .addRoleOption(o => o.setName('role').setDescription('Admin role').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current role configuration')
        )
        .addSubcommand(sub =>
            sub.setName('all')
                .setDescription('Set all roles at once')
                .addRoleOption(o => o.setName('autorole').setDescription('Auto role on join').setRequired(true))
                .addRoleOption(o => o.setName('support').setDescription('Ticket support role').setRequired(true))
                .addRoleOption(o => o.setName('admin').setDescription('Ticket admin role').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Role Configuration`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**Auto Role:**\n${config.ROLES.AUTO_ROLE.includes('_HERE') ? '*Not configured*' : `<@&${config.ROLES.AUTO_ROLE}>`}\n\n` +
                    `**Ticket Support:**\n${config.ROLES.TICKET_SUPPORT.includes('_HERE') ? '*Not configured*' : `<@&${config.ROLES.TICKET_SUPPORT}>`}\n\n` +
                    `**Ticket Admin:**\n${config.ROLES.TICKET_ADMIN.includes('_HERE') ? '*Not configured*' : `<@&${config.ROLES.TICKET_ADMIN}>`}\n\n` +
                    `-# To permanently save IDs, update \`config.js\` with these role IDs.`
                ));

            return interaction.reply({ components: [container], flags: CV2_FLAGS | 64 });
        }

        let lines = [];

        if (sub === 'autorole') {
            const role = interaction.options.getRole('role');
            config.ROLES.AUTO_ROLE = role.id;
            lines.push(`**Auto Role** set to <@&${role.id}>`);
        }

        if (sub === 'ticketsupport') {
            const role = interaction.options.getRole('role');
            config.ROLES.TICKET_SUPPORT = role.id;
            lines.push(`**Ticket Support** set to <@&${role.id}>`);
        }

        if (sub === 'ticketadmin') {
            const role = interaction.options.getRole('role');
            config.ROLES.TICKET_ADMIN = role.id;
            lines.push(`**Ticket Admin** set to <@&${role.id}>`);
        }

        if (sub === 'all') {
            const autoRole   = interaction.options.getRole('autorole');
            const support    = interaction.options.getRole('support');
            const admin      = interaction.options.getRole('admin');
            config.ROLES.AUTO_ROLE      = autoRole.id;
            config.ROLES.TICKET_SUPPORT = support.id;
            config.ROLES.TICKET_ADMIN   = admin.id;
            lines.push(
                `**Auto Role** → <@&${autoRole.id}>`,
                `**Ticket Support** → <@&${support.id}>`,
                `**Ticket Admin** → <@&${admin.id}>`
            );
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Role Setup Complete`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                lines.join('\n') + '\n\n-# These changes are applied for this session. Update `config.js` for permanent storage.'
            ));

        await interaction.reply({ components: [container], flags: CV2_FLAGS });
    },
};
