const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { Alert } = require('../models');

// ── GET /api/alerts ───────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch alerts.' });
  }
});

// ── PATCH /api/alerts/:id/read ────────────────────────────────────
router.patch('/:id/read', protect, async (req, res) => {
  try {
    await Alert.update(
      { read: true },
      { where: { id: req.params.id, user_id: req.user.id } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark alert as read.' });
  }
});

// ── PATCH /api/alerts/read-all ────────────────────────────────────
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Alert.update(
      { read: true },
      { where: { user_id: req.user.id, read: false } }
    );
    res.json({ success: true, message: 'All alerts marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

module.exports = router;
