#!/usr/bin/env python3
"""Bomba Ustası — 50 bölümlük haritaları üretir ve src/levels.js'e yazar.

    python3 tools/bolumler.py

Her dünyanın 9 bölümü ayrı bir yerleşim desenine göre, 10. bölüm patron
arenasıdır. Üretim tohumlu olduğu için her çalıştırmada aynı haritalar çıkar.
Harita işaretleri:
    #  duvar (kenar ve sütunlar)        X  dünyaya özgü ek engel (konteyner, kaya, makine...)
    .  zemin     c  sandık              D  kapıyı saklayan sandık
    B F S H  ödül saklayan sandık (dinamit, menzil, hız, kask)
    P  oyuncu    1 2 3  dünyanın düşman türleri    Z  patron (2×2 alanın sol üstü)
"""
import json
import random
from collections import deque
from pathlib import Path

W, H = 15, 13
WORLDS = [
    ('İnşaat', ['bocek', 'toz', 'kostebek'],
     ['Temel Kazısı', 'Kalıp İşleri', 'Demir Bağlama', 'Beton Dökümü', 'İskele', 'Çatı Katı', 'Sıva', 'Boya Badana', 'Anahtar Teslim'], 'kepce', 'Dev Kepçe'),
    ('Liman', ['yengec', 'marti', 'toz'],
     ['Rıhtım', 'Konteyner Sahası', 'Vinç Altı', 'Gümrük', 'Balıkçı Barınağı', 'Fener', 'Antrepo', 'Tersane', 'Mendirek'], 'yengec', 'Dev Yengeç'),
    ('Maden', ['yarasa', 'kostebek', 'bocek'],
     ['Giriş Galerisi', 'Kömür Damarı', 'Raylı Yol', 'Havalandırma', 'Asansör Kuyusu', 'Derin Ocak', 'Kristal Mağara', 'Grizu', 'Çöküntü'], 'matkap', 'Dev Matkap'),
    ('Fabrika', ['robot', 'kivilcim', 'toz'],
     ['Yükleme Rampası', 'Montaj Hattı', 'Kazan Dairesi', 'Boya Atölyesi', 'Döküm', 'Konveyör', 'Paketleme', 'Ambar', 'Kontrol Odası'], 'pres', 'Pres Makinesi'),
    ('Gökdelen', ['marti', 'robot', 'kivilcim'],
     ['Zemin Kat', 'Asansör Boşluğu', 'Onuncu Kat', 'Cam Cephe', 'Vinç Kulesi', 'Teras', 'Rüzgâr Katı', 'Anten', 'Son Kat'], 'robot', 'Yıkım Robotu'),
]

# Her dünyanın 9 bölümü için desen sırası.
PLAN = [
    ['seyrek', 'satir', 'rastgele', 'adalar', 'dama', 'arti', 'halka', 'capraz', 'kale'],
    ['konteyner_y', 'rastgele', 'konteyner_d', 'adalar', 'satir', 'dama2', 'halka', 'labirent', 'kale'],
    ['tunel', 'rastgele', 'tunel', 'adalar', 'capraz', 'tunel_kaya', 'arti', 'halka', 'kale'],
    ['hat', 'dama', 'hat2', 'satir', 'halka', 'labirent', 'capraz', 'adalar', 'kale'],
    ['rastgele', 'konteyner_y', 'tunel', 'hat', 'halka', 'arti', 'dama2', 'labirent', 'kale'],
]
ITEMS = [
    ['F', 'B', 'S', 'BF', 'H', 'F', 'B', 'SF', 'B'],
    ['F', 'B', 'S', 'H', 'BF', 'F', 'B', 'S', 'BH'],
    ['B', 'F', 'S', 'BF', 'H', 'F', 'B', 'SF', 'BH'],
    ['F', 'B', 'S', 'BF', 'H', 'F', 'B', 'SF', 'BH'],
    ['B', 'F', 'S', 'BF', 'H', 'F', 'B', 'SF', 'BH'],
]


