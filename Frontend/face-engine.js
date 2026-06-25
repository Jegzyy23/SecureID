/**
 * SecureID Face Engine v2
 * Uses face-api.js with jsDelivr CDN (fast, global).
 * Models are cached by the browser after first load — instant on revisit.
 */

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODELS_URL   = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/';

class FaceEngine {
  constructor() {
    this.loaded  = false;
    this.loading = false;
    this.stream  = null;
  }

  // ── Load library + neural network models ─────────────────────────
  async load(onProgress) {
    if (this.loaded) { if (onProgress) onProgress('Ready ✅', 100); return true; }
    if (this.loading) {
      while (this.loading) await new Promise(r => setTimeout(r, 80));
      return this.loaded;
    }
    this.loading = true;

    try {
      if (!window.faceapi) {
        if (onProgress) onProgress('Loading face-api library…', 5);
        await this._loadScript(FACE_API_CDN);
      }

      if (onProgress) onProgress('Loading face detection model…', 20);
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);

      if (onProgress) onProgress('Loading landmark model…', 55);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);

      if (onProgress) onProgress('Loading recognition model…', 80);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);

      if (onProgress) onProgress('Ready ✅', 100);
      this.loaded  = true;
      this.loading = false;
      return true;
    } catch (err) {
      this.loading = false;
      console.error('[FaceEngine] Load error:', err);
      throw err;
    }
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  }

  // ── Start webcam ──────────────────────────────────────────────────
  async startCamera(videoEl) {
    if (this.stream) this.stopCamera();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } }
    });
    videoEl.srcObject = this.stream;
    await new Promise((resolve, reject) => {
      videoEl.onloadedmetadata = resolve;
      videoEl.onerror = reject;
      setTimeout(reject, 8000);
    });
    await videoEl.play();
    return this.stream;
  }

  stopCamera() {
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  }

  // ── Capture 128-float face descriptor ─────────────────────────────
  async capture(videoEl) {
    if (!this.loaded) throw new Error('Engine not loaded. Call load() first.');
    if (!videoEl || videoEl.readyState < 2) return null;

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
    const result  = await faceapi
      .detectSingleFace(videoEl, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) return null;
    return Array.from(result.descriptor); // plain JS Array, not Float32Array
  }

  // ── Live detection overlay ─────────────────────────────────────────
  async drawOverlay(videoEl, canvasEl) {
    if (!this.loaded || !canvasEl || !videoEl) return 0;

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    let detections;
    try {
      detections = await faceapi.detectAllFaces(videoEl, options).withFaceLandmarks();
    } catch (e) { return 0; }

    const dw = videoEl.videoWidth  || 640;
    const dh = videoEl.videoHeight || 480;
    canvasEl.width  = dw;
    canvasEl.height = dh;

    const resized = faceapi.resizeResults(detections, { width: dw, height: dh });
    const ctx     = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, dw, dh);

    resized.forEach(d => {
      const b  = d.detection.box;
      const sz = 18;

      // Glow + box
      ctx.shadowColor = '#C9A84C'; ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      // Corner brackets
      ctx.shadowBlur = 20; ctx.strokeStyle = '#E8CC7A'; ctx.lineWidth = 2.5;
      [
        [[b.x,           b.y+sz], [b.x,           b.y           ], [b.x+sz,          b.y          ]],
        [[b.x+b.width-sz,b.y   ], [b.x+b.width,   b.y           ], [b.x+b.width,     b.y+sz       ]],
        [[b.x,           b.y+b.height-sz], [b.x, b.y+b.height], [b.x+sz, b.y+b.height]],
        [[b.x+b.width-sz,b.y+b.height], [b.x+b.width,b.y+b.height], [b.x+b.width,b.y+b.height-sz]],
      ].forEach(pts => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]); ctx.lineTo(pts[2][0],pts[2][1]);
        ctx.stroke();
      });

      // Score label
      ctx.shadowBlur = 0;
      const score = Math.round(d.detection.score * 100) + '% ✓';
      ctx.font = 'bold 11px sans-serif';
      const tw = ctx.measureText(score).width;
      const cy = b.y > 22 ? b.y - 22 : b.y + b.height + 4;
      ctx.fillStyle = 'rgba(201,168,76,0.9)';
      ctx.fillRect(b.x, cy, tw + 14, 18);
      ctx.fillStyle = '#050A14';
      ctx.fillText(score, b.x + 7, cy + 13);
    });

    return resized.length;
  }

  static euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) return 999;
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.pow(a[i]-b[i],2);
    return Math.sqrt(s);
  }

  static distanceToSimilarity(d) {
    return +(Math.max(0,Math.min(100,(1-d/0.6)*100))).toFixed(1);
  }
}

window.FaceEngine = FaceEngine;
