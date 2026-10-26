// Bomba Ustası — telefon kumandaları, ekran (oyun) tarafı.
//
// "Telefonla oyna" (K) bir QR kod gösterir; her telefon kumanda.html'i açıp
// WebRTC ile doğrudan bu sayfaya bağlanır. Eşleştirmeyi PeerJS'in ücretsiz
// sunucusu yapar. Birden çok telefon bağlanabilir; kapışmada her biri bir
// oyuncu yuvasına oturur. Kütüphaneler yalnız panel açılınca yüklenir.
//
// Mesajlar (JSON):
//   telefon → oyun  {t:'h'} merhaba · {t:'p'} nabız · {t:'bye'} ayrılıyor
//                   {t:'dir', d:'up'|'down'|'left'|'right'|null}
//                   {t:'b', b:'bomb'|'pause'|'menu'}
//   oyun → telefon  {t:'s', slot, color, label, screen, playing, alive, paused} · {t:'v', p} titreşim
(function () {
  'use strict';
  const B = window.__bu && window.__bu.bridge;
  if (!B) return;

  // kumanda.html ile aynı olmalı.
  const PREFIX = 'bombaustasi-';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const SITE = 'https://hamikumbasae.github.io/bomba-ustasi/';
  const CODE_KEY = 'bu-kumanda-kod';
  const params = new URLSearchParams(location.search);
  const tvMode = document.body.classList.contains('tv');

  function peerOptions() {
    const p = params.get('peer');
    if (!p) return { debug: 0 };
    const [host, port] = p.split(':');
    const local = /^(localhost|127\.|192\.168\.|10\.)/.test(host);
    return { debug: 1, host, port: +port || (local ? 9000 : 443), path: '/', secure: !local };
  }
  function newCode() {
    const r = new Uint8Array(6); crypto.getRandomValues(r);
    return Array.from(r, (n) => ALPHABET[n % ALPHABET.length]).join('');
  }
  function storedCode() {
    try { const c = localStorage.getItem(CODE_KEY); if (c && /^[A-Z0-9]{6}$/.test(c)) return c; } catch { /* yok say */ }
    const c = newCode();
    try { localStorage.setItem(CODE_KEY, c); } catch { /* yok say */ }
    return c;
  }
  function controllerUrl(code) {
    const unreachable = location.protocol === 'file:' || /^(localhost|127\.|\[::1\])/.test(location.hostname);
    const base = unreachable && !params.has('peer') ? SITE : new URL('.', location.href).href;
    const q = params.has('peer') ? '?peer=' + encodeURIComponent(params.get('peer')) : '';
    return base + 'kumanda.html' + q + '#' + code;
  }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
  }

  // ---------- görünüm ----------
  const css = document.createElement('style');
  css.textContent = `
    .kumanda-perde { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px;
      background: rgba(8, 6, 16, 0.86); overflow: auto; }
    .kumanda-perde[hidden], .kumanda-rozet[hidden] { display: none; }
    .kumanda-kart { width: min(92vw, 400px); background: #1c1834; border: 3px solid; border-color: #5a5090 #141024 #141024 #5a5090;
      padding: 20px 20px 16px; text-align: center; font-family: monospace; color: #e8e0cc; }
    .kumanda-kart h2 { margin: 0 0 4px; font-size: 19px; font-weight: normal; color: #f2c230; }
    .kumanda-kart p { margin: 0; display: block; }
    .kumanda-kart .alt { margin: 0 0 14px; color: #9a92ac; font-size: 14px; line-height: 1.5; }
    body .kumanda-perde canvas.kumanda-qr { display: block; margin: 0 auto; width: min(62vw, 240px, 38vh); height: auto;
      aspect-ratio: 1; image-rendering: pixelated; background: #fff; border: 0; }
    .kumanda-kod { margin: 12px 0 2px !important; font-size: 30px; letter-spacing: 0.18em; color: #f2c230; }
    .kumanda-adres { font-size: 12px; color: #6a6480; word-break: break-all; }
    .kumanda-durum { margin: 12px 0 !important; min-height: 1.4em; font-size: 15px; color: #c8c0e0; }
    .kumanda-durum.hata { color: #ff8a70; }
    .kumanda-durum.tamam { color: #6ad86a; }
    .kumanda-rozet { position: fixed; top: 8px; right: 8px; z-index: 19; padding: 6px 10px; font: 13px monospace;
      color: #c6f5c6; background: rgba(28, 24, 52, 0.9); border: 2px solid #2f6b2f; }
    body.tv .kumanda-adres { display: none !important; }
  `;
  document.head.appendChild(css);

  const overlay = document.createElement('div');
  overlay.className = 'kumanda-perde'; overlay.hidden = true;
  overlay.innerHTML = `
    <div class="kumanda-kart" role="dialog" aria-modal="true" aria-labelledby="kumanda-baslik">
      <h2 id="kumanda-baslik">Telefonu kumanda yap</h2>
      <p class="alt">Telefonun kamerasıyla QR kodu okut. Kapışmada her oyuncu kendi telefonunu bağlayabilir.</p>
      <canvas class="kumanda-qr" width="10" height="10" aria-label="Kumanda sayfasının QR kodu"></canvas>
      <p class="kumanda-kod" aria-label="Bağlantı kodu"></p>
      <p class="kumanda-adres"></p>
      <p class="kumanda-durum" role="status"></p>
      <button type="button" class="kumanda-kapat">Kapat</button>
    </div>`;
  document.body.appendChild(overlay);
  const $ = (s) => overlay.querySelector(s);
  const qrCanvas = $('.kumanda-qr'), codeEl = $('.kumanda-kod'), urlEl = $('.kumanda-adres'), statusEl = $('.kumanda-durum');
  $('.kumanda-kapat').addEventListener('click', () => close());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });

  const badge = document.createElement('button');
  badge.type = 'button'; badge.className = 'kumanda-rozet'; badge.hidden = true;
  badge.addEventListener('click', () => open());
  document.body.appendChild(badge);

  const bar = document.querySelector('.dugmeler');
  if (bar) {
    const btn = document.createElement('button');
    btn.id = 'telefon'; btn.type = 'button'; btn.textContent = 'Telefonla oyna';
    btn.addEventListener('click', () => toggle());
    bar.appendChild(btn);
  }

  function setStatus(t, kind) { statusEl.textContent = t; statusEl.className = 'kumanda-durum' + (kind ? ' ' + kind : ''); }
  function drawQr(text) {
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), quiet = 4, cell = 8, size = (n + quiet * 2) * cell;
    qrCanvas.width = size; qrCanvas.height = size;
    const g = qrCanvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#0c0a16';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
  }
  function showCode() {
    const url = controllerUrl(code);
    drawQr(url); codeEl.textContent = code; urlEl.textContent = url.replace(/^https?:\/\//, '');
  }

  // ---------- bağlantılar ----------
  let peer = null, code = null, starting = null, idRetries = 0;
  const conns = new Map(); // telefonun peer kimliği -> bağlantı
  const lastSent = new Map();

  function connectedText() {
    const n = conns.size;
    return n ? n + ' telefon bağlı.' + (n < 4 ? ' Başka telefonlar da okutabilir.' : '') : 'Telefonun bağlanması bekleniyor…';
  }

  async function start() {
    if (peer && !peer.destroyed) return;
    if (starting) return starting;
    setStatus('Hazırlanıyor…');
    starting = (async () => {
      try {
        await Promise.all([window.Peer ? null : loadScript('src/vendor/peerjs.min.js'), window.qrcode ? null : loadScript('src/vendor/qrcode.js')]);
      } catch { setStatus('Kumanda dosyaları yüklenemedi. Sayfayı yenileyip tekrar dene.', 'hata'); return; }
      code = code || storedCode();
      showCode();
      createPeer();
    })();
    try { await starting; } finally { starting = null; }
  }

  function createPeer() {
    setStatus('Sunucuya bağlanıyor…');
    peer = new window.Peer(PREFIX + code, peerOptions());
    peer.on('open', () => { idRetries = 0; setStatus(connectedText(), conns.size ? 'tamam' : ''); });
    peer.on('connection', accept);
    peer.on('disconnected', () => setTimeout(() => { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); }, 2000));
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        if (++idRetries <= 3) { setStatus('Kod yeniden alınıyor…'); setTimeout(createPeer, 2000); return; }
        idRetries = 0; code = newCode();
        try { localStorage.setItem(CODE_KEY, code); } catch { /* yok say */ }
        showCode(); createPeer();
      } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) {
        setStatus(err.type === 'browser-incompatible' ? 'Bu tarayıcı WebRTC desteklemiyor.' : 'Eşleştirme sunucusuna ulaşılamadı. İnternet bağlantını kontrol et; tekrar deneniyor…', 'hata');
        if (err.type !== 'browser-incompatible') {
          peer.destroy();
          setTimeout(() => { if (!overlay.hidden || conns.size) createPeer(); else peer = null; }, 5000);
        }
      }
    });
  }

  // Kopan telefonu bırak: oyuncusu bilgisayara geçer.
  const lastSeen = new Map();
  function drop(id, c) {
    if (conns.get(id) !== c) return;
    conns.delete(id); lastSent.delete(id); lastSeen.delete(id);
    B.leave(id);
    showBadge();
    setStatus(connectedText(), conns.size ? 'tamam' : '');
    try { c.close(); } catch { /* yok say */ }
  }

  function accept(c) {
    const id = c.peer;
    const old = conns.get(id);
    if (old && old !== c) old.close();
    c.on('open', () => {
      conns.set(id, c); lastSeen.set(id, performance.now());
      B.join(id);
      lastSent.delete(id);
      push(id, true);
      setStatus(connectedText(), 'tamam');
      showBadge();
      // Tek oyunculuda ilk telefon bağlanınca panel kapanır; kapışma odasında açık kalır.
      if (!overlay.hidden && window.__bu.app.screen !== 'lobby') setTimeout(close, 1200);
    });
    c.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      lastSeen.set(id, performance.now());
      if (m.t === 'p') return; // nabız
      if (m.t === 'bye') { drop(id, c); return; }
      if (m.t === 'h') { lastSent.delete(id); push(id, true); return; }
      B.input(id, m);
      push(id);
    });
    c.on('close', () => drop(id, c));
    c.on('error', () => { /* close ayrıca gelir */ });
  }

  function send(id, m) { const c = conns.get(id); if (c && c.open) c.send(m); }
  function push(id, force) {
    const m = B.info(id), s = JSON.stringify(m);
    if (!force && lastSent.get(id) === s) return;
    lastSent.set(id, s); send(id, m);
  }
  // Telefon her saniye nabız yollar; 4,5 sn ses gelmezse kopmuş sayılır
  // (sayfası kapanan telefonun WebRTC kapanışı geç fark edilebiliyor).
  setInterval(() => {
    const now = performance.now();
    for (const [id, c] of [...conns]) {
      if (now - (lastSeen.get(id) || now) > 4500) drop(id, c); else push(id);
    }
  }, 150);
  window.__buRemote = { send, count: () => conns.size };

  function showBadge() {
    badge.hidden = conns.size === 0;
    badge.textContent = conns.size + ' telefon bağlı';
  }

  // ---------- aç / kapat ----------
  let pausedByOverlay = false;
  function open() {
    if (!overlay.hidden) return;
    const app = window.__bu.app;
    if (app.G && (app.screen === 'story' || app.screen === 'battle') && !app.G.paused && app.G.phase !== 'over') { app.G.paused = true; pausedByOverlay = true; }
    overlay.hidden = false;
    if (conns.size) setStatus(connectedText(), 'tamam');
    start();
  }
  function close() {
    if (overlay.hidden) return false;
    overlay.hidden = true;
    const app = window.__bu.app;
    if (pausedByOverlay && app.G) app.G.paused = false;
    pausedByOverlay = false;
    return true;
  }
  function toggle() { if (overlay.hidden) open(); else close(); }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!overlay.hidden) {
      if (k === 'escape' || k === 'k' || k === 'enter' || k === ' ') close();
      e.preventDefault(); e.stopImmediatePropagation();
    } else if (k === 'k' && !e.repeat) { open(); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  if (tvMode) window.__buTv = { phone: toggle, back: () => (close() ? 'ok' : 'menu') };
})();
