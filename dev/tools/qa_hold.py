"""Kiểm tra 'chờ người đang đọc': đọc đúng nửa câu sát lúc hết giờ, chữ cuối tới trễ ~0,9s vẫn nhảy; đứng im thì vẫn đụng."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import qa_b4 as B
from playwright.sync_api import sync_playwright
ev, say = B.ev, B.say
srv = B.server()
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for case in ('hold', 'idle'):
            ctx, pg, errs = B.open_page(b)
            B.start(pg)
            r = ev(pg, '({T: game.round.T, pa: game.round.phrase.phienAm})')
            words = r['pa'].split()
            # chờ tới gần hết giờ
            pg.wait_for_timeout(int((r['T'] - 0.15) * 1000))
            if case == 'hold':
                half = ' '.join(words[:max(1, (len(words) + 1) // 2)]) if len(words) > 1 else ''
                if half: say(pg, half)
                pg.wait_for_timeout(900)
                say(pg, r['pa'], final=True)
                pg.wait_for_timeout(300)
                res = ev(pg, 'game.state')
                B.ok(res in ('jumping', 'playing') and ev(pg, 'game.passed') == 1, f'hold: chữ cuối trễ 0,9s vẫn qua (state={res}, words={len(words)})')
            else:
                pg.wait_for_timeout(1500)
                B.ok(ev(pg, 'game.state') in ('crash', 'over'), f'idle: không đọc thì vẫn đụng ({ev(pg, "game.state")})')
            ctx.close()
        b.close()
finally:
    srv.terminate()
print('LỖI' if B.problems else 'OK hết')
