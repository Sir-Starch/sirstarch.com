/* ============================================================
   SIR STARCH — sirstarch.com
   One long zoom into a potato who writes Rust.
   Written in JavaScript, which the Duke regrets.

   How it works: five worlds ("layers"). Each layer has a portal element
   (the monocle, a kitty window, the potato pi-casso found, the monocle again in digits, a painting).
   The next layer lives inside that portal, scaled down. Zoom position is
   one real number z: floor(z) is the layer you are in, the fraction is
   how far you have zoomed into its portal. Layer 4's portal contains
   layer 0 again, so z can grow forever.
   ============================================================ */
(() => {
'use strict';
window.__ss = 1;

/* ---------- config: where things are on the portrait ----------
   Fractions of assets/avatar-1254.webp. If the portrait ever changes,
   these are the only numbers that need a nudge. */
const AVATAR = 'assets/avatar-1254.webp';
const AVATAR_FALLBACK = 'assets/avatar-640.jpg';
const MONOCLE = { x: 0.5286, y: 0.3975, d: 0.0785 };   // glass of the monocle
const IMG_SCALE = 1.095;                                 // the gallery crops the portrait's own gold ring
const DISC = 0.4875;                                     // radius of the round portrait (gold ring included), as a fraction of the square image
const START_HASH = location.hash.slice(1);               // read before the engine starts rewriting the URL

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mod = (n, m) => ((n % m) + m) % m;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isNarrow = () => innerWidth <= 820 || innerWidth / innerHeight < 0.8;
const PI = window.PI_DIGITS || '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';
const store = {
  get(k, d) { try { const v = localStorage.getItem('ss:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ss:' + k, JSON.stringify(v)); } catch { /* private mode, peasants */ } },
};
const session = {
  get(k) { try { return sessionStorage.getItem('ss:' + k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem('ss:' + k, v); } catch { /* same */ } },
};

/* ============================================================
   SOUND — off by default. Harpsichord-ish prelude + a zoom whoosh.
   ============================================================ */
const sfx = (() => {
  let ctx = null, master = null, noiseGain = null, noiseFilter = null;
  let on = store.get('sound', false), music = false, seq = 0, nextNote = 0, step = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 400; noiseFilter.Q.value = 0.9;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    src.connect(noiseFilter).connect(noiseGain).connect(master); src.start();
    return ctx;
  }
  const ac = () => {
    if (!on) return null;
    const c = init();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    return c;
  };
  function tone(f, t, d, type = 'sine', v = 0.07, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  function pluck(f, t, v, d) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = f; o2.frequency.value = f * 2.004; g2.gain.value = 0.22;
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(Math.min(16000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(master);
    o1.start(t); o2.start(t); o1.stop(t + d + 0.05); o2.stop(t + d + 0.05);
  }
  // D minor, eight eighths per bar: i – iv – V7 – i – VI – iv – V – i
  const BARS = [
    [50, 57, 62, 65, 69, 65, 62, 57], [43, 55, 58, 62, 67, 62, 58, 55], [45, 57, 61, 64, 67, 64, 61, 57], [50, 57, 62, 65, 69, 74, 69, 65],
    [46, 53, 58, 62, 65, 62, 58, 53], [43, 55, 58, 62, 67, 62, 58, 55], [45, 57, 61, 64, 69, 64, 61, 57], [50, 57, 62, 65, 69, 65, 62, 50],
  ];
  const EIGHTH = 60 / 76 / 2;
  function schedule() {
    if (!ctx) return;
    while (nextNote < ctx.currentTime + 0.3) {
      const bar = BARS[Math.floor(step / 8) % BARS.length], n = bar[step % 8];
      pluck(midi(n), nextNote, step % 8 === 0 ? 0.045 : 0.028, 1.1);
      if (step % 8 === 0) pluck(midi(bar[0] - 12), nextNote, 0.035, 2.4);
      nextNote += EIGHTH; step++;
    }
  }
  return {
    get on() { return on; },
    get music() { return music; },
    setOn(v) {
      on = v; store.set('sound', v);
      if (v) ac(); else { this.stopMusic(); if (noiseGain) noiseGain.gain.value = 0; }
    },
    startMusic() {
      const c = ac(); if (!c) return false;
      if (music) return true;
      music = true; nextNote = c.currentTime + 0.12; schedule(); seq = setInterval(schedule, 80);
      return true;
    },
    stopMusic() { music = false; clearInterval(seq); },
    whoosh(speed) {
      if (!ctx || !on || !noiseGain) return;
      const t = ctx.currentTime, a = clamp(speed, 0, 4);
      noiseGain.gain.setTargetAtTime(a * 0.045, t, 0.07);
      noiseFilter.frequency.setTargetAtTime(220 + a * 700, t, 0.09);
    },
    ding() { const c = ac(); if (!c) return; const t = c.currentTime; tone(1568, t, 1.1, 'sine', 0.06); tone(2349, t, 0.8, 'sine', 0.03); tone(3136, t + 0.01, 0.5, 'sine', 0.015); },
    pop() { const c = ac(); if (!c) return; tone(520 + rand(-40, 80), c.currentTime, 0.14, 'triangle', 0.09, 160); },
    fanfare() { const c = ac(); if (!c) return; const t = c.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.5, 'triangle', 0.06)); },
    alarm() { const c = ac(); if (!c) return; const t = c.currentTime; for (let i = 0; i < 5; i++) { tone(880, t + i * 0.24, 0.16, 'square', 0.04); tone(620, t + i * 0.24 + 0.12, 0.12, 'square', 0.04); } },
  };
})();

/* ============================================================
   FX: particle physics + warp speed-lines while zooming
   ============================================================ */
const fx = (() => {
  const c = $('#fx'), g = c.getContext('2d');
  const P = [], LINES = [];
  let W = 0, H = 0, raf = 0, speed = 0;
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function resize() {
    const dpr = 1;   // flying potatoes and speed-lines don't need retina pixels; saves a full-screen buffer
    W = innerWidth; H = innerHeight;
    c.width = Math.floor(W * dpr); c.height = Math.floor(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function newLine(init) {
    const maxR = Math.hypot(W, H) / 2;
    return { a: Math.random() * Math.PI * 2, r: init ? rand(0, maxR) : rand(maxR * 0.05, maxR * 0.3), len: rand(30, 140), w: rand(0.5, 1.6) };
  }
  function loop() {
    g.clearRect(0, 0, W, H);
    const s = Math.abs(speed);
    if (s > 0.15 && !reduced) {
      const cx = W / 2, cy = H / 2, maxR = Math.hypot(W, H) / 2, dir = Math.sign(speed);
      while (LINES.length < 90) LINES.push(newLine(true));
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < LINES.length; i++) {
        const L = LINES[i];
        L.r += dir * s * (6 + L.r * 0.04);
        if (L.r > maxR || L.r < 0) { LINES[i] = newLine(false); if (dir < 0) LINES[i].r = maxR; continue; }
        const a = clamp((s - 0.15) * 0.35, 0, 0.55) * clamp(L.r / (maxR * 0.25), 0, 1);
        const ln = L.len * clamp(s * 0.6, 0.3, 2.4);
        const ca = Math.cos(L.a), sa = Math.sin(L.a);
        g.strokeStyle = `rgba(255,232,180,${a.toFixed(3)})`; g.lineWidth = L.w;
        g.beginPath(); g.moveTo(cx + ca * L.r, cy + sa * L.r); g.lineTo(cx + ca * (L.r + ln), cy + sa * (L.r + ln)); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.bounce && p.y > H - p.size && p.vy > 0) { p.y = H - p.size; p.vy *= -0.52; p.vx *= 0.8; p.bounce--; }
      if (p.life > p.max || p.y > H + 90) { P.splice(i, 1); continue; }
      g.globalAlpha = clamp(1 - (p.life - p.max * 0.65) / (p.max * 0.35), 0, 1);
      if (p.type === 's') {
        const r = p.size * (1 - (p.life / p.max) * 0.55);
        g.fillStyle = p.col || '#fff0b8';
        g.beginPath();
        g.moveTo(p.x, p.y - r); g.quadraticCurveTo(p.x, p.y, p.x + r, p.y); g.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
        g.quadraticCurveTo(p.x, p.y, p.x - r, p.y); g.quadraticCurveTo(p.x, p.y, p.x, p.y - r); g.fill();
      } else {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        if (p.col) { g.fillStyle = p.col; g.font = `800 ${p.size}px "JetBrains Mono",monospace`; } else g.font = `${p.size}px ${EMOJI}`;
        g.fillText(p.ch, 0, 0); g.restore();
      }
    }
    g.globalAlpha = 1;
    raf = (P.length || Math.abs(speed) > 0.15) ? requestAnimationFrame(loop) : 0;
    if (!raf) g.clearRect(0, 0, W, H);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(loop); };
  function add(p) { if (reduced) return; if (P.length > 380) P.shift(); P.push(p); wake(); }
  return {
    init() { resize(); addEventListener('resize', resize); },
    speed(v) { speed = v; if (Math.abs(v) > 0.15) wake(); },
    burst(x, y, n = 10, chars = ['🥔', '✨'], col) {
      for (let i = 0; i < n; i++) add({ type: 'e', x, y, vx: rand(-6, 6), vy: rand(-12, -3), g: 0.38, rot: rand(0, 6.28), vr: rand(-0.2, 0.2), size: rand(18, 34), ch: pick(chars), col, life: 0, max: rand(70, 110), bounce: 2 });
      for (let i = 0; i < Math.ceil(n / 2); i++) add({ type: 's', x, y, vx: rand(-4, 4), vy: rand(-6, 1), g: 0.12, size: rand(5, 11), life: 0, max: rand(30, 55), rot: 0, vr: 0 });
    },
    drop(chars, n = 2) {
      for (let i = 0; i < n; i++) add({ type: 'e', x: rand(10, W - 10), y: -30, vx: rand(-1, 1), vy: rand(1, 5), g: 0.2, rot: rand(0, 6.28), vr: rand(-0.12, 0.12), size: rand(20, 38), ch: pick(chars), life: 0, max: rand(160, 260), bounce: 2 });
    },
    get size() { return [W, H]; },
  };
})();

function floatText(txt, x, y) {
  const e = el('div', 'float', txt);
  e.style.left = x + 'px'; e.style.top = y + 'px';
  document.body.append(e);
  e.addEventListener('animationend', () => e.remove());
}

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
const ACH = [
  ['quickdraw', '⚡', 'Quickdraw', 'Poked the exhibit. It noticed.'],
  ['monocle', '🧐', 'Through the monocle', 'Looked closer than is polite.'],
  ['borrow', '🦀', 'Borrow checked', 'Fixed E0382. The compiler said nothing, which is how it shows love.'],
  ['yolo', '🎲', 'YOLO', 'rm -rf / --no-preserve-root, on a duke’s machine.'],
  ['loop', '♾️', 'Infinite recursion', 'Went all the way round and came out at the portrait again.'],
  ['stack', '📚', 'Stack overflow', 'Three full laps. The Duke is getting dizzy.'],
  ['unsafe', '☢️', 'unsafe { }', 'Konami code. The borrow checker looked away.'],
  ['mouse', '🐭', 'Pest control', 'Poked the cellar mouse. The Duke pretends he never met it.'],
];
const got = new Set(store.get('ach', []));
// a phone has no arrow keys, so the Konami code can't be typed there; unsafe { } is PC-only on touch screens
const phone = matchMedia('(hover: none) and (pointer: coarse)').matches;
const PC_ONLY = new Set(['unsafe']);
const onThisDevice = a => !(phone && PC_ONLY.has(a[0]));
function renderTrophies() {
  const mine = ACH.filter(onThisDevice);
  $('#trophy-count').textContent = `${mine.filter(a => got.has(a[0])).length}/${mine.length}`;
  const ul = $('#trophy-list'); ul.textContent = '';
  for (const a of ACH) {
    const has = got.has(a[0]), pcOnly = !onThisDevice(a), li = el('li', has ? 'got' : pcOnly ? 'pc' : '');
    const tx = el('div');
    tx.append(el('b', '', has ? a[2] : '???'), el('span', 'd', has ? a[3] : pcOnly ? 'PC-only' : 'Locked. Keep poking around.'));
    li.append(el('span', 'ic', a[1]), tx); ul.append(li);
  }
}
function unlock(id) {
  if (got.has(id)) return;
  const a = ACH.find(x => x[0] === id); if (!a) return;
  got.add(id); store.set('ach', [...got]); renderTrophies(); sfx.fanfare();
  const t = el('div', 'toast'), box = el('div');
  box.append(el('div', 'k', 'Achievement unlocked'), el('div', 'n', a[2]), el('div', 'd', a[3]));
  t.append(el('div', 'ic', a[1]), box); $('#toasts').append(t);
  setTimeout(() => t.remove(), 5300);
  const [W, H] = fx.size; fx.burst(W - 140, H - 120, 12, ['✨', a[1]]);
}
function initTrophies() {
  renderTrophies();
  const btn = $('#trophy-btn'), panel = $('#trophy-panel');
  btn.addEventListener('click', e => { e.stopPropagation(); const open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target)) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
}

/* ============================================================
   ENGINE — the infinite zoom
   ============================================================ */
const Engine = (() => {
  const stage = $('#stage');
  const ID = { k: 1, x: 0, y: 0 };
  let L = [], N = 0;   // collected in init(): some portals are built by the scene modules first
  const collect = () => $$('.layer').map((root, i) => {
    const portalEl = root.querySelector('[data-portal]');
    return { i, root, scene: root.querySelector('.scene'), over: root.querySelector('.over'), portalEl, shape: portalEl.dataset.portal, P: null, A: ID, tr: '', zs: null };
  });
  const NAMES = ['portrait', 'reflection', 'kitty', 'pi', 'cellar'];
  const named = h => { const i = NAMES.indexOf(h === 'konsole' ? 'kitty' : h); return i; };
  const ev = { frame: [], enter: [], leave: [], layout: [] };
  let W = 0, H = 0, HYP = 0, C = { x: 0, y: 0 };
  let z = 0, zt = 0, raf = 0, last = 0, active = -1, locked = false, dragging = false, speedMul = 1, lastDir = 1, snapTimer = 0;
  const emit = (k, a) => ev[k].forEach(f => f(a));

  function vars() {
    W = innerWidth; H = innerHeight; HYP = Math.hypot(W, H); C = { x: W / 2, y: H / 2 };
    const r = document.documentElement.style;
    r.setProperty('--W', W + 'px'); r.setProperty('--H', H + 'px'); r.setProperty('--HYP', HYP + 'px');
  }
  // Portal geometry in each layer's own (untransformed) pixels.
  function measure() {
    for (const l of L) {
      const r = l.portalEl.getBoundingClientRect(), A = l.A;
      const cx = (r.left + r.width / 2 - A.x) / A.k, cy = (r.top + r.height / 2 - A.y) / A.k;
      const w = r.width / A.k, h = r.height / A.k;
      let d, f;
      if (l.shape === 'circle') { d = Math.max(w, h); f = d / HYP; } else { d = w; f = w / W; }
      if (!(f > 0.0005 && f < 0.95)) f = 0.1;
      l.P = { cx, cy, d, f, ln: Math.log(1 / f) };
      for (const e of [l.scene, l.over]) if (e) {
        e.style.setProperty('--pcx', cx + 'px'); e.style.setProperty('--pcy', cy + 'px'); e.style.setProperty('--pd', d + 'px');
      }
    }
  }
  // will-change pins a layer's raster scale at the moment it is set. Zooming *out*, a world arrives
  // at 100×+ and shrinks, so a pinned 100× raster would have to cover more and more of it. Re-pin
  // whenever a layer has shrunk 2× since it was pinned: one frame without the hint lets the
  // browser re-raster at the current scale.
  let motion = false;
  function hint(l, k, onStage) {
    const els = l.over ? [l.scene, l.over] : [l.scene];
    if (!motion || !onStage) {
      if (l.wcOn) { els.forEach(e => { e.style.willChange = ''; }); l.wcOn = false; }
      return;
    }
    if (!l.wcOn) { els.forEach(e => { e.style.willChange = 'transform'; }); l.wcOn = true; l.wc = k; }
    else if (k < l.wc / 2) { els.forEach(e => { e.style.willChange = ''; }); l.wcOn = false; }
  }
  function place(l, A, depth) {
    const tr = A === ID ? 'none' : `translate3d(${A.x.toFixed(3)}px,${A.y.toFixed(3)}px,0) scale(${A.k.toPrecision(7)})`;
    if (l.tr !== tr) { l.scene.style.transform = tr; if (l.over) l.over.style.transform = tr; l.tr = tr; }
    l.A = A;
    if (l.zs !== depth) {
      l.scene.style.zIndex = depth < 0 ? '' : String(10 + depth * 20);
      if (l.over) l.over.style.zIndex = depth < 0 ? '' : String(25 + depth * 20);
      l.zs = depth;
    }
  }
  function render() {
    const base = Math.floor(z), t = z - base;
    const P = L[mod(base, N)].P, f = P.f, s = Math.exp(P.ln * t);
    // zoom about the fixed point that maps the portal onto the whole screen at t = 1
    const qx = (C.x * f - P.cx) / (f - 1), qy = (C.y * f - P.cy) / (f - 1);
    let A = { k: s, x: qx * (1 - s), y: qy * (1 - s) };
    const seen = new Set();
    for (let d = 0; d < 3; d++) {
      const l = L[mod(base + d, N)];
      if (seen.has(l)) break;
      seen.add(l); place(l, A, d); hint(l, A.k, true);
      l.root.classList.add('vis');
      if (l.over) l.over.style.opacity = d === 0 ? (1 - smooth(0.4, 0.85, t)).toFixed(3) : '1';
      const p = l.P;
      A = { k: A.k * p.f, x: A.x + A.k * (p.cx - C.x * p.f), y: A.y + A.k * (p.cy - C.y * p.f) };
      if (A.k * Math.max(W, H) < 5) break;
    }
    for (const l of L) if (!seen.has(l)) { l.root.classList.remove('vis'); place(l, ID, -1); hint(l, 1, false); }
  }
  function updateActive() {
    const r = Math.round(z), a = Math.abs(z - r) < 0.002 ? mod(r, N) : -1;
    if (a === active) return;
    if (active >= 0) { L[active].root.classList.remove('active'); emit('leave', active); }
    active = a;
    for (const l of L) l.scene.inert = l.i !== a;
    if (a >= 0) {
      L[a].root.classList.add('active'); emit('enter', a);
      const h = a === 0 ? location.pathname : '#' + NAMES[a];
      try { history.replaceState(null, '', h); } catch { /* file:// etc */ }
    }
  }
  const lnAt = (zz, dir) => L[mod(Math.floor(zz - (dir < 0 ? 1e-6 : 0)), N)].P.ln;
  function tick(now) {
    raf = 0;
    const dt = clamp((now - last) / 1000, 0.001, 0.05); last = now;
    const prev = z, diff = zt - z;
    if (reduced || Math.abs(diff) < 0.0006) z = zt;
    else {
      let step = diff * (1 - Math.exp(-dt * 5 * speedMul));
      const cap = (3.4 * speedMul / lnAt(z, diff)) * dt;      // at most ~e^3.4 ≈ 30× per second
      z += clamp(step, -cap, cap);
    }
    const v = (z - prev) / dt, vLog = v * lnAt(z, v);
    motion = z !== zt || dragging;
    render(); updateActive();
    emit('frame', { z, v, vLog });
    const moving = z !== zt || dragging;
    document.documentElement.classList.toggle('zooming', moving);
    if (moving) raf = requestAnimationFrame(tick);
    else { speedMul = 1; emit('frame', { z, v: 0, vLog: 0 }); }
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function snap() {
    const b = Math.floor(zt), fr = zt - b, th = clamp(0.3 / lnAt(zt, 1), 0.03, 0.3);
    zt = lastDir > 0 ? (fr > th ? b + 1 : b) : (fr < 1 - th ? b : b + 1);
    kick();
  }
  function nudge(dz) {
    if (locked || !dz) return;
    lastDir = Math.sign(dz);
    zt = clamp(zt + dz, z - 1.6, z + 1.6);
    clearTimeout(snapTimer); snapTimer = setTimeout(snap, 170);
    kick();
  }
  function go(d) { if (locked) return; clearTimeout(snapTimer); lastDir = Math.sign(d); zt = Math.round(zt) + d; kick(); }
  function goTo(i) {
    if (locked) return;
    const cur = mod(Math.round(zt), N); let d = mod(i - cur, N); if (d > N / 2) d -= N;
    if (d) go(d);
  }

  function canScroll(e, dy) { return dy > 0 ? e.scrollTop + e.clientHeight < e.scrollHeight - 1 : e.scrollTop > 0; }
  function inputs() {
    // focusing something inside a layer must never scroll the stage under our transforms
    const pin = () => { if (stage.scrollTop || stage.scrollLeft) { stage.scrollTop = 0; stage.scrollLeft = 0; } };
    stage.addEventListener('scroll', pin);
    addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); });
    addEventListener('wheel', e => {
      if (locked) return;
      const sc = e.target.closest && e.target.closest('[data-scroll]');
      if (sc && !e.ctrlKey && canScroll(sc, e.deltaY)) return;
      if (e.target.closest && e.target.closest('#trophy-panel')) return;
      e.preventDefault();
      let d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? H : 1);
      if (e.ctrlKey) d *= 2.5;   // trackpad pinch arrives as ctrl+wheel
      d = clamp(d, -260, 260);
      nudge(d * 0.0042 / lnAt(z, d));
    }, { passive: false });

    addEventListener('keydown', e => {
      if (locked || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === '+' || k === '=') { e.preventDefault(); go(1); }
      else if (k === 'ArrowUp' || k === 'PageUp' || k === '-' || k === '_') { e.preventDefault(); go(-1); }
      else if (k === 'Home') { e.preventDefault(); goTo(0); }
    });

    // touch: one finger drags the zoom, two fingers pinch it
    const pts = new Map();
    let pinch0 = 0, pinchZ = 0, dragZ = 0, moved = false, samples = [], suppress = false;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    stage.addEventListener('pointerdown', e => {
      if (locked || e.pointerType === 'mouse') return;
      if (e.target.closest('[data-drag],[data-scroll],input,textarea')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (pts.size === 1) { dragZ = zt; moved = false; samples = []; }
      if (pts.size === 2) { pinch0 = dist(); pinchZ = zt; moved = true; dragging = true; }
    });
    addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size >= 2) { zt = pinchZ + Math.log(dist() / pinch0) / lnAt(z, 1); clearTimeout(snapTimer); kick(); return; }
      const dy = p.y - p.y0;
      if (!moved && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(p.x - p.x0)) { moved = true; dragging = true; p.y0 = p.y; dragZ = zt; }
      if (moved) {
        zt = dragZ + (-(p.y - p.y0) * 0.011) / lnAt(z, -(p.y - p.y0));
        samples.push([performance.now(), zt]); if (samples.length > 6) samples.shift();
        clearTimeout(snapTimer); kick();
      }
    }, { passive: true });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0 && moved) {
        dragging = false; suppress = true; setTimeout(() => { suppress = false; }, 60);
        let vel = 0;
        if (samples.length > 1) { const [t0, z0] = samples[0], [t1, z1] = samples[samples.length - 1]; vel = (z1 - z0) / Math.max(1, t1 - t0) * 1000; }
        lastDir = Math.abs(vel) > 0.4 ? Math.sign(vel) : (zt >= Math.round(z) ? 1 : -1);
        snap();
      }
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    stage.addEventListener('click', e => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);

    // a portal is a window into the next world: click it to fall in
    stage.addEventListener('click', e => {
      if (locked || active < 0 || e.defaultPrevented || e.target.closest('a,button,input,textarea,select,[data-drag],[data-scroll]')) return;
      const r = L[active].portalEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = L[active].shape === 'circle' ? Math.hypot(e.clientX - cx, e.clientY - cy) < Math.max(r.width, r.height) / 2 : (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
      if (hit) go(1);
    });

    addEventListener('hashchange', () => { const i = named(location.hash.slice(1)); if (i >= 0) goTo(i); });
    $('#go-down').addEventListener('click', () => go(1));
    $('#go-up').addEventListener('click', () => go(-1));
    $('#brand').addEventListener('click', () => goTo(0));
    $$('#gauge [data-go]').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.go)));
  }

  // Warm-up: fly through every world once, off-screen (behind the curtain), so the GPU compiles
  // its shaders and rasterizes each world before the visitor ever asks for it.
  let warming = false, warmAbort = false;
  async function warm() {
    if (reduced || warming) return;
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    const z0 = z, html = document.documentElement;
    warming = true; warmAbort = false;
    html.classList.add('zooming'); motion = true;
    fly: for (let b = 0; b < N; b++) for (const t of [0, 0.3, 0.55, 0.75, 0.9, 0.97]) {
      if (warmAbort) break fly;
      z = zt = b + t; render(); await frame();
    }
    html.classList.remove('zooming'); motion = false;
    for (let b = 0; b < N && !warmAbort; b++) { z = zt = b; render(); await frame(); await frame(); await frame(); }
    if (!warmAbort) { z = zt = z0; render(); }
    warming = false;
  }
  function stopWarm(back) {
    if (!warming) return;
    warmAbort = true; motion = false;
    document.documentElement.classList.remove('zooming');
    z = zt = back; render();
  }

  function relayout() {
    vars();
    for (const l of L) place(l, ID, -1);   // measure from a neutral pose
    emit('layout', { W, H, narrow: isNarrow() });
    measure(); render(); updateActive();
    emit('frame', { z, v: 0, vLog: 0 });
  }
  return {
    NAMES, named,
    get L() { return L; },
    get N() { return N; },
    on(k, f) { ev[k].push(f); },
    init() {
      L = collect(); N = L.length;
      vars(); inputs();
      let tm = 0;
      addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(relayout, 120); });
      relayout();
    },
    relayout, measure: () => { measure(); render(); },
    go, goTo,
    jump(v) { z = zt = v; render(); updateActive(); emit('frame', { z, v: 0, vLog: 0 }); },
    to(v, mul = 1) { zt = v; speedMul = mul; lastDir = Math.sign(v - z) || 1; kick(); },
    lock(v) { locked = v; },
    warm, stopWarm,
    get z() { return z; },
    get active() { return active; },
    portal(i) { return L[i].P; },
  };
})();

