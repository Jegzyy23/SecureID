const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// ── Define all models inline to avoid any circular dependency ─────

const User = sequelize.define('User', {
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:                 { type: DataTypes.STRING(100), allowNull: false },
  email:                { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password:             { type: DataTypes.STRING(255), allowNull: false },
  face_embedding:       { type: DataTypes.ARRAY(DataTypes.FLOAT), allowNull: true, defaultValue: null },
  face_enrolled:        { type: DataTypes.BOOLEAN, defaultValue: false },
  account_status:       { type: DataTypes.ENUM('active','locked','suspended'), defaultValue: 'active' },
  failed_login_attempts:{ type: DataTypes.INTEGER, defaultValue: 0 },
  lock_until:           { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  last_login:           { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  last_login_device:    { type: DataTypes.STRING(100), allowNull: true }
}, { tableName: 'users', timestamps: true, underscored: true });

User.beforeSave(async (user) => {
  if (user.changed('password')) user.password = await bcrypt.hash(user.password, 12);
});
User.prototype.comparePassword = async function(pw) { return bcrypt.compare(pw, this.password); };
User.prototype.isLocked = function() {
  return this.account_status === 'locked' && this.lock_until && new Date(this.lock_until) > new Date();
};

// ─────────────────────────────────────────────────────────────────

const Device = sequelize.define('Device', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:     { type: DataTypes.UUID, allowNull: false },
  device_id:   { type: DataTypes.STRING(200), allowNull: false },
  device_name: { type: DataTypes.STRING(200), defaultValue: 'Unknown Device' },
  last_seen:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'devices', timestamps: true, underscored: true });

// ─────────────────────────────────────────────────────────────────

const Card = sequelize.define('Card', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:      { type: DataTypes.UUID, allowNull: false },
  card_number:  { type: DataTypes.STRING(20), allowNull: false },
  card_holder:  { type: DataTypes.STRING(100), allowNull: false },
  bank:         { type: DataTypes.STRING(100), allowNull: false },
  card_type:    { type: DataTypes.ENUM('VISA','MASTERCARD','VERVE'), defaultValue: 'VERVE' },
  expiry_month: { type: DataTypes.STRING(2), allowNull: true },
  expiry_year:  { type: DataTypes.STRING(4), allowNull: true },
  status:       { type: DataTypes.ENUM('active','frozen','blocked','expired'), defaultValue: 'active' },
  frozen_at:    { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  frozen_reason:{ type: DataTypes.TEXT, allowNull: true, defaultValue: null }
}, { tableName: 'cards', timestamps: true, underscored: true });

Card.prototype.getMasked = function() { return '**** **** **** ' + this.card_number.slice(-4); };

// ─────────────────────────────────────────────────────────────────

const Transaction = sequelize.define('Transaction', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  card_id:     { type: DataTypes.UUID, allowNull: false },
  user_id:     { type: DataTypes.UUID, allowNull: false },
  amount:      { type: DataTypes.DECIMAL(12,2), allowNull: false },
  description: { type: DataTypes.STRING(255), defaultValue: 'ATM Transaction' },
  type:        { type: DataTypes.ENUM('debit','credit'), defaultValue: 'debit' },
  status:      { type: DataTypes.ENUM('success','declined'), allowNull: false }
}, { tableName: 'transactions', timestamps: true, underscored: true });

// ─────────────────────────────────────────────────────────────────

const Alert = sequelize.define('Alert', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:   { type: DataTypes.UUID, allowNull: false },
  type:      { type: DataTypes.ENUM(
    'new_device_login','face_mismatch','card_frozen','card_unfrozen',
    'account_locked','suspicious_activity','emergency_freeze',
    'password_changed','login_success','login_failed'
  ), allowNull: false },
  message:   { type: DataTypes.TEXT, allowNull: false },
  severity:  { type: DataTypes.ENUM('info','warning','critical'), defaultValue: 'info' },
  device_id: { type: DataTypes.STRING(200), allowNull: true },
  read:      { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata:  { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName: 'alerts', timestamps: true, underscored: true });

// ── Associations ──────────────────────────────────────────────────
User.hasMany(Device,      { foreignKey: 'user_id', as: 'devices',      onDelete: 'CASCADE' });
Device.belongsTo(User,    { foreignKey: 'user_id' });

User.hasMany(Card,        { foreignKey: 'user_id', as: 'cards',        onDelete: 'CASCADE' });
Card.belongsTo(User,      { foreignKey: 'user_id' });

Card.hasMany(Transaction, { foreignKey: 'card_id', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(Card,{ foreignKey: 'card_id' });

User.hasMany(Transaction, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Transaction.belongsTo(User,{ foreignKey: 'user_id' });

User.hasMany(Alert,       { foreignKey: 'user_id', as: 'alerts',       onDelete: 'CASCADE' });
Alert.belongsTo(User,     { foreignKey: 'user_id' });

// ── Sync ──────────────────────────────────────────────────────────
const syncDatabase = async () => {
  await sequelize.sync({ alter: true });
  console.log('✅ All PostgreSQL tables synced successfully');
};

module.exports = { sequelize, syncDatabase, User, Device, Card, Transaction, Alert };
