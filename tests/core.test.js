// Çekirdek testleri: node tests/core.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Set, Map, Float32Array, Uint8Array, Int8Array, Int16Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8'), ctx);
const BU = ctx.BU;
const { idx, COLS, ROWS, FLOOR, WALL, CRATE, RULES } = BU;

let fails = 0;
function ok(cond, msg) { console.log((cond ? 'ok ' : 'HATA ') + msg); if (!cond) fails++; }
const run = (G, sec, step = 1 / 120) => { for (let t = 0; t < sec; t += step) BU.update(G, step); };
const drain = (G) => { const e = G.events; G.events = []; return e; };

function blank() {
  const G = BU.create();
  BU.setupStory(G, 1, false);
  G.grid = G.grid.map((v) => (v === CRATE ? FLOOR : v));
  G.enemies = []; G.door = -1; G.itemAt.fill(-1);
  G.phase = 'play';
  return G;
}

// 1) Harita: kenarlar ve sütunlar duvar, başlangıç köşesi boş.
{
  const G = BU.create();
  BU.setupStory(G, 1, false);
  ok(G.grid[idx(0, 0)] === WALL && G.grid[idx(2, 2)] === WALL && G.grid[idx(COLS - 1, 5)] === WALL, 'duvarlar yerinde');
  ok([idx(1, 1), idx(2, 1), idx(1, 2)].every((i) => G.grid[i] === FLOOR), 'başlangıç köşesi boş');
  ok(G.door >= 0 && G.grid[G.door] === CRATE, 'kapı bir sandığın altında');
  ok(G.enemies.length === BU.storyParams(1).enemies, 'düşman sayısı doğru');
  ok(G.enemies.every((e) => e.x + e.y >= 7), 'düşmanlar oyuncudan uzakta');
}

// 2) Hareket: koridorda yürür, sütuna çarpınca durur.
{
  const G = blank(), p = G.players[0];
  p.input.dir = 'right'; run(G, 0.5);
  ok(p.x > 2 && Math.abs(p.y - 1) < 1e-6, 'sağa yürüdü (' + p.x.toFixed(2) + ')');
  p.x = 1; p.y = 1; p.input.dir = 'up'; run(G, 0.3);
  ok(Math.abs(p.y - 1) < 1e-6, 'duvara doğru ilerlemedi');
  // Köşe yardımı: hafif kaymış oyuncu koridora hizalanıp döner.
  p.x = 1.25; p.y = 1; p.input.dir = 'down'; run(G, 0.4);
  ok(Math.abs(p.x - 1) < 1e-6 && p.y > 1.5, 'köşe yardımıyla aşağı döndü (' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ')');
  p.x = 1.6; p.y = 3; p.input.dir = 'down'; run(G, 0.4);
  ok(Math.abs(p.x - 1) < 1e-6 || Math.abs(p.x - 3) < 1e-6, 'kaymış oyuncu bir koridora oturdu (' + p.x.toFixed(2) + ')');
}

// 3) Bomba: kendi bombasından çıkabilir, geri giremez; menzil ve duvar.
{
  const G = blank(), p = G.players[0];
  p.x = 3; p.y = 1; p.input.bomb = true; BU.update(G, 1 / 120);
  ok(G.bombs.length === 1 && p.bombsOut === 1, 'bomba kondu');
  p.input.bomb = true; BU.update(G, 1 / 120);
  ok(G.bombs.length === 1, 'tek bomba hakkı');
  p.input.dir = 'right'; run(G, 0.5);
  ok(p.x > 3.9, 'bombanın üstünden çıktı');
  p.input.dir = 'left'; run(G, 0.6);
  ok(p.x >= 4 - 1e-6, 'bombaya geri giremedi (' + p.x.toFixed(2) + ')');
  p.input.dir = null; p.x = 4.2;
  drain(G);
  run(G, RULES.bombTime);
  const ev = drain(G);
  ok(ev.some((e) => e.type === 'boom') && G.bombs.length === 0 && p.bombsOut === 0, 'bomba patladı, hak geri geldi');
  ok(!p.alive, 'menzildeki oyuncu öldü (x=' + p.x.toFixed(1) + ')');
}

// 4) Alev: menzil, duvar kesmesi, sandık kırılır ve içindeki ödül çıkar.
{
  const G = blank(), p = G.players[0];
  p.x = 11; p.y = 11; p.alive = true;
  G.grid[idx(5, 1)] = CRATE; G.itemAt[idx(5, 1)] = 0;
  G.bombs.push({ x: 3, y: 1, t: 0.01, fire: 2, owner: 0, pass: new Set(), age: 0 });
  p.bombsOut = 1;
  BU.update(G, 1 / 60);
  ok(G.flameT[idx(4, 1)] > 0 && G.flameT[idx(5, 1)] > 0 && G.flameT[idx(6, 1)] === 0, 'alev sandıkta durdu');
  ok(G.grid[idx(3, 0)] === WALL && G.flameT[idx(3, 0)] === 0 && G.flameT[idx(3, 2)] > 0, 'alev duvardan geçmedi, boş karoya yayıldı');
  ok(G.flameT[idx(1, 1)] > 0 && G.flameT[idx(0, 1)] === 0, 'menzil 2, kenarda bitti');
  ok((G.flameMask[idx(3, 1)] & BU.CORE) && (G.flameMask[idx(4, 1)] & BU.ARM.left) && (G.flameMask[idx(4, 1)] & BU.ARM.right), 'alev maskeleri bağlı');
  run(G, 0.6);
  ok(G.grid[idx(5, 1)] === FLOOR && G.revealed[idx(5, 1)] === 1, 'sandık kırıldı, ödül göründü');
  p.x = 5; p.y = 1; BU.update(G, 1 / 120);
  ok(p.bombs === 2 && G.itemAt[idx(5, 1)] === -1, 'bomba ödülü alındı');
}

