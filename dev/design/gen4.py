import os, sys, json, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
from art import *  # noqa: F401,F403  (hàm vẽ dùng chung, xem tools/art.py)
ROOT = '/home/claude/cho-noi/design/project'

# ---------------- UI ----------------
def page(title, w, h, body):
    props = json.dumps({"$preview": {"width": w, "height": h}})
    return f'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Be+Vietnam+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>
body{{margin:0}}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{props}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
def pill(label, value):
    return (f'<div style="background: {CREAM}; border: 3px solid {OUT}; border-radius: 14px; padding: 2px 12px; display: flex; align-items: baseline; gap: 6px; box-shadow: 0 3px 0 {OUT}">'
            f'<span style="font-size: 12px; font-weight: 600; color: {MUTED}">{label}</span><span style="font-family: {FH}; font-weight: 800; font-size: 24px; line-height: 1.2">{value}</span></div>')
def hud(score, best, veh):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start"><div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%">{pill("Điểm", score)}{pill("Kỷ lục", best)}</div>'
            f'<span style="background: {OUT}; color: #FFFFFF; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px">{veh}</span></div>')
def panel(inner):
    return f'<div style="background: {CREAM}; border: 3.5px solid {OUT}; border-radius: 22px; padding: 12px 18px 16px; box-shadow: 0 6px 0 {OUT}; display: flex; flex-direction: column; gap: 10px">{inner}</div>'
def phone(svgs, top, bottom, extra=''):
    return (f'<div style="width: 390px; height: 844px; position: relative; overflow: hidden; font-family: {FB}; color: {OUT}; background: #2a9f98">{svgs}{extra}'
            f'<div style="position: absolute; left: 0; top: 0; width: 390px; height: 844px; box-sizing: border-box; padding: 18px 16px 22px; display: flex; flex-direction: column; justify-content: space-between">{top}{bottom}</div></div>')
def bubble(text, left, top, width, tx):
    return (f'<div style="position: absolute; left: {left}px; top: {top}px; width: {width}px; background: #FFFFFF; border: 3px solid {OUT}; border-radius: 18px; padding: 7px 12px; box-sizing: border-box; font-family: {FH}; font-weight: 800; font-size: 17px; line-height: 1.2; box-shadow: 0 4px 0 {OUT}">{text}'
            f'<span style="position: absolute; bottom: -10px; left: {tx}px; width: 14px; height: 14px; background: #FFFFFF; border-right: 3px solid {OUT}; border-bottom: 3px solid {OUT}; transform: rotate(45deg)"></span></div>')
def hl(t): return f'<span style="color: {ACC}">{t}</span>'
def phrase(big, small, color=OUT, size=58):
    return (f'<div style="display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 12px"><span style="font-family: {FH}; font-weight: 800; font-size: {size}px; line-height: 1; color: {color}">{big}</span>'
            f'<span style="font-size: 20px; font-weight: 400; color: {MUTED}">({small})</span></div>')
bar = f'<div style="height: 10px; border-radius: 8px; background: #e9dfc2; border: 2px solid {OUT}; overflow: hidden"><div style="width: 58%; height: 100%; background: {ACC}"></div></div>'

F = {}
W, H, HZ = 390, 844, 250
# 1 main: hero near (lens foreground), granny's stall coming
granny = person('granny', 'shock', 'scream', arms=[[(-26, -70), (-50, -96), (-46, -124)], [(26, -70), (50, -96), (46, -124)]], look=(-.6, 0))
mid = G(stall('bun-rieu', '#c8452c', '#f2c14e', granny), 268, 468, .82, 0, True)
hero = person('hero', 'grin', arms=[[(-26, -70), (-6, -58), (12, -70)], [(26, -70), (40, -60), (30, -52)]], look=(.7, -.2))
mid += G(hero_boat(hero), 150, 612, 1.28, -3)
fg = G(hyacinth(), 352, 650, 1.8, 0, False, 1, 'b4') + G(P('M0,0 Q60,20 90,90 Q40,60 0,60 Z', lg('#2f9c5a'), 3) + G(rambutan(), 60, 96, 1.6) + L('M50,40 L60,82', 3, '#6b4a2b'), 312, -10, 1.1, 0, False, 1, 'b4')
F['Main.dc.html'] = page('Màn chơi', W, H, phone(svg(W, H, scene(W, H, HZ, mid, fg)), hud('03', '12', 'Ghe chèo · còn 2 câu nữa lên đời'),
    panel(phrase(f'Bú{hl("ng")} {hl("gi")}êu', 'Bún riêu') + bar)))
