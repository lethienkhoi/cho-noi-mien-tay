"""B3 — Xuất sprite SVG tự chứa cho game từ các hàm vẽ đã duyệt (tools/art.py, tách từ design/gen4.py).

Chạy:  python3 tools/export_sprites.py
Ra:    game/assets/sprites/*.svg  +  game/assets/sprites/manifest.json

- Mỗi sprite là một file SVG riêng, có <defs> riêng (chỉ các gradient/pattern/filter nó dùng), viewBox bó sát
  (đo bằng Chromium: vẽ thật rồi lấy khung điểm ảnh có alpha, cộng lề 2 đơn vị).
- Đơn vị viewBox = đơn vị vẽ trong gen4 (1 đơn vị = 1px ở scale 1).
- manifest: w,h (kích thước viewBox), ox,oy (vị trí gốc toạ độ của hàm vẽ bên trong sprite), anchors (toạ độ hàm vẽ,
  tính từ gốc): water = mặt nước của thuyền, seat = chỗ đặt người bán trên ghe hàng, rider = chỗ nhân vật ngồi.
- Chữ "Vê Ép 5" được đổi thành path (font Baloo 2 ExtraBold, tools/fonts) vì SVG nạp dạng ảnh không dùng được web font.
"""
import os, re, sys, json, math, asyncio, io
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import art
from art import (G, P, L, C, E, person, stall, hero_boat, nonla, bowl, fish, durian, hyacinth, rambutan, ripple, scene, lg,
                 VEH, VCOLS, DEFS)

ROOT = os.path.abspath(os.path.join(HERE, '..'))
OUTDIR = os.path.join(ROOT, 'game', 'assets', 'sprites')
FONT = os.path.join(HERE, 'fonts', 'Baloo2-ExtraBold.ttf')
PAD = 2

# ---------------------------------------------------------------- định nghĩa sprite
SPR = {}   # name -> dict(svg=inner, anchors={}, box=None|(x,y,w,h))
def add(name, inner, anchors=None, box=None):
    SPR[name] = dict(svg=inner, anchors=anchors or {}, box=box)

ROW = [[(-26, -70), (-6, -58), (12, -70)], [(26, -70), (40, -60), (30, -52)]]
COCKY = [[(-26, -70), (-50, -100), (-52, -132)], [(26, -70), (6, -60), (-12, -68)]]
UP = [[(-26, -70), (-50, -100), (-56, -130)], [(26, -70), (50, -100), (60, -130)]]
SCREAM = [[(-26, -70), (-60, -96), (-76, -124)], [(26, -70), (60, -96), (78, -122)]]
SAD = [[(-26, -70), (-38, -46), (-30, -26)], [(26, -70), (38, -46), (30, -26)]]

# Nhân vật chính (khung 7: pv4) — đứng, có chân
add('hero_happy', person('hero', 'happy', arms=ROW, legs=True, look=(.4, -.2)), {'feet': [0, 0]})
add('hero_cocky', person('hero', 'cocky', mouth='grin', arms=COCKY, legs=True, hat_rot=-14), {'feet': [0, 0]})
add('hero_scream', person('hero', 'scream', arms=SCREAM, legs=True, hat=False, look=(0, 1)), {'feet': [0, 0]})
add('hero_sad', person('hero', 'sad', arms=SAD, legs=True, hat=False, look=(0, 1)), {'feet': [0, 0]})

# Nhân vật chính ngồi trên ghe (màn chơi, tier 0)
BOAT_A = {'water': [0, 12], 'rider': [-30, 16]}
add('hero_boat_row', hero_boat(person('hero', 'happy', arms=ROW, look=(.4, -.2))), BOAT_A)
add('hero_boat_row_cocky', hero_boat(person('hero', 'cocky', mouth='grin', arms=COCKY, hat_rot=-14)), BOAT_A)
add('hero_boat_jump', hero_boat(person('hero', 'laugh', arms=UP), oar=False).replace(ripple(100), ''), BOAT_A)
add('hero_boat_empty', hero_boat(None, oar=False).replace(ripple(100), ''), BOAT_A)

# Người bán: 5 kiểu x 3 mặt. Người bán vẽ trong hệ toạ độ chưa lật của ghe hàng; game lật cả ghe (mũi ghe quay về trái),
# nên look x dương = nhìn về phía nhân vật chính bên trái màn.
VEND_NORMAL = {
    'girl': dict(ex='laugh', arms=[[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (36, -86), (16, -96)]]),
    'granny': dict(ex='happy', mouth='tooth'),
    'oldman': dict(ex='happy', look=(.5, 0)),
    'dude': dict(ex='laugh', arms=[[(-28, -70), (-50, -50), (-30, -40)], [(28, -70), (50, -50), (30, -40)]]),
    'cool': dict(ex='smug'),
}
SHOCK_ARMS = [[(-26, -70), (-50, -96), (-46, -124)], [(26, -70), (50, -96), (46, -124)]]
YELL_ARMS = [[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (50, -100), (44, -132)]]
for k, kw in VEND_NORMAL.items():
    kw = dict(kw); ex = kw.pop('ex')
    add(f'{k}_normal', person(k, ex, **kw), {'seat': [0, 0]})
    add(f'{k}_shock', person(k, 'shock', 'scream', arms=SHOCK_ARMS, look=(.6, 0)), {'seat': [0, 0]})
    add(f'{k}_yell', person(k, 'angry' if k in ('granny', 'oldman') else 'yell', 'yell', arms=YELL_ARMS, look=(0, -1)), {'seat': [0, 0]})