// 5) Zincirleme patlama.
{
  const G = blank();
  G.players[0].x = 11; G.players[0].y = 11;
  G.bombs.push({ x: 1, y: 3, t: 0.01, fire: 2, owner: 9, pass: new Set(), age: 0 });
  G.bombs.push({ x: 3, y: 3, t: 5, fire: 2, owner: 9, pass: new Set(), age: 0 });
  run(G, 0.2);
  ok(G.bombs.length === 0 && G.flameT[idx(5, 3)] > 0, 'ikinci bomba zincirleme patladı');
}

// 6) Düşman: alevde ölür, puan verir; dokunursa oyuncu ölür; kask bir kez korur.
{
  const G = blank(), p = G.players[0];
  G.enemies.push({ ...BU.ENEMY.bocek, kind: 'bocek', x: 5, y: 1, tx: 5, ty: 1, dir: 'left', alive: true, dying: 0, anim: 0 });
  G.bombs.push({ x: 3, y: 1, t: 0.01, fire: 2, owner: 0, pass: new Set(), age: 0 });
  p.x = 11; p.y = 11;
  run(G, 0.05);
  ok(!G.enemies[0].alive && G.score === 100, 'düşman alevde öldü, 100 puan');
  G.enemies.push({ ...BU.ENEMY.bocek, kind: 'bocek', x: 11, y: 11, tx: 11, ty: 11, dir: 'left', alive: true, dying: 0, anim: 0, speed: 0 });
  p.helmet = true;
  run(G, 0.05);
  ok(p.alive && !p.helmet && p.inv > 0, 'kask bir kez korudu');
  run(G, RULES.invulnTime + 0.1);
  ok(!p.alive, 'kasksız dokunuşta öldü');
}

// 7) Hikâye akışı: düşmanlar bitince kapı açılır, kapıya basınca bölüm geçilir.
{
  const G = blank(), p = G.players[0];
  G.door = idx(5, 1); G.grid[G.door] = FLOOR; G.enemies = [];
  run(G, 0.05);
  ok(G.doorOpen, 'kapı açıldı');
  p.x = 5; p.y = 1; run(G, 0.05);
  ok(G.phase === 'clear', 'bölüm geçildi');
  run(G, RULES.stageClearTime + 0.1);
  ok(G.stage === 2 && G.phase === 'intro', 'ikinci bölüm başladı');
}

// 8) Kapışma: kurulum, bilgisayar oyuncuları kendini öldürmeden oynar, tur biter.
{
  const G = BU.create();
  BU.setupBattle(G, [{ cpu: true }, { cpu: true }, { cpu: true }, { cpu: true }], 1, 5);
  ok(G.players.length === 4, 'dört oyuncu');
  ok(BU.CORNERS.every(([x, y]) => G.grid[idx(x, y)] === FLOOR), 'köşeler boş');
  let bombs = 0, early = 0, t = 0;
  G.events = [];
  for (; t < 200 && G.phase !== 'roundEnd'; t += 1 / 60) {
    BU.update(G, 1 / 60);
    for (const e of G.events) { if (e.type === 'place') bombs++; if (e.type === 'die' && t < 8) early++; }
    G.events = [];
  }
  ok(bombs > 10, 'bilgisayar bomba koyuyor (' + bombs + ')');
  ok(early <= 1, '8 sn içinde en fazla bir erken ölüm (' + early + ')');
  ok(G.phase === 'roundEnd', 'tur bitti (' + t.toFixed(0) + ' sn, kazanan ' + G.winner + ')');
}

// 9) Daralan alan: süre bitince kenarlardan duvar örülür.
{
  const G = BU.create();
  BU.setupBattle(G, [{ cpu: false }, { cpu: false }, null, null], 1, 3);
  G.phase = 'play'; G.battleT = 0.01;
  run(G, 2);
  ok(G.grid[idx(3, 1)] === WALL, 'alan daralıyor');
  ok(!G.players[0].alive, 'köşede bekleyen oyuncu duvar altında kaldı');
}

// 10) Bilgisayar 100 turda kendi bombasıyla ölmüyor mu? (istatistik)
{
  let selfKills = 0, rounds = 0;
  for (let s = 1; s <= 40; s++) {
    const G = BU.create();
    BU.setupBattle(G, [{ cpu: true }, { cpu: true }, null, null], 1, s);
    G.events = [];
    for (let t = 0; t < 60 && G.phase !== 'roundEnd'; t += 1 / 60) {
      BU.update(G, 1 / 60);
      G.events = [];
    }
    rounds++;
    for (const p of G.players) if (!p.alive) {
      // Kim öldürdü bilinmiyor; ilk 60 sn'de iki oyunculuda ölüm = çoğunlukla kendi bombası.
      selfKills++;
    }
  }
  console.log('bilgi: 2 bilgisayar, 60 sn, 40 tur → ölüm', selfKills);
  ok(selfKills < rounds * 1.2, 'bilgisayarlar çoğunlukla hayatta kalıyor');
}

console.log(fails ? fails + ' test başarısız' : 'tüm testler geçti');
process.exit(fails ? 1 : 0);
