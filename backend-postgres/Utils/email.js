const emailjs = require('@emailjs/nodejs');

// ── In-memory OTP store ───────────────────────────────────────────
const otpStore    = new Map();
const OTP_TTL     = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createOTP(email) {
  const code = generateOTP();
  otpStore.set(email.toLowerCase(), {
    code, expiresAt: Date.now() + OTP_TTL, attempts: 0,
  });
  return code;
}

function verifyOTP(email, code) {
  const key    = email.toLowerCase();
  const record = otpStore.get(key);
  if (!record)                     return { valid: false, message: 'No code found. Please request a new one.' };
  if (Date.now() > record.expiresAt) { otpStore.delete(key); return { valid: false, message: 'Code expired. Please request a new one.' }; }
  record.attempts++;
  if (record.attempts > MAX_ATTEMPTS) { otpStore.delete(key); return { valid: false, message: 'Too many attempts. Please request a new code.' }; }
  if (record.code !== code.toString().trim()) {
    const left = MAX_ATTEMPTS - record.attempts;
    return { valid: false, message: left > 0 ? `Incorrect code. ${left} attempt(s) remaining.` : 'Too many incorrect attempts. Please request a new code.' };
  }
  otpStore.delete(key);
  return { valid: true };
}

// Expose OTP store so auth.js can read the code for dev fallback
function getStoredOTP(email) {
  const record = otpStore.get(email.toLowerCase());
  return record ? record.code : null;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (now > v.expiresAt) otpStore.delete(k);
  }
}, 15 * 60 * 1000);

// ── Send OTP via EmailJS ───────────────────────────────────────────
async function sendOTPEmail(toEmail, name, code) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  // No credentials set — skip silently (dev mode: code shown on screen)
  if (!serviceId || !templateId || !publicKey) {
    console.log(`\n📧 [DEV MODE] OTP for ${toEmail}: ${code}\n`);
    return { dev: true };
  }

  // Initialize EmailJS
  emailjs.init(publicKey);

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#02080F;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#02080F;padding:40px 20px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0"
  style="background:#060F1E;border-radius:20px;border:1px solid rgba(201,168,76,0.2);overflow:hidden;max-width:520px;width:100%">
<tr><td style="background:linear-gradient(135deg,#040D1E,#0A1628);padding:28px 36px;border-bottom:1px solid rgba(201,168,76,0.12)">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="background:linear-gradient(145deg,#0D1F4A,#091535);border:1px solid rgba(201,168,76,0.4);
               border-radius:12px;width:42px;height:42px;text-align:center;vertical-align:middle;font-size:20px;line-height:42px">🛡</td>
    <td style="padding-left:12px">
      <div style="font-size:19px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E8CC7A">SecureID</div>
      <div style="font-size:10px;color:#6B7FA8;letter-spacing:1px">Biometric Banking Protection</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:32px 36px">
  <div style="font-size:11px;color:#6B7FA8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Email Verification</div>
  <div style="font-size:22px;font-weight:400;color:#EEF2FF;margin-bottom:14px">Hello, ${name || 'there'} 👋</div>
  <p style="font-size:14px;color:#8A9AC8;line-height:1.7;margin:0 0 22px">
    Use the code below to verify your email and complete your SecureID registration.
  </p>
  <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.22);border-radius:14px;padding:26px;text-align:center;margin-bottom:24px">
    <div style="font-size:11px;color:#6B7FA8;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">Your Verification Code</div>
    <div style="font-size:46px;font-weight:700;letter-spacing:16px;color:#E8CC7A;font-family:'Courier New',monospace">${code}</div>
    <div style="font-size:11px;color:#6B7FA8;margin-top:12px">Expires in <strong style="color:#EEF2FF">10 minutes</strong></div>
  </div>
  <p style="font-size:12px;color:#6B7FA8;line-height:1.6;margin:0 0 10px">If you did not request this, ignore this email.</p>
  <div style="background:rgba(224,85,85,0.06);border:1px solid rgba(224,85,85,0.18);border-radius:9px;padding:12px 14px;margin-top:16px">
    <span style="font-size:11px;color:#E05555">⚠ Never share this code — SecureID will never ask for it.</span>
  </div>
</td></tr>
<tr><td style="padding:18px 36px 24px;border-top:1px solid rgba(201,168,76,0.07)">
  <p style="font-size:10px;color:#3A4A6A;margin:0;text-align:center">Sent by SecureID · Automated message — do not reply.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  try {
    const result = await emailjs.send(serviceId, templateId, {
      to_email: toEmail,
      to_name: name || 'User',
      subject: `${code} — Your SecureID Verification Code`,
      verification_code: code,
      html_content: html,
    }, publicKey);
    return result;
  } catch (err) {
    // EmailJS failed
    // Fall back to dev mode — log OTP to terminal
    console.error(`\n⚠️  EmailJS failed: ${err.message}`);
    console.error(`📧 [FALLBACK] OTP for ${toEmail}: ${code}\n`);
    return { dev: true, fallback: true, error: err.message };
  }
}

module.exports = { createOTP, verifyOTP, sendOTPEmail, getStoredOTP };