/* ============================================================
   HUD — depth gauge, magnification, hints
   ============================================================ */
const HUD = (() => {
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const NAMES = ['The Portrait', 'The Reflection', 'kitty', 'The π Sea', 'The Root Cellar'];
  const HINTS = ['zoom into the monocle', 'zoom into kitty', 'zoom into the potato it found', 'the monocle again, in digits', 'walk into the painting'];
  const where = $('#where'), hint = $('#hint-text'), mag = $('#mag'), btns = $$('#gauge [data-go]');
  let shown = -1, maxLoop = 0, minLoop = 0;
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = n => String(n).split('').map(c => (c === '-' ? '⁻' : SUP[+c])).join('');
  function fmt(lg) {
    if (Math.abs(lg) < 0.0025) return '×1';
    const neg = lg < 0, a = Math.abs(lg);
    let s;
    if (a < 3) s = Math.pow(10, a).toFixed(a < 1 ? 2 : 1);
    else if (a < 6) s = Math.round(Math.pow(10, a)).toLocaleString('en-US');
    else { const e = Math.floor(a); s = Math.pow(10, a - e).toFixed(2) + '×10' + sup(e); }
    return neg ? '×1/' + s : '×' + s;
  }
  function logMag(z) {
    const N = Engine.N, l10 = Engine.L.map(l => l.P.ln / Math.LN10), S = l10.reduce((a, b) => a + b, 0);
    const b = Math.floor(z), t = z - b, r = mod(b, N);
    let lg = Math.floor(b / N) * S;
    for (let j = 0; j < r; j++) lg += l10[j];
    return lg + t * l10[r];
  }
  return {
    init() {
      Engine.on('frame', ({ z, vLog }) => {
        const n = mod(Math.round(z), Engine.N);
        if (n !== shown) {
          shown = n;
          where.textContent = `${ROMAN[n]} · ${NAMES[n]}`;
          hint.textContent = HINTS[n];
          btns.forEach((b, i) => b.classList.toggle('on', i === n));
        }
        mag.textContent = fmt(logMag(z));
        fx.speed(vLog); sfx.whoosh(Math.abs(vLog));
        const loop = Math.trunc(z / Engine.N);
        if (loop > maxLoop) { maxLoop = loop; unlock('loop'); if (loop >= 3) unlock('stack'); }
        if (loop < minLoop) { minLoop = loop; unlock('loop'); if (loop <= -3) unlock('stack'); }
      });
      const snd = $('#snd');
      const paint = () => { snd.textContent = sfx.on ? '🔊' : '🔇'; snd.setAttribute('aria-pressed', String(sfx.on)); snd.title = sfx.on ? 'Sound on' : 'Sound off'; };
      snd.addEventListener('click', () => { sfx.setOn(!sfx.on); paint(); if (sfx.on) { sfx.startMusic(); sfx.ding(); } });
      paint();
      this.paintSound = paint;
    },
  };
})();

