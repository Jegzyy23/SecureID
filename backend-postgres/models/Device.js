const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// In MongoDB, devices were stored as an array inside the User document.
// In PostgreSQL (relational), they get their own proper table —
// this is cleaner, queryable, and scalable.

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Foreign key to users table
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE'   // if user is deleted, their devices are too
  },
  device_id: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  device_name: {
    type: DataTypes.STRING(200),
    defaultValue: 'Unknown Device'
  },
  last_seen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true
});

module.exports = Device;