# 2 jump
cool = person('cool', 'yell', arms=[[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (50, -100), (44, -132)]], look=(0, -1))
mid = G(L('M50,560 Q100,260 214,310', 4, '#ffffff', .9).replace('stroke-linecap', 'stroke-dasharray="4 12" stroke-linecap'), 0, 0)
splash = ''.join(P(f'M{x},{0} Q{x+dx*.4},{-hh} {x+dx},{-hh*1.1} Q{x+dx*.6},{-hh*.5} {x+dx*1.2},0 Z', '#ffffff', 3) for x, dx, hh in ((-50, 18, 60), (-24, 14, 90), (2, 16, 76), (26, 12, 54)))
splash += ''.join(C(R.uniform(-60, 60), R.uniform(-110, -40), R.uniform(3, 6), '#ffffff', 2.4) for _ in range(9))
mid += G(foam(46, 80) + ripple(60), 64, 588)
mid += G(stall('com-tam', '#2c6e91', '#e4572e', cool), 262, 566, .86, 0, True)
heroj = person('hero', 'laugh', arms=[[(-26, -70), (-50, -100), (-56, -130)], [(26, -70), (50, -100), (60, -130)]])
mid += G(hero_boat(heroj, oar=False).replace(ripple(100), ''), 222, 318, 1.0, -18)
F['Jump.dc.html'] = page('Nhảy qua ghe', W, H, phone(svg(W, H, scene(W, H, HZ, mid, G(hyacinth(), 26, 660, 1.6, 0, False, 1, 'b4'))), hud('04', '12', 'Ghe chèo · còn 1 câu nữa lên đời'),
    panel(phrase('Cơm tấm sừng bì', 'Cơm tấm sườn bì', GREEN, 40)
          + f'<div style="display: flex; gap: 8px"><span style="background: {GREEN}; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px">Qua ghe +1</span>'
            f'<span style="background: {CREAM}; color: {GREEN}; border: 2px solid {GREEN}; font-size: 13px; font-weight: 600; padding: 2px 10px; border-radius: 999px">Chuẩn miền Tây +2</span></div>'),
    bubble('Trời đất ơi, bộ ghe tui là cái cầu hả?', 14, 388, 196, 160)))
# 3 crash
bp = []
for i in range(22):
    a = i * 6.283 / 22; r = 78 if i % 2 == 0 else 40; bp.append(f'{math.cos(a)*r:.1f},{math.sin(a)*r*.85:.1f}')
burst = G(P('M' + ' L'.join(bp) + ' Z', '#ffd43b', 4) + f'<text x="-50" y="13" font-family="{FH}" font-weight="800" font-size="38" fill="{ACC}" stroke="{OUT}" stroke-width="2" paint-order="stroke" transform="rotate(-8)">RẦM!</text>', 198, 520)
oldman = person('oldman', 'angry', 'yell', arms=[[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (50, -100), (44, -134)]], look=(-.8, -.6))
mid = G(hero_boat(None, oar=False).replace(ripple(100), ''), 86, 588, 1.05, -24) + G(tube([(0, 0), (40, 70)], '#c08a48', 5), 150, 384, 1, 30)
mid += G(stall('bun-rieu', '#c8452c', '#f2c14e', oldman).replace(ripple(115), ''), 318, 590, .86, 22, True)
big = ''.join(P(f'M{x},0 Q{x+dx*.4},{-hh} {x+dx},{-hh*1.1} Q{x+dx*.6},{-hh*.5} {x+dx*1.3},0 Z', '#ffffff', 3.4) for x, dx, hh in ((-90, 24, 70), (-60, 20, 110), (-26, 22, 140), (8, 20, 120), (40, 20, 90), (70, 16, 60)))
big += ''.join(C(R.uniform(-110, 110), R.uniform(-170, -50), R.uniform(3, 8), '#ffffff', 2.6) for _ in range(14))
mid += G(foam(110, 150, 40), 196, 608) + burst
heroc = person('hero', 'scream', arms=[[(-26, -70), (-60, -96), (-76, -124)], [(26, -70), (60, -96), (78, -122)]], legs=True, hat=False, look=(0, 1))
mid += G(heroc, 150, 318, 1.0, -30) + nonla(244, 206, .95, 24) + G(bowl(), 312, 262, 1.5, 150)
mid += L('M296,280 q-8,14 4,26 M308,284 q-6,16 6,26', 3, '#fff1c9') + G(fish(), 252, 356, 1.25, -40) + G(durian(), 340, 368, 1, 20)
mid += L('M58,372 L46,404 M76,384 L68,410', 3, '#ffffff')
F['Crash.dc.html'] = page('Đụng thuyền', W, H, phone(svg(W, H, scene(W, H, 200, mid, far=False)), hud('04', '12', 'Ghe chèo'),
    panel(f'<div style="font-family: {FH}; font-weight: 800; font-size: 34px; line-height: 1; color: {ACC}">Đụng ghe rồi!</div>' + phrase(f'Bú{hl("ng")} {hl("gi")}êu', 'Bún riêu', OUT, 34)),
    bubble('Chèn đéc ơi, chạy ghe kiểu gì dị chời!', 176, 386, 204, 120)))
