// Bomba Ustası — ekranlar, çizim, giriş, ses ve retro ekran.
(function () {
  'use strict';
  const BU = window.BU, S = window.BUS;
  const { COLS, ROWS, FLOOR, WALL, CRATE, idx, RULES, ITEMS } = BU;

  // ---------- ekran ----------
  const SW = 256, SH = 240, AX = 8, AY = 30, TS = 16;
  const lo = document.createElement('canvas'); lo.width = SW; lo.height = SH;
  const ctx = lo.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let canvas = document.querySelector('canvas');
  const params = new URLSearchParams(location.search);
  if (/BlokTV|BombaTV/.test(navigator.userAgent) || params.has('tv')) document.body.classList.add('tv');

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok say */ } },
  };
  let crt = store.get('bu-ekran', true);
  let muted = store.get('bu-ses', false);

  // ---------- retro ekran (WebGL) ----------
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uSrc;
uniform vec2 uOut, uView;
uniform float uCrt, uTime;
void main() {
  vec2 f = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y) / uOut;
  vec2 p = f * uView, cell = floor(p);
  vec3 col = texture2D(uSrc, (cell + 0.5) / uView).rgb;
  if (uCrt < 0.5) { gl_FragColor = vec4(col, 1.0); return; }
  vec3 prev = texture2D(uSrc, (cell + vec2(-0.5, 0.5)) / uView).rgb;
  col = mix(col, prev, 0.22);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.8);
  col = col * vec3(0.94, 0.9, 0.8) + vec3(0.05, 0.04, 0.03);
  float rowPx = uOut.y / uView.y;
  float k = 0.34 * clamp((rowPx - 1.6) / 2.0, 0.0, 1.0);
  col *= 1.0 - k * (1.0 - sin(3.14159 * fract(p.y)));
  col *= 1.0 + k * 0.3;
  vec2 v = (f - 0.5) * vec2(1.0, 1.1);
  col *= 1.0 - dot(v, v) * 0.55;
  float n = fract(sin(dot(floor(gl_FragCoord.xy * 0.5) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}`;
  let gl = null, glp = null, direct = null;
  function initGL() {
    const g = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!g) return null;
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
    const prog = g.createProgram();
    g.attachShader(prog, sh(g.VERTEX_SHADER, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'));
    g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
    g.useProgram(prog);
    g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const a = g.getAttribLocation(prog, 'a'); g.enableVertexAttribArray(a); g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
    const t = g.createTexture(); g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, t);
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
    const u = (n) => g.getUniformLocation(prog, n);
    g.uniform1i(u('uSrc'), 0); g.uniform2f(u('uView'), SW, SH);
    glp = { uOut: u('uOut'), uCrt: u('uCrt'), uTime: u('uTime') };
    return g;
  }
  try { gl = initGL(); } catch (e) {
    console.warn('WebGL ekranı kurulamadı:', e); gl = null;
    const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh;
  }
  function fitCanvas() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    let w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (!w || !h) { w = SW * 3; h = SH * 3; }
    const k = Math.min(1, 1920 / w); w = Math.round(w * k); h = Math.round(h * k);
    if (!gl) { w = SW * 3; h = SH * 3; }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  if (gl) {
    if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(canvas);
    window.addEventListener('resize', fitCanvas);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; });
    canvas.addEventListener('webglcontextrestored', () => { try { gl = initGL(); } catch { gl = null; } });
  } else direct = canvas.getContext('2d');
  fitCanvas();

  function present(t) {
    if (gl) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lo);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(glp.uOut, canvas.width, canvas.height);
      gl.uniform1f(glp.uCrt, crt ? 1 : 0);
      gl.uniform1f(glp.uTime, (t / 1000) % 97);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (direct) {
      direct.imageSmoothingEnabled = false;
      direct.drawImage(lo, 0, 0, canvas.width, canvas.height);
    }
  }

  // ---------- yazı ----------
  if (window.FontFace && document.fonts) {
    for (const [file, range] of [
      ['latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215'],
      ['latin-ext', 'U+0100-0130, U+0132-024F, U+1E00-1EFF, U+20A0-20AB, U+20AD-20CF'],
    ]) {
      new FontFace('Press Start 2P', `url(src/fonts/press-start-2p-${file}-400-normal.woff2)`, { unicodeRange: range })
        .load().then((f) => document.fonts.add(f)).catch(() => { /* monospace'e düşer */ });
    }
  }
  // Yazı tipinin büyük İ, Ö, Ü harfleri küçük harf gibi duruyor; bunun yerine
  // I, O, U yazılıp noktalar piksel olarak üstüne konur.
  const DOTS = { 'İ': ['I', [3]], 'Ö': ['O', [1, 5]], 'Ü': ['U', [1, 5]] };
  function text(s, x, y, col = '#f0e8d0', size = 8, align = 'left', shadow = '#141020') {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = align;
    const chars = [...s];
    const plain = chars.map((c) => (DOTS[c] ? DOTS[c][0] : c)).join('');
    const sh = size >= 16 ? 2 : 1, u = size / 8;
    const x0 = Math.round(x) - (align === 'center' ? (chars.length * size) / 2 : align === 'right' ? chars.length * size : 0);
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c; ctx.fillText(plain, Math.round(x) + ox, Math.round(y) + oy);
      chars.forEach((ch, i) => { if (DOTS[ch]) for (const dx of DOTS[ch][1]) ctx.fillRect(x0 + i * size + dx * u + ox, Math.round(y) - 2 * u + oy, 2 * u, u); });
    };
    if (shadow) draw(sh, sh, shadow);
    draw(0, 0, col);
  }
  const upper = (s) => s.toLocaleUpperCase('tr-TR');

  // ---------- ses (sentezlenmiş) ----------
  let ac = null, lastBoom = 0, lastShrink = 0;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
    if (muted || !ac) return;
    const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 0.25, cutoff = 1200, delay = 0) {
    if (muted || !ac) return;
    const t0 = ac.currentTime + delay, n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t0); f.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    g.gain.setValueAtTime(vol, t0); src.connect(f).connect(g).connect(ac.destination); src.start(t0);
  }
  const sfx = {
    place: () => tone(330, 0.07, 'square', 0.06, 0.6),
    boom: () => { const n = performance.now(); if (n - lastBoom < 70) return; lastBoom = n; noise(0.55, 0.32, 1600); tone(90, 0.3, 'triangle', 0.12, 0.4); },
    pickup: () => { tone(523, 0.07, 'square', 0.06); tone(659, 0.07, 'square', 0.06, 0, 0.07); tone(784, 0.1, 'square', 0.06, 0, 0.14); },
    die: () => { tone(440, 0.6, 'square', 0.08, 0.25); tone(220, 0.5, 'triangle', 0.06, 0.3, 0.2); },
    enemy: () => tone(880, 0.12, 'square', 0.05, 0.4),
    door: () => { tone(392, 0.12, 'triangle', 0.08); tone(587, 0.2, 'triangle', 0.08, 0, 0.12); },
    clear: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.06, 0, i * 0.12)),
    over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, 0, i * 0.2)),
    round: () => [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'square', 0.06, 0, i * 0.1)),
    win: () => [523, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, 'square', 0.06, 0, i * 0.13)),
    shrink: () => { const n = performance.now(); if (n - lastShrink < 120) return; lastShrink = n; tone(70, 0.12, 'triangle', 0.1, 0.6); },
    helmet: () => { tone(1200, 0.08, 'square', 0.05, 0.5); noise(0.12, 0.12, 3000); },
    move: () => tone(660, 0.04, 'square', 0.04),
    select: () => { tone(523, 0.06, 'square', 0.05); tone(784, 0.08, 'square', 0.05, 0, 0.06); },
  };

  // ---------- durum ----------
  const MENU_TITLE = () => {
    const items = [{ id: 'story', label: 'TEK OYUNCU' }];
    const max = store.get('bu-kayit', 1);
    if (max > 1) items.push({ id: 'continue', label: 'DEVAM: BÖLÜM ' + max });
    items.push({ id: 'battle', label: 'KAPIŞMA' }, { id: 'help', label: 'NASIL OYNANIR' });
    return items;
  };
  const SLOT_TYPES = ['key1', 'key2', 'cpu', 'off'];
  const SLOT_LABEL = { key1: 'OKLAR', key2: 'WASD', cpu: 'BİLGİSAYAR', off: 'YOK', phone: 'TELEFON' };
  const app = {
    screen: 'title', menuIndex: 0, pauseIndex: 0, lobbyIndex: 0,
    slots: [{ type: 'key1' }, { type: 'cpu' }, { type: 'cpu' }, { type: 'off' }],
    G: null, fx: [], shake: 0, seed: 1, deco: null,
  };
  window.__bu = { app, BU };

  function decoArena() {
    const G = BU.create();
    BU.setupBattle(G, [null, null, null, null], 1, 11);
    return G;
  }
  app.deco = decoArena();

  function startStory(stage) {
    const G = BU.create();
    BU.setupStory(G, stage, false);
    G.lives = RULES.startLives; G.score = 0;
    app.G = G; app.screen = 'story'; app.fx = [];
    clearInputs();
  }
  function battleSlots() { return app.slots.map((s) => (s.type === 'off' ? null : { cpu: s.type === 'cpu' })); }
  function startBattle() {
    app.seed = (Date.now() % 100000) + 1;
    const G = BU.create();
    BU.setupBattle(G, battleSlots(), 1, app.seed);
    app.G = G; app.screen = 'battle'; app.fx = [];
    clearInputs();
  }
  function toTitle() { app.screen = 'title'; app.G = null; app.menuIndex = 0; clearInputs(); }
  function toLobby() { app.screen = 'lobby'; app.G = null; app.lobbyIndex = 4; assignPhones(); clearInputs(); }

  // ---------- giriş ----------
  const held = { key1: [], key2: [], touch: [] };
  const bombQueue = new Set(); // 'key1' | 'key2' | 'touch' | 'phone:<id>'
  const phones = new Map(); // id -> { dir, slot }
  function clearInputs() { held.key1 = []; held.key2 = []; held.touch = []; bombQueue.clear(); for (const p of phones.values()) p.dir = null; }
  const lastOf = (a) => (a.length ? a[a.length - 1] : null);

  const KEY_DIR = {
    ArrowUp: ['key1', 'up'], ArrowDown: ['key1', 'down'], ArrowLeft: ['key1', 'left'], ArrowRight: ['key1', 'right'],
    w: ['key2', 'up'], s: ['key2', 'down'], a: ['key2', 'left'], d: ['key2', 'right'],
  };
  const BOMB_KEYS = { ' ': 'key1', Enter: 'key1', f: 'key2' };

  function inGame() { return app.screen === 'story' || app.screen === 'battle'; }
  function playing() { return inGame() && app.G && !app.G.paused && app.G.phase !== 'over' && app.G.phase !== 'matchEnd'; }

  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    audio();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEY_DIR[k] || BOMB_KEYS[k]) e.preventDefault();
    if (k === 'm') { muted = !muted; store.set('bu-ses', muted); showButtons(); return; }
    if (k === 'c') { crt = !crt; store.set('bu-ekran', crt); showButtons(); return; }
    if (playing()) {
      if (KEY_DIR[k]) { const [set, d] = KEY_DIR[k]; held[set] = held[set].filter((x) => x !== d); held[set].push(d); return; }
      if (BOMB_KEYS[k] && !e.repeat) { bombQueue.add(BOMB_KEYS[k]); return; }
      if (k === 'p') { togglePause(); return; }
      if (k === 'Escape') { togglePause(); return; }
      return;
    }
    // menüler
    const d = KEY_DIR[k] ? KEY_DIR[k][1] : null;
    if (d) nav(d);
    else if ((k === 'Enter' || k === ' ' || k === 'f') && !e.repeat) confirm();
    else if (k === 'Escape' || k === 'Backspace') back();
    else if (k === 'p' && inGame()) togglePause();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEY_DIR[k]) { const [set, d] = KEY_DIR[k]; held[set] = held[set].filter((x) => x !== d); }
  });
  window.addEventListener('blur', () => { held.key1 = []; held.key2 = []; held.touch = []; if (playing()) togglePause(true); });

  function togglePause(force) {
    const G = app.G;
    if (!G || !inGame() || G.phase === 'over' || G.phase === 'matchEnd') return;
    G.paused = force === true ? true : !G.paused;
    app.pauseIndex = 0;
    clearInputs();
  }

  function nav(d) {
    if (app.screen === 'title') {
      const n = MENU_TITLE().length;
      if (d === 'up' || d === 'down') { app.menuIndex = (app.menuIndex + (d === 'up' ? n - 1 : 1)) % n; sfx.move(); }
    } else if (app.screen === 'lobby') {
      if (d === 'up' || d === 'down') { app.lobbyIndex = (app.lobbyIndex + (d === 'up' ? 4 : 1)) % 5; sfx.move(); }
      else if (app.lobbyIndex < 4) { cycleSlot(app.lobbyIndex, d === 'right' ? 1 : -1); sfx.move(); }
    } else if (inGame() && app.G && app.G.paused) {
      if (d === 'up' || d === 'down') { app.pauseIndex = 1 - app.pauseIndex; sfx.move(); }
    }
  }
  function confirm() {
    audio();
    if (app.screen === 'title') {
      const it = MENU_TITLE()[app.menuIndex];
      sfx.select();
      if (it.id === 'story') startStory(1);
      else if (it.id === 'continue') startStory(store.get('bu-kayit', 1));
      else if (it.id === 'battle') toLobby();
      else app.screen = 'help';
    } else if (app.screen === 'help') { sfx.select(); app.screen = 'title'; }
    else if (app.screen === 'lobby') {
      if (app.lobbyIndex < 4) { cycleSlot(app.lobbyIndex, 1); sfx.move(); return; }
      if (app.slots.filter((s) => s.type !== 'off').length >= 2) { sfx.select(); startBattle(); }
    } else if (inGame() && app.G) {
      const G = app.G;
      if (G.paused) { if (app.pauseIndex === 0) togglePause(); else toTitle(); sfx.select(); }
      else if (G.phase === 'over') toTitle();
      else if (G.phase === 'matchEnd') toLobby();
    }
  }
  function back() {
    if (app.screen === 'help' || app.screen === 'lobby') { app.screen = 'title'; app.menuIndex = 0; }
    else if (inGame()) togglePause();
  }
  function cycleSlot(i, step) {
    const s = app.slots[i];
    if (s.type === 'phone') return; // telefon bağlıyken yuva onundur
    const used = new Set(app.slots.filter((x, j) => j !== i).map((x) => x.type));
    let t = SLOT_TYPES.indexOf(s.type);
    for (let k = 0; k < SLOT_TYPES.length; k++) {
      t = (t + step + SLOT_TYPES.length) % SLOT_TYPES.length;
      const cand = SLOT_TYPES[t];
      if ((cand === 'key1' || cand === 'key2') && used.has(cand)) continue;
      s.type = cand; return;
    }
  }

  // Oyunculara giriş: her sabit adımda.
  function dirForSlot(i) {
    const G = app.G;
    if (G.mode === 'story') {
      let d = lastOf(held.key1) || lastOf(held.key2) || lastOf(held.touch);
      if (!d) for (const p of phones.values()) if (p.dir) { d = p.dir; break; }
      return d;
    }
    const s = app.slots[i];
    if (s.type === 'key1') return lastOf(held.key1) || lastOf(held.touch);
    if (s.type === 'key2') return lastOf(held.key2);
    if (s.type === 'phone') { const p = phones.get(s.phone); return p ? p.dir : null; }
    return null;
  }
  function bombForSlot(i) {
    const G = app.G;
    if (G.mode === 'story') {
      for (const k of [...bombQueue]) { bombQueue.delete(k); return true; }
      return false;
    }
    const s = app.slots[i];
    const key = s.type === 'key1' ? ['key1', 'touch'] : s.type === 'key2' ? ['key2'] : s.type === 'phone' ? ['phone:' + s.phone] : [];
    let hit = false;
    for (const k of key) if (bombQueue.delete(k)) hit = true;
    return hit;
  }
  function applyInputs() {
    const G = app.G;
    for (const p of G.players) {
      if (p.cpu) continue;
      p.input.dir = p.alive ? dirForSlot(p.id) : null;
      if (bombForSlot(p.id)) p.input.bomb = true;
    }
    if (G.mode === 'battle') bombQueue.clear();
  }

  // ---------- olaylar ----------
  function onEvents() {
    const G = app.G;
    for (const e of G.events) {
      switch (e.type) {
        case 'place': sfx.place(); break;
        case 'boom': sfx.boom(); app.shake = 0.15; break;
        case 'pickup': sfx.pickup(); buzzSlot(e.id, 30); break;
        case 'die': sfx.die(); buzzSlot(e.id, [120, 60, 220]); break;
        case 'helmet': sfx.helmet(); buzzSlot(e.id, 60); break;
        case 'enemy': sfx.enemy(); app.fx.push({ x: e.x, y: e.y, text: String(e.points), t: 1 }); break;
        case 'doorOpen': sfx.door(); break;
        case 'clear': sfx.clear(); store.set('bu-kayit', Math.max(store.get('bu-kayit', 1), e.stage + 1)); break;
        case 'over': sfx.over(); break;
        case 'roundEnd': sfx.round(); break;
        case 'nextRound': BU.setupBattle(G, battleSlots(), G.round + 1, app.seed); app.fx = []; break;
        case 'matchEnd': sfx.win(); break;
        case 'shrink': sfx.shrink(); break;
      }
    }
    G.events = [];
  }

  // ---------- telefon köprüsü (src/remote.js kullanır) ----------
  function assignPhones() {
    for (const [id, p] of phones) {
      const has = app.slots.findIndex((s) => s.type === 'phone' && s.phone === id);
      if (has >= 0) { p.slot = has; continue; }
      let i = app.slots.findIndex((s, j) => j > 0 && (s.type === 'cpu' || s.type === 'off'));
      if (i < 0) i = app.slots.findIndex((s) => s.type === 'cpu' || s.type === 'off');
      if (i >= 0) { app.slots[i] = { type: 'phone', phone: id }; p.slot = i; } else p.slot = -1;
    }
  }
  function buzzSlot(id, pattern) {
    for (const [pid, p] of phones) {
      const mine = app.G && app.G.mode === 'story' ? true : app.slots[id] && app.slots[id].phone === pid;
      if (mine && window.__buRemote) window.__buRemote.send(pid, { t: 'v', p: pattern });
    }
  }
  window.__bu.bridge = {
    join(id) {
      phones.set(id, { dir: null, slot: -1 });
      // Uyku vb. yüzünden kopup geri gelen telefon kendi oyuncusunu geri alır.
      const back = app.slots.findIndex((sl) => sl.type === 'cpu' && sl.was === id);
      if (back >= 0) {
        app.slots[back] = { type: 'phone', phone: id }; phones.get(id).slot = back;
        if (app.G && app.G.mode === 'battle') { const p = app.G.players.find((q) => q.id === back); if (p) { p.cpu = false; p.input.dir = null; } }
      } else if (app.screen === 'lobby') assignPhones();
      return this.info(id);
    },
    leave(id) {
      phones.delete(id);
      const i = app.slots.findIndex((s) => s.type === 'phone' && s.phone === id);
      if (i >= 0) {
        app.slots[i] = { type: 'cpu', was: id };
        if (app.G && app.G.mode === 'battle') { const p = app.G.players.find((q) => q.id === i); if (p) p.cpu = true; }
      }
    },
    input(id, m) {
      const ph = phones.get(id);
      if (!ph) return;
      audio();
      if (m.t === 'dir') {
        const d = BU.DIRS[m.d] ? m.d : null;
        const changed = d !== ph.dir;
        ph.dir = d;
        if (!playing() && d && changed) nav(d);
      } else if (m.t === 'b') {
        if (m.b === 'bomb' || m.b === 'ok') { if (playing()) bombQueue.add(app.G.mode === 'story' ? 'phone' : 'phone:' + id); else confirm(); }
        else if (m.b === 'pause') { if (inGame()) togglePause(); }
        else if (m.b === 'menu') { if (inGame()) togglePause(); else back(); }
      }
    },
    info(id) {
      const ph = phones.get(id);
      const story = app.G && app.G.mode === 'story';
      const slot = story ? 0 : ph ? ph.slot : -1;
      const p = app.G && slot >= 0 ? app.G.players.find((q) => q.id === slot) : null;
      return {
        t: 's', slot, color: slot >= 0 ? S.PLAYER_COLORS[slot].ui : '#95a2b9',
        label: app.screen === 'lobby' || inGame() ? (slot >= 0 ? 'OYUNCU ' + (slot + 1) : 'İZLEYİCİ') : 'MENÜ',
        screen: app.screen, playing: playing(), alive: p ? p.alive : true, paused: !!(app.G && app.G.paused),
      };
    },
  };

  // ---------- çizim: oyun ----------
  const sx = (x) => AX + x * TS, sy = (y) => AY + y * TS;
  function drawArena(G, t) {
    ctx.fillStyle = '#100e1c'; ctx.fillRect(0, AY - 2, SW, SH - AY + 2);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = idx(x, y), v = G.grid[i], X = sx(x), Y = sy(y);
      if (v === WALL) {
        const edge = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
        ctx.drawImage(edge ? S.border() : S.pillar(), X, Y);
        continue;
      }
      ctx.drawImage(S.floor((x + y) & 1), X, Y);
      if (y > 0 && G.grid[idx(x, y - 1)] !== FLOOR) ctx.drawImage(S.floorShadow(), X, Y);
      if (i === G.door && v === FLOOR) ctx.drawImage(S.door(G.doorOpen, Math.floor(t * 4) % 2), X, Y);
      if (v === FLOOR && G.revealed[i] && G.itemAt[i] >= 0) ctx.drawImage(S.item(ITEMS[G.itemAt[i]], Math.floor(t * 5) % 2), X, Y);
    }
    for (let i = 0; i < BU.N; i++) {
      if (G.grid[i] !== CRATE) continue;
      const c = G.crumble[i], stage = c > 0 ? (c > RULES.crumbleTime / 2 ? 1 : 2) : 0;
      ctx.drawImage(S.crate(stage), sx(i % COLS), sy(Math.floor(i / COLS)));
    }
    for (const b of G.bombs) {
      const f = b.t < 0.6 ? Math.floor(b.age * 16) % 3 : Math.floor(b.age * 6) % 3;
      ctx.drawImage(S.bomb(f), sx(b.x), sy(b.y));
    }
    for (let i = 0; i < BU.N; i++) {
      if (G.flameT[i] <= 0) continue;
      const ft = G.flameT[i], ph = ft > 0.38 ? 0 : ft > 0.18 ? 1 : 2;
      ctx.drawImage(S.flame(G.flameMask[i] || 16, ph), sx(i % COLS), sy(Math.floor(i / COLS)));
    }
    for (const e of G.enemies) {
      if (!e.alive && e.dying <= 0) continue;
      const fr = Math.floor(e.anim * 5) % 2;
      const img = !e.alive ? (Math.floor(e.dying * 12) % 2 ? S.enemyFlash(e.kind, fr) : S.enemy(e.kind, fr)) : S.enemy(e.kind, fr);
      if (!e.alive && e.dying < 0.35 && Math.floor(e.dying * 20) % 2) continue;
      ctx.drawImage(img, Math.round(sx(e.x)), Math.round(sy(e.y)));
    }
    const ps = G.players.slice().sort((a, b) => a.y - b.y);
    for (const p of ps) {
      if (!p.alive && p.dying <= 0) continue;
      const fr = p.moving ? 1 + (Math.floor(p.walkT * 7) % 2) : 0;
      const X = Math.round(sx(p.x)), Y = Math.round(sy(p.y)) - 2;
      if (!p.alive) {
        const k = p.dying / RULES.deathTime;
        if (k < 0.3 && Math.floor(p.dying * 20) % 2) continue;
        ctx.drawImage(Math.floor(p.dying * 14) % 2 ? S.playerFlash(p.id, p.dir, 0) : S.player(p.id, 'down', 0), X, Y + Math.round((1 - k) * 4));
        continue;
      }
      if (p.inv > 0 && Math.floor(p.inv * 12) % 2) continue;
      ctx.drawImage(S.player(p.id, p.dir, fr), X, Y);
      if (p.helmet) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(X + 7, Y, 2, 1); }
    }
    for (const f of app.fx) text(f.text, sx(f.x) + 8, sy(f.y) - (1 - f.t) * 10, '#fff6c0', 8, 'center');
  }

  function hud(G, t) {
    ctx.fillStyle = '#18142c'; ctx.fillRect(0, 0, SW, AY - 4);
    ctx.fillStyle = '#3c3468'; ctx.fillRect(0, AY - 5, SW, 1);
    if (G.mode === 'story') {
      text('BÖLÜM ' + G.stage, 8, 9, '#f0e8d0');
      ctx.drawImage(S.helmetIcon(0), 104, 9);
      text('x' + Math.max(0, G.lives), 116, 9, '#f0e8d0');
      text(String(G.score).padStart(6, '0'), 248, 9, '#f2c230', 8, 'right');
      const p = G.players[0];
      // ödül sayaçları
      ctx.drawImage(S.item('bomb', 0), 138, 5); text(String(p.bombs), 156, 9, '#f0e8d0');
      ctx.drawImage(S.item('fire', 0), 166, 5); text(String(p.fire), 184, 9, '#f0e8d0');
    } else {
      const x0 = [6, 64, 160, 218];
      G.players.forEach((p) => {
        const x = x0[p.id];
        ctx.globalAlpha = p.alive ? 1 : 0.35;
        ctx.drawImage(S.helmetIcon(p.id), x, 6);
        ctx.globalAlpha = 1;
        for (let k = 0; k < RULES.winsNeeded; k++) {
          ctx.fillStyle = k < p.wins ? S.PLAYER_COLORS[p.id].ui : '#3c3468';
          ctx.fillRect(x + k * 6, 16, 4, 4);
        }
      });
      const left = Math.max(0, Math.ceil(G.battleT));
      const warn = G.battleT <= 10 && Math.floor(t * 4) % 2;
      const label = G.battleT > 0 ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : 'DİKKAT';
      text(label, SW / 2, 9, warn || G.battleT <= 0 ? '#ff6a58' : '#f0e8d0', 8, 'center');
    }
  }

  function banner(lines, y = 104) {
    const w = Math.max(...lines.map((l) => l[0].length * (l[2] || 8))) + 24, h = lines.reduce((a, l) => a + (l[2] || 8) + 8, 12);
    ctx.fillStyle = 'rgba(16,12,28,.86)'; ctx.fillRect((SW - w) / 2, y - 8, w, h);
    ctx.fillStyle = '#e8d8a0'; ctx.fillRect((SW - w) / 2, y - 8, w, 1); ctx.fillRect((SW - w) / 2, y - 8 + h - 1, w, 1);
    let yy = y;
    for (const [s, col, size] of lines) { text(s, SW / 2, yy, col || '#f0e8d0', size || 8, 'center'); yy += (size || 8) + 8; }
  }

  function drawGame(t) {
    const G = app.G;
    ctx.save();
    if (app.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 2), Math.round((Math.random() - 0.5) * 2));
    drawArena(G, t);
    ctx.restore();
    hud(G, t);
    const name = (id) => 'OYUNCU ' + (id + 1);
    if (G.phase === 'intro') {
      if (G.mode === 'story') banner([['BÖLÜM ' + G.stage, '#f2c230', 16], ['HAZIR OL!', '#f0e8d0']]);
      else banner([['TUR ' + G.round, '#f2c230', 16], ['HAZIR OL!', '#f0e8d0']]);
    } else if (G.phase === 'clear') banner([['BÖLÜM TAMAM!', '#6ad86a', 8], ['+1000', '#f2c230']]);
    else if (G.phase === 'over') banner([['OYUN BİTTİ', '#ff6a58', 16], ['SKOR ' + G.score, '#f2c230'], ['ENTER: MENÜ', '#c8c0a8']]);
    else if (G.phase === 'roundEnd') banner([[G.winner >= 0 ? name(G.winner) + ' KAZANDI' : 'BERABERE', G.winner >= 0 ? S.PLAYER_COLORS[G.winner].ui : '#f0e8d0']]);
    else if (G.phase === 'matchEnd') banner([['ŞAMPİYON', '#f2c230', 16], [name(G.champion), S.PLAYER_COLORS[G.champion].ui], ['ENTER: DEVAM', '#c8c0a8']]);
    if (G.mode === 'battle' && G.phase === 'play' && G.battleT <= 0 && G.battleT > -1.5) banner([['ALAN DARALIYOR!', '#ff6a58']], 112);
    if (G.paused) {
      banner([['DURAKLATILDI', '#f2c230'], [(app.pauseIndex === 0 ? '> ' : '  ') + 'DEVAM', '#f0e8d0'], [(app.pauseIndex === 1 ? '> ' : '  ') + 'ANA MENÜ', '#f0e8d0']], 96);
    }
  }

  // ---------- çizim: menüler ----------
  function drawBackdrop(t) {
    drawArena(app.deco, t);
    ctx.fillStyle = 'rgba(12,10,22,.62)'; ctx.fillRect(0, 0, SW, SH);
  }
  function drawTitle(t) {
    drawBackdrop(t);
    ctx.fillStyle = '#18142c'; ctx.fillRect(0, 0, SW, AY - 4);
    text('BOMBA', SW / 2, 34, '#e8582a', 24, 'center', '#2a0e08');
    text('USTASI', SW / 2, 64, '#f2c230', 16, 'center', '#3a2408');
    ctx.drawImage(S.player(0, 'down', 0), 34, 62);
    ctx.drawImage(S.bomb(Math.floor(t * 6) % 3), 206, 62);
    const items = MENU_TITLE();
    items.forEach((it, i) => {
      const y = 112 + i * 16, on = i === app.menuIndex;
      if (on) ctx.drawImage(S.bomb(Math.floor(t * 8) % 3), 52, y - 5);
      text(it.label, 72, y, on ? '#f2c230' : '#e0d8c0');
    });
    text('K: TELEFONLA OYNA', SW / 2, 196, '#a8a090', 8, 'center');
    text('C: EKRAN  M: SES', SW / 2, 210, '#a8a090', 8, 'center');
  }
  function drawHelp(t) {
    drawBackdrop(t);
    text('NASIL OYNANIR', SW / 2, 12, '#f2c230', 8, 'center');
    const L = [
      ['OKLAR: YÜRÜ', '#f0e8d0'], ['BOŞLUK: DİNAMİT KOY', '#f0e8d0'], ['P: DURAKLAT', '#f0e8d0'],
      ['', ''], ['SANDIKLARI PATLAT,', '#e0d8c0'], ['DÜŞMANLARI TEMİZLE,', '#e0d8c0'], ['ÇIKIŞ KAPAĞINI BUL.', '#e0d8c0'],
    ];
    L.forEach(([s, c], i) => text(s, 16, 32 + i * 12, c));
    const it = [['bomb', '+1 DİNAMİT'], ['fire', '+1 MENZİL'], ['speed', 'DAHA HIZLI'], ['helmet', 'KASK: 1 KEZ KORUR']];
    it.forEach(([k, s], i) => { ctx.drawImage(S.item(k, 0), 16, 120 + i * 18); text(s, 38, 124 + i * 18, '#f0e8d0'); });
    text('KAPIŞMA: 2. OYUNCU WASD+F', 16, 196, '#c8c0a8');
    text('ENTER: GERİ', SW / 2, 222, '#a8a090', 8, 'center');
  }
  function drawLobby(t) {
    drawBackdrop(t);
    text('KAPIŞMA', SW / 2, 10, '#f2c230', 16, 'center');
    text('3 TUR ALAN KAZANIR', SW / 2, 32, '#c8c0a8', 8, 'center');
    app.slots.forEach((s, i) => {
      const y = 54 + i * 26, on = app.lobbyIndex === i;
      ctx.fillStyle = on ? 'rgba(242,194,48,.18)' : 'rgba(20,16,36,.7)'; ctx.fillRect(16, y - 4, SW - 32, 22);
      ctx.globalAlpha = s.type === 'off' ? 0.35 : 1;
      ctx.drawImage(S.player(i, 'down', 0), 22, y - 2);
      text('OYUNCU ' + (i + 1), 44, y + 3, S.PLAYER_COLORS[i].ui);
      ctx.globalAlpha = 1;
      const lab = SLOT_LABEL[s.type];
      text((on && s.type !== 'phone' ? '< ' : '') + lab + (on && s.type !== 'phone' ? ' >' : ''), SW - 22, y + 3, s.type === 'off' ? '#6a6480' : '#f0e8d0', 8, 'right');
    });
    const ok = app.slots.filter((s) => s.type !== 'off').length >= 2;
    const on = app.lobbyIndex === 4;
    text((on ? '> ' : '') + 'BAŞLA' + (on ? ' <' : ''), SW / 2, 166, ok ? (on ? '#f2c230' : '#f0e8d0') : '#6a6480', 8, 'center');
    text('K: TELEFONLA KATIL', SW / 2, 192, '#a8a090', 8, 'center');
    text('2. KLAVYE: WASD + F', SW / 2, 206, '#a8a090', 8, 'center');
    text('ESC: GERİ', SW / 2, 222, '#6a6480', 8, 'center');
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#100e1c'; ctx.fillRect(0, 0, SW, SH);
    const s = t / 1000;
    if (app.screen === 'title') drawTitle(s);
    else if (app.screen === 'help') drawHelp(s);
    else if (app.screen === 'lobby') drawLobby(s);
    else if (app.G) drawGame(s);
  }

  // ---------- döngü ----------
  const STEP = 1 / 120;
  let last = performance.now(), acc = 0;
  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      if (inGame() && app.G) { applyInputs(); BU.update(app.G, STEP); onEvents(); }
    }
    app.fx = app.fx.filter((f) => (f.t -= dt) > 0);
    if (app.shake > 0) app.shake -= dt;
    render(t);
    present(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- sayfa düğmeleri ve dokunmatik kumanda ----------
  const $ = (id) => document.getElementById(id);
  function showButtons() {
    if ($('ekran')) $('ekran').textContent = 'Ekran: ' + (crt ? 'Tüplü TV' : 'Temiz') + (gl ? '' : ' (yok)');
    if ($('ses')) $('ses').textContent = 'Ses: ' + (muted ? 'Kapalı' : 'Açık');
  }
  if ($('ekran')) $('ekran').onclick = () => { crt = !crt; store.set('bu-ekran', crt); showButtons(); };
  if ($('ses')) $('ses').onclick = () => { audio(); muted = !muted; store.set('bu-ses', muted); showButtons(); };
  showButtons();

  // Yön haçı: tek parmak, merkeze göre yön; parmak kaydırılınca yön değişir.
  const pad = $('yonhaci');
  if (pad) {
    let pid = null;
    const setDir = (e) => {
      const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      const d = Math.hypot(dx, dy) < dead ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const prev = lastOf(held.touch);
      held.touch = d ? [d] : [];
      pad.dataset.yon = d || '';
      if (d && d !== prev && !playing()) nav(d);
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); audio(); pid = e.pointerId; try { pad.setPointerCapture(pid); } catch { /* yok say */ } setDir(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) setDir(e); });
    const up = (e) => { if (e.pointerId !== pid) return; pid = null; held.touch = []; pad.dataset.yon = ''; };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  }
  const bombBtn = $('bomba');
  if (bombBtn) bombBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); audio(); if (playing()) bombQueue.add('touch'); else confirm(); });
  const pauseBtn = $('duraklat');
  if (pauseBtn) pauseBtn.onclick = () => { if (inGame()) togglePause(); else back(); };

  // Testler ve geliştirme için.
  window.__bu.startStory = startStory; window.__bu.startBattle = startBattle; window.__bu.toLobby = toLobby; window.__bu.toTitle = toTitle;
  window.__bu.view = () => ({ webgl: !!gl, crt, w: canvas.width, h: canvas.height });
})();
