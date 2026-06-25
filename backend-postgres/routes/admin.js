const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const { User, Device, Card, Transaction, Alert } = require('../models');

// ── Admin Key Guard ───────────────────────────────────────────────
// Protected by ADMIN_KEY in .env — add: ADMIN_KEY=secureid_admin_2025
const adminGuard = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, message: 'Admin access denied. Invalid key.' });
  }
  next();
};
router.use(adminGuard);

// ── GET /api/admin/stats ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, activeUsers, lockedUsers, suspendedUsers,
      faceEnrolled, newToday, newWeek,
      totalCards, frozenCards, activeCards,
      totalAlerts, unreadAlerts, criticalAlerts,
      totalTxn, successTxn, declinedTxn,
      totalDevices,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { account_status: 'active' } }),
      User.count({ where: { account_status: 'locked' } }),
      User.count({ where: { account_status: 'suspended' } }),
      User.count({ where: { face_enrolled: true } }),
      User.count({ where: { created_at: { [Op.gte]: today } } }),
      User.count({ where: { created_at: { [Op.gte]: weekAgo } } }),
      Card.count(),
      Card.count({ where: { status: 'frozen' } }),
      Card.count({ where: { status: 'active' } }),
      Alert.count(),
      Alert.count({ where: { read: false } }),
      Alert.count({ where: { severity: 'critical', read: false } }),
      Transaction.count(),
      Transaction.count({ where: { status: 'success' } }),
      Transaction.count({ where: { status: 'declined' } }),
      Device.count(),
    ]);

    res.json({
      success: true,
      stats: {
        users:        { total: totalUsers, active: activeUsers, locked: lockedUsers, suspended: suspendedUsers, faceEnrolled, newToday, newWeek },
        cards:        { total: totalCards, active: activeCards, frozen: frozenCards },
        alerts:       { total: totalAlerts, unread: unreadAlerts, critical: criticalAlerts },
        transactions: { total: totalTxn, success: successTxn, declined: declinedTxn },
        devices:      { total: totalDevices },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/users ─────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.account_status = status;
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: '%' + search + '%' } },
        { email: { [Op.iLike]: '%' + search + '%' } },
      ];
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: users } = await User.findAndCountAll({
      where, order: [['created_at', 'DESC']],
      limit: parseInt(limit), offset,
      attributes: { exclude: ['password', 'face_embedding'] }
    });

    const enriched = await Promise.all(users.map(async u => {
      const [cardCount, deviceCount, unreadAlerts] = await Promise.all([
        Card.count({ where: { user_id: u.id } }),
        Device.count({ where: { user_id: u.id } }),
        Alert.count({ where: { user_id: u.id, read: false } }),
      ]);
      return { ...u.toJSON(), cardCount, deviceCount, unreadAlerts };
    }));

    res.json({ success: true, users: enriched, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/users/:id ─────────────────────────────────────
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'face_embedding'] }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const [cards, devices, alerts] = await Promise.all([
      Card.findAll({ where: { user_id: user.id }, order: [['created_at', 'DESC']] }),
      Device.findAll({ where: { user_id: user.id }, order: [['last_seen', 'DESC']] }),
      Alert.findAll({ where: { user_id: user.id }, order: [['created_at', 'DESC']], limit: 30 }),
    ]);

    res.json({ success: true, user: user.toJSON(), cards, devices, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/users/:id/status ────────────────────────────
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','locked','suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await user.update({
      account_status: status,
      failed_login_attempts: status === 'active' ? 0 : user.failed_login_attempts,
      lock_until: status === 'active' ? null : user.lock_until,
    });
    await Alert.create({
      user_id: user.id, type: 'suspicious_activity',
      message: 'Account status changed to "' + status + '" by administrator.',
      severity: status === 'active' ? 'info' : 'critical',
    });
    res.json({ success: true, message: 'User status updated to ' + status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await user.destroy();
    res.json({ success: true, message: 'User and all data permanently deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/cards ─────────────────────────────────────────
router.get('/cards', async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const where = status ? { status } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: cards } = await Card.findAndCountAll({
      where, order: [['created_at', 'DESC']], limit: parseInt(limit), offset
    });
    const enriched = await Promise.all(cards.map(async c => {
      const user = await User.findByPk(c.user_id, { attributes: ['name', 'email'] });
      return { ...c.toJSON(), masked: c.getMasked(), ownerName: user?.name, ownerEmail: user?.email };
    }));
    res.json({ success: true, cards: enriched, total: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/admin/cards/:id/status ────────────────────────────
router.patch('/cards/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const card = await Card.findByPk(req.params.id);
    if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });
    await card.update({
      status,
      frozen_at:     ['frozen','blocked'].includes(status) ? new Date() : null,
      frozen_reason: reason || 'Admin action',
    });
    await Alert.create({
      user_id: card.user_id,
      type: status === 'frozen' ? 'card_frozen' : 'card_unfrozen',
      message: 'Card ' + card.getMasked() + ' changed to "' + status + '" by administrator.',
      severity: status === 'active' ? 'info' : 'warning',
    });
    res.json({ success: true, message: 'Card status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/alerts ────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const { severity, page = 1, limit = 50 } = req.query;
    const where = severity ? { severity } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: alerts } = await Alert.findAndCountAll({
      where, order: [['created_at', 'DESC']], limit: parseInt(limit), offset
    });
    const enriched = await Promise.all(alerts.map(async a => {
      const user = await User.findByPk(a.user_id, { attributes: ['name', 'email'] });
      return { ...a.toJSON(), userName: user?.name, userEmail: user?.email };
    }));
    res.json({ success: true, alerts: enriched, total: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/transactions ──────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const where = status ? { status } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Transaction.findAndCountAll({
      where, order: [['created_at', 'DESC']], limit: parseInt(limit), offset
    });
    const enriched = await Promise.all(rows.map(async t => {
      const [card, user] = await Promise.all([
        Card.findByPk(t.card_id, { attributes: ['card_number','bank'] }),
        User.findByPk(t.user_id, { attributes: ['name','email'] }),
      ]);
      return {
        ...t.toJSON(),
        cardMasked: card ? '**** **** **** ' + card.card_number.slice(-4) : 'N/A',
        bank: card?.bank, userName: user?.name, userEmail: user?.email,
      };
    }));
    res.json({ success: true, transactions: enriched, total: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/activity-feed ────────────────────────────────
router.get('/activity-feed', async (req, res) => {
  try {
    const alerts = await Alert.findAll({ order: [['created_at', 'DESC']], limit: 60 });
    const enriched = await Promise.all(alerts.map(async a => {
      const user = await User.findByPk(a.user_id, { attributes: ['name','email'] });
      return { ...a.toJSON(), userName: user?.name, userEmail: user?.email };
    }));
    res.json({ success: true, feed: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/broadcast ────────────────────────────────────
router.post('/broadcast', async (req, res) => {
  try {
    const { message, severity = 'info' } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required.' });
    const users = await User.findAll({ attributes: ['id'] });
    await Promise.all(users.map(u => Alert.create({
      user_id: u.id, type: 'suspicious_activity', message, severity
    })));
    res.json({ success: true, message: 'Broadcast sent to ' + users.length + ' users.', count: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/system-freeze ───────────────────────────────
router.post('/system-freeze', async (req, res) => {
  try {
    const { reason } = req.body;
    const [count] = await Card.update(
      { status: 'frozen', frozen_at: new Date(), frozen_reason: reason || 'System-wide emergency freeze by administrator' },
      { where: { status: 'active' } }
    );
    const users = await User.findAll({ attributes: ['id'] });
    await Promise.all(users.map(u => Alert.create({
      user_id: u.id, type: 'emergency_freeze',
      message: '🚨 SYSTEM ALERT: All cards frozen by administrator. Contact support immediately.',
      severity: 'critical',
    })));
    res.json({ success: true, message: count + ' cards frozen system-wide.', count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ── POST /api/admin/system-unfreeze ─────────────────────────────
router.post('/system-unfreeze', async (req, res) => {
  try {
    const { reason } = req.body;
    const [count] = await Card.update(
      { status: 'active', frozen_at: null, frozen_reason: null },
      { where: { status: 'frozen' } }
    );
    const users = await User.findAll({ attributes: ['id'] });
    await Promise.all(users.map(u => Alert.create({
      user_id:  u.id,
      type:     'card_unfrozen',
      message:  '✅ All cards have been unfrozen by administrator. ' + (reason || 'Normal service restored.'),
      severity: 'info',
    })));
    res.json({ success: true, message: count + ' cards unfrozen system-wide.', count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
