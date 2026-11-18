"""QA bước B6 (âm thanh): tiếng động đúng sự kiện, nhạc nền + ducking, giọng chửi tải/giải mã được, nút loa nhớ lựa chọn.
Nền: dev/tools/qa_b4.py (Web Speech giả, ?asr=webspeech). Chạy: python3 dev/tools/qa_b6.py -> dev/qa/b6_*.png; thoát 1 nếu lỗi.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import qa_b4 as B
from playwright.sync_api import sync_playwright

QA = B.QA
problems = B.problems
ok, ev, say, wait_state, phrase = B.ok, B.ev, B.say, B.wait_state, B.phrase
DATA = json.load(open(os.path.join(B.ROOT, 'data', 'phrases.json'), encoding='utf-8'))
MAN = json.load(open(os.path.join(B.ROOT, 'assets', 'audio', 'taunts', 'manifest.json'), encoding='utf-8'))


def counts(pg): return ev(pg, '({...__choNoi.sfx.counts})')
def c(pg, n): return counts(pg).get(n, 0)


def wait_prefetch(pg, kind):
    """chờ câu chửi đã chọn trước cho ghe hiện tại giải mã xong"""
    pg.wait_for_function(f'''(() => {{ const s = __choNoi.sfx, r = game.round; if (!s.taunts || !r) return false;
        const u = s.tauntUrl("{kind}", r.tauntPick["{kind}"], r.vendor, null); const p = u && s.buffers.get(u); return !!(p && p.buf); }})()''', timeout=5000)


def pass_one(pg, dialect=False):
    wait_state(pg, 'playing', 6000)
    pg.wait_for_function('game.round && game.round.t > 0.05', timeout=3000)
    wait_prefetch(pg, 'jumpedOver')
    p = phrase(pg)
    say(pg, p['pa'] if dialect else p['ct'], True, True)
    pg.wait_for_function('game.state === "jumping"', timeout=2500)


def btn_shot(pg, name):
    box = pg.locator('#btn-sound').bounding_box()
    pg.screenshot(path=f'{QA}/{name}', clip={'x': max(0, box['x'] - 150), 'y': max(0, box['y'] - 70), 'width': min(B.W, box['width'] + 165), 'height': box['height'] + 110})


def run_main(b):
    print('\n== luồng chính 390x844: tiếng động theo sự kiện')
    B.W, B.H = 390, 844
    ctx, pg, errs = B.open_page(b)
    ev(pg, 'localStorage.clear()'); pg.reload()
    pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
    ok(pg.locator('#btn-sound').is_visible(), 'nút loa hiện ở màn bắt đầu')
    cr, br = ev(pg, '[document.querySelector("#screen-start .card").getBoundingClientRect().top, document.getElementById("btn-sound").getBoundingClientRect().bottom]')
    ok(br < cr, f'nút loa không đè thẻ màn bắt đầu (đáy nút {br:.0f} < đỉnh thẻ {cr:.0f})')
    ok(ev(pg, '__choNoi.sfx.ctx') is None, 'chưa chạm thì chưa tạo AudioContext (không bị chặn tự phát)')
    pg.screenshot(path=f'{QA}/b6_1_title.png')

    B.start(pg)
    pg.wait_for_timeout(300)
    st = ev(pg, '({ state: __choNoi.sfx.ctx && __choNoi.sfx.ctx.state, mode: __choNoi.sfx.mode })')
    ok(st == {'state': 'running', 'mode': 'all'}, f'bấm Bắt đầu: AudioContext chạy, chế độ mặc định bật hết ({st})')
    ok(c(pg, 'beep') == 1, f'bíp khi micro bắt đầu nghe ({c(pg, "beep")} lần)')
    pg.wait_for_function('__choNoi.sfx.counts.musicStart >= 1', timeout=3000)
    ok(True, 'nhạc nền đã dựng và chạy')
    ev(pg, 'game.round.t = 0')
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(80)
    pg.screenshot(path=f'{QA}/b6_1b_play.png')
    pt, st_, sb, ut = ev(pg, '[document.querySelector("#hud .pill:last-child").getBoundingClientRect().bottom, document.getElementById("btn-sound").getBoundingClientRect().top, document.getElementById("btn-sound").getBoundingClientRect().bottom, __choNoi.renderer.uiTop * __choNoi.renderer.unit]')
    ok(st_ >= pt + 2 and ut >= sb - 0.5, f'nút loa dưới ô Kỷ lục (đỉnh nút {st_:.0f} > đáy ô {pt:.0f}); bong bóng chửi chừa chỗ nút (mốc {ut:.0f} ≥ đáy nút {sb:.0f})')
    ev(pg, 'game.frozen = false; game.round.t = 0')
    pg.wait_for_timeout(1900)
    np = c(pg, 'paddle')
    ok(2 <= np <= 4, f'mái chèo khua theo nhịp khi đang chèo ({np} lần trong ~1,9s)')
    g = ev(pg, '__choNoi.sfx.musicGainNow')
    ok(0.03 <= g <= 0.06, f'đang chơi (micro nghe): nhạc rất nhỏ, gain {g:.3f}')
    ok(ev(pg, '__choNoi.sfx.ctx.sampleRate') > 0, 'AudioContext game riêng, không đụng AudioContext của bộ nghe')

    # ---- qua ghe thường: vút + ting + tõm + tiếng chửi phát đúng câu bong bóng
    ev(pg, '''window.__tau = []; game.addEventListener("taunt", (e) => __tau.push({...e.detail}))''')
    pass_one(pg, dialect=False)
    pg.wait_for_timeout(60)
    k = counts(pg)
    ok(k.get('whoosh') == 1 and k.get('ting') == 1 and not k.get('ting2'), f'qua ghe: vút 1, ting 1, chưa có ting ting ({k})')
    pg.wait_for_function('__tau.length >= 1', timeout=2000)
    pg.wait_for_timeout(60)
    t = ev(pg, '__tau[0]')
    lt = ev(pg, '__choNoi.sfx.lastTaunt')
    want = MAN['kinds']['jumpedOver']['items'][t['index']]
    ok(t['kind'] == 'jumpedOver' and DATA['taunts']['jumpedOver'][t['index']] == t['text'], f'bong bóng nhảy qua: câu #{t["index"]} "{t["text"]}"')
    ok(c(pg, 'taunt') == 1 and lt and want['files'][t['vendor']]['file'] in lt['url'], f'phát đúng file giọng {t["vendor"]}: {lt and lt["url"].split("/")[-1]}')
    pg.wait_for_timeout(150)
    gd = ev(pg, '__choNoi.sfx.musicGainNow')
    ok(gd < 0.03, f'người bán chửi: nhạc hạ thêm (gain {gd:.3f})')
    wait_state(pg, 'playing', 4000)
    ok(c(pg, 'splash') == 1, f'đáp xuống: tõm 1 lần ({c(pg, "splash")})')

    # ---- qua ghe "Chuẩn miền Tây": ting ting
    pass_one(pg, dialect=True)
    pg.wait_for_timeout(60)
    ok(c(pg, 'ting2') == 1 and c(pg, 'ting') == 1, f'Chuẩn miền Tây: ting ting (ting2={c(pg, "ting2")}, ting={c(pg, "ting")})')
    # ---- lên đời ở ghe thứ 5: kèn
    for _ in range(3): pass_one(pg)
    pg.wait_for_function('game.tier === 1', timeout=4000)
    pg.wait_for_timeout(50)
    ok(c(pg, 'fanfare') == 1, f'lên đời phương tiện: kèn 1 lần ({c(pg, "fanfare")})')
    wait_state(pg, 'playing', 4000)
    p0 = c(pg, 'paddle'); pg.wait_for_timeout(1600)
    ok(c(pg, 'paddle') == p0, 'cano máy (cấp 1): không còn tiếng mái chèo')
    ok(c(pg, 'tauntSkipped') == 0, f'tiếng chửi luôn kịp nạp khi cần ({c(pg, "taunt")} câu phát, {c(pg, "tauntSkipped")} bỏ qua)')

    # ---- đụng: RẦM + chửi kiểu đụng; phá kỷ lục -> pháo hoa lách tách
    wait_prefetch(pg, 'crash')
    ev(pg, 'game.round.t = game.round.T + game.round.grace - 0.02')
    wait_state(pg, 'crash', 3000)
    pg.wait_for_timeout(250)
    ok(c(pg, 'crash') == 1, 'đụng ghe: tiếng RẦM 1 lần')
    tc = ev(pg, '__tau[__tau.length - 1]')
    ok(tc['kind'] == 'crash' and ev(pg, '__choNoi.sfx.lastTaunt.kind') == 'crash', f'chửi kiểu đụng có tiếng: "{tc["text"]}" ({tc["vendor"]})')
    wait_state(pg, 'over', 4000)
    pg.wait_for_function('__choNoi.sfx.counts.crackle >= 2', timeout=3500)
    ok(True, f'pháo hoa kỷ lục có tiếng lách tách ({c(pg, "crackle")} chùm)')
    pg.wait_for_function('__choNoi.sfx.musicGainNow > 0.13', timeout=5000)   # chờ hết đoạn hạ nhạc lúc người bán chửi
    g2 = ev(pg, '__choNoi.sfx.musicGainNow')
    ok(0.13 <= g2 <= 0.17, f'màn kết quả: nhạc to lại mức nền, gain {g2:.3f}')
    pg.screenshot(path=f'{QA}/b6_2_result.png')

    # ---- nút loa: bật hết -> tắt nhạc -> tắt hết, nhớ lựa chọn
    pg.click('#btn-sound'); pg.wait_for_timeout(400)
    s1 = ev(pg, '({m: __choNoi.sfx.mode, ls: localStorage.getItem("choNoiMienTay.sound.v1"), g: __choNoi.sfx.musicGainNow, d: document.getElementById("btn-sound").dataset.mode, tip: document.querySelector(".sound-tip").textContent})')
    ok(s1['m'] == 'sfx' and s1['ls'] == 'sfx' and s1['d'] == 'sfx' and s1['g'] < 0.01, f'bấm 1: tắt nhạc ({s1})')
    btn_shot(pg, 'b6_3_btn_sfx.png')
    pg.click('#btn-sound'); pg.wait_for_timeout(300)
    s2 = ev(pg, '({m: __choNoi.sfx.mode, ls: localStorage.getItem("choNoiMienTay.sound.v1"), mg: __choNoi.sfx.master.gain.value})')
    ok(s2['m'] == 'off' and s2['ls'] == 'off' and s2['mg'] < 0.01, f'bấm 2: tắt hết ({s2})')
    btn_shot(pg, 'b6_4_btn_off.png')
    n0 = ev(pg, '__choNoi.sfx.log.length')
    ev(pg, '__choNoi.sfx.whoosh()')
    last = ev(pg, '__choNoi.sfx.log[__choNoi.sfx.log.length - 1]')
    ok(last['n'] == 'whoosh' and last['played'] is False, 'tắt hết: tiếng động được gọi nhưng không phát')
    pg.reload(); pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    ok(ev(pg, '__choNoi.sfx.mode') == 'off' and ev(pg, 'document.getElementById("btn-sound").dataset.mode') == 'off', 'tải lại trang: vẫn nhớ "tắt hết"')
    pg.click('#btn-sound'); pg.wait_for_timeout(200)
    ok(ev(pg, '__choNoi.sfx.mode') == 'all', 'bấm 3: bật hết lại')
    btn_shot(pg, 'b6_5_btn_all.png')

    # ---- tab ẩn thì tắt tiếng, hiện lại thì chạy
    ev(pg, '''Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange"))''')
    pg.wait_for_timeout(200)
    hs = ev(pg, '__choNoi.sfx.ctx.state')
    ev(pg, '''Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange"))''')
    pg.wait_for_timeout(200)
    vs = ev(pg, '__choNoi.sfx.ctx.state')
    ok(hs == 'suspended' and vs == 'running', f'tab ẩn: {hs}; quay lại: {vs}')

    # ---- file thu tay được ưu tiên (giả lập manifest taunts_custom)
    u = ev(pg, '''(() => { const s = __choNoi.sfx; return s.loadTaunts().then(() => { s.custom.add("jumped_00_girl.mp3"); s.custom.add("crash_03.m4a");
        const r = [s.tauntUrl("jumpedOver", 0, "girl", null), s.tauntUrl("jumpedOver", 0, "dude", null), s.tauntUrl("crash", 3, "cool", null)];
        s.custom.clear(); return r; }); })()''')
    ok('taunts_custom/jumped_00_girl.mp3' in u[0] and '/taunts/jumped_00_dude.mp3' in u[1] and 'taunts_custom/crash_03.m4a' in u[2],
       'có file trong taunts_custom thì ưu tiên (riêng giọng, hoặc dùng chung mọi người bán)')
    ok(not errs, f'console không lỗi ({errs[:3]})')
    ctx.close()


def run_files(b):
    print('\n== giọng chửi: HTTP 200 + giải mã được (decodeAudioData, Chromium)')
    B.W, B.H = 390, 844
    ctx, pg, errs = B.open_page(b)
    texts_ok = all(MAN['kinds'][k]['items'][i]['text'] == t for k in ('jumpedOver', 'crash') for i, t in enumerate(DATA['taunts'][k]))
    ok(texts_ok and len(MAN['kinds']['jumpedOver']['items']) == len(DATA['taunts']['jumpedOver']) and len(MAN['kinds']['crash']['items']) == len(DATA['taunts']['crash']),
       'manifest khớp từng câu trong data/phrases.json')
    files = [f['file'] for k in MAN['kinds'].values() for it in k['items'] for f in it['files'].values()]
    res = ev(pg, '''async (files) => { const ac = new (window.OfflineAudioContext)(1, 22050, 22050); const out = [];
        for (const f of files) { const r = await fetch("assets/audio/taunts/" + f); let dur = -1, sr = 0;
          if (r.ok) { try { const b = await ac.decodeAudioData(await r.arrayBuffer()); dur = b.duration; sr = b.sampleRate; } catch (e) { dur = -2; } }
          out.push({ f, s: r.status, dur, ct: r.headers.get("content-type") }); } return out; }''', files)
    bad = [r for r in res if r['s'] != 200 or r['dur'] <= 0.3]
    sizes = [os.path.getsize(os.path.join(B.ROOT, 'assets', 'audio', 'taunts', f)) for f in files]
    ok(len(res) == 125 and not bad, f'{len(res)} file HTTP 200 + giải mã được ({bad[:3]})')
    ok(max(sizes) <= 30 * 1024, f'mỗi câu ≤ 30 KB (lớn nhất {max(sizes) / 1024:.1f} KB, tổng {sum(sizes) / 1024:.0f} KB)')
    durs = [r['dur'] for r in res]
    print(f'  thời lượng {min(durs):.2f}–{max(durs):.2f}s, content-type {res[0]["ct"]}')
    ok(not errs, f'console không lỗi ({errs[:3]})')
    ctx.close()


def run_no_storage(b):
    print('\n== localStorage bị chặn: nút loa vẫn chạy')
    B.W, B.H = 390, 844
    init = B.FAKE_SR + r'''
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });'''
    ctx, pg, errs = B.open_page(b, init=init)
    pg.click('#btn-sound'); pg.wait_for_timeout(100)
    ok(ev(pg, '__choNoi.sfx.mode') == 'sfx', 'không lưu được vẫn đổi chế độ trong phiên')
    ok(not errs, f'console không lỗi ({errs[:3]})')
    ctx.close()


if __name__ == '__main__':
    os.makedirs(QA, exist_ok=True)
    srv = B.server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            run_main(b)
            run_files(b)
            run_no_storage(b)
            b.close()
    finally:
        srv.terminate()
    print('\n' + ('TẤT CẢ OK' if not problems else f'{len(problems)} LỖI'))
    sys.exit(1 if problems else 0)
