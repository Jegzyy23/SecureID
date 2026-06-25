const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alert = sequelize.define('Alert', {
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
  type: {
    type: DataTypes.ENUM(
      'new_device_login',
      'face_mismatch',
      'card_frozen',
      'card_unfrozen',
      'account_locked',
      'suspicious_activity',
      'emergency_freeze',
      'password_changed',
      'login_success',
      'login_failed'
    ),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  severity: {
    type: DataTypes.ENUM('info', 'warning', 'critical'),
    defaultValue: 'info'
  },
  device_id: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Store extra data as JSONB — PostgreSQL's powerful JSON column type
  // This lets you store flexible metadata while keeping the rest structured
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'alerts',
  timestamps: true,
  underscored: true
});

module.exports = Alert;