/* ============================================================
   ASCII POTATO — filled with the real digits of π (hi, pi-casso)
   ============================================================ */
function potatoGrid(w = 42, h = 21) {
  const grid = []; let k = 0;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1;
      const r = (u * u) / 0.94 + (v * v) / 0.88;
      const wob = 0.07 * Math.sin(u * 4.1 + 1.2) + 0.05 * Math.cos(v * 5.3 + 0.4) + 0.04 * Math.sin((u + v) * 6.2);
      row.push(r + wob < 1 ? '#' : ' ');
    }
    grid.push(row);
  }
  for (const row of grid) for (let x = 0; x < w; x++) if (row[x] === '#') row[x] = { d: PI[k], i: k++ };
  const put = (y, str, cx) => {
    const s = Math.round(cx - str.length / 2);
    for (let i = 0; i < str.length; i++) if (str[i] !== ' ' && grid[y] && s + i >= 0 && s + i < w) grid[y][s + i] = { f: str[i] };
  };
  put(Math.round(h * 0.40), '-=-     (-=-)', w / 2);
  put(Math.round(h * 0.60), '~=-._.-=~', w / 2);
  return grid;
}
const HAT = ['.--------------.', '|              |', '|              |', '|==============|', '___|______________|___', '(______________________)']
  .map(s => ' '.repeat(Math.floor((42 - s.length) / 2)) + s);
const potatoText = () => HAT.join('\n') + '\n' + potatoGrid().map(r => r.map(c => (typeof c === 'object' ? (c.f || c.d) : c)).join('')).join('\n');

/* ============================================================
   I. THE PORTRAIT
   ============================================================ */
