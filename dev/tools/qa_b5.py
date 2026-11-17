"""QA bước B5 (chạy ngang kiểu khủng long trong khung dọc, bong bóng chửi, cảnh đụng, độ khó mới).
Nền: dev/tools/qa_b4.py (micro giả). Chạy: python3 dev/tools/qa_b5.py  → dev/qa/b5_*.png; thoát mã 1 nếu có lỗi.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import qa_b4 as B
from playwright.sync_api import sync_playwright

QA = B.QA
problems = B.problems
ok, ev, say, wait_state, phrase = B.ok, B.ev, B.say, B.wait_state, B.phrase
DATA = json.load(open(os.path.join(B.ROOT, 'data', 'phrases.json'), encoding='utf-8'))


def open_vp(b, w, h):
    B.W, B.H = w, h
    return B.open_page(b)


def freeze(pg): ev(pg, 'game.frozen = true'); pg.wait_for_timeout(90)
def thaw(pg): ev(pg, 'game.frozen = false')


def geom(pg):
    return ev(pg, '''(() => { const g = game, r = __choNoi.renderer, st = g.stall, m = g.stallMarks(), he = g.heroExt(), se = g.stallExt(st.key, st.s);
      return { W: r.W, lane: g.laneY, heroX: g.heroPos.x, heroW: he.left + he.right, stallW: se.left + se.right, stallY: st.y, stallX: st.x,
               uiTop: r.uiTop, uiBottom: r.uiBottom, m, H: r.H }; })()''')


def force_next(pg, pred_js):
    """câu kế tiếp lấy theo điều kiện pred (chuỗi JS nhận p)."""
    return ev(pg, f'''(() => {{ const L = game.data.phrases.filter((p) => {pred_js}); const p = L[0]; game.__next = p;
        if (!game.__wrapped) {{ const orig = game.picker.pick.bind(game.picker); game.__wrapped = true;
          game.picker.pick = (n) => {{ if (game.__next) {{ const q = game.__next; game.__next = null; return q; }} return orig(n); }}; }}
        return {{ ct: p.chinhTa, pa: p.phienAm, level: p.level }}; }})()''')


def run_vp(b, w, h):
    tag = f'{w}'
    print(f'\n== {w}x{h}')
    ctx, pg, errs = open_vp(b, w, h)
    ev(pg, '''window.__ev = []; for (const k of ["round", "crash", "taunt", "matched"]) game.addEventListener(k, (e) => __ev.push({k, at: performance.now(), d: {T: e.detail.T, grace: e.detail.grace, kind: e.detail.kind, text: e.detail.text, id: e.detail.id}}));''')
    B.start(pg)

    # ---- 1. đang chạy: ghe hàng giữa đường
    ev(pg, 'game.round.t = game.round.T * 0.45; game.placeStall()')
    freeze(pg)
    pg.screenshot(path=f'{QA}/b5_{tag}_1_running.png')
    G = geom(pg)
    ok(0.18 <= G['heroW'] / G['W'] <= 0.23, f'ghe mình nhỏ: {G["heroW"] / G["W"]:.0%} bề rộng màn')
    ok(0.21 <= G['stallW'] / G['W'] <= 0.26, f'ghe hàng nhỏ: {G["stallW"] / G["W"]:.0%} bề rộng màn')
    ok(abs(G['stallY'] - G['lane']) < 0.01, 'ghe hàng cùng làn với ghe mình')
    ok(0.17 <= G['heroX'] / G['W'] <= 0.23, f'ghe mình cố định bên trái ({G["heroX"] / G["W"]:.0%})')
    ok(G['uiTop'] + 120 < G['lane'] < G['uiBottom'] - 20, f'làn (y={G["lane"]:.0f}) nằm giữa HUD ({G["uiTop"]:.0f}) và khung chữ ({G["uiBottom"]:.0f})')
    ok(G['m']['start'] - G['stallW'] / 2 >= G['W'] - 8, 'ghe hàng xuất phát từ mép phải')
    thaw(pg)

    # ---- 2. giữa cú nhảy có bong bóng chửi
    ev(pg, 'game.round.t = game.round.T * 0.5')
    p1 = phrase(pg)
    say(pg, p1['pa'])
    pg.wait_for_function('game.state === "jumping"', timeout=2000)
    pg.wait_for_function('game.taunts.length > 0 && game.taunts[0].t > 0.12', timeout=3000)
    freeze(pg)
    pg.screenshot(path=f'{QA}/b5_{tag}_2_jump_taunt.png')
    t = ev(pg, '({kind: game.taunts[0].kind, text: game.taunts[0].text, face: game.stall.face, rect: __choNoi.renderer.lastTaunt, dy: game.jumpPose().dy})')
    ok(t['kind'] == 'jumpedOver' and t['text'] in DATA['taunts']['jumpedOver'], f'nhảy qua → bong bóng câu jumpedOver: "{t["text"]}"')
    ok(t['face'] == 'yell', 'người bán đổi mặt yell khi chửi')
    r = t['rect']; G = geom(pg)
    ok(r and r['L'] >= 0 and r['R'] <= G['W'] and r['T'] >= G['uiTop'] and r['B'] <= G['uiBottom'], f'bong bóng trong màn, không bị HUD/khung chữ che ({r and [round(r["L"]), round(r["T"]), round(r["R"]), round(r["B"])]})')
    ok(t['dy'] < -60, f'ghe mình đang bay trên cung (dy={t["dy"]:.0f}u)')
    thaw(pg)
    n_ev = ev(pg, '__ev.filter((e) => e.k === "taunt").length')
    ok(n_ev == 1, 'phát sự kiện taunt (cho playTaunt)')
    # bong bóng hết sau ~1.4s + mờ
    pg.wait_for_function('game.taunts.length === 0', timeout=4000)
    ok(True, 'bong bóng tự mờ đi')

    # ---- 3. đo thời gian câu → va chạm
    wait_state(pg, 'playing')
    pg.wait_for_function('__ev.filter((e) => e.k === "round").length >= 2', timeout=5000)
    pg.wait_for_function('game.state === "crash"', timeout=15000)
    m = ev(pg, '''(() => { const R = __ev.filter((e) => e.k === "round").pop(), C = __ev.filter((e) => e.k === "crash").pop();
        return {dt: (C.at - R.at) / 1000, T: game.round.T, grace: game.round.grace, words: game.round.phrase.phienAm.split(/\\s+/).length}; })()''')
    exp = m['T'] + m['grace']
    ok(abs(m['dt'] - exp) < 0.08, f'câu hiện → va chạm: đo {m["dt"]:.3f}s, config {m["T"]:.3f}s + ân hạn {m["grace"]:.2f}s = {exp:.3f}s')
    flo = 1.6 + 0.22 * m['words']
    ok(m['T'] >= flo - 1e-6, f'T={m["T"]:.2f}s không dưới sàn {flo:.2f}s ({m["words"]} chữ)')
    pg.wait_for_function('game.crash.t > 0.3', timeout=3000)
    freeze(pg)
    pg.screenshot(path=f'{QA}/b5_{tag}_3_crash.png')
    c = ev(pg, '({kind: game.taunts[0] && game.taunts[0].kind, text: game.taunts[0] && game.taunts[0].text, face: game.stall.face, rect: __choNoi.renderer.lastTaunt, bar: document.getElementById("bar").hidden})')
    ok(c['kind'] == 'crash' and c['text'] in DATA['taunts']['crash'], f'đụng → bong bóng câu crash: "{c["text"]}"')
    ok(c['face'] == 'yell', 'người bán yell khi đụng')
    r = c['rect']; G = geom(pg)
    ok(r and r['L'] >= 0 and r['R'] <= G['W'] and r['T'] >= G['uiTop'] and r['B'] <= G['uiBottom'], 'bong bóng đụng nằm trong vùng trống')
    thaw(pg)
    wait_state(pg, 'over', 4000)
    dt_over = ev(pg, 'game.crash.t')
    ok(1.5 <= dt_over <= 1.75, f'bảng kết quả hiện sau {dt_over:.2f}s')
    pg.wait_for_timeout(350)
    pg.screenshot(path=f'{QA}/b5_{tag}_4_result.png')

    # ---- 4. chơi lại, ân hạn: đọc khớp sau khi thanh thời gian hết vẫn nhảy
    pg.click('#btn-again'); wait_state(pg, 'playing')
    ev(pg, 'game.round.t = game.round.T + 0.06')
    pg.wait_for_timeout(30)
    freeze(pg)
    sx = ev(pg, '({x: game.stall.x, near: game.stallMarks().near, touch: game.stallMarks().touch, bar: game.remainingFrac})')
    ok(sx['bar'] == 0 and sx['touch'] <= sx['x'] <= sx['near'] + 0.5, f'thanh hết = ghe hàng sát mũi ({sx["x"] - sx["touch"]:.1f}u)')
    thaw(pg)
    p = phrase(pg); say(pg, p['ct'], False, True)
    pg.wait_for_function('game.state === "jumping"', timeout=2000)
    g = ev(pg, '__ev.filter((e) => e.k === "matched").pop().d.grace')
    ok(g is True, 'khớp trong ân hạn → vẫn nhảy')
    pg.wait_for_function('game.jump && game.jump.t > 0.12', timeout=2000)
    freeze(pg); pg.screenshot(path=f'{QA}/b5_{tag}_5_grace_jump.png'); thaw(pg)

    # ---- 5. câu dài mức 4 (đặt số ghe đã qua = 13)
    wait_state(pg, 'playing', 5000)
    lv4 = force_next(pg, 'p.level === 4 && p.phienAm.length > 50')
    ev(pg, 'game.passed = 13')
    p = phrase(pg); say(pg, p['ct'], False, True)
    pg.wait_for_function('game.state === "playing" && game.round.phrase.level === 4', timeout=5000)
    pg.wait_for_function('game.taunts.length === 0', timeout=3000)
    ev(pg, 'game.round.t = game.round.T * 0.4; game.placeStall()')
    freeze(pg)
    pg.screenshot(path=f'{QA}/b5_{tag}_6_long_lv4.png')
    G = geom(pg)
    ok(G['lane'] + 14 < G['uiBottom'], f'câu dài: khung chữ (y={G["uiBottom"]:.0f}) không đè làn (y={G["lane"]:.0f})')
    lvl = ev(pg, '[0,2,3,6,7,12,13,19,20,30].map((n) => [n, game.picker.pick(n).level])')
    ok(all(l <= 4 for _, l in lvl), f'mức 5 chưa có câu → vẫn chọn được ({lvl})')
    thaw(pg)
    # ---- 6. thua không phá kỷ lục: bảng kết quả có mặt mếu
    wait_state(pg, 'over', 15000); pg.wait_for_timeout(400)
    sad = ev(pg, '({rec: document.getElementById("res-kicker").textContent, vis: !document.getElementById("res-hero").hidden, src: document.getElementById("res-hero").getAttribute("src") || ""})')
    ok(sad['rec'] == 'HẾT LƯỢT' and sad['vis'] and 'hero_sad' in sad['src'], f'thua không phá kỷ lục → bảng có hero_sad ({sad})')
    pg.screenshot(path=f'{QA}/b5_{tag}_7_result_sad.png')
    ok(not errs, 'console không lỗi' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


def run_levels(b):
    print('\n== mức & thời gian')
    ctx, pg, errs = open_vp(b, 390, 844)
    rows = ev(pg, '''(async () => { const m = await import("./src/game/phrases.js");
        return game.data.phrases.map((p) => [p.id, p.level, m.wordCount(p.phienAm), +m.roundTime(p, 0).toFixed(2), +m.roundTime(p, 30).toFixed(2)]); })()''')
    lv = ev(pg, '''(async () => { const m = await import("./src/game/phrases.js"); return [0,2,3,6,7,12,13,19,20].map((n) => m.levelForPasses(n)); })()''')
    ok(lv == [1, 1, 2, 2, 3, 3, 4, 4, 5], f'mức theo số ghe qua: {lv}')
    for pid, l, n, t0, t30 in rows:
        if t30 < 1.6 + 0.22 * n - 0.01: ok(False, f'câu {pid} dưới sàn')
    print('  câu (id, level, chữ, T lúc vào, T nhanh nhất):', rows)
    ctx.close()


if __name__ == '__main__':
    os.makedirs(QA, exist_ok=True)
    srv = B.server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            run_vp(b, 390, 844)
            run_vp(b, 360, 780)
            run_levels(b)
            b.close()
    finally:
        srv.terminate()
    print('\n' + ('TẤT CẢ OK' if not problems else f'{len(problems)} LỖI'))
    sys.exit(1 if problems else 0)
