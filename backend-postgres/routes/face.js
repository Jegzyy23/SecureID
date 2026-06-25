const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { User, Alert } = require('../models');

// ── Euclidean distance (face-api.js standard) ─────────────────────
function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function distanceToSimilarity(distance) {
  return Math.max(0, Math.min(100, (1 - distance / 0.6) * 100));
}

// ── Helper: extract descriptor from request body ──────────────────
// Accepts: { descriptor: [...] } or { embedding: [...] }
// Also converts Float32Array-like objects to plain arrays
function extractDescriptor(body) {
  const raw = body.descriptor || body.embedding || body.samples;
  if (!raw) return null;
  
  // Handle nested samples array (average them)
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const len = raw[0].length;
    const avg = new Array(len).fill(0);
    raw.forEach(s => s.forEach((v, i) => { avg[i] += v; }));
    return avg.map(v => parseFloat((v / raw.length).toFixed(8)));
  }
  
  // Plain array — convert each value to float
  if (Array.isArray(raw)) {
    return raw.map(v => parseFloat(v));
  }
  
  return null;
}

// ── POST /api/face/enroll ─────────────────────────────────────────
router.post('/enroll', protect, async (req, res) => {
  try {
    const descriptor = extractDescriptor(req.body);

    if (!descriptor || descriptor.length < 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid face data. Got: ' + (descriptor ? descriptor.length + ' values' : 'nothing') + '. Expected 128 floats from face-api.js.'
      });
    }

    await req.user.update({
      face_embedding: descriptor,
      face_enrolled: true
    });

    await Alert.create({
      user_id: req.user.id,
      type: 'login_success',
      message: 'Face enrolled successfully using neural biometric recognition.',
      severity: 'info'
    });

    console.log('✅ Face enrolled for user:', req.user.email, '| descriptor length:', descriptor.length);
    res.json({ success: true, message: 'Face enrolled successfully.' });

  } catch (err) {
    console.error('Face enroll error:', err.message);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ── POST /api/face/verify ─────────────────────────────────────────
router.post('/verify', protect, async (req, res) => {
  try {
    const descriptor = extractDescriptor(req.body);

    if (!descriptor || descriptor.length < 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid face data. Got: ' + (descriptor ? descriptor.length + ' values' : 'nothing') + '. Expected 128 floats.'
      });
    }
  
    const user = await User.findByPk(req.user.id);

    if (!user.face_enrolled || !user.face_embedding) {
      return res.json({
        success: true,
        verified: true,
        similarity: 100,
        message: 'No face enrolled — access granted.'
      });
    }

    const storedDescriptor = Array.from(user.face_embedding).map(v => parseFloat(v));
    const distance   = euclideanDistance(descriptor, storedDescriptor);
    const THRESHOLD  = 0.5;  // slightly relaxed for real-world conditions
    const verified   = distance < THRESHOLD;
    const similarity = parseFloat(distanceToSimilarity(distance).toFixed(1));

    console.log('\Face verify for \${req.user.email}: distance=\${distance.toFixed(4)}, similarity=\${similarity}%, verified=\${verified}/');

    if (!verified) {
      await Alert.create({
        user_id: user.id,
        type: 'face_mismatch',
        message: 'Face verification failed (distance: ' + distance.toFixed(3) + ', similarity: ' + similarity + '%).',
        severity: 'critical',
        device_id: req.body.deviceId || null,
        metadata: { distance, similarity }
      });
    }

    res.json({
      success: true,
      verified,
      similarity,
      distance: parseFloat(distance.toFixed(4)),
      message: verified ? 'Face verified successfully. ✅' : 'Face does not match. ❌'
    });

  } catch (err) {
    console.error('Face verify error:', err.message);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// ── DELETE /api/face/remove ───────────────────────────────────────
router.delete('/remove', protect, async (req, res) => {
  try {
    await req.user.update({ face_embedding: null, face_enrolled: false });
    res.json({ success: true, message: 'Face data removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

module.exports = router;