const Gallery = (() => {
  const PHRASES = [
    'I am Starch, btw.',
    'Building strange things in Rust.',
    'Searching π for pictures. Mostly finding digits.',
    'Sending patches to someone else’s Photoshop.',
    'Simulating a fantasy world, one tick at a time.',
  ];
  const QUIPS = [
    'I say!', 'Careful, that’s the monocle side.', 'We don’t touch the exhibits.', 'My valet will hear about this.',
    'Do I poke you?', 'You’re smudging the varnish.', 'That tickles. Stop it.', 'Ahem.', 'Mind the mustache, it’s waxed.',
  ];
  const MILESTONES = { 10: 'Still here?', 25: 'Security has been called. Security is also a potato.', 50: 'I’ve written to your mother.', 69: 'Mature.', 100: 'Fine. You win nothing.' };
  let pokes = store.get('pokes', 0), bubbleT = 0;
  function bubble(t, ms = 1800) {
    const b = $('#bubble'); b.textContent = t; b.classList.add('show');
    clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('show'), ms);
  }
  async function typewriter() {
    const e = $('#typed');
    if (reduced) return;
    for (let i = 0; ; i++) {
      while (Engine.active !== 0 || document.hidden) await sleep(400);
      const s = PHRASES[i % PHRASES.length];
      for (let k = 1; k <= s.length; k++) { e.textContent = s.slice(0, k); await sleep(rand(34, 72)); }
      await sleep(2200);
      for (let k = s.length; k >= 0; k--) { e.textContent = s.slice(0, k); await sleep(18); }
      await sleep(260);
    }
  }
  return {
    build() {
      // the portal sits exactly on the monocle's glass
      const p = $('#portal-0');
      const cx = 50 + (MONOCLE.x * 100 - 50) * IMG_SCALE, cy = 50 + (MONOCLE.y * 100 - 50) * IMG_SCALE, d = MONOCLE.d * 100 * IMG_SCALE;
      Object.assign(p.style, { left: cx - d / 2 + '%', top: cy - d / 2 + '%', width: d + '%', height: d + '%' });
      $('#ava-wrap').style.setProperty('--img-s', IMG_SCALE);
      // laurel wreath on the frame
      const lg = $('#laurel'), NS = 'http://www.w3.org/2000/svg';
      for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
        const a = (90 + side * (22 + i * 8.5)) * Math.PI / 180, r = 94;
        const x = 100 + Math.cos(a) * r, y = 100 + Math.sin(a) * r;
        const leaf = document.createElementNS(NS, 'ellipse');
        leaf.setAttribute('cx', x.toFixed(2)); leaf.setAttribute('cy', y.toFixed(2)); leaf.setAttribute('rx', '5'); leaf.setAttribute('ry', '1.9');
        leaf.setAttribute('transform', `rotate(${(a * 180 / Math.PI + 90 + side * 38).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`);
        lg.append(leaf);
      }
      // dust in the spotlight
      const m = $('#motes');
      for (let i = 0; i < (reduced ? 0 : 22); i++) {
        const d = el('i');
        Object.assign(d.style, { left: rand(35, 95) + '%', top: rand(15, 95) + '%', animationDuration: rand(7, 14) + 's', animationDelay: -rand(0, 14) + 's' });
        d.style.setProperty('--dx', rand(-40, 40) + 'px');
        m.append(d);
      }
      const img = $('#ava');
      img.addEventListener('error', () => { if (!img.src.endsWith(AVATAR_FALLBACK)) { img.removeAttribute('srcset'); img.src = AVATAR_FALLBACK; } });
      $('#ava-btn').addEventListener('click', e => {
        pokes++; store.set('pokes', pokes);
        const x = e.detail ? e.clientX : innerWidth / 2, y = e.detail ? e.clientY : innerHeight / 2;
        fx.burst(x, y, 8, ['🥔', '🥔', '✨', '⚜️']); floatText('+1 starch', x, y - 10); sfx.pop();
        const w = $('#ava-wrap'); w.classList.remove('squish'); void w.offsetWidth; w.classList.add('squish');
        bubble(MILESTONES[pokes] || pick(QUIPS));
        unlock('quickdraw');
      });
      typewriter();
    },
  };
})();

/* ============================================================
   II. THE REFLECTION: his screen. PhotoCraft open, kitty next to it.
   ============================================================ */
