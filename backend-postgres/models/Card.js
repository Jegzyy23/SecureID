const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Card = sequelize.define('Card', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE'
  },
  card_number: {
    type: DataTypes.STRING(20),
    allowNull: false
    // In real banking: NEVER store full PAN — use tokenization
    // For this academic project it's acceptable as a simulation
  },
  card_holder: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  bank: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  card_type: {
    type: DataTypes.ENUM('VISA', 'MASTERCARD', 'VERVE'),
    defaultValue: 'VERVE'
  },
  expiry_month: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  expiry_year: {
    type: DataTypes.STRING(4),
    allowNull: true
  },

  // Card status
  status: {
    type: DataTypes.ENUM('active', 'frozen', 'blocked', 'expired'),
    defaultValue: 'active'
  },
  frozen_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  frozen_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'cards',
  timestamps: true,
  underscored: true
});

// Helper: return masked card number for display
Card.prototype.getMasked = function () {
  return '**** **** **** ' + this.card_number.slice(-4);
};

module.exports = Card;
