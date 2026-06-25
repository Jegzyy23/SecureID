const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { Device } = require('../models');

// ── GET /api/devices ──────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { user_id: req.user.id },
      order: [['last_seen', 'DESC']]
    });

    res.json({
      success: true,
      devices: devices.map(d => ({
        id: d.id,
        deviceId: d.device_id,
        deviceName: d.device_name,
        lastSeen: d.last_seen,
        addedAt: d.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch devices.' });
  }
});

// ── DELETE /api/devices/:deviceId ────────────────────────────────
router.delete('/:deviceId', protect, async (req, res) => {
  try {
    const deleted = await Device.destroy({
      where: {
        user_id: req.user.id,
        device_id: req.params.deviceId
      }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    res.json({ success: true, message: 'Device revoked successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to revoke device.' });
  }
});

module.exports = router;