const Desk = (() => {
  const W_ = id => $('#' + id);
  const GH_REPO = 'storytold/photocraft', GH_USER = 'Sir-Starch';
  // What GitHub said on 12 Oct 2026. Shown until (or unless) the live numbers arrive.
  const BAKED = {
    live: false, stars: 48474, merged: 24, open: 7, commits: 24, rank: 13, add: 3766, del: 415,
    prs: [[3763, 'automation: refuse edit.installedProfiles, it scans the OS profile folders'],
          [3285, 'fix(io): smooth PSD gradients no longer overshoot their stops'],
          [3211, 'Tools: Convert Point tool in the Pen flyout']],
  };
  let gh = BAKED;
  const nf = n => (n == null ? '–' : n.toLocaleString('en-US'));
  const k = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
  const ico = id => {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), use = document.createElementNS(NS, 'use');
    svg.setAttribute('class', 'i'); use.setAttribute('href', '#' + id); svg.append(use); return svg;
  };
  // every merged PR is a layer in the Layers panel; the repo itself is the locked Background
  function layer(href, icon, name, sub, locked) {
    const a = el('a', 'ly'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.title = name;
    const th = el('span', 'th'), nm = el('span', 'nm');
    th.append(ico(icon)); nm.append(el('b', '', name), el('small', '', sub));
    a.append(el('i', 'eye'), th, nm); if (locked) a.append(ico('i-lock'));
    const li = el('li', locked ? 'bgl' : ''); li.append(a); return li;
  }
  function render() {
    $('#pc-merged').textContent = nf(gh.merged);
    $('#pc-open').textContent = nf(gh.open);
    $('#pc-commits').textContent = nf(gh.commits);
    $('#pc-rank').textContent = gh.rank ? '#' + gh.rank : '–';
    $('#pc-lines').textContent = gh.add != null ? `+${nf(gh.add)} / −${nf(gh.del)}` : `+${nf(BAKED.add)} / −${nf(BAKED.del)}`;
    const ul = $('#pc-prs'); ul.textContent = '';
    for (const [n, t] of gh.prs.slice(0, 3)) ul.append(layer(`https://github.com/${GH_REPO}/pull/${n}`, 'i-merge', t, `#${n} · merged`));
    ul.firstChild.classList.add('on');
    ul.append(layer(`https://github.com/${GH_REPO}`, 'i-img', 'Background', `${GH_REPO} · ${k(gh.stars)} ★`, true));
    $('#pc-count').textContent = ul.children.length + ' layers';
    if (gh.live) {
      const min = Math.max(1, Math.round((Date.now() - gh.ts) / 60000));
      $('#pc-src').textContent = `live from GitHub, ${min < 60 ? min + ' min' : Math.round(min / 60) + ' h'} ago`;
    }
  }
  async function fetchStats() {
    const cached = store.get('gh', null);
    if (cached && Date.now() - cached.ts < 6 * 3600e3) return cached;
    const api = 'https://api.github.com', hdr = { headers: { Accept: 'application/vnd.github+json' } };
    const j = u => fetch(api + u, hdr).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
    const q = s => j(`/search/issues?q=${encodeURIComponent(`repo:${GH_REPO} author:${GH_USER} type:pr ${s}`)}&sort=created&order=desc&per_page=3`);
    const [merged, open, repo, contrib] = await Promise.all([q('is:merged'), q('is:open'), j(`/repos/${GH_REPO}`), j(`/repos/${GH_REPO}/contributors?per_page=100`)]);
    const i = contrib.findIndex(c => c.login.toLowerCase() === GH_USER.toLowerCase());
    const d = {
      live: true, ts: Date.now(), stars: repo.stargazers_count, merged: merged.total_count, open: open.total_count,
      commits: i >= 0 ? contrib[i].contributions : null, rank: i >= 0 ? i + 1 : null,
      prs: merged.items.map(it => [it.number, it.title]), add: null, del: null,
    };
    // Line counts come from an endpoint GitHub computes lazily (202 means "ask again later").
    try {
      const r = await fetch(api + `/repos/${GH_REPO}/stats/contributors`, hdr);
      if (r.status === 200) {
        const me = (await r.json()).find(c => c.author && c.author.login.toLowerCase() === GH_USER.toLowerCase());
        if (me) { d.add = me.weeks.reduce((s, w) => s + w.a, 0); d.del = me.weeks.reduce((s, w) => s + w.d, 0); }
      }
    } catch { /* keep the baked line counts */ }
    if (d.add == null) { const old = store.get('gh', null); if (old && old.add != null) { d.add = old.add; d.del = old.del; } }
    store.set('gh', d);
    return d;
  }
  const put = (id, x, y, w, h) => {
    const e = W_(id); e.style.left = Math.round(x) + 'px'; e.style.top = Math.round(y) + 'px';
    e.style.width = w != null ? Math.round(w) + 'px' : '';
    e.style.height = h != null ? Math.round(h) + 'px' : '';
  };
  function layout({ W, H, narrow }) {
    const scene = $('#L1 .scene'), bar = 31, panel = 44;
    if (!narrow) {
      const fk = 0.34; scene.style.setProperty('--fk', fk);
      const kw = W * fk, kh = H * fk + bar, gap = 28, left = 30, avail = W - left - 110;
      const pw = Math.min(avail - gap - kw, 1120), ph = Math.min(H - panel - 120, 740);
      const x0 = left + Math.max(0, (avail - pw - gap - kw) / 2);
      put('w-pc', x0, Math.max(68, (H - panel - ph) / 2), pw, ph);
      put('w-kitty', x0 + pw + gap, (H - panel) / 2 - kh / 2 + 6, kw);
    } else {
      const fk = 0.34; scene.style.setProperty('--fk', fk);
      const kw = W * fk, ph = Math.min(H * 0.44, 380);
      put('w-pc', 10, 62, W - 52, ph);
      put('w-kitty', (W - 40 - kw) / 2, 62 + ph + 14, kw);
    }
  }
  function drag() {
    let cur = null, ox = 0, oy = 0, zTop = 40;
    // every window stacks by focus, kitty included; the desk panel sits above all of them (CSS)
    const raise = win => { win.style.zIndex = ++zTop; };
    $$('#L1 .win').forEach(win => { raise(win); win.addEventListener('pointerdown', () => raise(win)); });
    $$('#L1 [data-drag]').forEach(bar => {
      bar.addEventListener('pointerdown', e => {
        const win = bar.closest('.win');
        cur = win; ox = e.clientX - win.offsetLeft; oy = e.clientY - win.offsetTop;
        bar.setPointerCapture(e.pointerId); e.preventDefault();
      });
      bar.addEventListener('pointermove', e => {
        if (!cur) return;
        cur.style.left = clamp(e.clientX - ox, -cur.offsetWidth + 60, innerWidth - 60) + 'px';
        cur.style.top = clamp(e.clientY - oy, 0, innerHeight - 80) + 'px';
        if (cur.classList.contains('w-kitty')) Engine.measure();
      });
      const end = () => { if (cur && cur.classList.contains('w-kitty')) Engine.measure(); cur = null; };
      bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
    });
  }
  function clock() {
    const d = new Date();
    $('#clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  return {
    build() {
      render(); drag(); clock(); setInterval(clock, 15000);
      Engine.on('layout', layout);
    },
    // called a little after load, so it never competes with the first paint
    loadStats() {
      fetchStats().then(d => { gh = { ...BAKED, ...d, prs: d.prs && d.prs.length ? d.prs : BAKED.prs }; render(); }).catch(() => { /* offline or rate-limited: baked numbers stay */ });
    },
    get gh() { return gh; },
  };
})();

/* ============================================================
   III. KITTY: zsh on the left, pi-casso hunting on the right
   ============================================================ */
const Term = (() => {
  const out = $('#term-out'), inp = $('#term-in'), hunt = $('#hunt');
  const hist = []; let hi = 0, busy = false;
  const PROMPT = 'sir@starch ~ % ';
  const scroll = () => { out.scrollTop = out.scrollHeight; };
  const ln = (parts, cls = '') => {
    const d = el('div', 'ln' + (cls ? ' ' + cls : ''));
    if (Array.isArray(parts)) for (const p of parts) d.append(typeof p === 'string' ? p : el('span', p[1] || '', p[0]));
    else d.textContent = parts;
    out.append(d); scroll(); return d;
  };
  const artLn = t => { out.append(el('div', 'ln art', t)); scroll(); };
  const echo = cmd => ln([[PROMPT, 'p'], [cmd, 'c']]);

  /* ---- fastfetch (the real machine, minus the hostname) ---- */
  const INSTALLED = new Date('2026-01-08T21:55:00+01:00');   // from the AGE line of my actual fastfetch
  const opened = Date.now();
  // `fastfetch --logo endeavouros`, verbatim
  const EOS = [
    '                     ./o.',
    '                   ./sssso-',
    '                 `:osssssss+-',
    '               `:+sssssssssso/.',
    '             `-/ossssssssssssso/.',
    '           `-/+sssssssssssssssso+:`',
    '         `-:/+sssssssssssssssssso+/.',
    '       `.://osssssssssssssssssssso++-',
    '      .://+ssssssssssssssssssssssso++:',
    '    .:///ossssssssssssssssssssssssso++:',
    '  `:////ssssssssssssssssssssssssssso+++.',
    '`-////+ssssssssssssssssssssssssssso++++-',
    ' `..-+oosssssssssssssssssssssssso+++++/`',
    '   ./++++++++++++++++++++++++++++++/:.',
    '  `:::::::::::::::::::::::::------``',
  ];
  const dur = ms => { const m = Math.floor(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  function fastfetch() {
    const age = Math.floor((Date.now() - INSTALLED) / 864e5);
    const rows = [
      ['OS', 'EndeavourOS x86_64'], ['Kernel', 'Linux 7.2.9-arch1-1'], ['Age', `${age} days, never reinstalled`],
      ['Uptime', `${dur(Date.now() - opened)} (this tab)`], ['DE', 'KDE Plasma 6.7 (Wayland)'], ['Terminal', 'kitty 0.49.2'],
      ['Shell', 'zsh 5.9.2'], ['Rust', 'rustc 1.99.0'], ['CPU', 'AMD Ryzen 9 7950X3D'], ['GPU', 'NVIDIA GeForce RTX 4080 SUPER'],
      ['Memory', '64 GiB DDR5'], ['Monocle', 'polished'],
    ];
    const box = el('div', 'ff'), logo = el('pre', 'logo');
    logo.setAttribute('aria-hidden', 'true');
    // the logo is fastfetch's own EndeavourOS art, split into three tones: rim, body, rim
    for (const line of EOS) {
      const m = /^(\s*)([^os]*)([os]+)(.*)$/.exec(line);
      if (!m) { logo.append(el('span', 'l1', line), '\n'); continue; }
      logo.append(m[1], el('span', 'l1', m[2]), el('span', 'l2', m[3]), el('span', 'l3', m[4]), '\n');
    }
    const pre = el('pre');
    pre.append(el('span', 't', 'sir'), el('span', 'm', '@'), el('span', 't', 'starch'), '\n', el('span', 'm', '─'.repeat(14)), '\n');
    for (const [key, v] of rows) pre.append(el('span', 'k', key.padEnd(10)), el('span', 'v', v), '\n');
    const sw = el('span', 'sw');
    for (const c of ['#2a0910', '#6b1226', '#a87a24', '#e8c36a', '#fff0b8', '#5be8a2', '#6cb6ff', '#efe4cf']) { const s = el('span', '', '●'); s.style.color = c; sw.append(s, ' '); }
    pre.append(sw);
    box.append(logo, pre); out.append(box); scroll();
  }

  /* ---- pi-casso hunt: a staged search ----
     The real pi-casso looks for a picture in the digits of π. Here the potato is "found" very far out,
     far beyond the digits this page carries, so the grid is rigged: real π digits, nudged into the right
     half of the alphabet (5-9 = ink, 0-4 = paper) wherever the potato needs them. The score is the part that's honest. */
  const MASK = ['....####....', '....####....', '..########..', '...######...', '..########..', '.##########.',
    '.##.####.##.', '.##########.', '.###....###.', '.##########.', '..########..', '....####....'].join('').split('').map(c => c === '#');
  const CELLS = MASK.length;
  const TOTAL = 31415926535, STEPS = 14, DUR = 13000, START_MISS = 46, END_MISS = 4, FINAL_OFFSET = 27182818284;
  const nf0 = n => Math.round(n).toLocaleString('en-US');
  // which cells are wrong, longest-lived first: a fixed shuffle, so every run converges the same way
  const RANK = (() => { const a = [...Array(CELLS).keys()]; let h = 2166136261; for (let i = CELLS - 1; i > 0; i--) { h = Math.imul(h ^ i, 16777619) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; })();
  const missAt = k => END_MISS + Math.round((START_MISS - END_MISS) * Math.pow(1 - k / STEPS, 1.6));
  const offAt = k => (k >= STEPS ? FINAL_OFFSET : (Math.imul(k + 7, 2654435761) >>> 0) % TOTAL * 7 % TOTAL);
  const tAt = k => 0.045 + 0.915 * (k / STEPS) * (k / STEPS);   // improvements get rarer as the hunt goes on
  let tgtEls = [], bestEls = [], bestHead = null, statsEl = null, huntT = 0, huntDone = false, t0 = 0, step = 0;
  function buildHunt() {
    const mk = (col, title, sub, node) => {
      const h = el('h5', 'c' + col + ' r1'), em = el('em', '', sub);
      h.append(title + ' ', em); node.classList.add('c' + col, 'r2'); hunt.append(h, node); return em;
    };
    const tg = el('div', 'grid tgt'), bg = el('div', 'grid best'), res = el('i', 'res');
    mk(1, 'target', '12×12', tg); bestHead = mk(2, 'best match', '', bg); mk(3, 'result', 'potato.png', res);
    // the way on is through the finished picture: a round window onto what it found
    res.id = 'portal-2'; res.dataset.portal = 'circle';
    tgtEls = MASK.map(m => { const i = el('i', m ? 'ink' : '', m ? '█' : '·'); tg.append(i); return i; });
    bestEls = MASK.map(() => { const i = el('i', '', '·'); bg.append(i); return i; });
    statsEl = el('div', 'hstats'); hunt.append(statsEl);
    paintStats(0, 0);
  }
  // k improvements in: the potato at a fake offset, with the first `missAt(k)` cells of RANK still wrong
  function paintBest(k) {
    const off = offAt(k), wrong = new Set(RANK.slice(0, missAt(k))), base = off % (PI.length - CELLS);
    for (let i = 0; i < CELLS; i++) {
      const g = +PI[base + i], want = MASK[i] !== wrong.has(i);   // wrong cells get the other class
      const d = want ? (g < 5 ? g + 5 : g) : (g >= 5 ? g - 5 : g);
      bestEls[i].textContent = d;
      bestEls[i].className = (wrong.has(i) ? 'miss' : 'hit') + (MASK[i] ? ' ink' : '');
    }
    bestHead.textContent = 'offset ' + nf0(off);
  }
  function paintStats(p, k) {
    const cells = k ? CELLS - missAt(k) : 0;
    const bar = '█'.repeat(Math.round(p * 28)).padEnd(28, '░');
    statsEl.textContent = '';
    statsEl.append('score    ', el('b', '', k ? (cells / CELLS * 100).toFixed(1) + '%' : '–'), k ? ` (${cells}/${CELLS} cells)` : '', '\n',
      'scanned  ', el('b', '', nf0(TOTAL * p)), ` / ${nf0(TOTAL)} windows\n`, `[${bar}] ${Math.floor(p * 100)}%\n`);
    if (huntDone) statsEl.append(el('span', 'q', `done in ${DUR / 1000} s on one potato-core. ${cells} of ${CELLS} cells; the other ${CELLS - cells} are artistic license.`));
    else if (p > 0) statsEl.append(el('span', 'q', `trying ${nf0(Math.random() * TOTAL)} → ${(47 + Math.random() * 8).toFixed(1)}%`));
    else statsEl.append(el('span', 'q', 'warming up the monocle…'));
  }
  function startHunt() {
    clearInterval(huntT); huntDone = false; step = 0; t0 = performance.now();
    bestEls.forEach(e => { e.textContent = '·'; e.className = ''; }); bestHead.textContent = '';
    if (reduced) { step = STEPS; huntDone = true; paintBest(STEPS); paintStats(1, STEPS); return; }
    paintStats(0, 0);
    huntT = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / DUR);
      while (step < STEPS && p >= tAt(step + 1)) { step++; paintBest(step); }
      if (p >= 1) { huntDone = true; clearInterval(huntT); }
      paintStats(p, step);
    }, 70);
  }
  function fitHunt() {
    const pane = hunt.getBoundingClientRect();
    hunt.style.setProperty('--hfs', clamp(Math.min(pane.width / 45, pane.height / 30), 5.5, 34).toFixed(2) + 'px');
  }

  /* ---- commands ---- */
  const RULES = [
    '1. No .unwrap() in production. I do it anyway, I’m a duke.',
    '2. If it works, leave it alone. If it doesn’t, rewrite it in Rust.',
    '3. Never call me a chip. Or a fry. Or mash.',
    '4. Every project should be a little bit useless. pi-casso holds the record.',
    '5. I don’t use Arch, btw. I use EndeavourOS, and I am Starch.',
  ];
  const HELP = [
    ['fastfetch', 'the specs again'], ['ls', 'what lives in ~/code'], ['cargo run', 'try to build the potato'], ['cargo fix', 'make the borrow checker happy'],
    ['pi-casso hunt', 'rerun the search on the right'], ['kitten icat potato.png', 'kitty can show pictures'], ['git log', 'my latest PhotoCraft patches'],
    ['cat rules.txt', 'house rules'], ['zoom', 'into the potato in the digits'], ['exit', 'back out to the desktop'], ['clear', 'wipe the screen'],
  ];
  const NAMES = ['help', 'fastfetch', 'neofetch', 'ls', 'cat', 'cargo', 'pi-casso', 'kitten', 'icat', 'git', 'sudo', 'rm', 'unsafe', 'zoom', 'exit', 'clear', 'whoami', 'history', 'echo', 'date', 'uname', 'vim', 'cd', 'pwd', 'man'];
  async function borrowError() {
    ln([['   Compiling', 'ok'], ' potato v0.1.0 (/root/cellar/potato)']); await sleep(260);
    ln([['error[E0382]', 'bad bold'], [': borrow of moved value: `potato`', 'bold']]);
    ln([['  --> ', 'blue'], 'src/main.rs:41:24']);
    ln([['38 | ', 'blue'], '    let potato = Potato::aristocratic();']);
    ln([['   | ', 'blue'], ['        ------ move occurs because `Potato` is not `Copy`', 'bad']]);
    ln([['39 | ', 'blue'], '    serve_at_dinner(potato);']);
    ln([['   | ', 'blue'], ['                    ------ value moved here', 'bad']]);
    ln([['41 | ', 'blue'], '    println!("{}", potato.monocle);']);
    ln([['   | ', 'blue'], ['                   ^^^^^^^^^^^^^^ value borrowed here after move', 'bad']]);
    ln([['help', 'ok'], ': lend him instead: ', ['serve_at_dinner(&potato)', 'ok'], '. There is only one of him.']);
    ln([['error', 'bad'], ': could not compile `potato`. Try ', ['cargo fix', 'gold'], '.']);
  }
  const C = {
    async help() { ln('Things you can type:', 'gold'); for (const [n, d] of HELP) ln([['  ' + n.padEnd(24), 'c'], [d, 'dim']]); ln('There are a few more. You’ll find them.', 'dim'); },
    async fastfetch() { fastfetch(); },
    async neofetch() { ln('neofetch was archived in 2024. In this house we run fastfetch.', 'dim'); fastfetch(); },
    async whoami() { ln('sir. A potato with root access, which explains a lot.'); },
    async ls(a) {
      if (a[0] && /photocraft/.test(a[0])) return ln('photocraft/ is upstream: storytold/photocraft. I only send patches.');
      ln([['Causafera/  pi-casso/  photocraft/', 'blue'], ['  rules.txt  potato.png', '']]);
    },
    async cat(a) {
      const f = a[0];
      if (!f) return ln('cat: what, exactly?');
      if (/^rules(\.txt)?$/.test(f)) { RULES.forEach(r => ln(r)); return; }
      if (f === 'potato.png') return ln('That’s a picture. Try `kitten icat potato.png`.', 'dim');
      ln(`cat: ${f}: No such file or directory`);
    },
    async kitten(a) {
      if (a[0] !== 'icat') return ln('kitten: try `kitten icat potato.png`');
      const d = el('div', 'ln icat'), img = el('img'); img.src = 'assets/avatar-640.webp'; img.alt = 'Sir Starch'; d.append(img); out.append(d);
      img.addEventListener('load', scroll); scroll();
    },
    async icat() { return C.kitten(['icat']); },
    async cargo(a) {
      const s = a[0];
      if (s === 'run' || s === 'build') {
        if (got.has('borrow')) { ln([['   Compiling', 'ok'], ' potato v0.1.0']); await sleep(260); ln([['    Finished', 'ok'], ' `release` profile [optimized] in 0.69s']); if (s === 'run') ln('Hello. I am Starch, btw. 🥔🎩', 'c'); }
        else await borrowError();
        return;
      }
      if (s === 'fix') {
        ln([['    Checking', 'ok'], ' potato v0.1.0']); await sleep(320);
        ln([['       Fixed', 'ok'], ' src/main.rs (1 fix: the potato is lent, not given away)']); await sleep(220);
        ln([['warning', 'warn'], ': unused variable: `humility`']);
        ln([['    Finished', 'ok'], ' `release` profile [optimized] in 0.69s']);
        unlock('borrow'); const r = inp.getBoundingClientRect(); fx.burst(r.left + 60, r.top, 14, ['🦀', '✨', '🥔']); return;
      }
      if (s === 'test') { ln('running 3 tests'); await sleep(240); ln(['test monocle_is_polished ... ', ['ok', 'ok']]); ln(['test mustache_is_waxed ... ', ['ok', 'ok']]); ln(['test humility_exists ... ', ['FAILED', 'bad']]); ln('2 passed, 1 failed. Close enough.', 'dim'); return; }
      ln('Try `cargo run`, `cargo fix` or `cargo test`.');
    },
    async 'pi-casso'(a) {
      if (a[0] === 'hunt' || !a.length) { ln('Restarting the hunt in the right split →', 'dim'); startHunt(); return; }
      ln('Only `pi-casso hunt` works here. The real one has a whole TUI with five tabs.', 'dim');
    },
    async git(a) {
      if (a[0] !== 'log') return ln(`git: try \`git log\`.`);
      const g = Desk.gh;
      for (const [n, t] of g.prs) { ln([[`merged #${n}`, 'gold'], ' into storytold/photocraft']); ln('    ' + t); }
      ln(`${g.merged} merged so far${g.live ? '' : ' (as of 12 Oct)'}. Not my repo; I send patches.`, 'dim');
    },
    async sudo(a) {
      if (!a.length) return ln('sudo what?');
      if (/sandwich/i.test(a.join(' '))) return ln('Okay. 🥪 It’s a potato sandwich. It’s always a potato sandwich.', 'ok');
      ln('[sudo] password for sir: ********', 'dim'); await sleep(380);
      ln('sir is not in the sudoers file. This incident will be reported. To sir.', 'bad');
    },
    async rm(a) {
      const full = a.join(' ');
      if (/--no-preserve-root/.test(full)) return kernelPanic();
      if (/(^|\s)\/(\s|\*|$)/.test(full)) { ln('rm: it is dangerous to operate recursively on \'/\'', 'bad'); ln('rm: use --no-preserve-root to override this failsafe', 'bad'); ln('(I wouldn’t. But you might.)', 'dim'); return; }
      ln('rm: permission denied. You can look, but you can’t delete.', 'bad');
    },
    async unsafe() { ln('unsafe { /* trust me */ }', 'warn'); setUnsafe(true); },
    async zoom() { ln('Into the potato, then.', 'gold'); await sleep(300); Engine.go(1); },
    async exit() { ln('logout'); await sleep(260); inp.blur(); Engine.go(-1); },
    async clear() { out.textContent = ''; },
    async history() { hist.forEach((h, i) => ln(`${String(i + 1).padStart(4)}  ${h}`, 'dim')); },
    async echo(a) { ln(a.join(' ')); },
    async date() { ln(new Date().toString()); },
    async uname() { ln('Linux starch 7.2.9-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux'); },
    async pwd() { ln('/home/sir'); },
    async cd(a) { if (a[0] === '..') return C.exit(); if (/^(pi|π|3)$/.test(a[0] || '')) return C.zoom(); ln('cd: try `cd ..` or `cd pi`.', 'dim'); },
    async man(a) { ln(`No manual entry for ${a[0] || 'that'}.`); },
    async vim() { ln('You’re in vim now. Nobody knows how to leave.'); },
    async fry() { ln('Excuse me?', 'bad'); },
  };
  C.ll = C.ls; C.vi = C.nano = C.vim; C.logout = C.quit = C.exit; C.fries = C.chips = C.mash = C.fry;
  async function exec(raw) {
    const t = raw.trim(); if (!t) return;
    const low = t.toLowerCase();
    if (/^i\s+use\s+arch/.test(low)) return ln('You use EndeavourOS. And I’m Starch, btw.', 'gold');
    if (/^:(q|wq|x)!?$/.test(low)) return ln('E37: No write since last change (add ! to override)', 'bad');
    const toks = t.split(/\s+/); let name = toks[0], args = toks.slice(1);
    if (name === 'sudo' && args[0] === 'rm') { name = 'rm'; args = args.slice(1); ln('[sudo] password for sir: ********', 'dim'); await sleep(280); }
    const fn = Object.prototype.hasOwnProperty.call(C, name) ? C[name] : null;
    if (fn) return fn(args);
    ln([[`zsh: command not found: ${name}`, 'bad']]);
    ln('`help` lists what works.', 'dim');
  }
  async function run(raw) {
    if (busy) return;
    busy = true;
    echo(raw);
    if (raw.trim()) hist.push(raw);
    hi = hist.length;
    try { await exec(raw); } catch { ln('zsh: something broke. Blame the intern.', 'bad'); }
    busy = false; scroll();
  }
  return {
    build() {
      ln([['Last login: ' + new Date().toDateString() + ' on ttys001', 'dim']]);
      echo('fastfetch'); fastfetch();
      (async () => {
        echo('cargo run');
        if (got.has('borrow')) await C.cargo(['run']); else await borrowError();
        ln('Type `help`, or poke around.', 'dim');
      })();
      buildHunt();
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const v = inp.value; inp.value = ''; run(v); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) inp.value = hist[++hi]; else { hi = hist.length; inp.value = ''; } }
        else if (e.key === 'Escape') inp.blur();
        else if (e.key === 'Tab') {
          e.preventDefault(); const v = inp.value; if (!v || /\s/.test(v)) return;
          const m = NAMES.filter(n => n.startsWith(v));
          if (m.length === 1) inp.value = m[0] + ' '; else if (m.length > 1) ln(m.join('  '), 'dim');
        } else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); out.textContent = ''; }
      });
      $('#k-shell').addEventListener('click', () => { if (!String(getSelection())) inp.focus({ preventScroll: true }); });
      const chips = $('#chips');
      for (const c of ['help', 'cargo run', 'cargo fix', 'git log', 'kitten icat potato.png', 'cat rules.txt', 'exit']) {
        const b = el('button', '', c); b.type = 'button'; b.addEventListener('click', e => { e.stopPropagation(); run(c); }); chips.append(b);
      }
      Engine.on('layout', fitHunt);
      Engine.on('enter', i => {
        if (i !== 2) return;
        if (!huntT) startHunt();
        if (fine) setTimeout(() => inp.focus({ preventScroll: true }), 50);
      });
      Engine.on('leave', i => { if (i === 2) inp.blur(); });
    },
  };
})();

