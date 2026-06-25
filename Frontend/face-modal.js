/**
 * SecureID Face Modal v3
 * - Models preload silently in background as soon as page loads
 * - Opening the modal is instant (no waiting for models)
 * - Clean iPhone-style face detection UI
 */

class FaceModal {
  constructor({ apiBase, getToken }) {
    this.apiBase    = apiBase;
    this.getToken   = getToken;
    this.engine     = new FaceEngine();
    this._injected  = false;
    this._mode      = null;
    this._cb        = null;
    this._raf       = null;
    this._phase     = 'idle';
    this._preloaded = false;

    // Start preloading models immediately in background
    this._preload();
  }

  // ── Preload models silently in background ─────────────────────────
  async _preload() {
    try {
      await this.engine.load();
      this._preloaded = true;
      console.log('[FaceModal] Models preloaded and cached ✅');
    } catch (e) {
      console.warn('[FaceModal] Background preload failed (will retry on open):', e.message);
    }
  }

  // ── Inject HTML & CSS (once) ──────────────────────────────────────
  init() {
    if (this._injected) return;
    this._injected = true;

    const style = document.createElement('style');
    style.textContent = `
      #fm-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.88);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        display: none; align-items: center; justify-content: center;
        font-family: 'Outfit', sans-serif;
      }
      #fm-overlay.on { display: flex; }

      #fm-box {
        width: 380px; max-width: 94vw;
        background: rgba(5,12,26,0.98);
        border: 1px solid rgba(201,168,76,0.22);
        border-radius: 28px;
        padding: 32px 28px 28px;
        position: relative; overflow: hidden;
        box-shadow: 0 50px 100px rgba(0,0,0,0.85), 0 0 80px rgba(201,168,76,0.05);
        animation: fm-pop .3s cubic-bezier(0.16,1,0.3,1) both;
      }
      @keyframes fm-pop {
        from { opacity:0; transform:scale(0.9) translateY(16px); }
        to   { opacity:1; transform:none; }
      }
      #fm-box::before {
        content: ''; position: absolute; top: 0; left: 8%; right: 8%; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(201,168,76,0.55), transparent);
      }

      /* Logo row */
      .fm-logo {
        display: flex; align-items: center; justify-content: center; gap: 9px;
        margin-bottom: 18px;
      }
      .fm-logo-icon {
        width: 32px; height: 32px;
        background: linear-gradient(145deg,#0D1F4A,#091535);
        border: 1px solid rgba(201,168,76,0.38); border-radius: 10px;
        display: flex; align-items: center; justify-content: center; font-size: 15px;
      }
      .fm-logo-name {
        font-family: 'Cormorant Garamond', serif;
        font-size: 15px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;
        background: linear-gradient(125deg,#C9A84C,#E8CC7A);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }

      /* Title */
      #fm-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 21px; font-weight: 400; color: #EEF2FF;
        text-align: center; margin-bottom: 3px;
      }
      #fm-subtitle {
        font-size: 12px; color: #6B7FA8; text-align: center;
        margin-bottom: 20px; font-weight: 300; line-height: 1.5;
        min-height: 18px;
      }

      /* ── Loading state ── */
      #fm-loading {
        padding: 20px 0; text-align: center; display: none;
      }
      #fm-loading.show { display: block; }
      .fm-spinner-ring {
        width: 48px; height: 48px; margin: 0 auto 14px;
        border: 3px solid rgba(201,168,76,0.15);
        border-top-color: #C9A84C;
        border-radius: 50%;
        animation: fm-spin 0.8s linear infinite;
      }
      @keyframes fm-spin { to { transform: rotate(360deg); } }
      #fm-load-label {
        font-size: 12px; color: #6B7FA8; margin-bottom: 10px; font-weight: 300;
      }
      #fm-progress-bg {
        height: 3px; background: rgba(201,168,76,0.1);
        border-radius: 2px; overflow: hidden; margin: 0 20px;
      }
      #fm-progress-fill {
        height: 3px;
        background: linear-gradient(90deg,#C9A84C,#E8CC7A);
        border-radius: 2px; width: 0%; transition: width 0.4s ease;
      }

      /* ── Camera area ── */
      #fm-cam-wrap { display: none; }
      #fm-cam-wrap.show { display: block; }

      .fm-circle-wrap {
        position: relative; width: 240px; height: 240px;
        margin: 0 auto 16px;
      }
      #fm-video {
        width: 240px; height: 240px;
        border-radius: 50%; object-fit: cover;
        transform: scaleX(-1); /* mirror */
        background: #02080F; display: block;
      }
      #fm-canvas {
        position: absolute; inset: 0;
        width: 240px; height: 240px;
        border-radius: 50%; overflow: hidden;
        transform: scaleX(-1);
        pointer-events: none;
      }
      /* Scan ring */
      .fm-ring {
        position: absolute; inset: -5px; border-radius: 50%;
        border: 2px solid rgba(201,168,76,0.15);
        pointer-events: none;
      }
      .fm-ring-spin {
        position: absolute; inset: -5px; border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: #C9A84C;
        border-right-color: rgba(201,168,76,0.4);
        animation: fm-spin 1.6s linear infinite;
        pointer-events: none;
        display: none;
      }
      .fm-ring-spin.active { display: block; }

      /* Face detected indicator */
      #fm-detect-badge {
        position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
        padding: 3px 12px; border-radius: 50px;
        font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
        opacity: 0; transition: opacity 0.3s; white-space: nowrap;
        pointer-events: none;
      }
      #fm-detect-badge.found { background: rgba(76,175,130,0.15); border: 1px solid rgba(76,175,130,0.4); color: #4CAF82; opacity: 1; }
      #fm-detect-badge.none  { background: rgba(212,145,58,0.1);  border: 1px solid rgba(212,145,58,0.3);  color: #D4913A; opacity: 1; }

      /* ── Idle placeholder ── */
      #fm-placeholder { display: block; }
      #fm-placeholder.hide { display: none; }
      .fm-placeholder-circle {
        width: 240px; height: 240px; border-radius: 50%;
        background: rgba(2,8,15,0.7);
        border: 1.5px dashed rgba(201,168,76,0.18);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        margin: 0 auto 16px; gap: 8px;
      }
      .fm-ph-icon {
        font-size: 60px;
        animation: fm-pulse 2.8s ease-in-out infinite;
      }
      @keyframes fm-pulse {
        0%,100% { opacity: 0.55; transform: scale(1); }
        50%      { opacity: 1;    transform: scale(1.04); }
      }
      .fm-ph-text {
        font-size: 12px; color: #4A5A7A; text-align: center;
        padding: 0 20px; font-weight: 300; line-height: 1.5;
      }

      /* ── Status text ── */
      #fm-status {
        text-align: center; font-size: 13px; color: #6B7FA8;
        margin-bottom: 16px; min-height: 20px;
        font-weight: 300; line-height: 1.5;
      }
      #fm-status.ok   { color: #4CAF82; font-weight: 500; }
      #fm-status.err  { color: #E05555; }
      #fm-status.warn { color: #D4913A; }
      #fm-status.go   { color: #E8CC7A; }

      /* ── Buttons ── */
      .fm-btns { display: flex; gap: 10px; }
      .fm-btn {
        flex: 1; padding: 13px; border: none; border-radius: 12px;
        font-family: 'Outfit', sans-serif;
        font-size: 12px; font-weight: 700;
        letter-spacing: 1.5px; text-transform: uppercase;
        cursor: pointer; transition: all 0.25s;
      }
      .fm-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }
      .fm-gold {
        background: linear-gradient(125deg,#9A7018,#C9A030,#E0BC55,#C9A030,#9A7018);
        background-size: 200%; color: #050A14;
        box-shadow: 0 3px 16px rgba(201,168,76,0.2);
      }
      .fm-gold:not(:disabled):hover {
        background-position: right;
        transform: translateY(-1px);
        box-shadow: 0 6px 22px rgba(201,168,76,0.35);
      }
      .fm-ghost {
        background: transparent;
        border: 1px solid rgba(201,168,76,0.14);
        color: #6B7FA8;
      }
      .fm-ghost:hover { border-color: rgba(201,168,76,0.3); color: #C9A84C; }
      .fm-safe {
        background: rgba(76,175,130,0.12);
        border: 1px solid rgba(76,175,130,0.3);
        color: #4CAF82;
      }

      /* Button spinner */
      .fm-btn-spin {
        display: inline-block; width: 11px; height: 11px;
        border: 2px solid rgba(5,10,20,0.3); border-top-color: #050A14;
        border-radius: 50%; animation: fm-spin 0.65s linear infinite;
        vertical-align: middle; margin-right: 6px;
      }
      .fm-ghost .fm-btn-spin { border-color: rgba(200,200,200,0.2); border-top-color: #aaa; }

      /* Hint */
      .fm-hint {
        text-align: center; margin-top: 12px;
        font-size: 10px; color: rgba(107,127,168,0.45);
        letter-spacing: 0.3px; font-weight: 300;
      }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'fm-overlay';
    wrap.innerHTML = `
      <div id="fm-box">
        <div class="fm-logo">
          <div class="fm-logo-icon">🛡</div>
          <span class="fm-logo-name">SecureID</span>
        </div>

        <div id="fm-title">Face Verification</div>
        <div id="fm-subtitle">Position your face in the frame</div>

        <!-- Loading models -->
        <div id="fm-loading">
          <div class="fm-spinner-ring"></div>
          <div id="fm-load-label">Initialising…</div>
          <div id="fm-progress-bg"><div id="fm-progress-fill"></div></div>
        </div>

        <!-- Idle placeholder -->
        <div id="fm-placeholder">
          <div class="fm-placeholder-circle">
            <div class="fm-ph-icon">👤</div>
            <div class="fm-ph-text">Click Start Camera to begin</div>
          </div>
        </div>

        <!-- Live camera -->
        <div id="fm-cam-wrap">
          <div class="fm-circle-wrap">
            <video id="fm-video" autoplay muted playsinline></video>
            <canvas id="fm-canvas"></canvas>
            <div class="fm-ring"></div>
            <div class="fm-ring-spin" id="fm-ring-spin"></div>
            <div id="fm-detect-badge"></div>
          </div>
        </div>

        <div id="fm-status">Ready when you are</div>

        <div class="fm-btns">
          <button class="fm-btn fm-ghost" onclick="window.__fm.cancel()">Cancel</button>
          <button class="fm-btn fm-gold"  id="fm-main-btn" onclick="window.__fm.action()">Start Camera</button>
        </div>

        <div class="fm-hint" id="fm-hint">Good lighting · Face the camera · Keep still</div>
      </div>
    `;
    document.body.appendChild(wrap);

    this._overlay = wrap;
    this._video   = document.getElementById('fm-video');
    this._canvas  = document.getElementById('fm-canvas');
    window.__fm   = this;
  }

  // ── Public API ────────────────────────────────────────────────────
  enroll(cb)  { this._open('enroll', cb); }
  verify(cb)  { this._open('verify', cb); }

  _open(mode, cb) {
    this._mode  = mode;
    this._cb    = cb;
    this._phase = 'idle';
    this._reset();

    const titles = {
      enroll: ['Enroll Your Face ID',    'Look directly at the camera. Hold still while we scan.'],
      verify: ['Face Verification',      'Confirm your identity to continue.'],
    };
    document.getElementById('fm-title').textContent    = titles[mode][0];
    document.getElementById('fm-subtitle').textContent = titles[mode][1];
    this._overlay.classList.add('on');
  }

  cancel() {
    this._stopOverlay();
    this.engine.stopCamera();
    this._overlay.classList.remove('on');
    this._phase = 'idle';
  }

  // ── Reset UI to idle state ────────────────────────────────────────
  _reset() {
    this._stopOverlay();
    this.engine.stopCamera();

    document.getElementById('fm-loading').classList.remove('show');
    document.getElementById('fm-placeholder').classList.remove('hide');
    document.getElementById('fm-cam-wrap').classList.remove('show');
    document.getElementById('fm-ring-spin').classList.remove('active');
    document.getElementById('fm-detect-badge').className = '';

    this._status('Ready when you are', '');
    this._btn('Start Camera', false, 'gold');
    document.getElementById('fm-hint').textContent = 'Good lighting · Face the camera · Keep still';
  }

  // ── Main button action ────────────────────────────────────────────
  async action() {
    if (this._phase === 'idle')  { await this._startCamera(); return; }
    if (this._phase === 'ready') { await this._scan(); }
  }

  // ── Step 1: Load models (if needed) + start camera ───────────────
  async _startCamera() {
    this._phase = 'loading';
    this._btn('Loading…', true, 'gold');

    // Show loading UI only if models aren't ready yet
    if (!this.engine.loaded) {
      document.getElementById('fm-placeholder').classList.add('hide');
      document.getElementById('fm-loading').classList.add('show');
      this._status('Loading neural models…', 'go');

      try {
        await this.engine.load((msg, pct) => {
          document.getElementById('fm-load-label').textContent     = msg;
          document.getElementById('fm-progress-fill').style.width  = pct + '%';
        });
      } catch (e) {
        document.getElementById('fm-loading').classList.remove('show');
        document.getElementById('fm-placeholder').classList.remove('hide');
        this._phase = 'idle';
        this._status('❌ Failed to load face models. Check your internet connection.', 'err');
        this._btn('Try Again', false, 'gold');
        return;
      }

      document.getElementById('fm-loading').classList.remove('show');
    }

    // Start webcam
    this._status('Starting camera…', 'go');
    document.getElementById('fm-placeholder').classList.add('hide');

    try {
      await this.engine.startCamera(this._video);
    } catch (e) {
      document.getElementById('fm-placeholder').classList.remove('hide');
      this._phase = 'idle';
      if (e.name === 'NotAllowedError') {
        this._status('❌ Camera permission denied. Allow camera in browser settings.', 'err');
      } else if (e.name === 'NotFoundError') {
        this._status('❌ No camera found. Connect a webcam and try again.', 'err');
      } else {
        this._status('❌ Camera error: ' + e.message, 'err');
      }
      this._btn('Try Again', false, 'gold');
      return;
    }

    // Show camera
    document.getElementById('fm-cam-wrap').classList.add('show');
    document.getElementById('fm-ring-spin').classList.add('active');
    this._phase = 'ready';
    this._status('Position your face in the circle and click the button.', 'go');
    this._btn(this._mode === 'enroll' ? 'Enroll My Face' : 'Verify My Face', false, 'gold');

    // Start live overlay
    this._startOverlay();
  }

  // ── Live detection overlay loop ───────────────────────────────────
  _startOverlay() {
    const tick = async () => {
      if (!this.engine.stream || this._phase === 'done' || this._phase === 'scanning') {
        this._raf = requestAnimationFrame(tick);
        return;
      }
      try {
        const n   = await this.engine.drawOverlay(this._video, this._canvas);
        const bdg = document.getElementById('fm-detect-badge');
        if (n > 0) {
          bdg.textContent = '✓ Face Detected';
          bdg.className   = 'found';
        } else {
          bdg.textContent = 'No face — move closer';
          bdg.className   = 'none';
        }
      } catch (e) {}
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stopOverlay() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._canvas) {
      const ctx = this._canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  // ── Step 2: Capture multiple frames, average, send to backend ─────
  async _scan() {
    this._phase = 'scanning';
    this._btn('Scanning…', true, 'gold');
    this._status('Hold still — scanning your face…', 'go');

    try {
      // Collect up to 3 good detections
      const descriptors = [];
      for (let i = 0; i < 6 && descriptors.length < 3; i++) {
        await new Promise(r => setTimeout(r, 250));
        const d = await this.engine.capture(this._video);
        if (d) { descriptors.push(d); }
      }

      if (descriptors.length === 0) {
        this._phase = 'ready';
        this._status('❌ No face detected. Move closer and ensure good lighting.', 'err');
        this._btn(this._mode === 'enroll' ? 'Enroll My Face' : 'Verify My Face', false, 'gold');
        return;
      }

      // Average descriptors for stability
      const avg = new Array(128).fill(0);
      descriptors.forEach(d => d.forEach((v, i) => { avg[i] += v; }));
      const descriptor = avg.map(v => v / descriptors.length);

      if (this._mode === 'enroll') {
        await this._enroll(descriptor);
      } else {
        await this._verify(descriptor);
      }

    } catch (e) {
      console.error('[FaceModal] Scan error:', e);
      this._phase = 'ready';
      this._status('❌ Scan error. Try again.', 'err');
      this._btn(this._mode === 'enroll' ? 'Enroll My Face' : 'Verify My Face', false, 'gold');
    }
  }

  // ── Enroll ────────────────────────────────────────────────────────
  async _enroll(descriptor) {
    this._status('Saving your face data…', 'go');
    try {
      const token = this.getToken();
      console.log('[FaceModal] Enrolling — descriptor length:', descriptor.length, '| token:', token ? 'ok' : 'MISSING');

      const r = await fetch(this.apiBase + '/face/enroll', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify({ descriptor })
      });

      const text = await r.text();
      console.log('[FaceModal] Enroll response:', r.status, text);
      const d = JSON.parse(text);

      if (d.success) {
        this._phase = 'done';
        this._stopOverlay();
        document.getElementById('fm-ring-spin').classList.remove('active');
        document.getElementById('fm-detect-badge').className = '';
        this._status('✅ Face enrolled successfully!', 'ok');
        this._btn('Done ✓', false, 'safe');
        document.getElementById('fm-hint').textContent = 'Your face is now your identity key';
        setTimeout(() => { this.cancel(); if (this._cb) this._cb(true, descriptor); }, 1200);
      } else {
        this._phase = 'ready';
        this._status('❌ ' + (d.message || 'Enrollment failed.'), 'err');
        this._btn('Try Again', false, 'gold');
      }
    } catch (e) {
      console.error('[FaceModal] Enroll fetch error:', e);
      this._phase = 'ready';
      this._status('❌ Server error. Is the backend running?', 'err');
      this._btn('Try Again', false, 'gold');
    }
  }

  // ── Verify ────────────────────────────────────────────────────────
  async _verify(descriptor) {
    this._status('Verifying your identity…', 'go');
    try {
      const token = this.getToken();
      console.log('[FaceModal] Verifying — descriptor length:', descriptor.length, '| token:', token ? 'ok' : 'MISSING');

      const r = await fetch(this.apiBase + '/face/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify({ descriptor })
      });

      const text = await r.text();
      console.log('[FaceModal] Verify response:', r.status, text);
      const d = JSON.parse(text);

      this._phase = 'done';
      this._stopOverlay();
      document.getElementById('fm-ring-spin').classList.remove('active');
      document.getElementById('fm-detect-badge').className = '';

      if (d.verified) {
        this._status('✅ Identity confirmed  (' + d.similarity + '% match)', 'ok');
        this._btn('Verified ✓', false, 'safe');
        document.getElementById('fm-hint').textContent = 'Access granted';
        setTimeout(() => { this.cancel(); if (this._cb) this._cb(true, d.similarity); }, 1000);
      } else {
        this._status('❌ Face not recognised  (' + d.similarity + '% match)', 'err');
        this._btn('Try Again', false, 'gold');
        this._phase = 'ready';
        if (this._cb) this._cb(false, d.similarity);
      }
    } catch (e) {
      console.error('[FaceModal] Verify fetch error:', e);
      this._phase = 'ready';
      this._status('❌ Server error. Is the backend running?', 'err');
      this._btn('Try Again', false, 'gold');
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────
  _status(text, cls) {
    const el = document.getElementById('fm-status');
    if (!el) return;
    el.textContent = text;
    el.className   = cls || '';
  }

  _btn(label, disabled, style) {
    const el = document.getElementById('fm-main-btn');
    if (!el) return;
    el.disabled   = disabled;
    el.className  = 'fm-btn fm-' + (style || 'gold');
    el.innerHTML  = disabled
      ? '<span class="fm-btn-spin"></span>' + label
      : label;
  }
}

window.FaceModal = FaceModal;
