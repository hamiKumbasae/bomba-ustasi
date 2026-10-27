// Bölüm ve patron testleri: node tests/levels.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Float32Array, Uint8Array, Int8Array, Int16Array };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['../src/levels.js', '../src/core.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx);
const BU = ctx.BU, L = ctx.BU_LEVELS, WORLDS = ctx.BU_WORLDS;
const { idx, COLS, ROWS, FLOOR, WALL, CRATE, RULES } = BU;

let fails = 0;
const problems = [];
function ok(cond, msg) { if (!cond) { fails++; problems.push(msg); } }
function report(title) { console.log((problems.length ? 'HATA ' : 'ok ') + title + (problems.length ? '\n  ' + problems.splice(0).join('\n  ') : '')); }
const run = (G, sec, step = 1 / 120) => { for (let t = 0; t < sec; t += step) BU.update(G, step); };

// 1) Liste: 50 bölüm, 5 dünya, her 10. bölüm patron
ok(L.length === 50, 'bölüm sayısı ' + L.length);
L.forEach((lv, i) => {
  ok(lv.stage === i + 1, 'sıra ' + lv.stage);
  ok(lv.world === Math.floor(i / 10) + 1, lv.stage + ': dünya ' + lv.world);
  ok(!!lv.boss === ((i + 1) % 10 === 0), lv.stage + ': patron yeri');
  ok(typeof lv.name === 'string' && lv.name.length > 2, lv.stage + ': ad');
  if (lv.boss) ok(!!BU.BOSS[lv.boss], lv.stage + ': bilinmeyen patron ' + lv.boss);
});
ok(WORLDS.length === 5 && WORLDS.every((w) => w.enemies.every((k) => BU.ENEMY[k])), 'dünya düşmanları tanımlı');
report('50 bölüm, 5 dünya, 5 patron');

// 2) Harita yapısı
for (const lv of L) {
  const m = lv.map, s = lv.stage;
  ok(m.length === ROWS && m.every((r) => r.length === COLS), s + ': boyut');
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const ch = m[y][x];
    ok('#X.cDBFSHPZ123'.includes(ch), s + ': bilinmeyen işaret ' + ch);
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) ok(ch === '#', s + ': kenar açık ' + x + ',' + y);
    else if (!lv.boss && x % 2 === 0 && y % 2 === 0) ok(ch === '#', s + ': sütun eksik ' + x + ',' + y);
  }
  const all = m.join(''), count = (c) => all.split(c).length - 1;
  ok(count('P') === 1, s + ': oyuncu sayısı');
  if (lv.boss) {
    ok(count('Z') === 1 && count('D') === 0, s + ': patron/kapı');
    const zi = all.indexOf('Z'), zx = zi % COLS, zy = Math.floor(zi / COLS);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ok('.Z'.includes(m[zy + dy][zx + dx]), s + ': patronun alanı dolu');
    ok(m[6][7] === '.', s + ': ortadaki kapı yeri boş değil');
  } else {
    ok(count('D') === 1, s + ': kapı sayısı');
    const en = count('1') + count('2') + count('3');
    ok(en >= 3 && en <= 10, s + ': düşman sayısı ' + en);
  }
}
report('harita yapısı (kenar, sütun, işaretler, kapı, düşman)');

// 3) Her karoya ulaşılır; başta dinamit koyup saklanacak yer var; düşmanlar uzakta
for (const lv of L) {
  const G = BU.create();
  BU.setupStory(G, lv.stage, false);
  const p = G.players[0], s = lv.stage;
  const seen = new Set([idx(p.x, p.y)]), q = [[p.x, p.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = idx(x + dx, y + dy);
      if (G.grid[i] !== WALL && !seen.has(i)) { seen.add(i); q.push([x + dx, y + dy]); }
    }
  }
  let unreachable = 0;
  for (let i = 0; i < BU.N; i++) if (G.grid[i] !== WALL && !seen.has(i)) unreachable++;
  ok(unreachable === 0, s + ': ulaşılamayan karo ' + unreachable);
  const D = BU.dangerMap(G, [{ x: p.x, y: p.y, fire: RULES.startFire, t: RULES.bombTime }]);
  const esc = BU.bfs(G, p, D, (i) => D[i] === Infinity, 8);
  ok(esc && esc.length / BU.speedOf(p) < RULES.bombTime - 0.4, s + ': başlangıçta saklanacak yer yok');
  for (const e of G.enemies) ok(Math.abs(e.x - p.x) + Math.abs(e.y - p.y) >= 7, s + ': düşman başlangıca yakın');
  if (lv.boss) ok(G.boss && G.boss.hp === BU.BOSS[lv.boss].hp, s + ': patron yüklenmedi');
}
report('ulaşılabilirlik, başlangıç güvenliği, düşman uzaklığı');