/* ============================================================
   IV. THE π SEA — the Duke, drawn with real digits of π
   ============================================================ */
const PiSea = (() => {
  const cv = $('#pi-canvas'), lens = $('#p-lens'), portal = $('#portal-3');
  let geo = null, img = null, imgOk = false, src = AVATAR;
  function loadImg(url) {
    return new Promise(res => {
      const i = new Image(); if (!url.startsWith('data:')) i.crossOrigin = 'anonymous'; i.decoding = 'async';
      i.onload = () => res(i); i.onerror = () => res(null); i.src = url;
    });
  }
  function sample(n) {
    if (!img) return null;
    try {
      const c = document.createElement('canvas'); c.width = c.height = n;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, n, n);
      return g.getImageData(0, 0, n, n).data;
    } catch { return null; }   // tainted canvas: CORS said no
  }
  function layout({ W, H, narrow }) {
    let cs = narrow ? 7.5 : 10;
    while ((W / cs) * (H / cs) > 11800) cs += 0.5;
    const A = narrow ? Math.min(W * 0.92, H * 0.58) : Math.min(W * 0.6, H * 0.84);
    const ax = narrow ? (W - A) / 2 - 10 : Math.max((W - A) / 2 + W * 0.06, 340), ay = narrow ? 62 : (H - A) / 2 - 6;
    geo = { W, H, cs, A, ax, ay, cols: Math.ceil(W / cs), rows: Math.ceil(H / cs) };
    // the way on is through the monocle again: same glass, now made of digits
    const d = Math.max(cs * 3, MONOCLE.d * A), mx = ax + MONOCLE.x * A, my = ay + MONOCLE.y * A;
    geo.mono = { x: mx, y: my, r: d / 2 };
    Object.assign(portal.style, { left: mx - d / 2 + 'px', top: my - d / 2 + 'px', width: d + 'px', height: d + 'px' });
    queueDraw();
  }
  // Layout, the avatar and the fonts all arrive separately; draw once for all of them.
  let drawQueued = false;
  function queueDraw() {
    if (drawQueued) return;
    drawQueued = true;
    setTimeout(() => { drawQueued = false; draw(); }, 30);
  }
  function draw() {
    if (!geo) return;
    const { W, H, cs, A, ax, ay, cols, rows } = geo, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const bw = Math.floor(W * dpr), bh = Math.floor(H * dpr);
    cv.width = bw; cv.height = bh; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    // The portrait's digits go to their own buffer so the glow can be ONE blurred drawImage.
    // (Never set ctx.filter around thousands of fillText calls: every call allocates a canvas-sized surface.)
    const off = document.createElement('canvas'); off.width = bw; off.height = bh;
    const o = off.getContext('2d');
    const font = `700 ${(cs * 1.08).toFixed(1)}px "JetBrains Mono",monospace`;
    for (const c of [g, o]) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; }
    g.clearRect(0, 0, W, H);
    const n = Math.max(8, Math.round(A / cs)), px = sample(n);
    const cxp = W / 2, cyp = H / 2, R = Math.hypot(W, H) / 2, mono = geo.mono;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c, dg = PI[idx % PI.length], x = c * cs + cs / 2, y = r * cs + cs / 2;
      if (Math.hypot(x - mono.x, y - mono.y) < mono.r) continue;   // the glass stays clear
      const u = (x - ax) / A, v = (y - ay) / A;
      // only the round portrait is drawn in colour; the square's black corners belong to the sea
      if (Math.hypot(u - 0.5, v - 0.5) < DISC) {
        let R8 = 200, G8 = 160, B8 = 90;
        if (px) { const p = ((v * n | 0) * n + (u * n | 0)) * 4; R8 = px[p]; G8 = px[p + 1]; B8 = px[p + 2]; }
        else { const du = u - 0.5, dv = v - 0.55; if (du * du / 0.12 + dv * dv / 0.16 > 1) { R8 = G8 = B8 = 20; } }
        const rr = Math.hypot(u - 0.5, v - 0.5);
        if (rr > 0.4655) { R8 = 235; G8 = 190; B8 = 100; }   // the portrait's own gold ring, redrawn so the round edge reads as a clean circle
        const lum = (0.299 * R8 + 0.587 * G8 + 0.114 * B8) / 255;
        const a = 0.22 + 0.78 * Math.pow(lum, 0.5), k = 1.6 + (1 - lum) * 0.7;
        o.fillStyle = `rgba(${Math.min(255, R8 * k + 26) | 0},${Math.min(255, G8 * k + 16) | 0},${Math.min(255, B8 * k + 4) | 0},${a.toFixed(3)})`;
        o.fillText(dg, x, y);
      } else {
        const fall = 1 - Math.hypot(x - cxp, y - cyp) / R;
        g.fillStyle = `rgba(232,195,106,${(0.035 + 0.1 * fall * fall + ((idx * 7919) % 13 === 0 ? 0.12 : 0)).toFixed(3)})`;
        g.fillText(dg, x, y);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if ('filter' in g) { g.filter = 'blur(6px)'; g.globalAlpha = 0.55; g.drawImage(off, 0, 0); g.filter = 'none'; g.globalAlpha = 1; }
    g.drawImage(off, 0, 0);
    off.width = off.height = 0;   // hand the memory back right away
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // dark glass behind the monocle (the cellar shows through it once it has rendered)
    g.fillStyle = 'rgba(8,5,4,.92)'; g.beginPath(); g.arc(mono.x, mono.y, mono.r, 0, Math.PI * 2); g.fill();
    $('#pi-count').textContent = (cols * rows).toLocaleString('en-US');
  }
  function lensMove(e) {
    if (!geo || Engine.active !== 3 || e.pointerType !== 'mouse') { lens.classList.remove('on'); return; }
    const { A, ax, ay } = geo, x = e.clientX, y = e.clientY;
    if (Math.hypot(x - (ax + A / 2), y - (ay + A / 2)) > A * DISC) { lens.classList.remove('on'); return; }
    const Z = 2.2, half = 90;
    lens.style.transform = `translate(${x}px,${y}px)`;
    lens.style.backgroundSize = `${A * Z}px ${A * Z}px`;
    lens.style.backgroundPosition = `${-(x - ax) * Z + half}px ${-(y - ay) * Z + half}px`;
    lens.classList.add('on');
  }
  return {
    async build() {
      // Pixels come from a small data: URI copy (never taints the canvas, even from file://);
      // the lens shows the full-size portrait as a plain CSS background.
      img = (window.AVATAR_SAMPLE && await loadImg(window.AVATAR_SAMPLE)) || await loadImg(AVATAR);
      imgOk = !!img;
      lens.style.backgroundImage = `url("${src}"), url("${AVATAR_FALLBACK}")`;
      queueDraw();
    },
    init() {
      Engine.on('layout', layout);
      $('#L3 .scene').addEventListener('pointermove', lensMove);
      $('#L3 .scene').addEventListener('pointerleave', () => lens.classList.remove('on'));
      Engine.on('leave', i => { if (i === 3) lens.classList.remove('on'); });
    },
    redraw: queueDraw,
    get ok() { return imgOk; },
  };
})();

