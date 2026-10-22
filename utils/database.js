// ============================================================
//  GOJO BOT — SQLite Database (Sequelize)
//  File: utils/database.js
//  Stores: tickets, member timeouts, game prices
//  Survives bot restarts with zero data loss
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
    timestamps: true,
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
        type: DataTypes.TEXT,
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
//  MODEL: GamePrice  (used by /game and /post)
// ─────────────────────────────────────────────────────────────
const GamePrice = sequelize.define('GamePrice', {
    appId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
    },
    gameName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    ourPrice: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    updatedBy: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'game_prices',
    timestamps: false,
});

// ─────────────────────────────────────────────────────────────
// MODEL: Vouch and pending VouchRequest
// ─────────────────────────────────────────────────────────────
const Vouch = sequelize.define('Vouch', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    adminId: { type: DataTypes.STRING, allowNull: false },
    productName: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    totalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    transactionId: { type: DataTypes.STRING, allowNull: true },
    paymentMethod: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Not specified' },
}, { tableName: 'vouches', timestamps: true });

const VouchFeedback = sequelize.define('VouchFeedback', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    adminId: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.STRING(1000), allowNull: false },
}, { tableName: 'vouch_feedback', timestamps: true });

const VouchRequest = sequelize.define('VouchRequest', {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    guildId: { type: DataTypes.STRING, allowNull: false },
    channelId: { type: DataTypes.STRING, allowNull: false },
    messageId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    adminId: { type: DataTypes.STRING, allowNull: false },
    productName: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    totalPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    transactionId: { type: DataTypes.STRING, allowNull: true },
    paymentMethod: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Not specified' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
}, { tableName: 'vouch_requests', timestamps: true });

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

// ── Game price helpers ──────────────────────────────────────
async function saveGamePrice(data) {
    // data: { appId, gameName, ourPrice, updatedBy }
    const payload = {
        appId: String(data.appId),
        gameName: String(data.gameName),
        ourPrice: Number(data.ourPrice),
        updatedBy: String(data.updatedBy),
        updatedAt: new Date(),
    };
    await GamePrice.upsert(payload);
    return payload;
}

async function getGamePrice(appId) {
    return GamePrice.findByPk(String(appId));
}

async function deleteGamePrice(appId) {
    return GamePrice.destroy({ where: { appId: String(appId) } });
}

module.exports = {
    sequelize,
    Ticket,
    MemberTimeout,
    GamePrice,
    Vouch,
    VouchRequest,
    VouchFeedback,
    initDatabase,
    saveTicket,
    getTicket,
    getOpenTicketByUser,
    updateTicket,
    deleteTicket,
    getAllOpenTickets,
    getAllTickets,
    saveMemberTimeout,
    getMemberTimeout,
    deleteMemberTimeout,
    getExpiredTimeouts,
    saveGamePrice,
    getGamePrice,
    deleteGamePrice,
    Op,
};
