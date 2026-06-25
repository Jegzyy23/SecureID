const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  // PostgreSQL will auto-create an integer primary key called "id"
  // We override to use UUID for security
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true }
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },

  // Face biometric — stored as ARRAY of floats (PostgreSQL supports native arrays)
  face_embedding: {
    type: DataTypes.ARRAY(DataTypes.FLOAT),
    allowNull: true,
    defaultValue: null
  },
  face_enrolled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  // Security
  account_status: {
    type: DataTypes.ENUM('active', 'locked', 'suspended'),
    defaultValue: 'active'
  },
  failed_login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lock_until: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },

  // Audit
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  last_login_device: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,         // adds createdAt / updatedAt columns automatically
  underscored: true         // uses snake_case column names in PostgreSQL
});

// ── Instance methods ──────────────────────────────────────────────

// Hash password before saving
User.beforeSave(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 12);
  }
});

// Compare entered password with hashed one
User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is currently locked
User.prototype.isLocked = function () {
  return (
    this.account_status === 'locked' &&
    this.lock_until &&
    new Date(this.lock_until) > new Date()
  );
};

module.exports = User;