/* ============================================================
   V. THE ROOT CELLAR: a toy Causafera observer
   A tiny deterministic world (two candles, a drip, five potatoes, a mana field).
   Same seed, same history; every event keeps a pointer to what caused it.
   ============================================================ */
const Cellar = (() => {
  const rng = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let seed = 2026, w = null;
  function world(sd) {
    const r = rng(sd);
    return { r, t: 0, temp: 8.6, hum: 0.57, wax: [100, 100], lit: [true, true], drip: 0, mana: 0.06, sync: 0, warm: false, anomaly: false,
      sprout: [0, 0, 0, 0, 0].map(() => r() * 0.25), up: [], warmTicks: [], lastWarm: null, ev: [], n: 0 };
  }
  function ev(w, text, why) { const e = { id: 'E-' + String(++w.n).padStart(2, '0'), t: w.t, text, why }; w.ev.push(e); return e; }
  function step(w) {
    const r = w.r; w.t++;
    for (let i = 0; i < 2; i++) if (w.lit[i]) {
      w.wax[i] -= 0.55 + r() * 0.5;
      if (w.wax[i] <= 0) { w.wax[i] = 0; w.lit[i] = false; ev(w, `candle ${i ? 'R' : 'L'} burned out`, { kind: 'candle' }); }
    }
    const lit = w.lit[0] + w.lit[1];
    w.temp += lit * 0.05 - (w.temp - 7.5) * 0.018 + (r() - 0.5) * 0.06;
    if (w.t % 7 === 0) { w.drip++; w.hum = Math.min(0.95, w.hum + 0.014); w.mana += 0.012; } else w.hum = Math.max(0.4, w.hum - 0.0011);
    if (w.lit[0] && w.lit[1] && Math.abs(w.wax[0] - w.wax[1]) < 4) { w.sync++; w.mana += 0.003; }
    w.mana *= 0.996;
    w.warmTicks.push(w.temp > 10 ? 1 : 0); if (w.warmTicks.length > 40) w.warmTicks.shift();
    if (!w.warm && w.temp > 10) { w.warm = true; w.lastWarm = ev(w, 'cellar warmed past 10 °C', { kind: 'warm', lit }); }
    else if (w.warm && w.temp < 9.5) { w.warm = false; ev(w, 'cellar cooled below 9.5 °C', { kind: 'cool', lit }); }
    for (let i = 0; i < 5; i++) if (!w.up.includes(i)) {
      w.sprout[i] += (Math.max(0, w.temp - 10) * 0.006 + Math.max(0, w.hum - 0.6) * 0.05) * (0.5 + r());
      if (w.sprout[i] >= 1) {
        w.up.push(i);
        ev(w, `potato #${i + 1} sprouted`, { kind: 'sprout', hum: w.hum, warm: w.warmTicks.reduce((a, b) => a + b, 0), warmEv: w.lastWarm && w.lastWarm.id, drip: w.drip });
      }
    }
    if (!w.anomaly && w.mana > 0.3) { w.anomaly = true; ev(w, 'mana anomaly by the crate', { kind: 'mana', drip: w.drip, sync: w.sync }); }
  }
  const hash = w => {
    const s = JSON.stringify([w.t, w.temp.toFixed(6), w.hum.toFixed(6), w.wax.map(x => x.toFixed(6)), w.mana.toFixed(6), w.up, w.ev.map(e => e.id + e.t)]);
    let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  function paint() {
    $('#cf-seed').textContent = seed; $('#cf-tick').textContent = w.t;
    const st = $('#cf-state'); st.textContent = '';
    st.append(el('b', '', w.temp.toFixed(1) + ' °C'), ' · humidity ', el('b', '', Math.round(w.hum * 100) + '%'), ' · mana ', el('b', '', w.mana.toFixed(2)),
      ' · candles ', el('b', '', (w.lit[0] + w.lit[1]) + '/2'), ' · sprouts ', el('b', '', w.up.length + '/5'));
    const log = $('#cf-log'); log.textContent = '';
    const last = w.ev.slice(-4);
    if (!last.length) { log.append(el('li', '', 'nothing has happened yet. it’s a cellar.')); return; }
    for (const e of last) { const li = el('li'); li.append(el('em', '', `t=${String(e.t).padEnd(4)}`), el('span', 'e', e.id), ' ' + e.text); log.append(li); }
  }
  function claim(box, conf, text, trace) {
    const row = el('p', 'cl' + (conf == null ? ' unk' : ''));
    row.append(el('span', 'cf', conf == null ? '?' : conf.toFixed(2)), el('span', '', text));
    if (trace) row.append(el('span', 'tr', trace));
    box.append(row);
  }
  function explain() {
    const box = $('#cf-why'); box.textContent = '';
    const e = w.ev[w.ev.length - 1];
    if (!e) { box.append(el('p', 'h', 'nothing to explain yet. run some ticks.')); return; }
    box.append(el('p', 'h', `why ${e.id}: ${e.text} (t=${e.t})`));
    const y = e.why;
    if (y.kind === 'warm') {
      claim(box, 0.93, `${y.lit} candles lit, about ${(y.lit * 0.05).toFixed(2)} °C of heat per tick`, '← both lit since t=0');
      claim(box, null, 'someone left the door open', 'no trace. the door hasn’t moved.');
    } else if (y.kind === 'cool') {
      const outs = w.ev.filter(x => x.why.kind === 'candle' && x.t <= e.t).map(x => x.id).join(', ');
      claim(box, 0.95, 'no candle left burning, so nothing heats the cellar', outs ? '← ' + outs : '');
      claim(box, null, 'it’s winter', 'no trace. there is no calendar in here.');
    } else if (y.kind === 'sprout') {
      claim(box, Math.min(0.97, 0.35 + y.warm / 40 * 0.6), `warm: above 10 °C for ${y.warm} of the last 40 ticks`, y.warmEv ? '← ' + y.warmEv : '');
      claim(box, Math.min(0.95, 0.3 + (y.hum - 0.55) * 3), `damp: humidity ${Math.round(y.hum * 100)}%, from the drip every 7 ticks`, `← drip ×${y.drip}`);
      claim(box, null, 'the Duke wanted it to', 'no trace. wanting doesn’t move potatoes.');
    } else if (y.kind === 'mana') {
      claim(box, 0.88, `the drip kept a steady 7-tick rhythm (×${y.drip})`, '← mana responds to recurrence');
      claim(box, Math.min(0.9, 0.4 + y.sync / 200), `both candles flickered in step for ${y.sync} ticks`, '← and to synchronised timing');
      claim(box, null, 'the Duke said a spell', 'no trace. mana ignores words.');
    } else if (y.kind === 'candle') {
      claim(box, 0.99, `the wax ran out after ${e.t} ticks`, '← lit since t=0');
      claim(box, null, 'a draught', 'no trace.');
    }
  }
  function reset(sd) { seed = sd; w = world(seed); $('#cf-why').textContent = ''; paint(); }
  async function runTicks(n) {
    const btn = $('#cf-run'); btn.disabled = true;
    const per = reduced ? n : 5;
    for (let i = 0; i < n; i += per) { for (let k = 0; k < per; k++) step(w); paint(); if (!reduced) await sleep(30); }
    btn.disabled = false; sfx.pop();
  }
  function replay() {
    const copy = world(seed); while (copy.t < w.t) step(copy);
    const a = hash(w), b = hash(copy), box = $('#cf-why'); box.textContent = '';
    box.append(el('p', 'h', `replayed seed ${seed} to t=${w.t}`));
    claim(box, a === b ? 1 : 0, a === b ? `identical: ${a} = ${b}` : `diverged: ${a} ≠ ${b}`, 'same seed, same history');
  }
  return {
    build() {
      reset(seed);
      $('#cf-run').addEventListener('click', () => runTicks(50));
      $('#cf-explain').addEventListener('click', explain);
      $('#cf-replay').addEventListener('click', replay);
      $('#cf-seed').addEventListener('click', () => { const o = (Math.random() * (PI.length - 5)) | 0; reset(parseInt(PI.slice(o, o + 4), 10) || 1729); });
      const sc = $('#L4 .scene');
      Engine.on('layout', ({ W, H, narrow }) => {
        sc.style.setProperty('--f4', narrow ? 0.3 : 0.26);
        sc.style.setProperty('--cs', narrow ? 1 : clamp(Math.min(W / 1400, H / 860), 0.72, 1.7).toFixed(3));   // the furniture grows with the screen
      });
      // the notice board shows live numbers while you are in the cellar
      const board = () => {
        const t = Math.floor(performance.now() / 1000);
        $('#ch-borrow').textContent = got.has('borrow') ? '1' : '0';
        $('#ch-troph').textContent = $('#trophy-count').textContent;
        $('#ch-time').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      };
      let boardT = 0;
      Engine.on('enter', i => { if (i === 4) { board(); clearInterval(boardT); boardT = setInterval(board, 1000); } });
      Engine.on('leave', i => { if (i === 4) clearInterval(boardT); });
      $('#c-mouse').addEventListener('click', e => {
        const r = e.currentTarget.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.3;
        fx.burst(x, y, 9, ['🧀', '🧀', '✨']); floatText('squeak!', x, y - 14); sfx.pop(); unlock('mouse');
      });
    },
  };
})();

/* ============================================================
   UNSAFE MODE, KONAMI, KERNEL PANIC
   ============================================================ */
let unsafeOn = false, unsafeTimer = 0, unsafeRain = 0;
function setUnsafe(on) {
  unsafeOn = on === undefined ? !unsafeOn : on;
  document.body.classList.toggle('unsafe', unsafeOn);
  clearInterval(unsafeRain); clearTimeout(unsafeTimer);
  if (unsafeOn) {
    unlock('unsafe'); sfx.alarm();
    unsafeRain = setInterval(() => fx.drop(['🥔', '🦀', '⚠️', '🔥'], 2), 380);
    unsafeTimer = setTimeout(() => setUnsafe(false), 20000);
  }
}
function initKonami() {
  const seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let i = 0;
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && unsafeOn) { setUnsafe(false); return; }
    if (e.target && /^(input|textarea)$/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    i = k === seq[i] ? i + 1 : (k === seq[0] ? 1 : 0);
    if (i === seq.length) { i = 0; setUnsafe(); }
  });
}
let panicking = false;
async function kernelPanic() {
  if (panicking) return; panicking = true;
  const box = $('#panic'), pre = $('#panic-text');
  pre.textContent = ''; box.classList.add('on'); sfx.alarm();
  const lines = [
    '[    0.000000] rm: removing /usr ............ done', '[    0.420000] rm: removing /home/sir ........ done',
    '[    0.690000] rm: removing /root/cellar ...... done', '[    1.337000] rm: removing /dev/null ......... refused (the Duke owns it)',
    '[    1.500000] rm: removing monocle.png ....... NO. NOT THE MONOCLE.', '[    1.618000] BUG: unable to handle kernel paging request at 0xDEADBEEF',
    '[    1.729000] Call Trace: humility_exit+0x0/0x0  aristocracy_main+0x69/0x420', '',
    'Kernel panic - not syncing: Out of potatoes', '---[ end Kernel panic - not syncing: Out of potatoes ]---', '',
    'Kidding. The Duke restored from backup. Rebooting the cellar…',
  ];
  for (const l of lines) { pre.append(l + '\n'); await sleep(l ? 180 : 110); }
  await sleep(1200);
  box.classList.remove('on'); panicking = false;
  unlock('yolo');
}