def base(pillars=True):
    g = [['.'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if x in (0, W - 1) or y in (0, H - 1) or (pillars and x % 2 == 0 and y % 2 == 0):
                g[y][x] = '#'
    return g


def cells(g, ch='.'):
    return [(x, y) for y in range(1, H - 1) for x in range(1, W - 1) if g[y][x] == ch]


def mirror(x):
    return W - 1 - x


def put(g, x, y, ch, sym=True):
    if g[y][x] == '.':
        g[y][x] = ch
    if sym and g[y][mirror(x)] == '.':
        g[y][mirror(x)] = ch


def solid(ch):
    return ch in '#X'


def connected(g, start):
    """Duvar olmayan tüm karolara (sandıklar kırılabilir sayılır) ulaşılabiliyor mu?"""
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and 0 <= n[0] < W and 0 <= n[1] < H and not solid(g[n[1]][n[0]]):
                seen.add(n)
                q.append(n)
    return all((x, y) in seen for y in range(H) for x in range(W) if not solid(g[y][x]))


# ---------- desenler ----------
def p_random(g, r, d):
    for x, y in cells(g):
        if x <= 7 and r.random() < d:
            put(g, x, y, 'c')


def p_rows(g, r):
    for x, y in cells(g):
        if x > 7:
            continue
        if y % 2 == 1 and r.random() < 0.62:
            put(g, x, y, 'c')
        elif y % 2 == 0 and r.random() < 0.25:
            put(g, x, y, 'c')


def p_checker(g, r, inv=False):
    for x, y in cells(g):
        between = (x + y) % 2 == 1
        if (between != inv) and r.random() < 0.9:
            put(g, x, y, 'c', sym=False)


def p_islands(g, r):
    centers = [(x, y) for x in range(2, W - 2, 2) for y in range(2, H - 2, 2)]
    r.shuffle(centers)
    for cx, cy in centers[:7]:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                x, y = cx + dx, cy + dy
                if 0 < x < W - 1 and 0 < y < H - 1 and r.random() < 0.85:
                    put(g, x, y, 'c')


def p_cross(g, r):
    for x, y in cells(g):
        if 6 <= x <= 8 or 5 <= y <= 7:
            if r.random() < 0.85:
                put(g, x, y, 'c')
        elif r.random() < 0.18:
            put(g, x, y, 'c')


def p_rings(g, r):
    for x, y in cells(g):
        ring = max(abs(x - 7), round(abs(y - 6) * 1.2))
        gap = (x == 7 or y == 6) and r.random() < 0.6
        if ring in (2, 3, 5, 6) and not gap and r.random() < 0.9:
            put(g, x, y, 'c', sym=False)


def p_diagonal(g, r):
    for x, y in cells(g):
        if (x + y) % 4 in (0, 1) and r.random() < 0.85:
            put(g, x, y, 'c', sym=False)


def p_fortress(g, r):
    for x, y in cells(g):
        if 4 <= x <= 10 and 3 <= y <= 9 and (x in (4, 5, 9, 10) or y in (3, 4, 8, 9)):
            put(g, x, y, 'c', sym=False)
        elif not (4 <= x <= 10 and 3 <= y <= 9) and r.random() < 0.25:
            put(g, x, y, 'c', sym=False)


def p_containers(g, r, vertical=False):
    if vertical:
        for cx in (4, 10):
            gaps = {r.choice([1, 3]), r.choice([9, 11]), 5 if cx == 4 else 7}
            for y in range(1, H - 1):
                if g[y][cx] == '.' and y not in gaps:
                    g[y][cx] = 'X'
    else:
        for cy in (4, 8):
            gaps = {r.choice([1, 3]), r.choice([11, 13]), 7}
            for x in range(1, W - 1):
                if g[cy][x] == '.' and x not in gaps:
                    g[cy][x] = 'X'
    p_random(g, r, 0.42)


def p_tunnels(g, r, rocks=False):
    for x, y in cells(g):
        if r.random() < 0.88:
            g[y][x] = 'c'
    # iki kıvrımlı tünel: dışarıdan ortaya
    for sx, sy in ((W - 2, 1), (1, H - 2), (W - 2, H - 2)):
        x, y = sx, sy
        for _ in range(22):
            if g[y][x] == 'c':
                g[y][x] = '.'
            opts = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 < x + dx < W - 1 and 0 < y + dy < H - 1 and g[y + dy][x + dx] != '#']
            opts.sort(key=lambda p: abs(p[0] - 7) + abs(p[1] - 6) + r.random() * 4)
            x, y = opts[0]
    if rocks:
        for x, y in r.sample(cells(g, 'c'), 10):
            if (x + y) % 2 == 1:
                g[y][x] = 'X'


def p_lanes(g, r, alt=False):
    cols = (4, 10) if not alt else (6, 8)
    for i, cx in enumerate(cols):
        gap_top = (i % 2 == 0) != alt
        for y in range(1, H - 1):
            keep = y in (1, 2) if gap_top else y in (H - 2, H - 3)
            if g[y][cx] == '.' and not keep:
                g[y][cx] = 'X'
    p_random(g, r, 0.4)


def p_maze(g, r):
    cand = [(x, y) for x, y in cells(g) if (x % 2) != (y % 2)]
    r.shuffle(cand)
    placed = 0
    for x, y in cand:
        if placed >= 16:
            break
        if (x, y) in ((1, 2), (2, 1), (1, 3), (2, 3)):
            continue
        g[y][x] = 'X'
        if connected(g, (1, 1)):
            placed += 1
        else:
            g[y][x] = '.'
    p_random(g, r, 0.35)


PATTERNS = {
    'seyrek': lambda g, r: p_random(g, r, 0.3),
    'rastgele': lambda g, r: p_random(g, r, 0.5),
    'satir': p_rows,
    'dama': lambda g, r: p_checker(g, r),
    'dama2': lambda g, r: p_checker(g, r, inv=True),
    'adalar': p_islands,
    'arti': p_cross,
    'halka': p_rings,
    'capraz': p_diagonal,
    'kale': p_fortress,
    'konteyner_y': lambda g, r: p_containers(g, r),
    'konteyner_d': lambda g, r: p_containers(g, r, vertical=True),
    'tunel': lambda g, r: p_tunnels(g, r),
    'tunel_kaya': lambda g, r: p_tunnels(g, r, rocks=True),
    'hat': lambda g, r: p_lanes(g, r),
    'hat2': lambda g, r: p_lanes(g, r, alt=True),
    'labirent': p_maze,
}


def start_area(x, y):
    """Oyuncunun başında boş kalan karolar: bomba koyup köşeyi dönebileceği L biçimi."""
    dx = 1 if x < W // 2 else -1
    dy = 1 if y < H // 2 else -1
    return {(x, y), (x + dx, y), (x, y + dy), (x, y + 2 * dy), (x + dx, y + 2 * dy)}


def dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def make_stage(n, w, k, r):
    name, kinds, names, _, _ = WORLDS[w]
    g = base()
    start = [(1, 1), (1, 1), (W - 2, 1), (1, H - 2), (1, 1), (W - 2, H - 2), (1, 1), (1, H - 2), (7, H - 2)][k]
    # Desenden önce başlangıcı ayır ki ek engeller oraya gelmesin.
    keep = start_area(*start)
    for x, y in keep:
        g[y][x] = 'k'
    PATTERNS[PLAN[w][k]](g, r)
    for x, y in keep:
        if g[y][x] in 'kc':
            g[y][x] = '.'
    if not connected(g, start):
        raise SystemExit(f'bölüm {n}: bağlı değil')
    crates = cells(g, 'c')
    # Çok seyrekse ya da çok doluysa ayarla.
    free = [c for c in cells(g) if c not in keep]
    if len(crates) < 24:
        for c in r.sample(free, min(len(free) - 12, 24 - len(crates))):
            g[c[1]][c[0]] = 'c'
        crates = cells(g, 'c')
    # Kapı: başlangıçtan uzak bir sandık.
    far = sorted(crates, key=lambda c: -dist(c, start))
    door = r.choice(far[: max(4, len(far) // 4)])
    if PLAN[w][k] == 'kale':  # kalede kapı ortada, sandık duvarların içinde
        door = (7, 5)
    g[door[1]][door[0]] = 'D'
    rest = [c for c in cells(g, 'c') if dist(c, start) >= 3]
    for it, c in zip(ITEMS[w][k], r.sample(rest, len(ITEMS[w][k]))):
        g[c[1]][c[0]] = it
    # Düşmanlar
    count = 3 + w + k // 3
    pool = [kinds[0], kinds[0], kinds[1]] if k < 3 else [kinds[0], kinds[1], kinds[1], kinds[2]] if k < 6 else [kinds[0], kinds[1], kinds[2], kinds[2]]
    spots = [c for c in cells(g) if dist(c, start) >= 7]
    while len(spots) < count:  # sandık açarak yer aç
        c = max(cells(g, 'c'), key=lambda c: dist(c, start) + r.random())
        g[c[1]][c[0]] = '.'
        spots = [c for c in cells(g) if dist(c, start) >= 7]
    for c in r.sample(spots, count):
        g[c[1]][c[0]] = str(kinds.index(r.choice(pool)) + 1)
    g[start[1]][start[0]] = 'P'
    return {'stage': n, 'world': w + 1, 'name': names[k], 'boss': None, 'map': [''.join(row) for row in g]}


BOSS_BLOCKS = [
    [(3, 3), (11, 3), (3, 9), (11, 9)],
    [(2, 4), (3, 4), (11, 4), (12, 4), (2, 8), (3, 8), (11, 8), (12, 8)],
    [(4, 4), (10, 4), (4, 8), (10, 8)],
    [(3, 3), (11, 3), (3, 9), (11, 9), (7, 4), (7, 8)],
    [(2, 3), (12, 3), (2, 9), (12, 9), (5, 6), (9, 6), (4, 8), (10, 8)],
]


def make_boss(n, w, r):
    name, kinds, _, boss, boss_name = WORLDS[w]
    g = base(pillars=False)
    for x, y in BOSS_BLOCKS[w]:
        g[y][x] = 'X'
    start = (7, H - 2)
    keep = {start, (6, H - 2), (8, H - 2), (7, H - 3), (5, H - 2), (9, H - 2)}
    # Az sayıda sandık, içlerinde yardımcı ödüller.
    density = 0.32 if boss == 'matkap' else 0.12
    for x, y in cells(g):
        if (x, y) not in keep and not (5 <= x <= 9 and 1 <= y <= 7) and r.random() < density:
            put(g, x, y, 'c')
    crates = cells(g, 'c')
    for it, c in zip('BFBF' + ('S' if w >= 2 else ''), r.sample(crates, min(len(crates), 4 + (w >= 2)))):
        g[c[1]][c[0]] = it
    g[2][6] = 'Z'
    g[start[1]][start[0]] = 'P'
    assert connected(g, start)
    return {'stage': n, 'world': w + 1, 'name': boss_name, 'boss': boss, 'map': [''.join(row) for row in g]}


def main():
    levels = []
    for w in range(5):
        for k in range(9):
            n = w * 10 + k + 1
            levels.append(make_stage(n, w, k, random.Random(n * 7919 + 17)))
        levels.append(make_boss(w * 10 + 10, w, random.Random(w * 31 + 5)))
    worlds = [{'name': w[0], 'enemies': w[1]} for w in WORLDS]
    out = Path(__file__).resolve().parent.parent / 'src' / 'levels.js'
    body = ',\n'.join('  ' + json.dumps(lv, ensure_ascii=False) for lv in levels)
    out.write_text(
        '// Bomba Ustası — 50 bölüm. Otomatik üretildi: python3 tools/bolumler.py\n'
        '// (elle değiştirme; desenler ve ayarlar betikte)\n'
        f'window.BU_WORLDS = {json.dumps(worlds, ensure_ascii=False)};\n'
        f'window.BU_LEVELS = [\n{body}\n];\n', encoding='utf-8')
    print(f'{len(levels)} bölüm yazıldı → {out}')


if __name__ == '__main__':
    main()