# Ghe hàng (không người bán): 2 lớp. *_back vẽ trước người bán, stall_* vẽ sau. Hai lớp chung viewBox.
STALL_STYLE = {
    'bun-rieu': ('#c8452c', '#f2c14e'), 'com-tam': ('#2c6e91', '#e4572e'), 'fruit': ('#3e8e5a', '#f2c14e'),
    'trai-cay': ('#3e8e5a', '#f2c14e'), 'ca-dong': ('#2c6e91', '#f2c14e'), 'rau': ('#d9668f', '#3e8e5a'),
    'nuoc': ('#3aa7c9', '#e0a126'), 'banh': ('#6b4e9b', '#f2c14e'), 'ca-phe': ('#8a5a3b', '#e4572e'),
    'hu-tieu': ('#e0a126', '#c8452c'), 'snack': ('#d9668f', '#3aa7c9'), 'lau-mam': ('#c8452c', '#e0a126'),
    'vit': ('#e0a126', '#6b4e9b'), 'ruou': ('#3e8e5a', '#d9668f'),
}
STALL_A = {'water': [0, 12], 'seat': [-36, 14]}
for k, (hc, aw) in STALL_STYLE.items():
    add(f'stall_{k}', stall(k, hc, aw, layer='front'), STALL_A)
    add(f'stall_{k}_back', stall(k, hc, aw, layer='back'), STALL_A)
    SPR[f'stall_{k}']['pair'] = f'stall_{k}_back'

# 6 phương tiện (kèm hero), cùng bản "đắc chí" và bản trống (để hero văng khi đụng)
VEH_A = {'water': [0, 12]}
for i, (n, fn) in enumerate(VEH):
    add(f'veh_{i}', fn(), VEH_A)
    add(f'veh_{i}_cocky', fn(ex='cocky'), VEH_A)
    add(f'veh_{i}_empty', fn(rider=False), VEH_A)

# Phụ kiện bay khi đụng
add('nonla', nonla()); add('bowl', bowl()); add('fish', fish()); add('durian', durian())

# Ghe xa / trung (đã mờ sẵn, cùng cách scene() vẽ), tiền cảnh mờ mạnh
FAR = [('fruit', 'girl', 'happy'), ('com-tam', 'dude', 'laugh'), ('bun-rieu', 'oldman', 'grin'), ('fruit', 'granny', 'happy')]
for i, (k, v, ex) in enumerate(FAR):
    add(f'far_{i}', G(G(stall(k, VCOLS[i], VCOLS[(i + 3) % 7], person(v, ex)), 0, 0, .2), filt='b2', op=.85), {'water': [0, 12 * .2]})
MID = [('com-tam', 'cool', 'laugh'), ('fruit', 'girl', 'happy')]
for i, (k, v, ex) in enumerate(MID):
    add(f'mid_{i}', G(G(stall(k, VCOLS[i + 4], VCOLS[i + 1], person(v, ex)), 0, 0, .3), filt='b1'), {'water': [0, 12 * .3]})
add('fg_hyacinth', G(hyacinth(), 0, 0, 1.8, 0, False, 1, 'b4'))
add('fg_branch', G(P('M0,0 Q60,20 90,90 Q40,60 0,60 Z', lg('#2f9c5a'), 3) + G(rambutan(), 60, 96, 1.6) + L('M50,40 L60,82', 3, '#6b4a2b'), 0, 0, 1.1, 0, False, 1, 'b4'))

# Nền: trời, bờ sông mờ, nước, lấp lánh — không ghe xa
art.R.seed(5)
BG_W, BG_H, BG_HZ = 390, 844, 250
add('background', scene(BG_W, BG_H, BG_HZ, '', far=False), {'horizon': [0, BG_HZ]}, box=(0, 0, BG_W, BG_H))

# ---------------------------------------------------------------- chữ -> path
def outline_text(s):
    if '<text' not in s: return s
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm; hmtx = f['hmtx']
    def rep(m):
        attrs, txt = m.group(1), m.group(2)
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', attrs))
        x, y, size = float(a['x']), float(a['y']), float(a['font-size']); k = size / upm
        sp = SVGPathPen(gs); pen_x = x
        for ch in txt:
            g = cmap.get(ord(ch))
            if g is None: continue
            gs[g].draw(TransformPen(sp, (k, 0, 0, -k, pen_x, y)))
            pen_x += hmtx[g][0] * k
        keep = ' '.join(f'{n}="{v}"' for n, v in a.items() if n in ('fill', 'stroke', 'stroke-width', 'paint-order', 'transform'))
        return f'<path d="{sp.getCommands()}" {keep} stroke-linejoin="round"/>'
    return re.sub(r'<text ([^>]*)>([^<]*)</text>', rep, s)