/* ============================================================
   CURTAIN + boot order
   ============================================================ */
function curtain(ready) {
  const c = $('#curtain');
  const idx = Engine.named(START_HASH);
  if (reduced || idx >= 0 || session.get('entered')) {
    c.classList.add('gone');
    Engine.jump(idx >= 0 ? idx : 0);
    return;
  }
  Engine.lock(true);
  Engine.jump(-0.72);   // we start in the cellar, a little way into the painting
  let entered = false;
  ready.then(() => sleep(350)).then(() => { if (!entered) Engine.warm(); });
  const enter = withSound => {
    if (entered) return;
    entered = true;
    Engine.stopWarm(-0.72);
    session.set('entered', '1');
    if (withSound) { sfx.setOn(true); sfx.startMusic(); HUD.paintSound(); }
    sfx.ding();
    c.classList.add('open');
    setTimeout(() => { Engine.lock(false); Engine.to(0, 0.35); }, 700);
    setTimeout(() => c.classList.add('gone'), 2000);
  };
  $('#enter').addEventListener('click', () => enter(false));
  $('#enter-snd').addEventListener('click', () => enter(true));
}

function misc() {
  const orig = document.title; let back = 0;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(back);
    if (document.hidden) document.title = 'Come back, peasant 🥔';
    else { document.title = 'Welcome back, your Lordship 🎩'; back = setTimeout(() => { document.title = orig; }, 2200); }
  });
  Engine.on('enter', i => { if (i === 1) unlock('monocle'); });
  try {
    console.log('%c⚜ SIR STARCH ⚜', 'font:900 28px Georgia,serif;color:#e8c36a;text-shadow:2px 2px 0 #000');
    console.log('%c' + potatoText(), 'font:10px/1.1 monospace;color:#e8c36a');
    console.log('%cOh, hello. Since you’re in here: try the Konami code, or `rm -rf / --no-preserve-root` in kitty.\nhttps://github.com/Sir-Starch', 'font:13px monospace;color:#5be8a2');
  } catch { /* the console is for peasants anyway */ }
}

function init() {
  fx.init();
  Gallery.build(); Desk.build(); Term.build(); Cellar.build(); PiSea.init();
  Engine.init(); HUD.init();
  initTrophies(); initKonami(); misc();
  // things that change geometry once they arrive
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.then(() => Engine.relayout()) : Promise.resolve();
  $('#ava').addEventListener('load', () => Engine.measure());
  const ready = Promise.all([fontsReady, PiSea.build(), sleep(0)]).catch(() => {});
  curtain(ready);
  setTimeout(() => Desk.loadStats(), 2500);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