# 4 result
steps = ''
for i, n in enumerate(['Ghe chèo', 'Cano máy', 'Vê Ép 5', 'Du thuyền', 'Máy bay', 'Tàu vũ trụ']):
    on = i <= 2
    steps += (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1"><span style="width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: {FH}; font-weight: 800; font-size: 16px; '
              f'background: {ACC if i == 2 else (OUT if on else "#FFFFFF")}; color: {"#FFFFFF" if on else MUTED}; border: 2px solid {OUT if on else "#8C8576"}">{i+1}</span>'
              f'<span style="font-size: 11px; font-weight: 600; color: {OUT if on else MUTED}; line-height: 1.15">{n}</span></div>')
vin = f'<rect x="-160" y="-140" width="320" height="200" fill="url(#sky)"/><rect x="-160" y="6" width="320" height="60" fill="url(#water)"/>{sparkles(140, 10, 50, 8).replace("cx=", "data-x=") if False else ""}{v_veep()}'
vsvg = svg(320, 170, f'<g transform="translate(160,120) scale(.95)">{vin}</g>', 'role="img" aria-label="Cano điện Vê Ép 5"', 'display: block')
card = (f'<div style="background: {CREAM}; border: 3.5px solid {OUT}; border-radius: 24px; padding: 16px; box-shadow: 0 6px 0 {OUT}; display: flex; flex-direction: column; gap: 10px; align-items: center; text-align: center">'
        f'<div style="font-size: 13px; font-weight: 600; letter-spacing: .1em; color: {ACC}">KỶ LỤC MỚI</div><div style="font-family: {FH}; font-weight: 800; font-size: 92px; line-height: .9">13</div>'
        f'<div style="font-size: 15px; color: {MUTED}">Kỷ lục cũ: 12 câu</div>'
        f'<div style="border: 3px solid {OUT}; border-radius: 14px; overflow: hidden; line-height: 0">{vsvg}</div>'
        f'<div style="font-family: {FH}; font-weight: 800; font-size: 21px; line-height: 1.15">Lên tới cấp 3: cano điện Vê Ép 5</div><div style="display: flex; width: 100%; gap: 2px">{steps}</div>'
        f'<div style="display: flex; gap: 10px; width: 100%"><button style="flex: 1; min-height: 52px; font-family: {FH}; font-weight: 800; font-size: 20px; background: {ACC}; color: #FFFFFF; border: 3px solid {OUT}; border-radius: 16px; box-shadow: 0 4px 0 {OUT}">Chơi lại</button>'
        f'<button style="min-height: 52px; padding: 0 16px; font-family: {FH}; font-weight: 800; font-size: 18px; background: #FFFFFF; color: {OUT}; border: 3px solid {OUT}; border-radius: 16px; box-shadow: 0 4px 0 {OUT}">Về bến</button></div></div>')
F['Result.dc.html'] = page('Kết thúc lượt, kỷ lục', W, H, phone(svg(W, H, scene(W, H, HZ, '')), hud('13', '13', 'Cano điện Vê Ép 5'), '<div></div>', f'<div style="position: absolute; left: 16px; top: 104px; width: 358px">{card}</div>'))

