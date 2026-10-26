// Bomba Ustası — oyun çekirdeği.
// Çizimden ve girişten bağımsızdır: tarayıcıda window.BU olarak, Node
// testlerinde vm ile yüklenir. Konumlar karo birimindedir; (x, y) karonun
// merkezidir, yani tam sayı konum = karonun tam ortası.
(function (root) {
  'use strict';

  const COLS = 15, ROWS = 13, N = COLS * ROWS;
  const FLOOR = 0, WALL = 1, CRATE = 2;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIR_LIST = ['up', 'down', 'left', 'right'];
  // Alev maskesi: alevin karodan hangi yönlere uzandığı (çizim için).
  const ARM = { left: 1, right: 2, up: 4, down: 8 }, CORE = 16;
  const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const ITEMS = ['bomb', 'fire', 'speed', 'helmet'];

  const RULES = {
    bombTime: 2.4,       // fitilin yanma süresi (s)
    flameTime: 0.55,     // alevin karoda kalma süresi
    crumbleTime: 0.4,    // sandığın parçalanma süresi (bu sürede hâlâ engel)
    chainDelay: 0.07,    // alev değen bombanın patlama gecikmesi
    speed: 3.0,          // karo/s
    speedStep: 0.45,
    maxSpeedUps: 5,
    maxBombs: 8, maxFire: 8,
    startBombs: 1, startFire: 2,
    deathTime: 1.2,
    invulnTime: 2.0,     // kask kırılınca kısa dokunulmazlık
    hitBox: 0.62,        // düşman–oyuncu çarpışma mesafesi
    battleTime: 90,      // kapışma turu; sonra alan daralır
    shrinkStep: 0.22,
    winsNeeded: 3,
    roundEndTime: 2.6,
    stageClearTime: 2.4,
    startLives: 3,
  };

  const ENEMY = {
    bocek:    { speed: 1.35, points: 100, turn: 0.15, chase: 0,    wallpass: false },
    toz:      { speed: 2.3,  points: 200, turn: 0.45, chase: 0,    wallpass: false },
    kostebek: { speed: 1.7,  points: 400, turn: 0.2,  chase: 0.65, wallpass: true },
  };

  const idx = (x, y) => y * COLS + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- harita ----------
  function baseGrid() {
    const g = new Uint8Array(N);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) g[idx(x, y)] = WALL;
    }
    return g;
  }

  const CORNERS = [[1, 1], [COLS - 2, ROWS - 2], [COLS - 2, 1], [1, ROWS - 2]];
  function clearAround(set, x, y) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) set.add(idx(x + dx, y + dy));
  }

  function storyParams(stage) {
    const s = stage - 1;
    return {
      density: Math.min(0.62, 0.4 + s * 0.012),
      enemies: Math.min(10, 3 + Math.floor(s * 0.6)),
      kinds: s < 2 ? ['bocek'] : s < 5 ? ['bocek', 'bocek', 'toz'] : ['bocek', 'toz', 'kostebek'],
      items: [['fire', 'bomb', 'speed', 'bomb', 'fire', 'helmet'][s % 6]].concat(s % 3 === 2 ? ['bomb'] : []),
    };
  }

  // ---------- oyun nesnesi ----------
  function newPlayer(id, x, y, opts = {}) {
    return {
      id, x, y, sx: x, sy: y, dir: 'down', alive: true, dying: 0, inv: 0, walkT: 0, moving: false,
      bombs: RULES.startBombs, fire: RULES.startFire, speedUps: 0, helmet: false, bombsOut: 0,
      cpu: !!opts.cpu, wins: opts.wins || 0, input: { dir: null, bomb: false }, ai: { t: 0, path: null },
    };
  }

  function emptyLevel(G) {
    G.grid = baseGrid();
    G.itemAt = new Int8Array(N).fill(-1);
    G.revealed = new Uint8Array(N);
    G.flameT = new Float32Array(N);
    G.flameMask = new Uint8Array(N);
    G.crumble = new Float32Array(N);
    G.bombs = []; G.enemies = [];
    G.door = -1; G.doorOpen = false;
    G.shrinkT = 0; G.shrinkI = 0; G.shrinkOrder = null;
  }

  function hideItems(G, r, kinds, candidates) {
    for (const k of kinds) {
      if (!candidates.length) return;
      const i = candidates.splice(Math.floor(r() * candidates.length), 1)[0];
      G.itemAt[i] = ITEMS.indexOf(k);
    }
  }

  function setupStory(G, stage, keep) {
    const r = mulberry32(stage * 7919 + 13);
    emptyLevel(G);
    G.mode = 'story'; G.stage = stage;
    const p = G.players[0] || newPlayer(0, 1, 1);
    const fresh = newPlayer(0, 1, 1);
    if (keep) for (const k of ['bombs', 'fire', 'speedUps', 'helmet']) fresh[k] = p[k];
    G.players = [fresh];
    const P = storyParams(stage), clear = new Set();
    clearAround(clear, 1, 1); clear.add(idx(1, 3)); clear.add(idx(3, 1));
    const crates = [];
    for (let i = 0; i < N; i++) {
      if (G.grid[i] !== FLOOR || clear.has(i)) continue;
      if (r() < P.density) { G.grid[i] = CRATE; crates.push(i); }
    }
    // Kapı: başlangıçtan uzak bir sandığın altında.
    const far = crates.filter((i) => (i % COLS) + Math.floor(i / COLS) > 8);
    const pool = far.length ? far : crates;
    G.door = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const rest = crates.filter((i) => i !== G.door);
    hideItems(G, r, P.items, rest);
    // Düşmanlar: boş karolarda, oyuncudan uzakta.
    const free = [];
    for (let i = 0; i < N; i++) {
      const x = i % COLS, y = Math.floor(i / COLS);
      if (G.grid[i] === FLOOR && x + y >= 7) free.push(i);
    }
    for (let k = 0; k < P.enemies && free.length; k++) {
      const i = free.splice(Math.floor(r() * free.length), 1)[0];
      const kind = P.kinds[Math.floor(r() * P.kinds.length)];
      G.enemies.push(newEnemy(kind, i % COLS, Math.floor(i / COLS), r));
    }
    G.phase = 'intro'; G.phaseT = 1.8;
    G.rand = mulberry32(stage * 104729 + 7);
  }

  function newEnemy(kind, x, y, r) {
    const d = ENEMY[kind];
    return { kind, x, y, tx: x, ty: y, dir: DIR_LIST[Math.floor(r() * 4)], alive: true, dying: 0, anim: r() * 4, ...d };
  }

  // slots: [{cpu:bool} | null] × 4 — null kapalı.
  function setupBattle(G, slots, round, seed) {
    const r = mulberry32((seed || 1) * 31337 + round * 977);
    emptyLevel(G);
    G.mode = 'battle'; G.round = round;
    const prev = G.players || [];
    G.players = [];
    const clear = new Set();
    slots.forEach((s, i) => {
      if (!s) return;
      const [x, y] = CORNERS[i];
      const old = prev.find((p) => p.id === i);
      G.players.push(newPlayer(i, x, y, { cpu: s.cpu, wins: old ? old.wins : 0 }));
      clearAround(clear, x, y);
    });
    // Köşelerde kaçış yolu: L biçimi boş kalır.
    for (const [x, y] of CORNERS) { clear.add(idx(x, y + (y === 1 ? 2 : -2))); clear.add(idx(x + (x === 1 ? 2 : -2), y)); }
    const crates = [];
    for (let i = 0; i < N; i++) {
      if (G.grid[i] !== FLOOR || clear.has(i)) continue;
      if (r() < 0.72) { G.grid[i] = CRATE; crates.push(i); }
    }
    const kinds = [];
    const nItems = Math.round(crates.length * 0.34);
    for (let k = 0; k < nItems; k++) {
      const v = r();
      kinds.push(v < 0.4 ? 'bomb' : v < 0.75 ? 'fire' : v < 0.9 ? 'speed' : 'helmet');
    }
    hideItems(G, r, kinds, crates.slice());
    G.battleT = RULES.battleTime;
    G.shrinkOrder = spiralOrder();
    G.phase = 'intro'; G.phaseT = 1.5;
    G.rand = mulberry32((seed || 1) * 7 + round);
  }

  // Dıştan içe sarmal: alan daralırken sırayla duvar olacak iç karolar.
  function spiralOrder() {
    const out = [];
    let x0 = 1, y0 = 1, x1 = COLS - 2, y1 = ROWS - 2;
    while (x0 <= x1 && y0 <= y1) {
      for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
      for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
      if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
      if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
      x0++; y0++; x1--; y1--;
    }
    // Ortadaki son birkaç karo boş kalsın.
    return out.slice(0, out.length - 9);
  }

  function create() {
    const G = { players: [], events: [], time: 0, score: 0, lives: RULES.startLives, stage: 1, mode: 'story', phase: 'intro', phaseT: 0 };
    emptyLevel(G);
    return G;
  }

  // ---------- sorgular ----------
  const bombAt = (G, x, y) => G.bombs.find((b) => b.x === x && b.y === y);
  const tileOf = (e) => [Math.round(e.x), Math.round(e.y)];

  function playerCanEnter(G, p, x, y) {
    if (!inside(x, y) || G.grid[idx(x, y)] !== FLOOR) return false;
    const b = bombAt(G, x, y);
    return !b || b.pass.has(p.id);
  }
  function enemyCanEnter(G, e, x, y) {
    if (!inside(x, y)) return false;
    const t = G.grid[idx(x, y)];
    if (t === WALL || (t === CRATE && !e.wallpass)) return false;
    return !bombAt(G, x, y);
  }

  // ---------- oyuncu hareketi ----------
  // Karo ızgarasında hareket + köşe yardımı: oyuncu koridora tam hizalı
  // değilse ve gitmek istediği yön açıksa kendiliğinden hizaya kayar.
  function stepAxis(G, p, a, s, dist) {
    const b = a === 'x' ? 'y' : 'x';
    const open = (ta, tb) => (a === 'x' ? playerCanEnter(G, p, ta, tb) : playerCanEnter(G, p, tb, ta));
    for (let guard = 0; guard < 8 && dist > 1e-6; guard++) {
      const lane = Math.round(p[b]), off = p[b] - lane;
      const ca = Math.round(p[a]);
      const toCenter = (ca - p[a]) * s; // + ise karonun ortası ileride
      if (Math.abs(off) < 1e-4) {
        p[b] = lane;
        const room = open(ca + s, lane) ? toCenter + 1 : Math.max(0, toCenter);
        const m = Math.min(dist, room);
        if (m <= 1e-6) return false;
        p[a] += s * m; dist -= m;
        continue;
      }
      const sg = off > 0 ? 1 : -1, nb = lane + sg;
      const fl = open(ca + s, lane), fn = open(ca + s, nb);
      if (fl && fn) {
        const m = Math.min(dist, toCenter + 1);
        p[a] += s * m; dist -= m;
      } else if (fl) {
        const m = Math.min(dist, Math.abs(off));
        p[b] -= sg * m; dist -= m;
      } else if (fn && Math.abs(off) > 0.3) {
        const m = Math.min(dist, 1 - Math.abs(off));
        p[b] += sg * m; dist -= m;
      } else {
        const m = Math.min(dist, Math.max(0, toCenter));
        if (m <= 1e-6) return false;
        p[a] += s * m; dist -= m;
      }
    }
    return true;
  }

  const speedOf = (p) => RULES.speed + p.speedUps * RULES.speedStep;

  function movePlayer(G, p, dt) {
    const d = p.input.dir;
    p.moving = false;
    if (!d || !DIRS[d]) return;
    p.dir = d;
    const [dx, dy] = DIRS[d];
    const ox = p.x, oy = p.y;
    if (dx) stepAxis(G, p, 'x', dx, speedOf(p) * dt);
    else stepAxis(G, p, 'y', dy, speedOf(p) * dt);
    p.moving = Math.abs(p.x - ox) + Math.abs(p.y - oy) > 1e-6;
    if (p.moving) p.walkT += dt;
  }

  // ---------- bombalar ve alev ----------
  function placeBomb(G, p) {
    const [x, y] = tileOf(p);
    if (p.bombsOut >= p.bombs || bombAt(G, x, y) || G.grid[idx(x, y)] !== FLOOR) return false;
    const pass = new Set();
    for (const q of G.players) if (q.alive && Math.abs(q.x - x) < 1 && Math.abs(q.y - y) < 1) pass.add(q.id);
    G.bombs.push({ x, y, t: RULES.bombTime, fire: p.fire, owner: p.id, pass, age: 0 });
    p.bombsOut++;
    G.events.push({ type: 'place', x, y });
    return true;
  }

  function addFlame(G, i, mask) {
    G.flameT[i] = RULES.flameTime;
    G.flameMask[i] |= mask;
  }

  function explode(G, b) {
    G.bombs.splice(G.bombs.indexOf(b), 1);
    const owner = G.players.find((p) => p.id === b.owner);
    if (owner) owner.bombsOut = Math.max(0, owner.bombsOut - 1);
    let core = CORE;
    for (const d of DIR_LIST) {
      const [dx, dy] = DIRS[d];
      let px = b.x, py = b.y;
      for (let k = 1; k <= b.fire; k++) {
        const x = b.x + dx * k, y = b.y + dy * k;
        if (!inside(x, y)) break;
        const i = idx(x, y), t = G.grid[i];
        if (t === WALL) break;
        // Bu yöne uzanabiliyoruz: önceki karo bu yöne, bu karo geri yöne bağlanır.
        if (k === 1) core |= ARM[d]; else G.flameMask[idx(px, py)] |= ARM[d];
        if (t === CRATE) {
          addFlame(G, i, ARM[OPP[d]]);
          if (G.crumble[i] <= 0) { G.crumble[i] = RULES.crumbleTime; G.events.push({ type: 'crate', x, y }); }
          break;
        }
        addFlame(G, i, ARM[OPP[d]]);
        const other = bombAt(G, x, y);
        if (other) { other.t = Math.min(other.t, RULES.chainDelay); break; }
        if (G.revealed[i] && G.itemAt[i] >= 0) { G.itemAt[i] = -1; G.revealed[i] = 0; G.events.push({ type: 'burn', x, y }); break; }
        px = x; py = y;
      }
    }
    addFlame(G, idx(b.x, b.y), core);
    G.events.push({ type: 'boom', x: b.x, y: b.y });
  }

  function updateBombs(G, dt) {
    for (const b of G.bombs) {
      b.t -= dt; b.age += dt;
      // Bombadan çıkan oyuncu bir daha üstüne basamaz.
      for (const id of [...b.pass]) {
        const p = G.players.find((q) => q.id === id);
        if (!p || !p.alive || Math.abs(p.x - b.x) >= 1 || Math.abs(p.y - b.y) >= 1) b.pass.delete(id);
      }
      // Alev değen bomba hemen patlar.
      if (G.flameT[idx(b.x, b.y)] > 0) b.t = Math.min(b.t, RULES.chainDelay);
    }
    let guard = 0, due;
    while ((due = G.bombs.find((b) => b.t <= 0)) && guard++ < 64) explode(G, due);
  }

  function updateTiles(G, dt) {
    for (let i = 0; i < N; i++) {
      if (G.flameT[i] > 0) { G.flameT[i] -= dt; if (G.flameT[i] <= 0) { G.flameT[i] = 0; G.flameMask[i] = 0; } }
      if (G.crumble[i] > 0) {
        G.crumble[i] -= dt;
        if (G.crumble[i] <= 0) {
          G.crumble[i] = 0; G.grid[i] = FLOOR;
          if (G.itemAt[i] >= 0) G.revealed[i] = 1;
          if (i === G.door) { G.doorShown = true; G.events.push({ type: 'door' }); }
        }
      }
    }
  }

  // ---------- hasar ----------
  function hurtPlayer(G, p, cause) {
    if (!p.alive || p.inv > 0) return;
    if (p.helmet) { p.helmet = false; p.inv = RULES.invulnTime; G.events.push({ type: 'helmet', id: p.id }); return; }
    p.alive = false; p.dying = RULES.deathTime; p.input.dir = null;
    G.events.push({ type: 'die', id: p.id, cause });
  }

  function checkHits(G) {
    for (const p of G.players) {
      if (!p.alive) continue;
      const [x, y] = tileOf(p);
      if (G.flameT[idx(x, y)] > 0) hurtPlayer(G, p, 'flame');
    }
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const [x, y] = tileOf(e);
      if (G.flameT[idx(x, y)] > 0) {
        e.alive = false; e.dying = 0.9; G.score += e.points;
        G.events.push({ type: 'enemy', x: e.x, y: e.y, points: e.points });
        continue;
      }
      for (const p of G.players) {
        if (p.alive && Math.abs(p.x - e.x) < RULES.hitBox && Math.abs(p.y - e.y) < RULES.hitBox) hurtPlayer(G, p, 'enemy');
      }
    }
  }

  function pickUp(G, p) {
    const [x, y] = tileOf(p), i = idx(x, y);
    if (!G.revealed[i] || G.itemAt[i] < 0 || Math.abs(p.x - x) > 0.45 || Math.abs(p.y - y) > 0.45) return;
    const k = ITEMS[G.itemAt[i]];
    if (k === 'bomb') p.bombs = Math.min(RULES.maxBombs, p.bombs + 1);
    if (k === 'fire') p.fire = Math.min(RULES.maxFire, p.fire + 1);
    if (k === 'speed') p.speedUps = Math.min(RULES.maxSpeedUps, p.speedUps + 1);
    if (k === 'helmet') p.helmet = true;
    G.itemAt[i] = -1; G.revealed[i] = 0;
    if (G.mode === 'story') G.score += 50;
    G.events.push({ type: 'pickup', kind: k, id: p.id });
  }

  // ---------- düşmanlar ----------
  function nearestPlayer(G, e) {
    let best = null, bd = Infinity;
    for (const p of G.players) if (p.alive) { const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  function enemyChoose(G, e) {
    const r = G.rand;
    const opts = DIR_LIST.filter((d) => enemyCanEnter(G, e, e.tx + DIRS[d][0], e.ty + DIRS[d][1]));
    if (!opts.length) return null;
    if (e.chase && r() < e.chase) {
      const p = nearestPlayer(G, e);
      if (p && Math.abs(p.x - e.x) + Math.abs(p.y - e.y) < 7) {
        const pref = opts.filter((d) => (DIRS[d][0] && Math.sign(p.x - e.x) === DIRS[d][0]) || (DIRS[d][1] && Math.sign(p.y - e.y) === DIRS[d][1]));
        if (pref.length) return pref[Math.floor(r() * pref.length)];
      }
    }
    const forward = opts.includes(e.dir);
    if (forward && r() > e.turn) return e.dir;
    const noBack = opts.filter((d) => d !== OPP[e.dir]);
    const pool = noBack.length ? noBack : opts;
    return pool[Math.floor(r() * pool.length)];
  }

  function moveEnemy(G, e, dt) {
    e.anim += dt;
    let dist = e.speed * dt;
    for (let guard = 0; guard < 4 && dist > 1e-6; guard++) {
      if (Math.abs(e.x - e.tx) < 1e-6 && Math.abs(e.y - e.ty) < 1e-6) {
        e.x = e.tx; e.y = e.ty;
        const d = enemyChoose(G, e);
        if (!d) return;
        e.dir = d; e.tx += DIRS[d][0]; e.ty += DIRS[d][1];
      } else if (!enemyCanEnter(G, e, e.tx, e.ty) && Math.hypot(e.tx - e.x, e.ty - e.y) > 0.5) {
        // Yol kapandı (önüne bomba kondu): geri dön.
        e.tx -= DIRS[e.dir][0]; e.ty -= DIRS[e.dir][1]; e.dir = OPP[e.dir];
      }
      const rx = e.tx - e.x, ry = e.ty - e.y, len = Math.abs(rx) + Math.abs(ry);
      const m = Math.min(dist, len);
      if (len > 0) { e.x += (rx / len) * m; e.y += (ry / len) * m; }
      dist -= m;
    }
  }

  // ---------- bilgisayar oyuncusu ----------
  function blastTiles(G, x, y, fire, extraBombs) {
    const out = [idx(x, y)];
    const hasBomb = (bx, by) => bombAt(G, bx, by) || (extraBombs && extraBombs.some((b) => b.x === bx && b.y === by));
    for (const d of DIR_LIST) {
      const [dx, dy] = DIRS[d];
      for (let k = 1; k <= fire; k++) {
        const tx = x + dx * k, ty = y + dy * k;
        if (!inside(tx, ty)) break;
        const i = idx(tx, ty), t = G.grid[i];
        if (t === WALL) break;
        out.push(i);
        if (t === CRATE || hasBomb(tx, ty)) break;
      }
    }
    return out;
  }

  // Her karonun en erken ne zaman alev alacağı (zincirleme dahil).
  function dangerMap(G, extra) {
    const D = new Float32Array(N).fill(Infinity);
    for (let i = 0; i < N; i++) if (G.flameT[i] > 0) D[i] = 0;
    const bombs = G.bombs.map((b) => ({ x: b.x, y: b.y, fire: b.fire, t: b.t })).concat(extra || []);
    const tiles = bombs.map((b) => blastTiles(G, b.x, b.y, b.fire, extra));
    for (let pass = 0; pass < 4; pass++) {
      for (let a = 0; a < bombs.length; a++) for (const i of tiles[a]) {
        for (const c of bombs) if (idx(c.x, c.y) === i && c.t > bombs[a].t) c.t = bombs[a].t;
      }
    }
    bombs.forEach((b, a) => { for (const i of tiles[a]) D[i] = Math.min(D[i], Math.max(0, b.t)); });
    return D;
  }

  // Güvenli olduğu sürece adım adım arama; hedef bulununca yol döner.
  function bfs(G, p, D, goal, maxLen = 40, extraBlock) {
    const [sx, sy] = tileOf(p), start = idx(sx, sy), sp = speedOf(p);
    const prev = new Int16Array(N).fill(-1), dist = new Int16Array(N).fill(-1);
    dist[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (i !== start && goal(i)) {
        const path = [];
        for (let k = i; k !== start; k = prev[k]) path.unshift(k);
        return path;
      }
      if (dist[i] >= maxLen) continue;
      const x = i % COLS, y = (i - x) / COLS;
      for (const d of DIR_LIST) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (!inside(nx, ny)) continue;
        const j = idx(nx, ny);
        if (dist[j] >= 0 || G.grid[j] !== FLOOR || bombAt(G, nx, ny) || (extraBlock && extraBlock.has(j))) continue;
        // O karoya varınca alev içinde olmayacak mıyız?
        const arrive = (dist[i] + 1) / sp;
        if (D[j] < Infinity && arrive > D[j] - 0.25 && arrive < D[j] + RULES.flameTime + 0.2) continue;
        dist[j] = dist[i] + 1; prev[j] = i; q.push(j);
      }
    }
    return null;
  }

  function aiThink(G, p, dt) {
    const ai = p.ai, r = G.rand;
    p.input.bomb = false;
    const [tx, ty] = tileOf(p);
    const here = idx(tx, ty);
    const centered = Math.abs(p.x - tx) < 0.06 && Math.abs(p.y - ty) < 0.06;
    ai.t -= dt;
    // Yoldaki sıradaki karoya vardıysak onu düş.
    if (ai.path && ai.path.length && ai.path[0] === here && centered) ai.path.shift();
    if (ai.t > 0 && ai.path && ai.path.length) { steer(p, ai.path[0]); return; }
    ai.t = 0.1 + r() * 0.12;
    const D = dangerMap(G);
    if (D[here] < Infinity) {
      ai.path = bfs(G, p, D, (i) => D[i] === Infinity) || ai.path;
      if (ai.path && ai.path.length) steer(p, ai.path[0]); else p.input.dir = null;
      return;
    }
    if (!centered && ai.path && ai.path.length) { steer(p, ai.path[0]); return; }
    // Bomba koymaya değer mi? (sandık ya da rakip menzilde ve kaçış yolu var)
    if (p.bombsOut < p.bombs && !bombAt(G, tx, ty)) {
      const hits = blastTiles(G, tx, ty, p.fire);
      const crate = hits.some((i) => G.grid[i] === CRATE && G.crumble[i] <= 0);
      const foe = G.players.some((q) => q !== p && q.alive && hits.includes(idx(Math.round(q.x), Math.round(q.y))));
      if ((crate && r() < 0.85) || (foe && r() < 0.7)) {
        const extra = [{ x: tx, y: ty, fire: p.fire, t: RULES.bombTime }];
        const D2 = dangerMap(G, extra);
        const esc = bfs(G, p, D2, (i) => D2[i] === Infinity, 10);
        if (esc && esc.length / speedOf(p) < RULES.bombTime - 0.6) {
          p.input.bomb = true; ai.path = esc; steer(p, esc[0]); ai.t = 0.25; return;
        }
      }
    }
    // Hedef: yakındaki ödül, sonra bomba koyulacak yer, sonra rakip.
    const safe = (i) => D[i] === Infinity;
    let path = bfs(G, p, D, (i) => safe(i) && G.revealed[i] && G.itemAt[i] >= 0, 8);
    if (!path) path = bfs(G, p, D, (i) => {
      if (!safe(i)) return false;
      const x = i % COLS, y = (i - x) / COLS;
      return blastTiles(G, x, y, p.fire).some((j) => (G.grid[j] === CRATE && G.crumble[j] <= 0) || G.players.some((q) => q !== p && q.alive && idx(Math.round(q.x), Math.round(q.y)) === j));
    }, 14);
    if (!path) {
      const foe = G.players.filter((q) => q !== p && q.alive)[0];
      if (foe) { const fi = idx(Math.round(foe.x), Math.round(foe.y)); path = bfs(G, p, D, (i) => i === fi || (safe(i) && Math.abs(i % COLS - foe.x) + Math.abs(Math.floor(i / COLS) - foe.y) <= 1), 30); }
    }
    if (!path && r() < 0.3) {
      const opts = DIR_LIST.filter((d) => { const nx = tx + DIRS[d][0], ny = ty + DIRS[d][1]; return playerCanEnter(G, p, nx, ny) && safe(idx(nx, ny)); });
      if (opts.length) { const d = opts[Math.floor(r() * opts.length)]; path = [idx(tx + DIRS[d][0], ty + DIRS[d][1])]; }
    }
    ai.path = path;
    if (path && path.length) steer(p, path[0]); else p.input.dir = null;
  }

  function steer(p, target) {
    const x = target % COLS, y = (target - x) / COLS;
    const dx = x - p.x, dy = y - p.y;
    if (Math.abs(dx) < 0.04 && Math.abs(dy) < 0.04) { p.input.dir = null; return; }
    // Önce dik eksende hizalan, sonra ilerle.
    if (Math.abs(dx) > Math.abs(dy)) p.input.dir = dx > 0 ? 'right' : 'left';
    else p.input.dir = dy > 0 ? 'down' : 'up';
  }

  // ---------- kapışma: daralan alan ----------
  function updateShrink(G, dt) {
    if (G.mode !== 'battle') return;
    G.battleT -= dt;
    if (G.battleT > 0 || !G.shrinkOrder) return;
    G.shrinkT -= dt;
    while (G.shrinkT <= 0 && G.shrinkI < G.shrinkOrder.length) {
      G.shrinkT += RULES.shrinkStep;
      const i = G.shrinkOrder[G.shrinkI++];
      if (G.grid[i] === WALL) continue;
      const x = i % COLS, y = (i - x) / COLS;
      G.grid[i] = WALL; G.itemAt[i] = -1; G.revealed[i] = 0; G.crumble[i] = 0;
      const b = bombAt(G, x, y);
      if (b) { G.bombs.splice(G.bombs.indexOf(b), 1); const o = G.players.find((p) => p.id === b.owner); if (o) o.bombsOut = Math.max(0, o.bombsOut - 1); }
      for (const p of G.players) if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { p.helmet = false; p.inv = 0; hurtPlayer(G, p, 'shrink'); }
      G.events.push({ type: 'shrink', x, y });
    }
  }

  // ---------- ana adım ----------
  function update(G, dt) {
    if (G.paused) return;
    G.time += dt;
    if (G.phase === 'intro') {
      G.phaseT -= dt;
      for (const p of G.players) p.input.bomb = false;
      if (G.phaseT <= 0) G.phase = 'play';
      return;
    }
    if (G.phase === 'over' || G.phase === 'matchEnd') return;

    for (const p of G.players) {
      if (p.alive) {
        if (p.inv > 0) p.inv -= dt;
        if (G.phase === 'play') {
          if (p.cpu) aiThink(G, p, dt);
          movePlayer(G, p, dt);
          if (p.input.bomb) placeBomb(G, p);
          pickUp(G, p);
        }
        p.input.bomb = false;
      } else if (p.dying > 0) p.dying -= dt;
    }
    updateBombs(G, dt);
    updateTiles(G, dt);
    for (const e of G.enemies) {
      if (e.alive && G.phase === 'play') moveEnemy(G, e, dt);
      else if (!e.alive && e.dying > 0) e.dying -= dt;
    }
    if (G.phase === 'play') { checkHits(G); updateShrink(G, dt); }

    if (G.mode === 'story') storyFlow(G, dt); else battleFlow(G, dt);
  }

  function storyFlow(G, dt) {
    const p = G.players[0];
    const enemiesLeft = G.enemies.some((e) => e.alive);
    if (!enemiesLeft && !G.doorOpen) { G.doorOpen = true; G.events.push({ type: 'doorOpen' }); }
    if (G.phase === 'play') {
      if (p.alive && G.doorOpen && G.door >= 0 && G.grid[G.door] === FLOOR && idx(...tileOf(p)) === G.door &&
          Math.abs(p.x - Math.round(p.x)) < 0.3 && Math.abs(p.y - Math.round(p.y)) < 0.3) {
        G.phase = 'clear'; G.phaseT = RULES.stageClearTime; G.score += 1000;
        G.events.push({ type: 'clear', stage: G.stage });
      } else if (!p.alive) {
        G.phase = 'dead'; G.phaseT = RULES.deathTime + 0.9;
      }
      return;
    }
    G.phaseT -= dt;
    if (G.phaseT > 0) return;
    if (G.phase === 'clear') { setupStory(G, G.stage + 1, true); G.events.push({ type: 'stage', stage: G.stage }); }
    else if (G.phase === 'dead') {
      G.lives--;
      if (G.lives < 0) { G.phase = 'over'; G.events.push({ type: 'over' }); }
      else { setupStory(G, G.stage, false); G.events.push({ type: 'stage', stage: G.stage }); }
    }
  }

  function battleFlow(G, dt) {
    if (G.phase === 'play') {
      const standing = G.players.filter((p) => p.alive);
      const settling = G.players.some((p) => !p.alive && p.dying > 0);
      if (standing.length <= 1 && !settling) {
        G.phase = 'roundEnd'; G.phaseT = RULES.roundEndTime;
        G.winner = standing.length === 1 ? standing[0].id : -1;
        if (standing.length === 1) standing[0].wins++;
        G.events.push({ type: 'roundEnd', winner: G.winner });
      }
      return;
    }
    if (G.phase !== 'roundEnd') return;
    G.phaseT -= dt;
    if (G.phaseT > 0) return;
    const champ = G.players.find((p) => p.wins >= RULES.winsNeeded);
    if (champ) { G.phase = 'matchEnd'; G.champion = champ.id; G.events.push({ type: 'matchEnd', winner: champ.id }); }
    else G.events.push({ type: 'nextRound' });
  }

  const api = {
    COLS, ROWS, N, FLOOR, WALL, CRATE, DIRS, DIR_LIST, ARM, CORE, ITEMS, RULES, ENEMY, CORNERS,
    idx, create, setupStory, setupBattle, storyParams, update, placeBomb, explode, dangerMap, blastTiles,
    bfs, aiThink, movePlayer, playerCanEnter, spiralOrder, mulberry32, speedOf,
  };
  root.BU = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
