const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const { User, Device, Alert } = require('../models');
const { createOTP, verifyOTP, sendOTPEmail, getStoredOTP } = require('../Utils/email');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

// ── POST /api/auth/send-otp ───────────────────────────────────────
// Step 1 of registration: send OTP to email address
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Check if email is already registered
    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This email address is already registered. Please log in.' });
    }

    // Generate and store OTP
    const code = createOTP(email.toLowerCase().trim());

    // Send email — never crash registration if email fails
    const emailResult = await sendOTPEmail(email.trim(), name || '', code).catch(err => {
      console.error('Email error:', err.message);
      return { dev: true, error: err.message };
    });

    const isDevMode = !emailResult || emailResult.dev || emailResult.fallback || emailResult.error;

    console.log(`OTP for ${email}: ${code} | devMode: ${isDevMode}`);

    res.json({
      success: true,
      devMode: isDevMode,
      devCode: isDevMode ? code : undefined,
      message: isDevMode
        ? 'Code generated. Check your terminal or use the pre-filled code.'
        : 'Verification code sent to ' + email + '. Check your inbox and spam folder.'
    });

  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────
// Step 2 of registration: verify the OTP before creating account
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const result = verifyOTP(email.toLowerCase().trim(), code.toString().trim());

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({ success: true, message: 'Email verified successfully! You can now complete your registration.' });

  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────
// Step 3 of registration: create account (after OTP verified)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, deviceId, deviceName, otpVerified } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    // Require OTP verification flag — the frontend sets this after /verify-otp succeeds
    if (!otpVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email verification required. Please verify your email first.'
      });
    }

    // Double-check for duplicate email
    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Create user
    const user = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password,
    });

    // Save device
    if (deviceId) {
      await Device.create({
        user_id:     user.id,
        device_id:   deviceId,
        device_name: deviceName || 'Unknown Device'
      });
    }

    await Alert.create({
      user_id:   user.id,
      type:      'login_success',
      message:   `Account created with verified email. Welcome, ${name}!`,
      severity:  'info',
      device_id: deviceId || null
    });

    const token = signToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        id:            user.id,
        name:          user.name,
        email:         user.email,
        faceEnrolled:  user.face_enrolled,
        accountStatus: user.account_status
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceId, deviceName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.isLocked()) {
      const remaining = Math.ceil((new Date(user.lock_until) - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remaining} minute(s).`
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      const attempts = user.failed_login_attempts + 1;
      const updateData = { failed_login_attempts: attempts };

      if (attempts >= 5) {
        updateData.account_status = 'locked';
        updateData.lock_until = new Date(Date.now() + 15 * 60 * 1000);
        await Alert.create({
          user_id:   user.id, type: 'account_locked',
          message:   'Account locked after 5 failed login attempts.',
          severity:  'critical', device_id: deviceId || null
        });
      }
      await user.update(updateData);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // New device check
    let newDeviceDetected = false;
    if (deviceId) {
      const knownDevice = await Device.findOne({ where: { user_id: user.id, device_id: deviceId } });
      if (!knownDevice) {
        newDeviceDetected = true;
        await Device.create({ user_id: user.id, device_id: deviceId, device_name: deviceName || 'Unknown Device' });
        await Alert.create({
          user_id:   user.id, type: 'new_device_login',
          message:   `New device login: ${deviceName || 'Unknown Device'}. If this wasn't you, freeze your cards immediately.`,
          severity:  'warning', device_id: deviceId
        });
      } else {
        await knownDevice.update({ last_seen: new Date() });
      }
    }

    await user.update({
      failed_login_attempts: 0,
      account_status:        'active',
      lock_until:            null,
      last_login:            new Date(),
      last_login_device:     deviceId || null
    });

    await Alert.create({
      user_id:   user.id, type: 'login_success',
      message:   `Successful login from ${deviceName || 'Unknown Device'}.`,
      severity:  'info', device_id: deviceId || null
    });

    const token = signToken(user.id);
    res.json({
      success: true, message: 'Login successful.', token, newDeviceDetected,
      user: {
        id: user.id, name: user.name, email: user.email,
        faceEnrolled: user.face_enrolled, accountStatus: user.account_status
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

module.exports = router;