# 5 characters
def sheet(title, sub, s, caps):
    cc = ''.join(f'<div style="flex: 1; text-align: center; font-family: {FH}; font-weight: 800; font-size: 20px; line-height: 1.15">{a}<div style="font-family: {FB}; font-weight: 400; font-size: 14px; color: {MUTED}; line-height: 1.3">{b}</div></div>' for a, b in caps)
    return (f'<div style="width: 1344px; height: 760px; box-sizing: border-box; padding: 28px 32px; background: {CREAM}; font-family: {FB}; color: {OUT}; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="display: flex; justify-content: space-between; align-items: baseline"><h1 style="margin: 0; font-family: {FH}; font-weight: 800; font-size: 34px">{title}</h1><div style="font-size: 15px; color: {MUTED}">{sub}</div></div>'
            f'<div style="border: 3.5px solid {OUT}; border-radius: 18px; overflow: hidden; line-height: 0">{s}</div><div style="display: flex; gap: 8px">{cc}</div></div>')
cast = [('hero', 'grin', None, dict(look=(.3, 0))), ('girl', 'laugh', [[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (36, -86), (16, -96)]], {}),
        ('granny', 'angry', [[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (50, -100), (46, -130)]], dict(mouth='tooth')),
        ('oldman', 'frown', [[(-26, -70), (-4, -52), (18, -58)], [(26, -70), (6, -50), (-16, -56)]], dict(look=(-.6, 0))),
        ('dude', 'laugh', [[(-28, -70), (-50, -50), (-30, -40)], [(28, -70), (50, -50), (30, -40)]], {}), ('cool', 'smug', [[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (52, -96), (58, -126)]], {})]
cs = f'<rect width="1280" height="480" fill="#ffe8b6"/><ellipse cx="640" cy="440" rx="700" ry="40" fill="#f2cf8a"/>'
for i, (k, e, a, kw) in enumerate(cast):
    sc = 1.5 if k != 'granny' else 1.3
    cs += E(140 + i * 200, 432, 56, 9, '#c79a55', 0).replace('fill="#c79a55"', 'fill="#c79a55" opacity=".5"') + G(person(k, e, arms=a, legs=True, **kw), 140 + i * 200, 432, sc)
cs += G(tube([(0, -110), (2, 60)], '#c08a48', 5) + P('M-10,50 L14,50 L16,92 L-12,92 Z', lg('#c08a48'), 3.4), 52, 340)
F['Characters.dc.html'] = page('Nhân vật', 1344, 760, sheet('Nhân vật', 'Đầu tròn to, viền đậm, đổ bóng mềm, mặt đổi theo tình huống',
    svg(1280, 480, cs, 'role="img" aria-label="Sáu nhân vật"', 'display: block'),
    [('Nhân vật chính', 'Nón lá, áo bà ba tím, khăn rằn'), ('Cô gái', 'Cười nghiêng ngả'), ('Bà già', 'Sún răng, chỉ tay la'), ('Ông già', 'Hói, râu dê, khoanh tay quạu'), ('Thanh niên', 'Cười ha hả'), ('Thanh niên kính đen', 'Tỉnh bơ')]))
vs = f'<rect width="1280" height="480" fill="url(#sky)"/><rect y="300" width="1280" height="180" fill="url(#water)"/>' + sparkles(1280, 300, 480, 40)
for i, (n, fn) in enumerate(VEH): vs += G(fn(), 110 + i * 212, 330, .82)
F['Vehicles.dc.html'] = page('6 cấp phương tiện', 1344, 760, sheet('6 cấp phương tiện', 'Cứ đọc được 5 câu thì lên một cấp, ngay trong lượt chơi',
    svg(1280, 480, vs, 'role="img" aria-label="Sáu phương tiện"', 'display: block'),
    [('1 · Ghe chèo', '0 tới 4 câu'), ('2 · Cano máy', '5 câu'), ('3 · Cano điện Vê Ép 5', '10 câu'), ('4 · Du thuyền', '15 câu'), ('5 · Máy bay', '20 câu'), ('6 · Tàu vũ trụ', '25 câu')]))

