"""QA màn kết quả (2026-11-18): điểm thang trăm, câu chọc, ảnh vụ đụng cuối, pháo hoa khi phá kỷ lục, top 4,
đổi kỷ lục cũ 7 -> 700. Nền: qa_b4.py / qa_b5.py (micro giả, ?asr=webspeech).
Chạy: python3 dev/tools/qa_result.py  → dev/qa/result_*.png; thoát mã 1 nếu có lỗi.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import qa_b4 as B
from playwright.sync_api import sync_playwright

QA = B.QA
problems = B.problems
ok, ev, say, wait_state, phrase = B.ok, B.ev, B.say, B.wait_state, B.phrase
ROASTS = json.load(open(os.path.join(B.ROOT, 'data', 'roasts.json'), encoding='utf-8'))


def num(t): return int(t.replace('.', '').strip() or '0')


def bracket_lines(score):
    for b in ROASTS['brackets']:
        if b['min'] <= score <= b['max']: return b['lines']
    return []


def open_vp(b, w, h, legacy=None):
    """mở trang; legacy: đặt kỷ lục cũ (thang +1) rồi tải lại để kiểm tra đổi sang thang trăm"""
    B.W, B.H = w, h
    ctx, pg, errs = B.open_page(b)
    ev(pg, 'localStorage.clear()')
    if legacy is not None: ev(pg, f'localStorage.setItem("choNoiMienTay.best.v1", "{legacy}")')
    pg.reload()
    pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    return ctx, pg, errs


def pass_ghe(pg, n, dialect=False):
    for _ in range(n):
        wait_state(pg, 'playing', 6000)
        pg.wait_for_function('game.round && game.round.t > 0.05', timeout=3000)
        p = phrase(pg)
        say(pg, p['pa'] if dialect else p['ct'], True, True)
        pg.wait_for_function('game.state === "jumping"', timeout=2500)


def layout_check(pg, tag):
    """mọi phần của thẻ kết quả nằm trong màn, không đè nhau, không cuộn"""
    L = ev(pg, '''(() => { const app = document.getElementById("app").getBoundingClientRect();
      const card = document.querySelector(".result-card"), scr = document.getElementById("screen-result");
      const kids = [...card.children].filter((e) => !e.hidden && getComputedStyle(e).display !== "none")
        .map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height }; });
      const c = card.getBoundingClientRect(); const roast = document.getElementById("res-roast");
      const lh = parseFloat(getComputedStyle(roast).lineHeight);
      return { app: { t: app.top, b: app.bottom, l: app.left, r: app.right }, card: { t: c.top, b: c.bottom }, kids,
               scroll: scr.scrollHeight - scr.clientHeight, cardScroll: card.scrollHeight - card.clientHeight,
               roastLines: roast.hidden ? 0 : Math.round(roast.getBoundingClientRect().height / lh),
               shotH: document.getElementById("res-shot").getBoundingClientRect().height }; })()''')
    a = L['app']
    ok(L['card']['t'] >= a['t'] - 0.5 and L['card']['b'] <= a['b'] + 0.5, f'{tag}: thẻ kết quả nằm gọn trong màn ({L["card"]["t"]:.0f}–{L["card"]["b"]:.0f} / {a["b"]:.0f})')
    ok(L['scroll'] <= 1 and L['cardScroll'] <= 1, f'{tag}: không cuộn ({L["scroll"]}, {L["cardScroll"]})')
    ks = L['kids']; over = [(x['id'], y['id']) for x, y in zip(ks, ks[1:]) if x['b'] > y['t'] + 0.5]
    ok(not over, f'{tag}: các phần không đè nhau {over or ""}')
    ok(all(k['l'] >= a['l'] - 0.5 and k['r'] <= a['r'] + 0.5 for k in ks), f'{tag}: không tràn ngang')
    ok(L['roastLines'] <= 3, f'{tag}: câu chọc ≤ 3 dòng ({L["roastLines"]})')
    ok(L['shotH'] >= 90, f'{tag}: khung ảnh đủ cao ({L["shotH"]:.0f}px)')
    return L


def result_info(pg):
    return ev(pg, '''(() => { const cv = document.getElementById("res-shot-cv"), x = cv.getContext("2d");
      let varc = 0; try { const d = x.getImageData(0, 0, cv.width, cv.height).data; let s = 0, s2 = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] + d[i + 1] + d[i + 2]; s += v; s2 += v * v; n++; } varc = n ? s2 / n - (s / n) ** 2 : 0; } catch (e) { varc = -1; }
      return { score: document.getElementById("res-score").textContent, roast: document.getElementById("res-roast").textContent,
        badge: !document.getElementById("res-badge").hidden, fw: !document.getElementById("fireworks").hidden,
        rows: [...document.querySelectorAll("#res-top .top-row")].map((r) => ({ s: r.querySelector(".top-score").textContent, d: r.querySelector(".top-date").textContent, me: r.classList.contains("is-me") })),
        shot: { w: cv.width, h: cv.height, varc }, hudHidden: document.getElementById("hud").hidden,
        oldBits: !!document.getElementById("res-steps") || !!document.getElementById("res-tier") || /HẾT LƯỢT/.test(document.getElementById("screen-result").textContent),
        top: JSON.parse(localStorage.getItem("choNoiMienTay.top.v2") || "[]") }; })()''')


def run_vp(b, w, h):
    tag = f'{w}'
    print(f'\n== {w}x{h}')
    ctx, pg, errs = open_vp(b, w, h, legacy=7)

    # ---- đổi kỷ lục cũ 7 -> 700
    st = ev(pg, '({best: game.best, txt: document.getElementById("start-best").textContent, top: JSON.parse(localStorage.getItem("choNoiMienTay.top.v2") || "null")})')
    ok(st['best'] == 700 and st['txt'] == '700', f'kỷ lục cũ 7 → 700 (game.best={st["best"]}, màn bắt đầu "{st["txt"]}")')
    ok(st['top'] and st['top'][0]['s'] == 700, f'đã ghi bảng top mới từ kỷ lục cũ ({st["top"]})')
    pg.reload(); pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    ok(ev(pg, 'game.best') == 700, 'tải lại: vẫn 700 (chỉ đổi một lần, không nhân tiếp)')
    pg.screenshot(path=f'{QA}/result_{tag}_0_start.png')

    # ---- lượt 1: qua 2 ghe (chính tả, +100 mỗi ghe) rồi đụng → không phá kỷ lục
    B.start(pg)
    ok(ev(pg, 'document.getElementById("hud-score").textContent') == '0', 'HUD điểm "0" (không đệm "00")')
    pass_ghe(pg, 2)
    pg.wait_for_function('document.querySelector("#chips .chip-green") && !document.getElementById("chips").hidden', timeout=2000)
    chip = ev(pg, 'document.querySelector("#chips .chip-green").textContent')
    ok(chip == 'Qua ghe +100', f'chữ điểm khi qua ghe: "{chip}"')
    wait_state(pg, 'playing', 6000)
    hud = ev(pg, '[document.getElementById("hud-score").textContent, document.getElementById("hud-best").textContent]')
    ok(hud == ['200', '700'], f'HUD thang trăm: Điểm {hud[0]}, Kỷ lục {hud[1]}')
    ok(ev(pg, 'game.tier') == 0 and ev(pg, 'game.passed') == 2, 'lên đời vẫn theo số ghe qua (2 ghe → cấp 1)')
    wait_state(pg, 'crash', 20000)
    pg.wait_for_function('__choNoi.shot.taken', timeout=3000)
    sh = ev(pg, '({t: game.crash.t, taunt: game.taunts.length && game.taunts[0].kind})')
    ok(sh['taunt'] == 'crash', f'lúc chụp đã có bong bóng chửi (t={sh["t"]:.2f}s)')
    wait_state(pg, 'over', 4000); pg.wait_for_timeout(450)
    r = result_info(pg)
    ok(num(r['score']) == 200 and num(r['score']) % 100 == 0, f'điểm hiển thị bội số 100: "{r["score"]}"')
    ok(not r['badge'] and not r['fw'], 'không phá kỷ lục: không nhãn KỶ LỤC MỚI, không pháo hoa')
    ok(r['roast'] in bracket_lines(200), f'câu chọc đúng khung 100–200: "{r["roast"]}"')
    ok([x['s'] for x in r['rows']] == ['700', '200', '—', '—'], f'top 4: {[x["s"] for x in r["rows"]]}')
    ok([x['me'] for x in r['rows']] == [False, True, False, False], 'dòng lượt vừa chơi (hạng 2) được tô')
    ok(r['shot']['w'] > 50 and r['shot']['varc'] > 200, f'ảnh vụ đụng có nội dung ({r["shot"]})')
    ok(not r['oldBits'], 'đã bỏ HẾT LƯỢT / các cấp phương tiện')
    ok(r['hudHidden'], 'HUD ẩn ở màn kết quả')
    layout_check(pg, 'thường')
    pg.screenshot(path=f'{QA}/result_{tag}_1_normal.png')

    # ---- lượt 2: qua 1 ghe giọng miền Tây (+300) rồi đặt điểm 900 → phá kỷ lục, pháo hoa
    pg.click('#btn-again'); wait_state(pg, 'playing')
    pass_ghe(pg, 1, dialect=True)
    chips = ev(pg, '[...document.querySelectorAll("#chips > *")].map((e) => e.textContent)')
    ok(chips == ['Qua ghe +100', 'Chuẩn miền Tây +200'], f'chữ điểm giọng miền Tây: {chips}')
    ok(ev(pg, 'game.score') == 300, f'qua ghe + chuẩn miền Tây = 300 ({ev(pg, "game.score")})')
    wait_state(pg, 'playing', 6000)
    ev(pg, 'game.score = 900')
    wait_state(pg, 'crash', 20000)
    wait_state(pg, 'over', 4000)
    pg.wait_for_timeout(700)
    r = result_info(pg)
    ok(num(r['score']) == 900, f'điểm "{r["score"]}"')
    ok(r['badge'] and r['fw'], 'phá kỷ lục: có nhãn KỶ LỤC MỚI và pháo hoa')
    ok(r['roast'] in ROASTS['newBest'], f'câu chọc newBest: "{r["roast"]}"')
    ok([x['s'] for x in r['rows']] == ['900', '700', '200', '—'] and r['rows'][0]['me'], f'top 4: {[x["s"] for x in r["rows"]]}, hạng 1 được tô')
    pe = ev(pg, 'getComputedStyle(document.getElementById("fireworks")).pointerEvents')
    ok(pe == 'none', 'pháo hoa không chặn chạm')
    layout_check(pg, 'kỷ lục')
    pg.screenshot(path=f'{QA}/result_{tag}_2_record_fireworks.png')
    pg.wait_for_timeout(3000)
    ok(ev(pg, 'document.getElementById("fireworks").hidden'), 'pháo hoa tự tắt sau ~3 giây')
    # nút vẫn bấm được khi pháo hoa đang nổ
    pg.click('#btn-home'); wait_state(pg, 'title', 3000)
    ok(ev(pg, 'document.getElementById("start-best").textContent') == '900', 'màn bắt đầu: kỷ lục 900')

    # ---- top 4: thêm nhiều điểm → giữ 4 cao nhất, giảm dần
    t = ev(pg, '''(async () => { const m = await import("./src/game/storage.js");
        for (const s of [300, 1500, 100, 800, 0]) m.recordScore(s, "01/01"); return m.loadTop(); })()''')
    ok([x['s'] for x in t] == [1500, 900, 800, 700], f'top 4 đúng thứ tự giảm dần ({[x["s"] for x in t]})')
    ok(all(len(x['d']) in (0, 5) for x in t), 'ngày dạng dd/mm')

    # ---- prefers-reduced-motion: chỉ 1 chùm
    pg.emulate_media(reduced_motion='reduce')
    n = ev(pg, '''(() => { const f = __choNoi.screens.fireworks; __choNoi.screens.result.hidden = false; f.start(); const n = f.bursts.length; f.stop(); __choNoi.screens.result.hidden = true; return n; })()''')
    ok(n == 1, f'giảm chuyển động: {n} chùm')
    ok(not errs, 'console không lỗi' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


def run_safari(b):
    """iPhone thật: 393 rộng, vùng nhìn thấy ~660 cao (thanh địa chỉ Safari dưới đáy) + safe-area"""
    print('\n== 393x660 (Safari có thanh địa chỉ)')
    ctx, pg, errs = open_vp(b, 393, 660, legacy=3)
    B.start(pg)
    pass_ghe(pg, 1)
    wait_state(pg, 'over', 25000); pg.wait_for_timeout(700)
    r = result_info(pg)
    ok(r['badge'] is False and num(r['score']) == 100, f'100 < 300: không kỷ lục ({r["score"]})')
    layout_check(pg, '393x660')
    pg.screenshot(path=f'{QA}/result_393x660_normal.png')
    ok(not errs, 'console không lỗi' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


def run_bad_roasts(b):
    print('\n== roasts.json hỏng')
    B.W, B.H = 390, 844
    kw = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx = b.new_context(**kw); ctx.add_init_script(B.FAKE_SR)
    ctx.route('**/data/roasts.json*', lambda route: route.fulfill(status=200, body='{ hỏng', content_type='application/json'))
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(B.URL); pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    B.start(pg)
    wait_state(pg, 'over', 25000); pg.wait_for_timeout(400)
    r = result_info(pg)
    ok(r['roast'] == '' and r['score'] == '0', f'roasts.json hỏng: không có câu chọc, màn vẫn hiện (điểm "{r["score"]}")')
    layout_check(pg, 'không câu chọc')
    pg.screenshot(path=f'{QA}/result_390_3_no_roast.png')
    ok(not errs, 'không lỗi trang' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


if __name__ == '__main__':
    os.makedirs(QA, exist_ok=True)
    srv = B.server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            run_vp(b, 390, 844)
            run_vp(b, 360, 780)
            run_safari(b)
            run_bad_roasts(b)
            b.close()
    finally:
        srv.terminate()
    print('\n' + ('TẤT CẢ OK' if not problems else f'{len(problems)} LỖI'))
    sys.exit(1 if problems else 0)
