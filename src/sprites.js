// Bomba Ustası — piksel çizimler. Hepsi bu oyuna özgü; 16×16 karolar, bir kez
// çizilip önbelleğe alınır.
(function () {
  'use strict';

  const T = 16;
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function mk(w, h, fn) {
    const c = canvas(w, h), g = c.getContext('2d');
    const px = (x, y, col) => { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
    const rect = (x, y, rw, rh, col) => { g.fillStyle = col; g.fillRect(x, y, rw, rh); };
    const disc = (cx, cy, r, col, ry = r) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) px(x, y, col);
      }
    };
    fn({ g, px, rect, disc });
    return c;
  }
  // Satır dizilerinden çizim: '.' saydam, diğer harfler palette.
  function art(rows, pal, flip) {
    return mk(T, T, ({ px }) => rows.forEach((row, y) => {
      if (row.length !== T) throw new Error('çizim satırı 16 değil: ' + row);
      for (let x = 0; x < T; x++) { const c = pal[row[x]]; if (c) px(flip ? T - 1 - x : x, y, c); }
    }));
  }
  const cache = new Map();
  const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  // Beyaz siluet (vurulma / ölüm yanıp sönmesi için).
  function silhouette(src, col = '#fff') {
    const c = canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---------- oyuncu: baretli yıkım ustası ----------
  const HELMET = ['......LLLL......', '....LLHHHHhh....', '...LHHHHHHHHh...', '...HHHHHHHHHh...'];
  const DOWN = {
    head: HELMET.concat([
      '..hhhhhhhhhhhh..',
      '...ksssssssSk...',
      '...ksesssseSk...',
      '...kssmmmmsSk...',
      '....kSSSSSSk....',
      '...kVVVVVVVVk...',
      '..sVRRRRRRRRVs..',
      '..sVVVVVVVVVVs..',
      '...kppppppppk...',
    ]),
    legs: [
      ['....pp....pp....', '...bbb....bbb...'],
      ['....pp....bb....', '...bbb..........'],
      ['....bb....pp....', '..........bbb...'],
    ],
  };
  const UP = {
    head: HELMET.concat([
      '..hhhhhhhhhhhh..',
      '...khhhhhhhhk...',
      '...kmmmmmmmmk...',
      '...kmmmmmmmmk...',
      '....kSSSSSSk....',
      '...kVVVVVVVVk...',
      '..sVRRRRRRRRVs..',
      '..sVVVVVVVVVVs..',
      '...kppppppppk...',
    ]),
    legs: DOWN.legs,
  };
  const SIDE = {
    head: ['......LLLL......', '....LLHHHHHh....', '...LHHHHHHHHh...', '...HHHHHHHHHh...',
      '...hhhhhhhhhhhhh',
      '....kmmssssssk..',
      '....kmmsssseSk..',
      '....kmSsssmmmk..',
      '.....kSSSSSSk...',
      '....kVVVVVVk....',
      '....kVRRRRRsk...',
      '....kVVVVVVk....',
      '....kppppppk....',
    ],
    legs: [
      ['.....pp..pp.....', '.....bb..bbb....'],
      ['....pp....pp....', '...bbb....bbb...'],
      ['......pppp......', '......bbbb......'],
    ],
  };
  const PLAYER_COLORS = [
    { name: 'SARI', H: '#f2c230', h: '#b8861a', L: '#fff0a0', V: '#e46a28', ui: '#f2c230' },
    { name: 'KIRMIZI', H: '#e0483a', h: '#962a20', L: '#ffa090', V: '#3a68c8', ui: '#ff6a58' },
    { name: 'YEŞİL', H: '#4cb848', h: '#2a7a2a', L: '#b0f0a0', V: '#8a58c8', ui: '#6ad86a' },
    { name: 'MAVİ', H: '#3a88e0', h: '#1a58a0', L: '#a8d4ff', V: '#d8c038', ui: '#6ab0ff' },
  ];
  function playerPal(i) {
    const c = PLAYER_COLORS[i];
    return { H: c.H, h: c.h, L: c.L, V: c.V, R: '#ece8d8', k: '#1c1622', s: '#eab48c', S: '#c08860', e: '#1c1622', m: '#4a2a18', p: '#2e3c5c', b: '#3a2418' };
  }
  function player(i, dir, frame) {
    return memo(`p${i}${dir}${frame}`, () => {
      const set = dir === 'up' ? UP : dir === 'down' ? DOWN : SIDE;
      const rows = ['................'].concat(set.head, set.legs[frame % 3]);
      return art(rows, playerPal(i), dir === 'left');
    });
  }
  const playerFlash = (i, dir, frame) => memo(`pf${i}${dir}${frame}`, () => silhouette(player(i, dir, frame)));

  // Küçük baret simgesi (can sayacı, oyuncu rozetleri).
  function helmetIcon(i) {
    return memo('hi' + i, () => {
      const c = PLAYER_COLORS[i];
      return mk(10, 7, ({ rect, px }) => {
        rect(3, 0, 4, 1, c.L); rect(2, 1, 6, 1, c.H); rect(1, 2, 8, 2, c.H); px(2, 2, c.L);
        rect(8, 1, 1, 3, c.h); rect(0, 4, 10, 2, c.h); rect(1, 6, 8, 1, '#1c1622');
      });
    });
  }

  // ---------- zemin ve duvarlar: şantiye ----------
  function floor(variant) {
    return memo('floor' + variant, () => mk(T, T, ({ rect, px }) => {
      rect(0, 0, T, T, variant ? '#4a4f5c' : '#474c58');
      // beton lekeleri (sabit)
      let s = 7 + variant * 31;
      for (let k = 0; k < 14; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; px(s % 15, (s >> 8) % 15, k % 3 ? '#525866' : '#3e434e'); }
      rect(0, 15, T, 1, '#353943'); rect(15, 0, 1, T, '#353943');
      rect(0, 0, T, 1, '#565c6a');
    }));
  }
  // Duvar karosunun hemen altındaki zemin gölgeli.
  function floorShadow() {
    return memo('floorS', () => mk(T, T, ({ rect }) => { rect(0, 0, T, 4, 'rgba(10,8,20,.45)'); }));
  }
  function pillar() {
    return memo('pillar', () => mk(T, T, ({ rect, px }) => {
      rect(0, 0, T, T, '#8e8f98');
      rect(0, 0, T, 2, '#c4c5cc'); rect(0, 0, 2, T, '#b0b1b8');
      rect(0, 14, T, 2, '#55565f'); rect(14, 0, 2, T, '#62636c');
      for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) { px(x, y, '#5a5b64'); px(x + 1, y + 1, '#b8b9c0'); }
      px(7, 7, '#74757e'); px(8, 8, '#74757e'); px(9, 8, '#74757e');
    }));
  }
  // Dış sınır: sarı-siyah şantiye şeridi.
  function border() {
    return memo('border', () => mk(T, T, ({ px, rect }) => {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, ((x + y) >> 2) & 1 ? '#d8a82a' : '#2a2830');
      rect(0, 0, T, 1, '#f0d070'); rect(0, 15, T, 1, '#141218');
    }));
  }

  // ---------- tahta sandık ----------
  function crate(stage = 0) {
    return memo('crate' + stage, () => mk(T, T, ({ rect, px }) => {
      const wood = ['#b4722c', '#8a5420', '#5a3612'][stage], dark = ['#6e4216', '#4e2e10', '#2e1a08'][stage];
      rect(0, 0, T, T, dark);
      rect(1, 1, 14, 14, wood);
      rect(1, 1, 14, 1, ['#d8964a', '#a86a2c', '#6a4420'][stage]);
      rect(1, 5, 14, 1, dark); rect(1, 10, 14, 1, dark);
      // çapraz destek
      for (let k = 0; k < 12; k++) { px(2 + k, 13 - k, dark); px(3 + k, 13 - k, dark); }
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(x, y, '#e8d8b0');
      if (stage > 0) { // çatlaklar
        px(6, 3, '#1a0e04'); px(7, 4, '#1a0e04'); px(10, 7, '#1a0e04'); px(9, 8, '#1a0e04'); px(4, 12, '#1a0e04');
      }
    }));
  }

  // ---------- dinamit ----------
  function bomb(frame) {
    return memo('bomb' + frame, () => mk(T, T, ({ rect, px }) => {
      const big = frame === 1 ? 1 : 0;
      for (const sx of [3, 7, 11]) {
        const top = sx === 7 ? 5 : 6;
        rect(sx - big * (sx === 3 ? 1 : 0), top, 3 + (sx === 11 ? big : 0), 15 - top, '#c4302a');
        rect(sx, top, 1, 15 - top, '#ec6450');
        rect(sx + 2, top, 1, 15 - top, '#821a14');
        rect(sx, top, 3, 1, '#f0d8b8');
      }
      rect(3 - big, 10, 11 + big * 2, 2, '#e8d8a0'); rect(3 - big, 11, 11 + big * 2, 1, '#b8a870');
      // fitil
      px(8, 4, '#3a2a1a'); px(8, 3, '#3a2a1a'); px(9, 2, '#3a2a1a'); px(10, 2, '#3a2a1a');
      const spark = [['#fff8c0', '#ffb030'], ['#ffd040', '#ff7020'], ['#ffffff', '#ffd040']][frame % 3];
      px(11, 1, spark[0]); px(12, 1, spark[1]); px(11, 0, spark[1]); px(10, 1, spark[1]); px(11, 2, spark[1]);
      if (frame === 2) { px(13, 0, '#ffd040'); px(9, 0, '#ffd040'); }
    }));
  }

  // ---------- alev ----------
  // mask: 1 sol, 2 sağ, 4 yukarı, 8 aşağı, 16 merkez; phase 0 (taze) .. 2 (sönüyor)
  function flame(mask, phase) {
    return memo(`fl${mask}_${phase}`, () => mk(T, T, ({ rect, disc }) => {
      const layers = [['#d8481a', [12, 10, 6][phase]], ['#f8a830', [8, 6, 4][phase]], ['#fff4c0', [4, 2, 2][phase]]];
      for (const [col, w] of layers) {
        const o = (T - w) / 2;
        if (mask & 1) rect(0, o, 8, w, col);
        if (mask & 2) rect(8, o, 8, w, col);
        if (mask & 4) rect(o, 0, w, 8, col);
        if (mask & 8) rect(o, 8, w, 8, col);
        const r = (mask & 16 ? w / 2 + 2 : w / 2);
        disc(8, 8, r, col);
      }
    }));
  }

  // ---------- ödüller ----------
  function item(kind, blink) {
    return memo(`it${kind}${blink}`, () => mk(T, T, ({ rect, px, disc }) => {
      rect(1, 1, 14, 14, blink ? '#f0e6c8' : '#c8b88a');
      rect(2, 2, 12, 12, '#2c2640');
      if (kind === 'bomb') {
        for (const sx of [5, 8]) { rect(sx, 6, 3, 7, '#c4302a'); rect(sx, 6, 1, 7, '#ec6450'); }
        rect(5, 9, 6, 1, '#e8d8a0'); px(8, 5, '#3a2a1a'); px(9, 4, '#ffd040'); px(10, 3, '#fff8c0');
      } else if (kind === 'fire') {
        disc(8, 10, 4, '#d8481a'); disc(8, 10.5, 2.5, '#f8a830'); rect(7, 4, 2, 4, '#d8481a'); px(8, 3, '#d8481a'); disc(8, 11, 1.2, '#fff4c0');
      } else if (kind === 'speed') {
        rect(6, 4, 4, 6, '#8a5a2a'); rect(6, 10, 7, 3, '#8a5a2a'); rect(6, 12, 7, 1, '#3a2418'); rect(6, 4, 4, 1, '#c08a50');
        rect(3, 6, 2, 1, '#e8e0c0'); rect(2, 8, 3, 1, '#e8e0c0'); rect(3, 10, 2, 1, '#e8e0c0');
      } else if (kind === 'helmet') {
        rect(6, 5, 4, 1, '#fff0a0'); rect(5, 6, 6, 1, '#f2c230'); rect(4, 7, 8, 3, '#f2c230'); px(5, 7, '#fff0a0');
        rect(3, 10, 10, 2, '#b8861a');
      }
    }));
  }

  // ---------- çıkış kapağı ----------
  function door(open, blink) {
    return memo(`door${open}${blink}`, () => mk(T, T, ({ rect, px }) => {
      rect(1, 1, 14, 14, '#6e707a'); rect(1, 1, 14, 1, '#a0a2ac'); rect(1, 14, 14, 1, '#3a3c44');
      rect(3, 3, 10, 10, open ? (blink ? '#5ae07a' : '#2ea050') : '#24262e');
      if (open) { rect(7, 4, 2, 6, '#e8fff0'); rect(5, 8, 6, 1, '#e8fff0'); rect(6, 9, 4, 1, '#e8fff0'); px(7, 10, '#e8fff0'); px(8, 10, '#e8fff0'); }
      else { for (let k = 4; k < 12; k += 2) rect(4, k, 8, 1, '#3a3c46'); }
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(x, y, '#c8cad0');
    }));
  }

  // ---------- düşmanlar (oyuna özgü) ----------
  function enemy(kind, frame) {
    return memo(`en${kind}${frame}`, () => mk(T, T, ({ rect, px, disc }) => {
      if (kind === 'bocek') {         // böcek: kırmızı kabuk
        const lg = frame ? 1 : 0;
        for (const y of [8, 11, 14]) { px(2 + lg, y - 1, '#1c1622'); px(1 + lg, y, '#1c1622'); px(13 - lg, y - 1, '#1c1622'); px(14 - lg, y, '#1c1622'); }
        disc(8, 10, 6, '#1c1622', 5.5); disc(8, 10, 5, '#b8302a', 4.6);
        rect(7, 6, 2, 9, '#1c1622');
        px(5, 8, '#f08070'); px(4, 9, '#f08070'); px(10, 8, '#e05040');
        disc(8, 4.5, 3, '#1c1622', 2.5); px(6, 4, '#fff'); px(9, 4, '#fff');
        px(5, 1 + lg, '#1c1622'); px(6, 2, '#1c1622'); px(10, 1 + lg, '#1c1622'); px(9, 2, '#1c1622');
      } else if (kind === 'toz') {    // toz bulutu
        const o = frame ? 1 : 0;
        const puff = [[5 + o, 9, 4], [10 - o, 8, 4.5], [8, 11, 4.5], [7, 6 - o, 3.5]];
        for (const [x, y, r] of puff) disc(x, y + 1, r, '#7a7468');
        for (const [x, y, r] of puff) disc(x, y, r, '#bcb4a4');
        disc(6, 6 - o, 1.5, '#e4dccc');
        rect(5, 9, 2, 2, '#1c1622'); rect(9, 9, 2, 2, '#1c1622');
        rect(4, 8, 3, 1, '#5a5448'); rect(9, 8, 3, 1, '#5a5448');
        px(5, 9, '#fff'); px(9, 9, '#fff');
      } else {                        // köstebek
        const c = frame ? 1 : 0;
        disc(8, 9.5, 6.5, '#3a2414', 6); disc(8, 9.5, 5.8, '#7a5030', 5.3);
        disc(8, 11.5, 3.5, '#a8784a', 2.5);
        px(5, 7, '#1c1622'); px(10, 7, '#1c1622'); px(5, 6, '#fff'); px(10, 6, '#fff');
        rect(7, 8, 2, 2, '#f090a0'); px(7, 8, '#ffd0d8');
        for (const sx of [1, 13]) { rect(sx, 9 - c, 2, 3, '#e8d4b0'); px(sx + (sx === 1 ? 0 : 1), 12 - c, '#c8b490'); }
        rect(6, 2, 1, 2, '#3a2414'); rect(9, 2, 1, 2, '#3a2414');
      }
    }));
  }
  const enemyFlash = (kind, frame) => memo(`enf${kind}${frame}`, () => silhouette(enemy(kind, frame)));

  window.BUS = { T, PLAYER_COLORS, player, playerFlash, helmetIcon, floor, floorShadow, pillar, border, crate, bomb, flame, item, door, enemy, enemyFlash, mk };
})();
