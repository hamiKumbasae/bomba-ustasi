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

  // ---------- dünyalar: zemin, sütun, ek engel, kenar, kırılabilir ----------
  // 1 İnşaat · 2 Liman · 3 Maden · 4 Fabrika · 5 Gökdelen
  function speckle(px, seed, n, cols) {
    let s = seed;
    for (let k = 0; k < n; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; px(s % 15, (s >> 8) % 15, cols[k % cols.length]); }
  }
  function floor(variant, w = 1) {
    return memo(`floor${w}_${variant}`, () => mk(T, T, ({ rect, px }) => {
      if (w === 2) {          // rıhtım tahtası
        rect(0, 0, T, T, variant ? '#6e5c46' : '#685742');
        for (const y of [3, 7, 11, 15]) rect(0, y, T, 1, '#463a2c');
        for (const [x, y] of [[3, 1], [12, 5], [6, 9], [10, 13]]) px(x, y, '#9a8a70');
        speckle(px, 9 + variant * 13, 6, ['#5a4a38', '#7a684e']);
      } else if (w === 3) {   // toprak
        rect(0, 0, T, T, variant ? '#3e3126' : '#3a2e24');
        speckle(px, 5 + variant * 17, 18, ['#4c3c2e', '#2a2018', '#56463a']);
        rect(0, 15, T, 1, '#2a2018');
      } else if (w === 4) {   // metal ızgara
        rect(0, 0, T, T, '#3c4246');
        for (let k = 1; k < T; k += 4) { rect(k, 0, 1, T, '#2c3034'); rect(0, k, T, 1, '#2c3034'); }
        for (let k = 0; k < T; k += 4) px(k, k, '#5a6266');
        rect(0, 0, T, 1, '#4e565a');
        if (variant) rect(0, 15, T, 1, '#30353a');
      } else if (w === 5) {   // çatı betonu, gece
        rect(0, 0, T, T, variant ? '#363a4c' : '#33374a');
        speckle(px, 3 + variant * 7, 10, ['#3e4256', '#2c3040']);
        rect(0, 15, T, 1, '#262a38'); rect(15, 0, 1, T, '#262a38');
      } else {                // beton
        rect(0, 0, T, T, variant ? '#4a4f5c' : '#474c58');
        speckle(px, 7 + variant * 31, 14, ['#3e434e', '#525866', '#525866']);
        rect(0, 15, T, 1, '#353943'); rect(15, 0, 1, T, '#353943');
        rect(0, 0, T, 1, '#565c6a');
      }
    }));
  }
  // Duvar karosunun hemen altındaki zemin gölgeli.
  function floorShadow() {
    return memo('floorS', () => mk(T, T, ({ rect }) => { rect(0, 0, T, 4, 'rgba(10,8,20,.45)'); }));
  }
  function bevel(rect, base, hi, lo) {
    rect(0, 0, T, T, base); rect(0, 0, T, 2, hi); rect(0, 0, 2, T, hi); rect(0, 14, T, 2, lo); rect(14, 0, 2, T, lo);
  }
  function pillar(w = 1) {
    return memo('pillar' + w, () => mk(T, T, ({ rect, px, disc }) => {
      if (w === 2) {          // rıhtım babası
        bevel(rect, '#7c8288', '#a8aeb4', '#4c5258');
        disc(8, 8.5, 4.5, '#1e2228'); disc(8, 8, 3.5, '#2e343c'); px(6, 6, '#6a727c'); px(7, 6, '#6a727c');
      } else if (w === 3) {   // katmanlı taş blok
        bevel(rect, '#626872', '#8e949e', '#373b44');
        for (const y of [5, 10]) rect(2, y, 12, 1, '#4a4f58');
        px(0, 0, '#2a221c'); px(15, 0, '#2a221c'); px(0, 15, '#2a221c'); px(15, 15, '#2a221c');
        px(5, 3, '#a8aeb8'); px(10, 8, '#a8aeb8'); px(6, 12, '#3a3e46'); px(7, 12, '#3a3e46');
      } else if (w === 4) {   // makine bloğu
        bevel(rect, '#46666a', '#6e9094', '#2a3e42');
        rect(4, 4, 8, 6, '#24343a'); rect(5, 5, 6, 4, '#1a4a3a'); px(6, 6, '#5ae07a'); px(9, 7, '#e0c040');
        for (const [x, y] of [[3, 12], [12, 12]]) px(x, y, '#a8c0c4');
      } else if (w === 5) {   // kırmızı çelik kiriş
        rect(0, 0, T, T, '#8a2e22');
        rect(0, 0, T, 3, '#b8483a'); rect(0, 13, T, 3, '#5a1a12'); rect(6, 3, 4, 10, '#a03a2c'); rect(6, 3, 1, 10, '#c45a48');
        for (const x of [2, 5, 10, 13]) { px(x, 1, '#e08070'); px(x, 14, '#2e0e08'); }
      } else {                // beton sütun
        bevel(rect, '#8e8f98', '#c4c5cc', '#55565f');
        for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) { px(x, y, '#5a5b64'); px(x + 1, y + 1, '#b8b9c0'); }
        px(7, 7, '#74757e'); px(8, 8, '#74757e'); px(9, 8, '#74757e');
      }
    }));
  }
  // Dünyaya özgü ek engel (haritada X).
  function extra(w = 1, v = 0) {
    return memo(`extra${w}_${v % 3}`, () => mk(T, T, ({ rect, px, disc }) => {
      if (w === 2) {          // konteyner
        const c = [['#a8382c', '#d0584a', '#6e1e16'], ['#2e5a9a', '#4e7aba', '#1a3a6a'], ['#3a7a44', '#5a9a62', '#1e4a28']][v % 3];
        rect(0, 0, T, T, c[0]);
        for (let x = 1; x < T; x += 3) rect(x, 1, 1, 14, c[2]);
        rect(0, 0, T, 1, c[1]); rect(0, 15, T, 1, c[2]); rect(12, 6, 2, 4, '#d8d0c0');
      } else if (w === 3) {   // destek direği
        rect(0, 0, T, T, '#2a1e14');
        rect(2, 0, 4, T, '#7a5430'); rect(10, 0, 4, T, '#7a5430'); rect(2, 0, 1, T, '#9a7048'); rect(10, 0, 1, T, '#9a7048');
        rect(0, 2, T, 3, '#6a4828'); rect(0, 2, T, 1, '#8a6440');
        for (let k = 0; k < 10; k++) px(3 + k, 6 + k > 15 ? 15 : 6 + k, '#5a3c20');
      } else if (w === 4) {   // tehlike şeritli çelik kasa
        bevel(rect, '#6a6e72', '#94989c', '#3e4246');
        for (let x = 0; x < T; x++) for (let y = 2; y < 6; y++) if (((x + y) >> 1) & 1) px(x, y, '#d8b028'); else px(x, y, '#222428');
        rect(5, 9, 6, 3, '#4a4e52');
      } else if (w === 5) {   // klima ünitesi
        bevel(rect, '#8a909c', '#b4bac4', '#545a64');
        disc(8, 8.5, 5, '#3a3e46'); disc(8, 8.5, 1.5, '#8a909c');
        for (let k = -4; k <= 4; k += 2) rect(8 + k, 8, 1, 1, '#5a5e66');
      } else {                // beton bariyer, kırmızı-beyaz şeritli
        bevel(rect, '#9a9ca4', '#c8cad0', '#5e6068');
        for (let x = 0; x < T; x++) for (let y = 6; y < 10; y++) px(x, y, ((x + y) >> 2) & 1 ? '#d23a2a' : '#ece8e0');
        rect(0, 6, T, 1, '#6e7078'); rect(0, 9, T, 1, '#6e7078');
      }
    }));
  }
  function border(w = 1, v = 0) {
    return memo(`border${w}_${v % 4}`, () => mk(T, T, ({ px, rect }) => {
      if (w === 2) {          // deniz
        rect(0, 0, T, T, '#1c3656');
        const o = (v % 4) * 4;
        for (let x = 0; x < T; x++) { px(x, (3 + ((x + o) >> 2) % 2), '#3a6a9a'); px(x, 10 + ((x + o + 2) >> 2) % 2, '#2e5a86'); }
        px((5 + o) % 16, 7, '#9ac8e8');
      } else if (w === 3) {   // ahşap iksa
        rect(0, 0, T, T, '#24180e');
        rect(0, 1, T, 5, '#6a4626'); rect(0, 9, T, 5, '#5e3e20'); rect(0, 1, T, 1, '#8a6038'); rect(0, 9, T, 1, '#7a5430');
        px(3 + (v % 4) * 3, 3, '#3a2a18'); px(9, 11, '#3a2a18');
      } else if (w === 4) {   // borular
        rect(0, 0, T, T, '#1e2226');
        rect(0, 2, T, 5, '#8a6a4a'); rect(0, 2, T, 1, '#b48c64'); rect(0, 6, T, 1, '#5a4430');
        rect(0, 9, T, 5, '#6a7076'); rect(0, 9, T, 1, '#9aa0a6'); rect(0, 13, T, 1, '#40464c');
        if (v % 2) { rect(6, 1, 3, 7, '#5a4430'); rect(10, 8, 3, 7, '#40464c'); }
      } else if (w === 5) {   // gece şehir
        rect(0, 0, T, T, '#10142a');
        let s = 11 + v * 7;
        for (let k = 0; k < 5; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; px(s % 16, (s >> 8) % 16, k % 2 ? '#e8d070' : '#8a90c0'); }
      } else {                // şantiye şeridi
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, ((x + y) >> 2) & 1 ? '#d8a82a' : '#2a2830');
        rect(0, 0, T, 1, '#f0d070'); rect(0, 15, T, 1, '#141218');
      }
    }));
  }

  // ---------- kırılabilir engel: sandık, varil, kömür, koli, tuğla ----------
  function crate(stage = 0, w = 1) {
    return memo(`crate${w}_${stage}`, () => mk(T, T, ({ rect, px, disc }) => {
      const dk = (a) => a[stage];
      if (w === 2) {          // varil
        rect(2, 1, 12, 14, dk(['#4a2c12', '#3a2210', '#24140a']));
        rect(3, 1, 10, 14, dk(['#9a5a26', '#7a461e', '#4a2a10'])); rect(4, 1, 2, 14, dk(['#c07a3a', '#9a5e2a', '#5e3a1a']));
        for (const y of [3, 12]) rect(2, y, 12, 2, dk(['#6a6e76', '#50545c', '#33363c']));
        rect(3, 1, 10, 1, '#d8a060');
      } else if (w === 3) {   // cevherli kaya (kırılır)
        disc(8, 8.5, 7.2, dk(['#4a3020', '#3a2618', '#24160c']));
        disc(7.5, 7.8, 6, dk(['#a0744a', '#7e5a38', '#4e3622']));
        disc(6, 6, 2.6, dk(['#c4986a', '#9a744e', '#5e4430']));
        for (const [x, y] of [[9, 5], [10, 6], [5, 10], [6, 11], [11, 10]]) px(x, y, '#3a2416');
        for (const [x, y] of [[4, 8], [9, 9], [11, 7], [7, 12]]) px(x, y, stage ? '#5a4030' : '#ffd84a');
      } else if (w === 4) {   // koli
        rect(1, 2, 14, 13, dk(['#7a5630', '#5e4024', '#3a2814']));
        rect(2, 3, 12, 11, dk(['#b88a58', '#94683e', '#5e4226'])); rect(2, 3, 12, 1, '#d4aa78');
        rect(7, 3, 2, 11, dk(['#d8c8a0', '#b0a080', '#7a6e58'])); rect(2, 8, 12, 1, dk(['#9a7448', '#7a5a38', '#4a3622']));
        px(4, 11, '#5a3e20'); px(11, 5, '#5a3e20');
      } else if (w === 5) {   // tuğla yığını
        rect(0, 0, T, T, dk(['#c8b090', '#a08a70', '#605444']));
        for (let y = 0; y < T; y += 4) for (let x = (y / 4) % 2 ? -4 : 0; x < T; x += 8) rect(x + 1, y + 1, 6, 2, dk(['#a8442e', '#863624', '#4e2016']));
        rect(0, 0, T, 1, '#e0d0b0');
      } else {                // tahta sandık
        const wood = dk(['#b4722c', '#8a5420', '#5a3612']), dark = dk(['#6e4216', '#4e2e10', '#2e1a08']);
        rect(0, 0, T, T, dark); rect(1, 1, 14, 14, wood); rect(1, 1, 14, 1, dk(['#d8964a', '#a86a2c', '#6a4420']));
        rect(1, 5, 14, 1, dark); rect(1, 10, 14, 1, dark);
        for (let k = 0; k < 12; k++) { px(2 + k, 13 - k, dark); px(3 + k, 13 - k, dark); }
        for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(x, y, '#e8d8b0');
      }
      if (stage > 0) for (const [x, y] of [[6, 3], [7, 4], [10, 7], [9, 8], [4, 12], [11, 12]]) px(x, y, '#0e0804');
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
      } else if (kind === 'yengec') { // yengeç: yan yan koşar
        const c = frame ? 1 : 0;
        for (const sx of [2, 13]) for (const y of [10, 12, 14]) px(sx + (sx === 2 ? c : -c), y, '#7a2a12');
        disc(8, 10.5, 5.5, '#5a1e0c', 4.2); disc(8, 10, 4.8, '#d8542a', 3.6); disc(6.5, 9, 1.6, '#f08860');
        rect(2, 4 + c, 3, 3, '#d8542a'); rect(11, 4 - c + 1, 3, 3, '#d8542a'); px(3, 4 + c, '#5a1e0c'); px(12, 5 - c, '#5a1e0c');
        rect(6, 4, 1, 3, '#5a1e0c'); rect(9, 4, 1, 3, '#5a1e0c'); px(6, 3, '#fff'); px(9, 3, '#fff'); px(6, 4, '#111'); px(9, 4, '#111');
      } else if (kind === 'marti') {  // martı: sandıkların üstünden uçar
        const up = frame ? 1 : 0;
        for (let k = 0; k < 6; k++) { px(1 + k, 7 - (up ? k >> 1 : 0) + (up ? 0 : k >> 2), '#e8ecf0'); px(14 - k, 7 - (up ? k >> 1 : 0) + (up ? 0 : k >> 2), '#e8ecf0'); }
        px(1, up ? 7 : 8, '#5a6068'); px(14, up ? 7 : 8, '#5a6068'); px(2, up ? 7 : 8, '#5a6068'); px(13, up ? 7 : 8, '#5a6068');
        disc(8, 8.5, 2.6, '#f4f6f8', 3.6); rect(7, 12, 2, 2, '#c8ccd0');
        px(7, 6, '#1c1622'); px(9, 6, '#1c1622'); rect(7, 3, 2, 2, '#f0b030'); px(8, 2, '#f0b030');
      } else if (kind === 'yarasa') { // yarasa: hızlı, kararsız
        const up = frame ? 1 : 0;
        const wing = up ? [[1, 4], [2, 5], [3, 5], [4, 6], [5, 6]] : [[1, 10], [2, 9], [3, 9], [4, 8], [5, 8]];
        for (const [x, y] of wing) { rect(x, y, 1, 3, '#7a5aa8'); rect(15 - x, y, 1, 3, '#7a5aa8'); px(x, y, '#c8b0f0'); px(15 - x, y, '#c8b0f0'); }
        disc(8, 8, 3.6, '#2a1a3a'); disc(8, 8, 3, '#9a7ac8'); px(7, 7, '#ff3020'); px(9, 7, '#ff3020'); px(6, 4, '#9a7ac8'); px(10, 4, '#9a7ac8');
        px(7, 10, '#e8e0d0'); px(9, 10, '#e8e0d0');
      } else if (kind === 'robot') {  // robot: inatla kovalar
        const c = frame ? 1 : 0;
        rect(3, 3, 10, 9, '#3a4048'); rect(4, 4, 8, 7, '#8a94a0'); rect(4, 4, 8, 1, '#b4bec8');
        rect(5, 6, 6, 2, '#1c1622'); rect(6 + c * 2, 6, 2, 2, '#ff5a3a');
        rect(7, 1, 2, 2, '#5a646e'); px(7 + c, 0, '#e0c040');
        rect(3, 12, 10, 3, '#2a2e34'); for (let x = 3 + c; x < 13; x += 2) px(x, 13, '#6a7078');
      } else if (kind === 'kivilcim') { // kıvılcım: çok hızlı
        const r = frame ? 6 : 5;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
          for (let k = 2; k <= (Math.abs(dx) === Math.abs(dy) ? r - 1 : r); k++) px(Math.round(8 + dx * k), Math.round(8 + dy * k), k > 3 ? '#f0a020' : '#ffe060');
        }
        disc(8, 8, 2.6, '#fff8d0'); px(7, 7, '#1c1622'); px(9, 7, '#1c1622');
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

  // ---------- patronlar (32×32) ----------
  function boss(kind, frame) {
    return memo(`boss${kind}${frame}`, () => mk(32, 32, ({ rect, px, disc }) => {
      const f = frame % 2;
      const tread = (y) => { rect(2, y, 28, 6, '#22252a'); rect(3, y + 1, 26, 4, '#3a3e44'); for (let x = 4 + f * 2; x < 28; x += 4) rect(x, y + 1, 2, 4, '#55595f'); };
      if (kind === 'kepce') {          // dev kepçe
        tread(25);
        rect(5, 12, 20, 13, '#c89a1a'); rect(5, 12, 20, 2, '#f0c848'); rect(23, 12, 2, 13, '#8a6a10');
        rect(7, 5, 11, 9, '#c89a1a'); rect(8, 6, 9, 6, '#6ab0d0'); rect(8, 6, 3, 2, '#c0e8f8');
        rect(10, 15, 10, 2, '#2a2830'); for (let x = 10; x < 20; x += 4) rect(x, 15, 2, 2, '#e0b020');
        rect(24, 6 + f, 3, 12, '#a07a14'); rect(25, 4 + f, 6, 4, '#a07a14');
        rect(25, 0 + f, 7, 6, '#6a6e74'); for (let x = 26; x < 32; x += 2) px(x, 6 + f, '#d8dce0');
        px(9, 8, '#1c1622'); px(14, 8, '#1c1622'); rect(10, 10, 5, 1, '#1c1622');
      } else if (kind === 'yengec') {  // dev yengeç
        for (const sx of [4, 27]) for (const y of [18, 22, 26]) { rect(sx + (sx === 4 ? -f : f), y, 2, 2, '#7a2a12'); }
        disc(16, 19, 12, '#5a1e0c', 9); disc(16, 18.5, 11, '#d8542a', 8.2); disc(11, 15, 4, '#f08860', 2.5);
        for (const sx of [1, 23]) { rect(sx, 3 + (sx === 1 ? f : -f) + 2, 8, 7, '#d8542a'); rect(sx + 3, 3 + (sx === 1 ? f : -f) + 2, 2, 4, '#5a1e0c'); }
        rect(11, 6, 2, 6, '#5a1e0c'); rect(19, 6, 2, 6, '#5a1e0c'); disc(12, 5.5, 2.2, '#fff'); disc(20, 5.5, 2.2, '#fff'); px(12, 6, '#111'); px(20, 6, '#111');
        rect(12, 21, 8, 1, '#5a1e0c');
      } else if (kind === 'matkap') {  // dev matkap
        tread(25);
        rect(4, 10, 18, 15, '#6a6e78'); rect(4, 10, 18, 2, '#9a9ea8'); rect(6, 13, 8, 6, '#2e3a46'); rect(7, 14, 3, 2, '#7ac0e0');
        for (let k = 0; k < 10; k++) rect(22 + k, 12 + (k >> 1), 1, 11 - k, ((k + f * 2) >> 1) % 2 ? '#c8ccd2' : '#7a7e86');
        rect(8, 4, 8, 7, '#d0a020'); rect(8, 4, 8, 1, '#f0c848'); px(10, 7, '#1c1622'); px(14, 7, '#1c1622');
      } else if (kind === 'pres') {    // pres makinesi
        rect(3, 2, 26, 6, '#4a5a64'); rect(3, 2, 26, 1, '#7a8a94');
        rect(6, 8, 3, 8 + f * 3, '#9aa4ac'); rect(23, 8, 3, 8 + f * 3, '#9aa4ac');
        rect(2, 14 + f * 3, 28, 14 - f * 3, '#5a6a74'); rect(2, 14 + f * 3, 28, 2, '#8a9aa4');
        rect(8, 18 + f * 3, 16, 5, '#1c2228'); rect(10, 19 + f * 3, 4, 3, '#ff5030'); rect(18, 19 + f * 3, 4, 3, '#ff5030');
        for (let x = 2; x < 30; x++) if (((x >> 1) & 1)) px(x, 29, '#e0b020'); else px(x, 29, '#1c1622');
      } else {                         // yıkım robotu
        rect(8, 22, 6, 8, '#3a3e44'); rect(18, 22, 6, 8, '#3a3e44'); rect(7, 29, 8, 3, '#22252a'); rect(17, 29, 8, 3, '#22252a');
        rect(6, 10, 20, 13, '#8a2e22'); rect(6, 10, 20, 2, '#b8483a'); rect(13, 13, 6, 6, '#e0b020'); disc(16, 16, 2, '#1c1622');
        rect(9, 1, 14, 9, '#6a727c'); rect(9, 1, 14, 1, '#9aa2ac'); rect(11, 4, 10, 3, '#1c1622'); rect(12 + f * 5, 4, 3, 3, '#ff4030');
        rect(1, 11 + f, 5, 4, '#6a727c'); rect(26, 11 - f + 1, 5, 4, '#6a727c');
        disc(3, 20 + f * 2, 3.5, '#2a2e34'); disc(29, 20 - f * 2 + 2, 3.5, '#2a2e34');
      }
    }));
  }
  const bossFlash = (kind, frame) => memo(`bossf${kind}${frame}`, () => silhouette(boss(kind, frame)));

  window.BUS = { T, PLAYER_COLORS, player, playerFlash, helmetIcon, floor, floorShadow, pillar, extra, border, crate, bomb, flame, item, door, enemy, enemyFlash, boss, bossFlash, mk };
})();
