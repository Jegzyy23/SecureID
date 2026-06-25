const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// In MongoDB this was an array inside the Card document.
// In PostgreSQL it's a proper separate table — much better for querying.

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  card_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'cards', key: 'id' },
    onDelete: 'CASCADE'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),   // proper currency type — not float!
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255),
    defaultValue: 'ATM Transaction'
  },
  type: {
    type: DataTypes.ENUM('debit', 'credit'),
    defaultValue: 'debit'
  },
  status: {
    type: DataTypes.ENUM('success', 'declined'),
    allowNull: false
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true
});

module.exports = Transaction;
