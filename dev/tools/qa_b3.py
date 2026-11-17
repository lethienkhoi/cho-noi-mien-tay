"""QA bước B3: chạy game trong Chromium (Playwright), chụp ảnh vào game/_qa/, mô phỏng chạm.

Chạy:  python3 tools/qa_b3.py           (tự mở http.server trong game/ ở cổng 8765)
Ra:    game/_qa/b3_*.png  + in kết quả kiểm tra; thoát mã 1 nếu có lỗi.
"""
import os, sys, time, json, subprocess, socket
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GAME = os.path.join(ROOT, 'game'); QA = os.path.join(GAME, '_qa')
PORT = 8765
URL = f'http://127.0.0.1:{PORT}/index.html'
problems = []

def ok(cond, msg):
    print(('  OK  ' if cond else '  LỖI ') + msg)
    if not cond: problems.append(msg)

def server():
    p = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=GAME,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try: socket.create_connection(('127.0.0.1', PORT), .2).close(); return p
        except OSError: time.sleep(.1)
    raise SystemExit('server không lên')

def ev(pg, js, arg=None): return pg.evaluate(js, arg)
def state(pg): return ev(pg, 'window.game ? game.state : document.getElementById("app").dataset.state')

def open_page(b, w, h, dpr, init=None, route=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, is_mobile=True, has_touch=True)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if route: pg.route(route, lambda r: r.abort())
    pg.goto(URL)
    pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(300)
    return ctx, pg, errs

def wait_state(pg, s, timeout=15000):
    pg.wait_for_function(f'window.game && game.state === "{s}"', timeout=timeout)

def tap(pg, w, h):
    pg.touchscreen.tap(w * .5, h * .45)

