const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────
// IMPORTANT: x-admin-key must be in allowedHeaders or browser blocks admin panel
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // allow all origins in development
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  credentials: true
}));

// Handle browser preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check (no auth needed) ────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SecureID Backend (PostgreSQL) is running 🟢',
    database: 'PostgreSQL',
    time: new Date()
  });
});

// DB + route registration are performed in initApp so importing this file
// does not start a server (important for serverless environments).
const { sequelize, syncDatabase } = require('./models');

let _initialized = false;

async function initApp() {
  if (_initialized) return app;
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected successfully');
    await syncDatabase();

    // ── Routes ────────────────────────────────────────────────────
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/user', require('./routes/user'));
    app.use('/api/cards', require('./routes/cards'));
    app.use('/api/devices', require('./routes/devices'));
    app.use('/api/face', require('./routes/face'));
    app.use('/api/alerts', require('./routes/alerts'));
    app.use('/api/admin', require('./routes/admin')); // ← Admin panel

    _initialized = true;
    return app;
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err && err.message ? err.message : err);
    console.error('   Check .env — DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    throw err;
  }
}

// If executed directly, initialize and start a local server (development)
if (require.main === module) {
  initApp()
    .then(() => {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log('🚀 SecureID running on http://localhost:' + PORT);
        console.log('📋 Health: http://localhost:' + PORT + '/api/health');
        console.log('🛡  Admin:  http://localhost:' + PORT + '/api/admin/stats  (needs x-admin-key header)');
      });
    })
    .catch(() => process.exit(1));
}

module.exports = { app, initApp };
