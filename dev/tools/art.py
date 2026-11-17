"""Hàm vẽ SVG dùng chung (tách nguyên văn từ design/gen4.py, hình đã duyệt 2026-11-14).
KHÔNG đổi giá trị mặc định: gen4.py và tools/export_sprites.py cùng dùng module này."""
import os, json, math, random
R = random.Random(5)
OUT = '#2a2420'; CREAM = '#fff7e3'; INK = '#1f2a30'; ACC = '#c2331c'; GREEN = '#0d7a52'; MUTED = '#55606a'
FH = "'Baloo 2', sans-serif"; FB = "'Be Vietnam Pro', sans-serif"

# ---------------- colour + defs registry ----------------
def sh(c, f):
    r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
    if f >= 1: r, g, b = [int(v + (255 - v) * (f - 1)) for v in (r, g, b)]
    else: r, g, b = [int(v * f) for v in (r, g, b)]
    return '#%02x%02x%02x' % (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
DEFS = {}
def lg(c, a=1.14, b=.84, vert=False):
    i = f'lg{c[1:]}{"v" if vert else ""}'
    if i not in DEFS:
        x2, y2 = ('0', '1') if vert else ('1', '1')
        DEFS[i] = f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{sh(c, a)}"/><stop offset="1" stop-color="{sh(c, b)}"/></linearGradient>'
    return f'url(#{i})'
def rg(c):
    i = f'rg{c[1:]}'
    if i not in DEFS:
        DEFS[i] = f'<radialGradient id="{i}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="{sh(c, 1.1)}"/><stop offset=".62" stop-color="{c}"/><stop offset="1" stop-color="{sh(c, .86)}"/></radialGradient>'
    return f'url(#{i})'
DEFS['krn'] = '<pattern id="krn" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#f6f2ea"/><rect width="3.5" height="3.5" fill="#2a2420"/><rect x="3.5" y="3.5" width="3.5" height="3.5" fill="#2a2420"/><rect x="3.5" width="3.5" height="3.5" fill="#8a8580"/><rect y="3.5" width="3.5" height="3.5" fill="#8a8580"/></pattern>'
DEFS['straw'] = '<linearGradient id="straw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc93"/><stop offset=".55" stop-color="#e2bd62"/><stop offset="1" stop-color="#bf9440"/></linearGradient>'
for k, sd in (('b1', 1.4), ('b2', 2.6), ('b4', 5)):
    DEFS[k] = f'<filter id="{k}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{sd}"/></filter>'
DEFS['sky'] = '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6e6"/><stop offset=".55" stop-color="#cfeaf0"/><stop offset=".85" stop-color="#ffe9bf"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>'
DEFS['water'] = '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe0cf"/><stop offset=".18" stop-color="#5cc3b2"/><stop offset=".6" stop-color="#2a9f98"/><stop offset="1" stop-color="#17777a"/></linearGradient>'
DEFS['haze'] = '<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d8" stop-opacity="0"/><stop offset="1" stop-color="#fff3d8" stop-opacity=".65"/></linearGradient>'
DEFS['glow'] = '<radialGradient id="glow"><stop offset="0" stop-color="#fff6d0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffe3a0" stop-opacity=".5"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/></radialGradient>'
DEFS['spark'] = '<radialGradient id="spark"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
UID = [0]
def uid(): UID[0] += 1; return f'u{UID[0]}'

# ---------------- primitives ----------------
def P(d, fill, sw=4, stroke=OUT, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke if sw else "none"}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'
def C(x, y, r, fill, sw=4, stroke=OUT): return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{fill}" stroke="{stroke if sw else "none"}" stroke-width="{sw}"/>'
def E(x, y, rx, ry, fill, sw=4, rot=0, stroke=OUT): return f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" stroke="{stroke if sw else "none"}" stroke-width="{sw}" transform="rotate({rot} {x:.1f} {y:.1f})"/>'
def L(d, sw=4, stroke=OUT, op=1): return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" opacity="{op}"/>'
def G(inner, x=0, y=0, s=1, rot=0, flip=False, op=1, filt=None):
    a = f' opacity="{op}"' if op != 1 else ''
    f = f' filter="url(#{filt})"' if filt else ''
    return f'<g transform="translate({x:.1f},{y:.1f}) rotate({rot}) scale({-s if flip else s},{s})"{a}{f}>{inner}</g>'
def tube(pts, color, w):
    d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    if len(pts) == 3:
        (a, b), (c, e), (f, g) = pts; d = f'M{a},{b} Q{c},{e} {f},{g}'
    return L(d, w + 7, OUT) + L(d, w, color)

# ---------------- characters ----------------
SKIN = '#f3c9a0'
CAST = {
    'hero':   dict(shirt='#7b4fb8', hair='#201b1d', hat=True, scarf=True),
    'girl':   dict(shirt='#f08db0', hair='#201b1d', hat=True, long=True),
    'granny': dict(shirt='#8b5a3a', hair='#d4d4da', bun=True, skin='#ecbd93', wrinkles=True, brow='#a9a9ad'),
    'oldman': dict(shirt='#5f86b2', hair='#f0f0f0', bald=True, skin='#ecbd93', wrinkles=True, brow='#f4f4f4', stache=True),
    'dude':   dict(shirt='#f6f2e6', hair='#201b1d', buzz=True, tank=True, towel=True, fat=1.18, skin='#e9b78c'),
    'cool':   dict(shirt='#ea6330', hair='#201b1d', pomp=True, shades=True, floral=True),
}
def eye(x, y, ex, look):
    lx, ly = look
    if ex == 'cocky':
        return P(f'M{x-10},{y-3} L{x+10},{y-3} Q{x+10},{y+9} {x},{y+9} Q{x-10},{y+9} {x-10},{y-3} Z', '#ffffff', 3.2) + C(x + 2, y + 3.5, 4, '#1b1718', 0) + L(f'M{x-12},{y-4} L{x+12},{y-4}', 4.5)
    if ex == 'sad':
        return E(x, y + 2, 9.5, 11, '#ffffff', 3.2) + C(x, y + 6, 4.6, '#1b1718', 0) + C(x + 1.6, y + 4, 1.4, '#ffffff', 0)
    if ex in ('laugh', 'squint'):
        return L(f'M{x-10},{y+3} Q{x},{y-9} {x+10},{y+3}', 4.5)
    big = ex in ('shock', 'scream')
    rx, ry, pr = (12.5, 15, 3.6) if big else (9.5, 11.5, 4.8)
    o = E(x, y, rx, ry, '#ffffff', 3.2)
    o += C(x + lx * (rx - pr - 2), y + ly * (ry - pr - 3), pr, '#1b1718', 0) + C(x + lx * (rx - pr - 2) + 1.6, y + ly * (ry - pr - 3) - 1.8, 1.4, '#ffffff', 0)
    return o
def brows(ex, col):
    # (outer_y, inner_y) relative ; positive = lower
    t = {'happy': (-145, -147, 'arc'), 'grin': (-146, -141, 'line'), 'angry': (-149, -134, 'line'), 'yell': (-151, -135, 'line'),
         'shock': (-156, -158, 'arc'), 'scream': (-157, -153, 'arc'), 'laugh': (-147, -149, 'arc'), 'smug': (-143, -143, 'line'),
         'frown': (-150, -137, 'line'), 'worry': (-140, -152, 'line'), 'sad': (-138, -152, 'line'), 'cocky': (-144, -150, 'arc')}[ex]
    w = 7 if col != '#201b1d' else 6
    o = ''
    for s in (-1, 1):
        ox, ix = s * 28, s * 7
        if t[2] == 'arc': o += L(f'M{ox},{t[0]+4} Q{s*17},{t[0]-6} {ix},{t[1]+3}', w, col)
        else: o += L(f'M{ox},{t[0]} L{ix},{t[1]}', w, col)
    return o
MOUTH = {
    'happy': lambda: P('M-15,-100 Q0,-97 15,-100 Q12,-84 0,-83 Q-12,-84 -15,-100 Z', '#6b1c17', 3.4) + P('M-12.5,-99.4 Q0,-97.4 12.5,-99.4 L11.5,-94.6 Q0,-93 -11.5,-94.6 Z', '#ffffff', 0) + E(0, -87.5, 6.5, 3, '#e56f6f', 0),
    'grin': lambda: P('M-21,-103 Q0,-95 21,-103 Q17,-85 0,-84 Q-17,-85 -21,-103 Z', '#6b1c17', 3.4) + P('M-19,-102 Q0,-95 19,-102 L17,-93 Q0,-88 -17,-93 Z', '#ffffff', 0) + L('M-8,-98 L-8,-91 M0,-97 L0,-89.5 M8,-98 L8,-91', 1.6, '#c9c0b8'),
    'laugh': lambda: P('M-23,-106 Q0,-101 23,-106 Q19,-78 0,-76 Q-19,-78 -23,-106 Z', '#6b1c17', 3.4) + P('M-20.5,-105 Q0,-100.5 20.5,-105 L19.5,-99 Q0,-95 -19.5,-99 Z', '#ffffff', 0) + E(0, -83, 9, 4.5, '#e56f6f', 0),
    'yell': lambda: P('M-21,-106 Q0,-111 21,-106 Q19,-80 0,-77 Q-19,-80 -21,-106 Z', '#5a1410', 3.4) + P('M-18,-105.6 Q0,-109.5 18,-105.6 L17,-101 Q0,-104 -17,-101 Z', '#ffffff', 0) + P('M-14,-82 Q0,-86 14,-82 L13,-79.5 Q0,-77.5 -13,-79.5 Z', '#ffffff', 0) + E(0, -88, 8, 3.6, '#e56f6f', 0),
    'scream': lambda: E(0, -91, 11.5, 16, '#5a1410', 3.4) + E(0, -82, 6.5, 4, '#e56f6f', 0),
    'shock': lambda: E(0, -93, 7, 9, '#5a1410', 3.4),
    'angry': lambda: P('M-17,-99 L17,-99 Q16,-88 0,-88 Q-16,-88 -17,-99 Z', '#ffffff', 3.4) + L('M-16,-93.5 L16,-93.5 M-8,-99 L-8,-88 M0,-99 L0,-88 M8,-99 L8,-88', 1.6, '#9a918a'),
    'smug': lambda: L('M-11,-95 Q4,-90 15,-101', 4.2),
    'frown': lambda: L('M-13,-90 Q0,-101 13,-90', 4.2),
    'tooth': lambda: P('M-15,-100 Q0,-97 15,-100 Q12,-83 0,-82 Q-12,-83 -15,-100 Z', '#6b1c17', 3.4) + P('M2,-99 L9,-99.6 L8.5,-92 L3,-92 Z', '#ffffff', 0),
    'worry': lambda: L('M-12,-92 Q-4,-97 0,-93 Q5,-89 12,-94', 4.2),
}
def face(cfg, ex, mouth, look):
    o = ''
    if cfg.get('shades'):
        o += P('M-33,-133 L-4,-133 Q-4,-116 -10,-113 L-27,-113 Q-33,-117 -33,-133 Z', '#141418', 3) + P('M4,-133 L33,-133 Q33,-117 27,-113 L10,-113 Q4,-116 4,-133 Z', '#141418', 3)
        o += L('M-4,-130 L4,-130', 3.4) + L('M-28,-129 L-18,-120', 2.4, '#ffffff', .7) + L('M9,-129 L19,-120', 2.4, '#ffffff', .7)
        o += L('M-33,-130 L-44,-126 M33,-130 L44,-126', 3)
    else:
        o += eye(-17, -124, ex, look) + eye(17, -124, ex, look)
    if ex == 'smug' and not cfg.get('shades'):
        o += P('M-27,-130 L-7,-130 L-7,-124 L-27,-124 Z', cfg.get('skin', SKIN), 0)
    o += brows(ex, cfg.get('brow', cfg['hair'] if cfg['hair'] == '#201b1d' else '#201b1d'))
    o += L('M-2,-112 Q4,-106 -1,-103', 3, sh(cfg.get('skin', SKIN), .7))
    o += E(-29, -104, 7.5, 4.2, '#f08070', 0) .replace('fill="#f08070"', 'fill="#f08070" opacity=".38"') + E(29, -104, 7.5, 4.2, '#f08070', 0).replace('fill="#f08070"', 'fill="#f08070" opacity=".38"')
    if cfg.get('wrinkles'):
        o += L('M-40,-128 L-34,-125 M-40,-121 L-34,-121 M40,-128 L34,-125 M40,-121 L34,-121', 2, sh(cfg.get('skin', SKIN), .65)) + L('M-12,-160 Q0,-163 12,-160 M-9,-154 Q0,-156 9,-154', 2, sh(cfg.get('skin', SKIN), .7))
    if cfg.get('stache'):
        o += P('M-21,-103 Q-11,-112 0,-105 Q11,-112 21,-103 Q12,-98 0,-101 Q-12,-98 -21,-103 Z', '#f6f6f6', 3)
    o += MOUTH[mouth]()
    if cfg.get('stache'):
        o += P('M-9,-80 Q0,-52 9,-80 Q0,-75 -9,-80 Z', '#f6f6f6', 3)
    if ex == 'sad':
        o += P('M-26,-114 Q-30,-96 -24,-80 Q-18,-96 -20,-114 Z', '#8fd6f5', 2.4) + P('M20,-114 Q18,-96 24,-80 Q30,-96 26,-114 Z', '#8fd6f5', 2.4)
    if ex in ('shock', 'scream', 'worry'):
        o += P('M47,-156 Q56,-140 49,-133 Q40,-137 47,-156 Z', '#a8e2f7', 2.8)
    if ex in ('angry', 'yell'):
        o += L('M30,-170 Q36,-164 30,-158 M36,-172 Q42,-166 48,-170 M42,-160 Q36,-155 42,-150 M28,-156 Q22,-150 16,-155', 3.2, '#d32f2f')
    return o
def nonla(x=0, y=0, s=1, rot=0):
    o = P('M-86,0 L0,-60 L86,0 Q0,17 -86,0 Z', 'url(#straw)', 4)
    o += L('M0,-58 L-50,5 M0,-58 L-22,9 M0,-58 L8,9 M0,-58 L36,8 M0,-58 L64,4', 1.4, '#a07a30', .7)
    o += L('M-60,-17 Q0,-8 60,-17 M-35,-34 Q0,-28 35,-34', 1.6, '#a07a30', .7) + L('M-84,1 Q0,18 84,1', 3, '#9a7330')
    return G(o, x, y, s, rot)
def person(kind='hero', ex='happy', mouth=None, arms=None, legs=False, hat=True, look=(0, 0), s=1, hat_rot=0):
    cfg = CAST[kind]; skin = cfg.get('skin', SKIN); shirt = cfg['shirt']; fat = cfg.get('fat', 1)
    mouth = mouth or {'sad': 'frown', 'cocky': 'grin', 'shock': 'shock', 'angry': 'angry', 'smug': 'smug', 'squint': 'grin'}.get(ex, ex if ex in MOUTH else 'happy')
    o = ''
    if cfg.get('long'): o += P('M-44,-140 Q-60,-84 -46,-58 Q0,-48 46,-58 Q60,-84 44,-140 Z', cfg['hair'], 4)
    if cfg.get('bun'): o += C(0, -176, 17, rg(cfg['hair']), 4)
    if legs:
        o += tube([(-13, -36), (-15, -4)], '#2c2c35', 16) + tube([(13, -36), (15, -4)], '#2c2c35', 16)
        o += E(-20, 0, 15, 7, '#3a2a20', 3.4) + E(20, 0, 15, 7, '#3a2a20', 3.4)
    A = arms or [[(-26, -70), (-44, -50), (-38, -30)], [(26, -70), (44, -50), (38, -30)]]
    armc = skin if cfg.get('tank') else lg(shirt)
    o += tube(A[0], skin if cfg.get('tank') else shirt, 14) + C(*A[0][-1], 9, rg(skin), 3.4)
    w0, w1 = 31 * fat, 27 * fat
    torso = f'M{-w0},-26 Q{-w0-4},-58 {-w1},-77 Q0,-86 {w1},-77 Q{w0+4},-58 {w0},-26 Q0,-20 {-w0},-26 Z'
    if cfg.get('tank'):
        o += P(torso, rg(skin), 4) + P(f'M{-w0+2},-28 Q{-w0},-56 -16,-70 Q0,-62 16,-70 Q{w0},-56 {w0-2},-28 Q0,-22 {-w0+2},-28 Z', lg(shirt), 3.4)
    else:
        o += P(torso, lg(shirt), 4)
        if not cfg.get('floral'): o += ''.join(C(0, y, 2.6, sh(shirt, .55), 0) for y in (-66, -54, -42)) + L('M0,-74 L0,-28', 2, sh(shirt, .7), .6)
    if cfg.get('floral'):
        for fx, fy in ((-18, -62), (12, -50), (-6, -38), (20, -68), (-22, -40), (16, -32)):
            o += ''.join(C(fx + math.cos(a) * 3.6, fy + math.sin(a) * 3.6, 2.8, '#fff3c4', 0) for a in (0, 1.26, 2.51, 3.77, 5.03)) + C(fx, fy, 2, '#f2b21b', 0)
        o += P('M-16,-78 L0,-62 L16,-78 L10,-80 L0,-70 L-10,-80 Z', sh(shirt, 1.15), 3)
    if cfg.get('towel'): o += P('M14,-80 L32,-74 L36,-30 L20,-32 Z', '#fffdf4', 3.4) + L('M18,-48 L34,-46', 2, '#d8cfb8')
    o += E(0, -80, 10, 6, skin, 0)
    if cfg.get('scarf'):
        o += P('M-32,-84 Q0,-70 32,-84 Q35,-73 30,-66 Q0,-55 -30,-66 Q-35,-73 -32,-84 Z', 'url(#krn)', 3.6)
        o += P('M-15,-66 L-3,-63 L-6,-30 L-20,-32 Z', 'url(#krn)', 3.4) + P('M4,-63 L16,-66 L23,-34 L9,-30 Z', 'url(#krn)', 3.4)
        o += L('M-19,-31 L-20,-23 M-15,-30.5 L-15.5,-22 M-11,-30 L-11,-22 M-7,-30 L-6.5,-22', 1.8) + L('M10,-30 L10,-22 M14,-31 L14.5,-23 M18,-32 L19,-24 M22,-33 L23,-25', 1.8)
    # head
    o += C(-44, -120, 9.5, rg(skin), 3.6) + C(44, -120, 9.5, rg(skin), 3.6)
    cid = uid()
    o += f'<clipPath id="{cid}"><circle cx="0" cy="-122" r="46"/></clipPath>'
    o += C(0, -122, 46, rg(skin), 4)
    o += f'<g clip-path="url(#{cid})"><path d="M-60,-180 H60 V-60 H-60 Z M-8,-130 m-46,0 a46,46 0 1,0 92,0 a46,46 0 1,0 -92,0 Z" fill="#a85a2a" fill-rule="evenodd" opacity=".16"/>'
    if hat and cfg.get('hat'): o += E(0, -150, 52, 13, '#6b3a16', 0).replace('fill="#6b3a16"', 'fill="#6b3a16" opacity=".22"')
    o += '</g>'
    hc = cfg['hair']
    if cfg.get('bun'): o += P('M-46,-122 Q-48,-170 0,-171 Q48,-170 46,-122 Q34,-150 0,-151 Q-34,-150 -46,-122 Z', rg(hc), 4)
    if cfg.get('buzz'): o += P('M-45,-126 Q-47,-170 0,-171 Q47,-170 45,-126 Q38,-152 0,-153 Q-38,-152 -45,-126 Z', hc, 4) + L('M-20,-163 Q0,-168 20,-163', 2.4, '#4a4446')
    if cfg.get('pomp'): o += P('M-46,-122 Q-52,-176 -8,-184 Q42,-192 58,-162 Q50,-145 32,-150 Q0,-156 -46,-122 Z', hc, 4) + L('M-10,-176 Q20,-182 40,-168', 3, '#5a5357')
    if cfg.get('bald'):
        o += E(-10, -155, 14, 6, '#ffffff', 0, -20).replace('fill="#ffffff"', 'fill="#ffffff" opacity=".45"')
        o += P('M-46,-128 Q-60,-138 -50,-150 Q-46,-138 -40,-142 Q-44,-130 -46,-128 Z', hc, 3) + P('M46,-128 Q60,-138 50,-150 Q46,-138 40,-142 Q44,-130 46,-128 Z', hc, 3)
    o += face(cfg, ex, mouth, look)
    if cfg.get('hat') and not hat:
        o += P('M-46,-118 Q-50,-172 0,-172 Q50,-172 46,-118 Q40,-146 14,-150 Q20,-140 8,-136 Q4,-148 -14,-150 Q-38,-146 -46,-118 Z', rg(hc), 4)
    if cfg.get('hat') and hat:
        o += P('M-44,-140 Q-34,-131 -24,-142 Q-14,-130 -4,-142 Q6,-131 16,-142 Q26,-130 36,-142 L44,-142 L44,-152 L-44,-152 Z', hc, 3.4) if kind == 'hero' else P('M-44,-138 Q-20,-150 0,-136 Q20,-150 44,-138 L44,-152 L-44,-152 Z', hc, 3.4)
        o += nonla(0, -149, 1, hat_rot)
    tube_c = skin if cfg.get('tank') else shirt
    o += tube(A[1], tube_c, 14) + C(*A[1][-1], 9, rg(skin), 3.4)
    return G(o, 0, 0, s)

# ---------------- props ----------------
def bowl():
    return (P('M-22,-12 Q-20,9 0,9 Q20,9 22,-12 Z', '#fbfbfb', 3.4) + L('M-19,-2 Q0,4 19,-2', 2.4, '#3f7fb0') + E(0, -12, 22, 6.5, '#ea6a2c', 3.4)
            + C(-8, -13, 3, '#4fb06e', 0) + C(5, -11, 3.6, '#f2c58e', 0) + C(11, -14, 2.4, '#d3362c', 0) + C(-1, -15, 2.2, '#4fb06e', 0))
def plate():
    return (E(0, 0, 28, 8.5, '#fbfbfb', 3.4) + P('M-18,-2 Q-16,-18 -2,-18 Q8,-18 8,-2 Z', '#fff6dc', 3) + P('M4,-12 Q18,-20 24,-8 Q20,0 6,-2 Z', '#9a4a1e', 3)
            + E(-4, 2, 8, 4, '#ffffff', 2.4) + C(-4, 1.5, 3, '#f5b324', 0))
def durian():
    pts = []
    for i in range(24):
        a = i * 6.283 / 24; r = 1 if i % 2 else 1.28; pts.append(f'{math.cos(a) * 16 * r:.1f},{math.sin(a) * 20 * r:.1f}')
    return P('M' + ' L'.join(pts) + ' Z', lg('#a9bd3f'), 3) + L('M0,-24 L2,-33', 4.5, '#6b4a2b')
def rambutan():
    o = ''
    for x, y in ((-10, 0), (8, -3), (0, 10)):
        pts = []
        for i in range(18):
            a = i * 6.283 / 18; r = 1 if i % 2 else 1.35; pts.append(f'{x + math.cos(a) * 8 * r:.1f},{y + math.sin(a) * 8 * r:.1f}')
        o += P('M' + ' L'.join(pts) + ' Z', '#da3a2c', 2.4)
    return o
def fish(): return P('M-26,0 Q-10,-13 12,-9 Q20,-5 22,0 L34,-11 L34,11 L22,0 Q20,6 12,9 Q-10,13 -26,0 Z', lg('#93a8b2'), 3.4) + C(-14, -2, 3.4, '#ffffff', 2) + C(-13, -2, 1.5, OUT, 0)
def pot(): return P('M-20,-30 L20,-30 L17,0 L-17,0 Z', lg('#b9bec4'), 3.4) + E(0, -30, 20, 5.5, '#ea6a2c', 3.4) + L('M-26,-24 L-20,-24 M20,-24 L26,-24', 4)
def steam(x, y): return ''.join(L(f'M{x+dx},{y} q-6,-9 0,-18 q6,-9 0,-18', 3.4, '#ffffff', .8) for dx in (-8, 6))

# ---------------- boats ----------------
def hull(Lg, color, eye=True, rim='#f6e7c3'):
    h = Lg / 2
    d = f'M{-h-12},-36 Q{-h-2},-18 {-h+16},-16 L{h-34},-16 Q{h+4},-20 {h+24},-52 Q{h+18},-6 {h-14},14 Q0,26 {-h+20},16 Q{-h-6},2 {-h-12},-36 Z'
    o = f'<ellipse cx="0" cy="18" rx="{h+18}" ry="8" fill="#0d5e60" opacity=".35"/>'
    o += P(d, lg(color, 1.12, .78, True), 4)
    o += L(f'M{-h-9},-31 Q{-h},-19 {-h+16},-17 L{h-34},-17 Q{h+3},-21 {h+21},-48', 4.5, rim) + L(f'M{-h+6},-2 Q0,6 {h-12},-3 M{-h+16},8 Q0,14 {h-24},7', 2.2, sh(color, .62), .7)
    if eye:
        ex = h - 14
        o += P(f'M{ex-18},-26 Q{ex-2},-40 {ex+16},-30 Q{ex+2},-16 {ex-18},-26 Z', '#d63a26', 2.6) + E(ex - 1, -28, 9, 6, '#ffffff', 2.4) + C(ex + 2, -28, 3.6, OUT, 0) + C(ex + 3.4, -29.4, 1.2, '#ffffff', 0)
    return o
def ripple(w): return f'<ellipse cx="0" cy="20" rx="{w}" ry="9" fill="none" stroke="#e8fff8" stroke-width="2.6" opacity=".6"/>' + f'<ellipse cx="0" cy="22" rx="{w+20}" ry="12" fill="none" stroke="#e8fff8" stroke-width="1.8" opacity=".3"/>'
def awning(color):
    o = ''
    for i in range(7):
        x0 = -100 + i * 18; o += P(f'M{x0},-136 L{x0+18},-136 L{x0+18},-118 L{x0},-118 Z', color if i % 2 == 0 else '#fff6dc', 0)
    o += P('M-100,-136 L26,-136 L26,-118 L-100,-118 Z', 'none', 4)
    o += ''.join(P(f'M{-100+i*18},-118 Q{-91+i*18},-106 {-82+i*18},-118 Z', color if i % 2 == 0 else '#fff6dc', 3) for i in range(7))
    return o
ITEM = {'bun-rieu': bowl, 'com-tam': plate, 'fruit': durian}
def stall(kind, color, awn, vendor='', Lg=230, layer='all'):
    """layer='all' giống hệt bản duyệt; 'back' = gợn nước + cột (vẽ SAU người bán); 'front' = hàng, mái, thân ghe, cây bẹo."""
    back = tube([(-84, -14), (-84, -124)], '#9a6a3a', 5) + tube([(14, -14), (14, -124)], '#9a6a3a', 5)
    if kind == 'bun-rieu': front = G(pot(), 42, -14) + steam(42, -50) + G(bowl(), -78, -16, .85)
    elif kind == 'com-tam': front = G(plate(), 40, -20) + G(plate(), -76, -22, .85) + P('M20,-40 L56,-40 L56,-18 L20,-18 Z', lg('#3c3c44'), 3.4) + steam(38, -44)
    elif kind in DECK: front = DECK[kind]()
    else: front = P('M20,-34 L60,-34 L54,-14 L26,-14 Z', lg('#c99a55'), 3.4) + G(rambutan(), 34, -38) + G(rambutan(), 48, -40) + G(durian(), -74, -36, .85)
    front += awning(awn)
    front += hull(Lg, color)
    front += tube([(66, -12), (68, -196)], '#d0a630', 5) + tube([(68, -192), (100, -188)], '#d0a630', 4) + L('M98,-188 L98,-172', 2)
    front += G(ITEM[kind](), 98, -150, 1.3)
    if layer == 'back': return ripple(Lg / 2) + back
    if layer == 'front': return front
    return ripple(Lg / 2) + back + G(vendor, -36, 14) + front
def hero_boat(p=None, oar=True):
    o = ''
    if p is not None: o += G(p, -30, 16)
    o += hull(200, '#a8693a')
    o += P('M14,-26 L48,-26 L48,-16 L14,-16 Z', lg('#e2bd62'), 3)
    if oar: o += tube([(-2, -74), (62, 30)], '#c08a48', 5) + P('M54,18 L72,40 L62,50 L46,28 Z', lg('#c08a48'), 3.4)
    return ripple(100) + o

# ---------------- scenery ----------------
def palm(h=100, lean=12, col='#2f9c5a', trunk='#8a5a3b', sw=3):
    o = L(f'M0,0 Q{lean*.2},{-h*.5} {lean},{-h}', 8 + sw, OUT if sw else trunk) + L(f'M0,0 Q{lean*.2},{-h*.5} {lean},{-h}', 8, trunk)
    for a in (-165, -130, -95, -55, -20, 12):
        r = math.radians(a); ex, ey = math.cos(r) * 52, math.sin(r) * 34 + 14
        o += P(f'M{lean},{-h} Q{lean+ex*.5},{-h+ey*.5-22} {lean+ex},{-h+ey} Q{lean+ex*.45},{-h+ey*.4-8} {lean},{-h} Z', col if a % 2 else sh(col, 1.18), sw)
    return o
def house(roof, wall='#f4e3bd', sw=3):
    return (L('M-20,0 L-20,-14 M20,0 L20,-14', 3, '#6b4a2b') + P('M-26,-14 L26,-14 L26,-40 L-26,-40 Z', wall, sw) + P('M-33,-40 L0,-62 L33,-40 Z', roof, sw)
            + P('M-15,-14 L-5,-14 L-5,-30 L-15,-30 Z', '#8a5a3b', sw * .6) + P('M5,-32 L17,-32 L17,-24 L5,-24 Z', '#8fd0e6', sw * .6))
def hyacinth():
    o = E(0, 0, 32, 10, lg('#2f9c5a'), 3.4) + E(26, 6, 22, 8, lg('#46b36c'), 3.4) + E(-24, 7, 18, 7, lg('#3a9e5e'), 3.4)
    o += L('M2,-2 L4,-30', 3.4, '#2f7d48') + ''.join(C(4 + math.cos(a) * 7, -34 + math.sin(a) * 7, 6, '#b48ae3' if i % 2 else '#9a6fd6', 2.2) for i, a in enumerate((0, 1.26, 2.51, 3.77, 5.03))) + C(4, -34, 4, '#ffd84a', 0)
    return o
def foam(wd, ht, n=26):
    o = E(0, 2, wd, 9, '#ffffff', 3)
    for i in range(n):
        t = R.random(); x = R.uniform(-wd, wd) * (1 - t * .55); y = -t * ht * (1 - (x / wd) ** 2 * .6); r = 5 + (1 - t) * 9 * R.uniform(.6, 1.2)
        o += C(x, y, r, '#ffffff', 2.8)
    for i in range(8):
        x = R.uniform(-wd * 1.2, wd * 1.2); y = -ht * R.uniform(.7, 1.2)
        o += P(f'M{x:.0f},{y-8:.0f} Q{x+5:.0f},{y+2:.0f} {x:.0f},{y+5:.0f} Q{x-5:.0f},{y+2:.0f} {x:.0f},{y-8:.0f} Z', '#e8fbff', 2.4)
    return o
def sparkles(w, hz, h, n=46):
    o = ''
    for _ in range(n):
        t = R.random(); x = R.uniform(6, w - 6); y = hz + 8 + t * (h - hz - 12); r = 1.6 + t * 5
        o += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r*2.6:.1f}" fill="url(#spark)" opacity=".7"/>'
        o += f'<path d="M{x:.1f},{y-r:.1f} L{x+r*.25:.1f},{y-r*.25:.1f} L{x+r:.1f},{y:.1f} L{x+r*.25:.1f},{y+r*.25:.1f} L{x:.1f},{y+r:.1f} L{x-r*.25:.1f},{y+r*.25:.1f} L{x-r:.1f},{y:.1f} L{x-r*.25:.1f},{y-r*.25:.1f} Z" fill="#ffffff"/>'
    return o
VCOLS = ['#d9668f', '#2c6e91', '#e0a126', '#6b4e9b', '#3e8e5a', '#c8452c', '#3aa7c9']
VK = ['girl', 'dude', 'oldman', 'granny', 'cool', 'girl', 'dude']
def scene(w, h, hz, mid, fg='', far=True, sunx=None):
    sunx = w * .78 if sunx is None else sunx
    o = f'<rect width="{w}" height="{hz+4}" fill="url(#sky)"/>'
    o += f'<circle cx="{sunx}" cy="{hz-70}" r="130" fill="url(#glow)"/>' + C(sunx, hz - 70, 26, '#fff4c8', 0)
    o += G(E(0, 0, 60, 14, '#ffffff', 0) + E(30, -10, 36, 16, '#ffffff', 0) + E(-28, -6, 30, 12, '#ffffff', 0), w * .22, hz * .32, 1, 0, False, .85, 'b2')
    o += G(E(0, 0, 44, 10, '#ffffff', 0) + E(20, -8, 26, 12, '#ffffff', 0), w * .62, hz * .5, 1, 0, False, .7, 'b2')
    bank = ''
    bank += P(f'M-10,{hz+4} L-10,{hz-30} Q{w*.15},{hz-48} {w*.32},{hz-32} T{w*.64},{hz-34} T{w+10},{hz-36} L{w+10},{hz+4} Z', '#6fb88e', 0)
    for i, fx in enumerate((.03, .14, .25, .37, .47, .58, .7, .8, .9, .99)):
        bank += G(palm(84 + (i % 3) * 18, (-1) ** i * 12, '#4f9e74', '#7b6550', 0), w * fx, hz - 26 - (i % 2) * 8, .62)
    for fx, c in ((.2, '#e07a52'), (.52, '#6a9fd8'), (.84, '#e9c45c')): bank += G(house(c, '#f3e6c8', 0), w * fx, hz - 8, .7)
    bank += P(f'M-10,{hz+4} L-10,{hz-14} Q{w*.3},{hz-24} {w*.6},{hz-16} T{w+10},{hz-18} L{w+10},{hz+4} Z', '#5aa77c', 0)
    o += G(bank, filt='b2') + f'<rect y="{hz-70}" width="{w}" height="76" fill="url(#haze)"/>'
    o += f'<rect y="{hz}" width="{w}" height="{h-hz}" fill="url(#water)"/>'
    for i in range(10):
        yy = hz + 6 + i * i * 2.6; ww = 10 + i * 9
        o += E(sunx, yy, ww, 1.6 + i * .25, '#fff2c4', 0).replace('fill="#fff2c4"', f'fill="#fff2c4" opacity="{.85-i*.06:.2f}"')
    for _ in range(40):
        t = R.random() ** 1.4; y = hz + 10 + t * (h - hz - 20); x = R.uniform(0, w); rw = 8 + t * 40
        o += f'<path d="M{x-rw:.0f},{y:.0f} Q{x:.0f},{y-2-t*3:.1f} {x+rw:.0f},{y:.0f}" fill="none" stroke="#e8fff8" stroke-width="{1+t*1.6:.1f}" opacity="{.25+t*.2:.2f}" stroke-linecap="round"/>'
    if far:
        vf = ''
        for i in range(4):
            v = person(VK[i], ['happy', 'laugh', 'grin', 'happy'][i])
            vf += G(stall(['fruit', 'com-tam', 'bun-rieu', 'fruit'][i], VCOLS[i], VCOLS[(i + 3) % 7], v), w * (.1 + i * .27), hz + 18, .2, 0, i % 2 == 0)
        o += G(vf, filt='b2', op=.85)
        vm = ''
        for i in range(2):
            v = person(VK[i + 4], ['laugh', 'happy'][i])
            vm += G(stall(['com-tam', 'fruit'][i], VCOLS[i + 4], VCOLS[i + 1], v), w * (.14 + i * .5), hz + 52, .3, 0, i == 1)
        o += G(vm, filt='b1')
    o += sparkles(w, hz, h)
    o += mid + fg
    return o
def svg(w, h, inner, aria='aria-hidden="true"', style='position: absolute; left: 0; top: 0; display: block'):
    return f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" {aria} style="{style}"><defs>{"".join(DEFS.values())}</defs>{inner}</svg>'

# ---------------- vehicles ----------------
def mini(ex='happy', **k): return person('hero', ex, **k)
def v_ghe(ex='happy', rider=True): return hero_boat(mini(ex) if rider else None)
def v_cano(ex='laugh', rider=True):
    o = ''.join(C(-122 - i * 16, -40 - i * 14, 9 + i * 4, '#d4d8dc', 0).replace('fill="#d4d8dc"', f'fill="#d4d8dc" opacity="{.85-i*.2:.2f}"') for i in range(3))
    o += G(mini(ex, arms=[[(-26, -70), (-6, -56), (16, -62)], [(26, -70), (40, -60), (34, -52)]]), -30, 8, .8) if rider else ''
    o += P('M-110,-46 L-90,-46 L-90,-10 L-110,-10 Z', lg('#2c3036'), 3.4) + tube([(-100, -10), (-101, 18)], '#2c3036', 5)
    o += P('M-94,-22 L60,-24 Q102,-26 120,-44 Q108,6 70,16 L-80,16 Q-96,8 -94,-22 Z', lg('#ffffff', 1, .86, True), 4) + P('M-92,-2 L104,-6 Q94,8 70,16 L-80,16 Q-92,10 -92,-2 Z', lg('#d33c2a', 1.1, .8, True), 3)
    o += P('M20,-24 L36,-50 L54,-50 L58,-24 Z', '#a9def0', 3.4)
    return ripple(110) + o
def v_veep(ex='laugh', rider=True):
    o = G(mini(ex, arms=[[(-26, -70), (-46, -96), (-44, -120)], [(26, -70), (40, -60), (34, -52)]]), -14, 0, .72) if rider else ''
    o += P('M-104,-18 Q-104,-28 -84,-28 L54,-30 Q104,-30 128,-50 Q116,6 76,16 L-86,16 Q-106,8 -104,-18 Z', lg('#12a694', 1.1, .78, True), 4) + P('M-100,0 L108,-6 Q98,8 76,16 L-86,16 Q-100,10 -100,0 Z', '#ffffff', 3)
    o += P('M-56,-28 Q-40,-66 6,-68 Q40,-66 54,-30 Z', '#bfeaf6', 3.4).replace('fill="#bfeaf6"', 'fill="#bfeaf6" fill-opacity=".45"')
    o += f'<text x="-92" y="-6" font-family="{FH}" font-weight="800" font-size="25" fill="#ffffff" stroke="{OUT}" stroke-width="1.4" paint-order="stroke">Vê Ép 5</text>'
    o += P('M28,-26 L12,-4 L22,-4 L14,14 L38,-10 L27,-10 L36,-26 Z', '#ffd43b', 2.6)
    return ripple(115) + o
def v_yacht(ex='laugh', rider=True):
    o = P('M-122,-20 L70,-24 Q120,-26 140,-48 Q126,6 86,16 L-104,16 Q-122,8 -122,-20 Z', lg('#ffffff', 1, .86, True), 4) + P('M-118,0 L116,-6 Q106,8 86,16 L-104,16 Q-118,10 -118,0 Z', lg('#28557f', 1.1, .8, True), 3)
    o += P('M-90,-22 L-88,-56 L56,-58 L78,-24 Z', lg('#ffffff', 1, .9, True), 3.6) + P('M-78,-48 L46,-50 L52,-36 L-78,-34 Z', '#23364e', 2.4)
    o += P('M-66,-56 L-64,-82 L22,-84 L38,-58 Z', lg('#ffffff', 1, .9, True), 3.6) + P('M-56,-76 L18,-78 L22,-66 L-56,-64 Z', '#23364e', 2.4)
    o += L('M-78,-56 L-79,-112', 3.2) + P('M-78,-112 L-50,-110 L-50,-94 L-78,-95 Z', '#da251d', 2.6) + C(-64, -102.5, 4, '#ffd43b', 0)
    o += G(mini(ex, arms=[[(-26, -70), (-46, -96), (-50, -122)], [(26, -70), (46, -96), (50, -122)]]), 90, -12, .58) if rider else ''
    return ripple(125) + o
def v_plane(ex='laugh', rider=True):
    o = P('M-74,6 L72,4 Q88,0 92,-8 Q86,18 70,18 L-66,18 Q-78,16 -74,6 Z', lg('#ffffff', 1, .86, True), 3.6) + tube([(-38, 4), (-28, -30)], '#5a5a5a', 3) + tube([(42, 4), (32, -30)], '#5a5a5a', 3)
    o += P('M-60,-70 L-118,-102 L-124,-92 L-94,-52 Z', lg('#d33c2a'), 3.6)
    o += tube([(-70, -88), (-70, -72)], '#5a5a5a', 3) + tube([(-20, -88), (-20, -72)], '#5a5a5a', 3)
    o += P('M-110,-98 L-4,-100 L-2,-86 L-110,-84 Z', lg('#d33c2a'), 3.6)
    o += G(mini(ex, arms=[[(-26, -70), (-50, -100), (-56, -130)], [(26, -70), (50, -100), (60, -130)]]), 40, -16, .6) if rider else ''
    o += P('M-100,-54 Q-66,-74 64,-76 Q104,-72 110,-54 Q100,-30 64,-30 L-70,-30 Q-98,-34 -100,-54 Z', lg('#f7b81b', 1.1, .82, True), 4)
    o += P('M14,-70 Q40,-60 66,-71', 'none', 3.6) + P('M66,-74 Q76,-94 86,-74 Z', '#bfeaf6', 3).replace('fill="#bfeaf6"', 'fill="#bfeaf6" fill-opacity=".6"')
    o += C(110, -54, 7, '#2c3036', 3) + L('M112,-90 L111,-18', 6, '#2c3036')
    return ripple(100) + o
def v_ufo(ex='laugh', rider=True):
    o = P('M-34,-50 L-70,16 L70,16 L34,-50 Z', '#a6f5e6', 0).replace('fill="#a6f5e6"', 'fill="#a6f5e6" opacity=".4"') + ripple(60)
    o += G(mini(ex, hat=False, arms=[[(-26, -70), (-50, -100), (-56, -128)], [(26, -70), (40, -60), (34, -52)]]), 0, -10, .74) if rider else ''
    o += P('M-76,-62 Q-74,-176 0,-182 Q74,-176 76,-62 Z', '#bfeaf6', 3.6).replace('fill="#bfeaf6"', 'fill="#bfeaf6" fill-opacity=".32"') + L('M-50,-130 Q-42,-160 -14,-168', 5, '#ffffff', .7)
    o += P('M-112,-56 Q-60,-82 0,-82 Q60,-82 112,-56 Q60,-36 0,-36 Q-60,-36 -112,-56 Z', lg('#dfe5ea', 1.1, .78, True), 4)
    o += ''.join(C(-64 + i * 32, -50, 5.5, '#ffd43b' if i % 2 == 0 else '#5ff0dc', 2.4) for i in range(5))
    o += nonla(0, -178, .7)
    return o
VEH = [('Ghe chèo', v_ghe), ('Cano máy', v_cano), ('Cano điện Vê Ép 5', v_veep), ('Du thuyền', v_yacht), ('Máy bay', v_plane), ('Tàu vũ trụ', v_ufo)]

# ---------------- B3: món tượng trưng cho các ghe còn lại (cùng phong cách: viền OUT dày, gradient lg/rg) ----------------
# Lưu ý: chỉ là hàm, không gọi lúc import, để DEFS của gen4.py không đổi.
def crate(x0=20, x1=60, top=-34, col='#c99a55'):
    return P(f'M{x0},{top} L{x1},{top} L{x1-6},-14 L{x0+6},-14 Z', lg(col), 3.4) + L(f'M{x0+4},{top+8} L{x1-4},{top+8}', 1.8, sh(col, .65), .7)
def fish_hang(): return L('M0,-34 L0,-24', 2) + G(fish(), 0, 4, .8, -90)
def rau():
    o = ''
    for dx, ex in ((-16, -22), (-6, -26), (6, -26), (16, -20), (0, -30)):
        o += tube([(0, 20), (dx * .55, -2), (dx, ex + 8)], '#79c257', 2.6)
    for dx, ex, rot in ((-16, -22, -24), (-6, -26, -8), (6, -26, 10), (16, -20, 26), (0, -30, 0)):
        o += G(P('M0,0 Q-7,-8 -3,-18 L0,-22 L3,-18 Q7,-8 0,0 Z', lg('#3fa34d'), 2.6), dx, ex + 8, 1, rot)
    o += P('M-8,6 L8,6 L7,12 L-7,12 Z', '#d94a8c', 2.6)
    return o
def nuocmia():
    o = tube([(-18, 20), (14, -30)], '#8a5a6e', 5) + L('M-10,8 L-6,10 M2,-8 L6,-6', 2)
    o += P('M-12,-18 L12,-18 L9,20 L-9,20 Z', lg('#c9df6e', 1.12, .88, True), 3.4)
    o += P('M-7,-12 L-1,-12 L-1,-6 L-7,-6 Z', '#ffffff', 1.6).replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity=".6"') + P('M1,-6 L7,-6 L7,0 L1,0 Z', '#ffffff', 1.6).replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity=".6"')
    o += E(0, -18, 12, 3.6, '#f3f0c6', 3) + tube([(4, -16), (10, -32)], '#e0503a', 2.4)
    return o
def banhtet():
    o = P('M-12,-20 L12,-20 L12,20 Q0,25 -12,20 Z', lg('#3e8e3a'), 3.4)
    o += L('M-12,-6 Q0,-2 12,-6 M-12,8 Q0,12 12,8', 2.6, '#efe2b0') + L('M-3,-19 L-3,22 M4,-19 L4,22', 2.2, '#efe2b0')
    o += E(0, -20, 12, 5, '#7a3b8f', 3.4) + E(0, -20, 7, 3, '#f2c24b', 0) + E(0, -20, 3.2, 1.6, '#e7a7a0', 0)
    o += L('M0,-26 L0,-34', 2)
    return o
def caphe():
    o = P('M-12,-18 L12,-18 L9,20 L-9,20 Z', lg('#a0643a', 1.15, .7, True), 3.4)
    o += P('M-10,-16 L10,-16 L9.4,-6 L-9.4,-6 Z', '#e9d2a6', 0)
    o += P('M-6,-12 L0,-12 L0,-6 L-6,-6 Z', '#ffffff', 1.6).replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity=".55"') + P('M2,-4 L8,-4 L8,2 L2,2 Z', '#ffffff', 1.6).replace('fill="#ffffff"', 'fill="#ffffff" fill-opacity=".5"')
    o += E(0, -18, 12, 3.6, '#f7f1e0', 3) + tube([(-3, -16), (-8, -32)], '#2b8a5a', 2.4)
    return o
def phin():
    return P('M-11,-24 L11,-24 L9,-8 L-9,-8 Z', lg('#c9ced4'), 3) + E(0, -24, 11, 3, '#dfe3e7', 2.6) + E(0, -8, 15, 3.4, '#c9ced4', 2.6) + G(caphe(), 0, 12, .8)
def hutieu():
    return (P('M-22,-12 Q-20,9 0,9 Q20,9 22,-12 Z', '#fbfbfb', 3.4) + L('M-19,-2 Q0,4 19,-2', 2.4, '#3f7fb0') + E(0, -12, 22, 6.5, '#f1d48c', 3.4)
            + L('M-14,-12 Q-6,-16 2,-12 Q8,-9 14,-13', 2.2, '#ffffff') + L('M-12,-10 Q-2,-14 10,-10', 1.8, '#ffffff')
            + P('M2,-16 Q10,-20 12,-13 Q8,-10 4,-12', '#f08a4b', 2) + C(-9, -14, 2.6, '#4fb06e', 0) + C(-3, -11, 2, '#4fb06e', 0) + C(13, -11, 2.2, '#4fb06e', 0))
def pot2(broth='#f1d48c'): return P('M-20,-30 L20,-30 L17,0 L-17,0 Z', lg('#b9bec4'), 3.4) + E(0, -30, 20, 5.5, broth, 3.4) + L('M-26,-24 L-20,-24 M20,-24 L26,-24', 4)
def banhtrang():
    o = L('M0,-34 L0,16', 2)
    for y in (-18, -2, 14):
        o += E(0, y, 17, 7, lg('#f3dfb0'), 3) + ''.join(C(dx, y + dy, 1, OUT, 0) for dx, dy in ((-8, -1), (-2, 2), (5, -2), (10, 1))) + C(-4, y - 1, 1.3, '#d3362c', 0) + C(7, y + 2, 1.3, '#d3362c', 0)
    return o
def keokeo():
    o = P('M-3,-24 L3,-24 L3,22 L-3,22 Z', '#fff4ef', 2.8)
    o += ''.join(L(f'M-3,{y} L3,{y+6}', 2.2, '#e8649a') for y in range(-22, 20, 7))
    return o
def snack(): return G(banhtrang(), -4, 0) + G(keokeo(), 18, 6, .8, 14)
def candyjar():
    o = P('M-14,-26 L14,-26 L16,0 L-16,0 Z', '#d8f2f6', 3.2).replace('fill="#d8f2f6"', 'fill="#d8f2f6" fill-opacity=".75"')
    o += ''.join(C(x, y, 4, c, 1.8) for x, y, c in ((-8, -6, '#e8649a'), (1, -5, '#f2c24b'), (9, -7, '#5cc3b2'), (-4, -14, '#7b4fb8'), (6, -15, '#e8649a')))
    return o + P('M-12,-32 L12,-32 L12,-26 L-12,-26 Z', '#d33c2a', 3)
def diendien():
    o = ''
    for dx, top in ((-10, -18), (0, -26), (10, -16), (-4, -10), (6, -8)):
        o += L(f'M0,22 Q{dx*.4},4 {dx},{top+6}', 2.4, '#4f9e4a')
    for dx, dy in ((-10, -18), (-4, -24), (2, -28), (8, -22), (12, -14), (-12, -10), (0, -14), (6, -8), (-6, -4)):
        o += E(dx, dy, 4.2, 3, '#f7c31b', 2, (dx * 7) % 60)
    o += P('M-6,10 L6,10 L5,15 L-5,15 Z', '#d94a8c', 2.4)
    return o
def laupot(): return pot2('#8a5a2e') + C(-8, -32, 2.6, '#f7c31b', 0) + C(4, -31, 2.6, '#f7c31b', 0) + C(10, -33, 2.2, '#4fb06e', 0) + P('M-17,0 L17,0 L14,8 L-14,8 Z', lg('#3c3c44'), 3)
def vitquay():
    o = L('M0,-34 Q6,-30 2,-24', 2.6) + tube([(2, -24), (-4, -14), (2, -6)], '#b5562a', 5)
    o += E(1, 8, 15, 17, lg('#c2602c', 1.2, .72), 3.4) + E(-4, 2, 4, 7, '#ffd9a8', 0, 20).replace('fill="#ffd9a8"', 'fill="#ffd9a8" opacity=".55"')
    o += E(14, 22, 5, 3.4, '#b5562a', 2.6, 30) + E(-12, 22, 5, 3.4, '#b5562a', 2.6, -30)
    return o
def thot(): return E(0, 0, 26, 7, lg('#c99a55'), 3.4) + ''.join(E(x, -5, 6, 4, '#c2602c', 2.4, r) for x, r in ((-12, 10), (0, -8), (11, 14)))
def ruou():
    o = P('M-5,-30 L5,-30 L5,-16 Q16,-10 14,4 L14,18 Q0,24 -14,18 L-14,4 Q-16,-10 -5,-16 Z', '#e8f6f4', 3.4).replace('fill="#e8f6f4"', 'fill="#e8f6f4" fill-opacity=".85"')
    o += P('M-13,2 L13,2 L13,17 Q0,22 -13,17 Z', '#f3e6a8', 0).replace('fill="#f3e6a8"', 'fill="#f3e6a8" opacity=".9"') + L('M-8,-8 Q-11,2 -9,12', 2.6, '#ffffff', .8)
    o += P('M-6,-36 Q0,-42 6,-36 L5,-28 L-5,-28 Z', '#5aa84a', 2.6)
    return o
def chum(): return P('M-14,-30 L14,-30 Q26,-18 22,-4 Q18,8 0,8 Q-18,8 -22,-4 Q-26,-18 -14,-30 Z', lg('#9a5a32'), 3.4) + E(0, -30, 14, 4, '#6b3a1e', 3) + P('M-8,-18 L8,-18 L8,-6 L-8,-6 Z', '#d33c2a', 2.4)
def cup(): return P('M-7,-8 L7,-8 L5,2 L-5,2 Z', '#fbfbfb', 2.6)
ITEM.update({'ca-dong': fish_hang, 'rau': rau, 'nuoc': nuocmia, 'banh': banhtet, 'ca-phe': caphe, 'hu-tieu': hutieu,
             'snack': snack, 'lau-mam': diendien, 'vit': vitquay, 'ruou': ruou, 'trai-cay': durian})
DECK = {
    'ca-dong': lambda: crate() + G(fish(), 30, -38, .55, -30) + G(fish(), 50, -36, .55, 200) + G(fish(), -76, -24, .7, -15),
    'rau': lambda: G(rau(), 32, -40, .9, -10) + G(rau(), 48, -40, .85, 12) + crate() + G(rau(), -76, -32, .7, -24),
    'nuoc': lambda: G(nuocmia(), 30, -36, .8) + G(nuocmia(), 50, -34, .75) + crate(16, 64, -18) + G(nuocmia(), -76, -32, .7),
    'banh': lambda: crate() + G(banhtet(), 32, -44, .7, 90) + G(banhtet(), 48, -44, .7, 90) + G(banhtet(), -76, -32, .75),
    'ca-phe': lambda: G(phin(), 40, -32, .9) + steam(40, -60) + G(caphe(), -76, -32, .75),
    'hu-tieu': lambda: G(pot2(), 42, -14) + steam(42, -50) + G(hutieu(), -78, -16, .85),
    'snack': lambda: G(candyjar(), 40, -14) + G(banhtrang(), -76, -30, .7) + G(keokeo(), -60, -30, .6, 20),
    'lau-mam': lambda: G(laupot(), 42, -22) + steam(42, -58) + G(diendien(), -76, -30, .8),
    'vit': lambda: G(thot(), 40, -18) + G(vitquay(), -76, -26, .7),
    'ruou': lambda: G(chum(), 40, -14) + G(cup(), 64, -16) + G(ruou(), -76, -30, .75),
}
DECK['trai-cay'] = lambda: P('M20,-34 L60,-34 L54,-14 L26,-14 Z', lg('#c99a55'), 3.4) + G(rambutan(), 34, -38) + G(rambutan(), 48, -40) + G(durian(), -74, -36, .85)
