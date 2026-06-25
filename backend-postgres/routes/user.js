const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { User, Device, Card, Alert } = require('../models');

// ── GET /api/user/profile ─────────────────────────────────────────
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Load devices separately to avoid association errors
    const devices = await Device.findAll({
      where: { user_id: req.user.id },
      order: [['last_seen', 'DESC']]
    });

    res.json({
      success: true,
      user: {
        id:                   user.id,
        name:                 user.name,
        email:                user.email,
        faceEnrolled:         user.face_enrolled,
        face_enrolled:        user.face_enrolled,
        accountStatus:        user.account_status,
        account_status:       user.account_status,
        failedLoginAttempts:  user.failed_login_attempts,
        trustedDevices:       devices,
        lastLogin:            user.last_login,
        createdAt:            user.createdAt
      }
    });
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch profile: ' + err.message });
  }
});

// ── PUT /api/user/profile ─────────────────────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
    }
    await req.user.update({ name: name.trim() });
    res.json({ success: true, message: 'Profile updated.', user: { name: req.user.name } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed.' });
  }
});

// ── PUT /api/user/change-password ─────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findByPk(req.user.id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    await user.update({ password: newPassword });
    await Alert.create({
      user_id: user.id,
      type: 'password_changed',
      message: 'Password changed successfully.',
      severity: 'warning'
    });
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password change failed.' });
  }
});

// ── POST /api/user/unlock ─────────────────────────────────────────
router.post('/unlock', protect, async (req, res) => {
  try {
    await req.user.update({ account_status: 'active', failed_login_attempts: 0, lock_until: null });
    res.json({ success: true, message: 'Account unlocked.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unlock failed.' });
  }
});

// ── GET /api/user/stats ───────────────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    const [unreadAlerts, totalCards, frozenCards] = await Promise.all([
      Alert.count({ where: { user_id: req.user.id, read: false } }),
      Card.count({ where: { user_id: req.user.id } }),
      Card.count({ where: { user_id: req.user.id, status: 'frozen' } })
    ]);
    res.json({
      success: true,
      stats: {
        unreadAlerts,
        totalCards,
        frozenCards,
        activeCards: totalCards - frozenCards
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
});

module.exports = router;
