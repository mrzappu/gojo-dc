// ============================================================
//  GOJO BOT — SQLite Database (Sequelize)
//  File: utils/database.js
//  Stores: tickets — survives bot restarts with zero data loss
// ============================================================

const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

// ── Connect to gojo.db in project root ──────────────────────
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'gojo.db'),
    logging: false,   // silence SQL query logs
});

// ─────────────────────────────────────────────────────────────
//  MODEL: Ticket
// ─────────────────────────────────────────────────────────────
const Ticket = sequelize.define('Ticket', {
    channelId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    userTag: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    claimedBy: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    closed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    closedBy: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
}, {
    tableName: 'tickets',
    timestamps: true,       // createdAt + updatedAt tracked
});

// ─────────────────────────────────────────────────────────────
//  MODEL: MemberTimeout (For role restoration)
// ─────────────────────────────────────────────────────────────
const MemberTimeout = sequelize.define('MemberTimeout', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    roles: {
        type: DataTypes.TEXT, // Store as JSON string
        allowNull: false,
        defaultValue: '[]',
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    tableName: 'member_timeouts',
    timestamps: true,
});


// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
async function initDatabase() {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });  // auto-create / migrate tables
    console.log('[DB] gojo.db connected and tables synced.');
    return sequelize;
}

async function saveTicket(data) {
    await Ticket.upsert(data);
}

async function getTicket(channelId) {
    return Ticket.findByPk(channelId);
}

async function getOpenTicketByUser(userId) {
    return Ticket.findOne({ where: { userId, closed: false } });
}

async function updateTicket(channelId, updates) {
    await Ticket.update(updates, { where: { channelId } });
}

async function deleteTicket(channelId) {
    await Ticket.destroy({ where: { channelId } });
}

async function getAllOpenTickets() {
    return Ticket.findAll({ where: { closed: false } });
}

async function getAllTickets() {
    return Ticket.findAll();
}

async function saveMemberTimeout(data) {
    // Upsert or create
    return MemberTimeout.create(data);
}

async function getMemberTimeout(userId, guildId) {
    return MemberTimeout.findOne({ where: { userId, guildId } });
}

async function deleteMemberTimeout(id) {
    return MemberTimeout.destroy({ where: { id } });
}

async function getExpiredTimeouts() {
    return MemberTimeout.findAll({
        where: {
            expiresAt: {
                [Op.lte]: new Date()
            }
        }
    });
}

module.exports = {
    sequelize,
    Ticket,
    initDatabase,
    saveTicket,
    getTicket,
    getOpenTicketByUser,
    updateTicket,
    deleteTicket: deleteTicket,
    getAllOpenTickets,
    getAllTickets,
    MemberTimeout,
    saveMemberTimeout,
    getMemberTimeout,
    deleteMemberTimeout,
    getExpiredTimeouts,
    Op,
};