def defs_for(inner):
    ids = set(re.findall(r'url\(#([\w-]+)\)', inner))
    return ''.join(v for k, v in DEFS.items() if k in ids)

def doc(inner, box):
    x, y, w, h = box
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {w:g} {h:g}" width="{w:g}" height="{h:g}">'
            f'<defs>{defs_for(inner)}</defs>{inner}</svg>')

# ---------------------------------------------------------------- đo khung bó sát bằng Chromium
SCAN = 460   # vùng quét: [-SCAN, SCAN] mỗi chiều
async def measure(names):
    from playwright.async_api import async_playwright
    from PIL import Image
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': SCAN * 2, 'height': SCAN * 2}, device_scale_factor=2)
        for n in names:
            html = ('<html><body style="margin:0;background:transparent">'
                    + doc(SPR[n]['svg'], (-SCAN, -SCAN, SCAN * 2, SCAN * 2)).replace('<svg ', '<svg style="display:block" ', 1)
                    + '</body></html>')
            await pg.set_content(html)
            png = await pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': SCAN * 2, 'height': SCAN * 2})
            im = Image.open(io.BytesIO(png)).getchannel('A').point(lambda a: 255 if a > 3 else 0)
            bb = im.getbbox()
            if not bb: raise SystemExit(f'sprite rỗng: {n}')
            x0, y0, x1, y1 = [v / 2 - SCAN for v in bb]
            if x0 <= -SCAN + 1 or y0 <= -SCAN + 1 or x1 >= SCAN - 1 or y1 >= SCAN - 1:
                raise SystemExit(f'sprite {n} chạm biên vùng quét, tăng SCAN')
            x0, y0 = math.floor(x0 - PAD), math.floor(y0 - PAD); x1, y1 = math.ceil(x1 + PAD), math.ceil(y1 + PAD)
            out[n] = (x0, y0, x1 - x0, y1 - y0)
        await b.close()
    return out

def main():
    for n in SPR: SPR[n]['svg'] = outline_text(SPR[n]['svg'])
    need = [n for n in SPR if SPR[n]['box'] is None]
    boxes = asyncio.run(measure(need))
    for n, bx in boxes.items(): SPR[n]['box'] = bx
    # hai lớp ghe hàng dùng chung một viewBox (hợp của hai khung)
    for n, s in SPR.items():
        if 'pair' in s:
            a, b2 = s['box'], SPR[s['pair']]['box']
            x0, y0 = min(a[0], b2[0]), min(a[1], b2[1]); x1, y1 = max(a[0] + a[2], b2[0] + b2[2]), max(a[1] + a[3], b2[1] + b2[3])
            s['box'] = SPR[s['pair']]['box'] = (x0, y0, x1 - x0, y1 - y0)
    os.makedirs(OUTDIR, exist_ok=True)
    for f in os.listdir(OUTDIR):
        if f.endswith('.svg'): os.remove(os.path.join(OUTDIR, f))
    man = {'_note': 'Sinh tự động bởi tools/export_sprites.py từ tools/art.py (hình duyệt trong design/gen4.py). Đơn vị = đơn vị vẽ gen4. '
                    'ox,oy = vị trí gốc toạ độ hàm vẽ trong sprite; anchors tính từ gốc. Đừng sửa tay.',
           'sprites': {}}
    total = 0
    for n, s in SPR.items():
        x, y, w, h = s['box']
        txt = doc(s['svg'], s['box'])
        open(os.path.join(OUTDIR, n + '.svg'), 'w', encoding='utf-8').write(txt); total += len(txt)
        m = {'file': n + '.svg', 'w': w, 'h': h, 'ox': -x, 'oy': -y}
        if s['anchors']: m['anchors'] = s['anchors']
        if 'pair' in s: m['back'] = s['pair']
        man['sprites'][n] = m
    man['vendors'] = list(VEND_NORMAL.keys())
    man['vendorFaces'] = ['normal', 'shock', 'yell']
    man['stallMap'] = {k: f'stall_{k}' for k in STALL_STYLE}
    man['vehicles'] = [{'tier': i, 'name': n, 'sprite': f'veh_{i}', 'cocky': f'veh_{i}_cocky', 'empty': f'veh_{i}_empty'} for i, (n, _) in enumerate(VEH)]
    man['vehicles'][0].update({'play': 'hero_boat_row', 'playCocky': 'hero_boat_row_cocky', 'jump': 'hero_boat_jump', 'empty': 'hero_boat_empty'})
    man['background'] = {'sprite': 'background', 'w': BG_W, 'h': BG_H, 'horizon': BG_HZ, 'waterBottom': '#17777a'}
    json.dump(man, open(os.path.join(OUTDIR, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(SPR)} sprite, {total // 1024} KB -> {OUTDIR}')

if __name__ == '__main__':
    main()