// 4) Patron: patlama hasarı, dokunulmazlık, ölüm, kapı, +1 can, sonraki dünya
{
  const G = BU.create();
  BU.setupStory(G, 10, false);
  G.phase = 'play';
  const B = G.boss, p = G.players[0];
  B.dx = 0; B.dy = 0; B.turnT = 99; B.chargeT = 99;
  const bx = Math.round(B.x + 1.5), by = Math.round(B.y);
  G.grid[idx(bx, by)] = FLOOR;
  G.bombs.push({ x: bx, y: by, t: 0.01, fire: 2, owner: 9, pass: new Set(), age: 0 });
  BU.update(G, 1 / 60);
  ok(B.hp === BU.BOSS.kepce.hp - 1 && B.inv > 0, 'patlama patrona vurdu (hp ' + B.hp + ')');
  G.bombs.push({ x: bx, y: by, t: 0.01, fire: 2, owner: 9, pass: new Set(), age: 0 });
  run(G, 0.6);
  ok(B.hp === BU.BOSS.kepce.hp - 1, 'dokunulmazken ikinci vuruş sayılmadı');
  B.hp = 1; B.inv = 0;
  run(G, 0.05);
  G.bombs.push({ x: bx, y: by, t: 0.01, fire: 2, owner: 9, pass: new Set(), age: 0 });
  run(G, 0.05);
  ok(!B.alive, 'patron yenildi');
  ok(G.door < 0, 'kapı patron ölürken henüz yok');
  run(G, 2.0);
  ok(G.door === idx(7, 6) && G.doorOpen, 'kapı ortada açıldı');
  const lives = G.lives;
  p.alive = true; p.x = 7; p.y = 6; p.inv = 5;
  run(G, 0.05);
  ok(G.phase === 'clear' && G.lives === lives + 1, 'bölüm geçildi, +1 can');
  run(G, RULES.stageClearTime + 1.5);
  ok(G.stage === 11 && G.world === 2 && !G.boss, 'liman dünyası başladı');
}
report('patron 1: hasar, ölüm, kapı, ödül');

// 5) Patron saldırıları: sarsıntı (pres), yardımcı çağırma (yengeç), sandık delme (matkap)
{
  const G = BU.create();
  BU.setupStory(G, 40, false);
  G.phase = 'play'; G.players[0].x = 13; G.players[0].y = 11; G.players[0].inv = 99;
  const B = G.boss; B.dx = 0; B.dy = 0; B.turnT = 99; B.slamT = 0.01;
  BU.update(G, 1 / 60);
  const warned = Array.from(G.warnT).filter((v) => v > 0).length;
  ok(warned >= 6, 'sarsıntı uyarısı işaretlendi (' + warned + ')');
  run(G, 1.0);
  ok(Array.from(G.flameT).filter((v) => v > 0).length >= 6, 'uyarıdan sonra alev çıktı');
  ok(B.hp === BU.BOSS.pres.hp, 'patron kendi sarsıntısından hasar almadı');
}
{
  const G = BU.create();
  BU.setupStory(G, 20, false);
  G.phase = 'play'; G.players[0].inv = 99;
  G.boss.spawnT = 0.01;
  run(G, 0.1);
  ok(G.enemies.filter((e) => e.alive && e.kind === 'yengec').length === 1, 'dev yengeç yardımcı çağırdı');
  for (let k = 0; k < 6; k++) { G.boss.spawnT = 0.01; run(G, 0.05); }
  ok(G.enemies.filter((e) => e.alive).length <= 3, 'aynı anda en fazla 3 yardımcı');
}
{
  const G = BU.create();
  BU.setupStory(G, 30, false);
  G.phase = 'play'; G.players[0].inv = 99;
  const B = G.boss; B.turnT = 99; B.dx = 1; B.dy = 0;
  const cx = Math.ceil(B.x + BU.BOSS_R + 0.5), cy = Math.floor(B.y);
  G.grid[idx(cx, cy)] = CRATE; G.crumble[idx(cx, cy)] = 0;
  run(G, 0.6);
  ok(G.crumble[idx(cx, cy)] > 0 || G.grid[idx(cx, cy)] === FLOOR, 'matkap sandığı deldi');
}
report('patron saldırıları');

// 6) Ölünce dinamit ve menzil kalır, hız ve kask gider; 50. bölümden sonra oyun biter
{
  const G = BU.create();
  BU.setupStory(G, 5, false);
  const p = G.players[0];
  p.bombs = 4; p.fire = 5; p.speedUps = 3; p.helmet = false; p.inv = 0;
  G.phase = 'play';
  G.flameT[idx(p.x, p.y)] = 0.5;
  run(G, RULES.deathTime + 1.2);
  const q = G.players[0];
  ok(G.stage === 5 && q.bombs === 4 && q.fire === 5 && q.speedUps === 0, 'ölünce dinamit/menzil kaldı, hız gitti');
  const E = BU.create();
  BU.setupStory(E, 50, false);
  E.boss.alive = false; E.boss.gone = true; E.door = idx(7, 6); E.grid[E.door] = FLOOR;
  E.phase = 'play'; E.players[0].x = 7; E.players[0].y = 6;
  run(E, 0.05); run(E, RULES.stageClearTime + 1.5);
  ok(E.phase === 'end', 'son bölümden sonra oyun bitti (' + E.phase + ')');
}
report('can kaybı ve oyun sonu');

console.log(fails ? fails + ' sorun' : 'tüm bölüm testleri geçti');
process.exit(fails ? 1 : 0);