ex4 = [
    ('happy', dict(arms=[[(-26, -70), (-6, -58), (12, -70)], [(26, -70), (40, -60), (30, -52)]], look=(.4, -.2))),
    ('cocky', dict(mouth='grin', arms=[[(-26, -70), (-50, -100), (-52, -132)], [(26, -70), (6, -60), (-12, -68)]], hat_rot=-14)),
    ('scream', dict(arms=[[(-26, -70), (-60, -96), (-76, -124)], [(26, -70), (60, -96), (78, -122)]], legs=True, hat=False, look=(0, 1))),
    ('sad', dict(arms=[[(-26, -70), (-38, -46), (-30, -26)], [(26, -70), (38, -46), (30, -26)]], look=(0, 1))),
]
es = f'<rect width="1280" height="480" fill="#ffe8b6"/><ellipse cx="640" cy="440" rx="700" ry="40" fill="#f2cf8a"/>'
for i, (e, kw) in enumerate(ex4):
    x = 170 + i * 314
    legs = kw.pop('legs', False)
    if e == 'scream':
        es += G(person('hero', e, legs=True, **kw), x, 360, 1.45, -24) + nonla(x + 90, 120, 1, 26)
        es += G(foam(80, 70, 24), x, 432, 1) + L(f'M{x-120},250 L{x-136},290 M{x-100},270 L{x-110},300', 4, '#ffffff')
    elif e == 'sad':
        es += E(x, 432, 60, 9, '#c79a55', 0).replace('fill="#c79a55"', 'fill="#c79a55" opacity=".5"') + G(person('hero', e, legs=True, hat=False, **kw), x, 432, 1.5)
        es += nonla(x + 70, 434, .7, 168) + P(f'M{x-56},150 Q{x-40},120 {x-10},126 Q{x+20},110 {x+40},132 Q{x+66},134 {x+60},154 Q{x+40},166 {x-40},164 Q{x-66},164 {x-56},150 Z', '#8e98a8', 3.6)
        es += ''.join(L(f'M{x-30+j*20},172 L{x-36+j*20},190', 3.4, '#6fb7e8') for j in range(4))
    else:
        es += E(x, 432, 60, 9, '#c79a55', 0).replace('fill="#c79a55"', 'fill="#c79a55" opacity=".5"') + G(person('hero', e, legs=True, **kw), x, 432, 1.5)
        if e == 'cocky':
            for a in range(0, 360, 45):
                r = math.radians(a); es += L(f'M{x+math.cos(r)*150:.0f},{230+math.sin(r)*130:.0f} L{x+math.cos(r)*172:.0f},{230+math.sin(r)*150:.0f}', 5, '#f2b21b')
            es += ''.join(f'<path d="M{x+dx},{y-12} L{x+dx+3.5},{y-3.5} L{x+dx+12},{y} L{x+dx+3.5},{y+3.5} L{x+dx},{y+12} L{x+dx-3.5},{y+3.5} L{x+dx-12},{y} L{x+dx-3.5},{y-3.5} Z" fill="#ffd43b" stroke="#2a2420" stroke-width="2.4"/>' for dx, y in ((-120, 120), (110, 150), (130, 330)))
F['Expressions.dc.html'] = page('Biểu cảm nhân vật chính', 1344, 760, sheet('Biểu cảm nhân vật chính', 'Đổi mặt theo từng lúc trong game',
    svg(1280, 480, es, 'role="img" aria-label="Bốn biểu cảm của nhân vật chính"', 'display: block'),
    [('Vui', 'Lúc đang chèo, đọc câu'), ('Đắc chí', 'Nhảy qua ghe, phá kỷ lục: nheo mắt, giơ nắm đấm, nón nghiêng'), ('Đụng ghe', 'Văng lên trời, hét, nón bay'), ('Thua', 'Ướt nhẹp, mếu, mây mưa trên đầu')]))
for n, t in F.items(): open(os.path.join(ROOT, n), 'w').write(t)
c = json.load(open(os.path.join(ROOT, 'canvas.json')))
c['boards']['Characters.dc.html']['h'] = 760; c['boards']['Vehicles.dc.html']['h'] = 760
c['boards']['Expressions.dc.html'] = {'x': 0, 'y': 2170, 'w': 1344, 'h': 760, 'title': '7 · Biểu cảm nhân vật chính'}
if 'Expressions.dc.html' not in c['order']: c['order'].append('Expressions.dc.html')
json.dump(c, open(os.path.join(ROOT, 'canvas.json'), 'w'), ensure_ascii=False)
pv = '<html><head><meta charset="utf-8"></head><body style="margin:0;background:#888;display:flex;flex-wrap:wrap;gap:8px;width:1600px">' + ''.join(t.split('<x-dc>')[1].split('</x-dc>')[0].replace('<helmet>', '<div style="display:none">').replace('</helmet>', '</div>') for t in F.values()) + '</body></html>'
open('/home/claude/cho-noi/design/preview.html', 'w').write(pv)
print({n: len(t) // 1024 for n, t in F.items()})