def run_main(b, w, h, dpr, tag):
    print(f'\n== {w}x{h} dpr {dpr}')
    ctx, pg, errs = open_page(b, w, h, dpr)
    pg.screenshot(path=f'{QA}/b3_{tag}_1_start.png')
    ok(pg.is_visible('text=made by Khoi M1nhon'), 'màn bắt đầu có chữ ký')
    pg.click('#btn-start'); wait_state(pg, 'playing')
    ok(not ev(pg, 'document.getElementById("panel").hidden'), 'khung chữ hiện khi chơi')
    # chờ ghe hàng tới ~60% rồi đóng băng để chụp
    pg.wait_for_function('game.round && game.round.t / game.round.T > .68', timeout=15000)
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(120)
    pg.screenshot(path=f'{QA}/b3_{tag}_2_playing.png')
    ok(ev(pg, 'game.stall.face') == 'shock', 'người bán hết hồn khi ghe mình tới gần')
    frac = ev(pg, 'game.remainingFrac'); ok(0 < frac < .35, f'thanh thời gian còn {frac:.2f}')
    ev(pg, 'game.frozen = false')
    # nhảy: chạm, chụp giữa cú nhảy
    rid = ev(pg, 'game.round.id'); tap(pg, w, h)
    pg.wait_for_function('game.jump && game.jump.t > .4', timeout=5000)
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(120)
    pg.screenshot(path=f'{QA}/b3_{tag}_3_jump.png')
    ok(ev(pg, 'game.stall.face') == 'yell', 'người bán la khi bị nhảy qua')
    ok(ev(pg, '__choNoi.renderer.heroSprite()') == 'hero_boat_jump', 'sprite nhảy đúng')
    ev(pg, 'game.frozen = false')
    pg.wait_for_function('game.jump && game.jump.landed', timeout=5000)
    ok(ev(pg, '__choNoi.renderer.heroSprite()') == 'hero_boat_row_cocky', 'mặt đắc chí ngay sau khi qua ghe')
    pg.wait_for_function(f'game.state === "playing" && game.round.id > {rid}', timeout=8000)
    # API B4: sai roundId bị từ chối
    ok(ev(pg, 'game.onPhraseMatched(-1, {dialect:true})') is False, 'onPhraseMatched từ chối roundId cũ')
    # 5 ghe nữa liên tiếp (tổng 6)
    seen_ids = []
    for i in range(5):
        wait_state(pg, 'playing')
        rid = ev(pg, 'game.round.id'); seen_ids.append(ev(pg, 'game.round.phrase.id'))
        pg.wait_for_timeout(250)
        if i == 2:
            ok(ev(pg, f'game.onPhraseMatched({rid}, {{dialect:true}})') is True, 'onPhraseMatched (dialect) nhận đúng round')
        else:
            tap(pg, w, h)
        pg.wait_for_function(f'game.state === "playing" && game.round.id > {rid}', timeout=8000)
    passed, score, tier = ev(pg, '[game.passed, game.score, game.tier]')
    ok(passed == 6, f'qua 6 ghe liên tiếp (passed={passed})')
    ok(score == 6 + 2, f'điểm = 6 + thưởng giọng 2 (score={score})')
    ok(tier == 1, f'đủ 5 câu lên cấp 2 cano máy (tier={tier})')
    ok(ev(pg, '__choNoi.renderer.heroSprite()') in ('veh_1', 'veh_1_cocky'), 'đổi sprite phương tiện veh_1')
    hud = ev(pg, 'document.getElementById("hud-vehicle").textContent'); ok('Cano máy' in hud, f'HUD: {hud}')
    ok(ev(pg, 'document.getElementById("panel").textContent').count('(') == 1, 'khung chữ chỉ có câu hiện tại')
    # đo fps vài giây
    pg.wait_for_timeout(1200); fps = ev(pg, '__choNoi.renderer.fps'); print(f'  fps headless ~ {fps:.0f}')
    # hết giờ -> đụng
    wait_state(pg, 'crash', 20000)
    pg.wait_for_function('game.crash.t > .28', timeout=3000)
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(120)
    pg.screenshot(path=f'{QA}/b3_{tag}_4_crash.png')
    ok(ev(pg, 'document.getElementById("panel-title").hidden') is False, 'khung chữ báo "Đụng ghe rồi!"')
    ev(pg, 'game.frozen = false')
    wait_state(pg, 'over', 5000); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{QA}/b3_{tag}_5_result.png')
    best = ev(pg, 'localStorage.getItem("choNoiMienTay.best.v1")'); ok(best == str(score), f'kỷ lục lưu localStorage = {best}')
    pg.click('#btn-again'); wait_state(pg, 'playing')
    ok(ev(pg, 'game.score') == 0 and ev(pg, 'document.getElementById("hud-best").textContent') == f'{score:02d}', 'chơi lại: điểm 0, kỷ lục giữ')
    ok(not errs, 'console không lỗi' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()

def run_edges(b):
    print('\n== edge cases')
    ctx, pg, errs = open_page(b, 390, 844, 2)
    pg.click('#btn-start'); wait_state(pg, 'playing')
    pg.wait_for_timeout(300)
    ev(pg, '''Object.defineProperty(document, "hidden", {configurable: true, get: () => true});
              document.dispatchEvent(new Event("visibilitychange"))''')
    t0 = ev(pg, 'game.round.t'); pg.wait_for_timeout(500); t1 = ev(pg, 'game.round.t')
    ok(ev(pg, 'game.paused') and t1 == t0, 'tab ẩn: tạm dừng, đồng hồ đứng')
    ev(pg, 'Object.defineProperty(document, "hidden", {configurable: true, get: () => false})')
    pg.wait_for_timeout(150)
    pg.screenshot(path=f'{QA}/b3_edge_pause.png')
    pg.click('#btn-resume'); pg.wait_for_timeout(200)
    ok(not ev(pg, 'game.paused') and ev(pg, 'game.round.t') > t1, 'bấm "Chơi tiếp" chạy lại')
    pg.set_viewport_size({'width': 844, 'height': 390}); pg.wait_for_timeout(400)
    ok(pg.is_visible('#overlay-rotate') and ev(pg, 'game.paused'), 'nằm ngang: che "Xoay dọc điện thoại" + tạm dừng')
    pg.screenshot(path=f'{QA}/b3_edge_landscape.png')
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(400)
    ok(not pg.is_visible('#overlay-rotate'), 'dựng dọc lại: bỏ lớp che')
    ok(not errs, 'console không lỗi (edge)' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()

    blocked = '''Object.defineProperty(window, "localStorage", {configurable: true, get() { throw new DOMException("blocked", "SecurityError"); }});'''
    ctx, pg, errs = open_page(b, 360, 780, 3, init=blocked)
    pg.click('#btn-start'); wait_state(pg, 'playing'); pg.wait_for_timeout(200); tap(pg, 360, 780)
    wait_state(pg, 'over', 25000)
    ok(ev(pg, 'game.best') == ev(pg, 'game.score') and pg.is_visible('#screen-result'), 'localStorage bị chặn: vẫn chơi, kỷ lục giữ trong bộ nhớ')
    ok(not errs, 'console không lỗi (localStorage chặn)' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()

    ctx, pg, errs = open_page(b, 390, 844, 2, route='**/stall_rau.svg')
    ok(pg.is_visible('#overlay-error'), 'sprite nạp lỗi: hiện thông báo, không trắng màn')
    pg.screenshot(path=f'{QA}/b3_edge_spritefail.png')
    pg.click('#btn-continue'); pg.click('#btn-start'); wait_state(pg, 'playing')
    ok(True, 'bấm "Vẫn chơi" vẫn vào được game')
    ctx.close()

if __name__ == '__main__':
    srv = server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            run_main(b, 390, 844, 2, '390')
            run_main(b, 360, 780, 2, '360')
            run_main(b, 390, 844, 3, '390dpr3')
            run_edges(b)
            b.close()
    finally:
        srv.terminate()
    print('\n' + ('TẤT CẢ OK' if not problems else f'{len(problems)} LỖI'))
    sys.exit(1 if problems else 0)
