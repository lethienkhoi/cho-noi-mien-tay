"""QA bước B4 (giọng nói): Playwright + SpeechRecognition giả tiêm vào trang, khung 390x844.

Chạy:  python3 dev/tools/qa_b4.py      (tự mở http.server ở thư mục gốc repo, cổng 8766)
Ra:    dev/qa/b4_*.png + in kết quả; thoát mã 1 nếu có lỗi.
"""
import os, sys, time, subprocess, socket
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
QA = os.path.join(ROOT, 'dev', 'qa')
PORT = 8766
URL = f'http://127.0.0.1:{PORT}/index.html?asr=webspeech'  # B4b: ép Web Speech để dùng micro giả
W, H = 390, 844
problems = []

# SpeechRecognition giả: phát transcript theo lệnh từ test (__srSay), giả lỗi (__srError / __sr.failNext),
# giả Safari tự dừng (__srEnd). Ghi lại số lần start để kiểm tra khởi động lại.
FAKE_SR = r'''
(() => {
  const S = window.__sr = { instances: [], starts: 0, failNext: null, active: null, dieFast: false };
  class FakeSR {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.running = false; this._r = []; S.instances.push(this); }
    start() {
      if (this.running) throw new DOMException('already started', 'InvalidStateError');
      S.starts++; this.running = true; this._r = []; S.active = this;
      const err = S.failNext; S.failNext = null;
      setTimeout(() => {
        if (!this.running) return;
        if (err) { this.onerror && this.onerror({ error: err }); this._end(); return; }
        this.onstart && this.onstart({});
        if (S.dieFast) { this._end(); return; }
        this.onaudiostart && this.onaudiostart({});
      }, 40);
    }
    stop() { this._end(); }
    abort() { if (this.running) { this.onerror && this.onerror({ error: 'aborted' }); this._end(); } }
    _end() { if (!this.running) return; this.running = false; setTimeout(() => this.onend && this.onend({}), 15); }
  }
  window.__srSay = (text, isFinal = false, newResult = false) => {
    const r = S.active; if (!r || !r.running) return false;
    const res = r._r;
    if (!newResult && res.length && !res[res.length - 1].isFinal) res.pop();
    res.push({ transcript: text, isFinal });
    const results = res.map((x) => { const a = [{ transcript: x.transcript, confidence: .9 }]; a.isFinal = x.isFinal; return a; });
    r.onspeechstart && r.onspeechstart({});
    r.onresult && r.onresult({ resultIndex: 0, results });
    return true;
  };
  window.__srError = (err) => { const r = S.active; if (!r || !r.running) return false; r.onerror && r.onerror({ error: err }); r._end(); return true; };
  window.__srEnd = () => { const r = S.active; if (!r || !r.running) return false; r._end(); return true; };
  window.__srRunning = () => !!(S.active && S.active.running);
  window.SpeechRecognition = undefined;
  window.webkitSpeechRecognition = FakeSR;
})();
'''
NO_SR = r'''
Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
'''
UA_ZALO = ('Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) '
           'Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Zalo android/12100734 ZaloTheme/light ZaloLanguage/vn')


def ok(cond, msg):
    print(('  OK  ' if cond else '  LỖI ') + msg)
    if not cond: problems.append(msg)


def server():
    p = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try: socket.create_connection(('127.0.0.1', PORT), .2).close(); return p
        except OSError: time.sleep(.1)
    raise SystemExit('server không lên')


def open_page(b, init=FAKE_SR, ua=None, ready='title'):
    kw = dict(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
    if ua: kw['user_agent'] = ua
    ctx = b.new_context(**kw)
    try: ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=f'http://127.0.0.1:{PORT}')
    except Exception: pass
    if init: ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=20000)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(300)
    return ctx, pg, errs


def ev(pg, js, arg=None): return pg.evaluate(js, arg)
def wait_state(pg, s, timeout=15000): pg.wait_for_function(f'window.game && game.state === "{s}"', timeout=timeout)
def say(pg, text, final=False, new=False): return ev(pg, '([t, f, n]) => __srSay(t, f, n)', [text, final, new])
def phrase(pg): return ev(pg, '({ct: game.round.phrase.chinhTa, pa: game.round.phrase.phienAm, id: game.round.id})')
def said_count(pg): return ev(pg, 'document.querySelectorAll("#phrase-big .w.said").length')
def start(pg):
    pg.click('#btn-start'); wait_state(pg, 'playing')


def run_main(b):
    print('\n== luồng chính 390x844')
    ctx, pg, errs = open_page(b)
    ev(pg, '''window.__matched = []; game.addEventListener("matched", (e) => __matched.push({id: e.detail.roundId, dialect: e.detail.dialect, gained: e.detail.gained}))''')
    pg.screenshot(path=f'{QA}/b4_1_start.png')
    note = ev(pg, 'document.getElementById("start-note").textContent')
    ok('micro' in note and 'đọc to câu trên khung chữ' in note, f'màn bắt đầu ghi rõ cần micro: "{note}"')
    ok('Bản thử' not in ev(pg, 'document.body.innerText') and 'chạm màn hình' not in ev(pg, 'document.body.innerText'), 'không còn chữ "Bản thử: chạm màn hình…"')
    ok(ev(pg, '__sr.starts') == 0, 'chưa bấm Bắt đầu thì chưa mở micro')

    start(pg)
    sr = ev(pg, '({lang: __sr.active.lang, c: __sr.active.continuous, i: __sr.active.interimResults, n: __sr.starts})')
    ok(sr == {'lang': 'vi-VN', 'c': True, 'i': True, 'n': 1}, f'mở nhận giọng vi-VN, continuous + interim, 1 lần start ({sr})')

    # ---- chạm KHÔNG làm nhảy (bỏ hẳn điều khiển chạm)
    for x, y in [(W * .5, H * .45), (W * .5, H * .85), (60, 300)]:
        pg.touchscreen.tap(x, y); pg.wait_for_timeout(60)
    pg.mouse.click(W * .5, H * .4); pg.keyboard.press('Space'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    ok(ev(pg, 'game.state') == 'playing' and ev(pg, 'game.passed') == 0, 'chạm/bấm/phím trên màn chơi KHÔNG làm nhảy')

    # ---- đọc dở → tô dần + "Đang nghe"
    ev(pg, 'game.round.t = 0'); p1 = phrase(pg)
    first = p1['pa'].split()[0]
    say(pg, first)
    pg.wait_for_timeout(150)
    heard = ev(pg, 'document.getElementById("heard-text").textContent')
    ok(said_count(pg) == 1 and first.lower().strip(',.') in heard, f'đọc chữ đầu: tô 1 chữ, "Đang nghe: {heard}"')
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(80)
    pg.screenshot(path=f'{QA}/b4_2_listening.png')
    ev(pg, 'game.frozen = false')

    # ---- đọc đủ câu (phiên âm, kết quả tạm thời) → nhảy, chuẩn miền Tây
    say(pg, p1['pa'])
    pg.wait_for_function('game.state === "jumping"', timeout=2000)
    m = ev(pg, '__matched[0]')
    ok(m and m['id'] == p1['id'] and m['dialect'] is True and m['gained'] == 300, f'đọc phiên âm (chưa final) → qua ghe, chuẩn miền Tây +300 ({m})')
    pg.wait_for_function('game.jump && game.jump.t > .4', timeout=3000)
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(80)
    pg.screenshot(path=f'{QA}/b4_3_passed.png')
    ok(ev(pg, 'document.querySelector("#chips").textContent').find('Chuẩn miền Tây') >= 0, 'khung chữ hiện "Chuẩn miền Tây"')
    ev(pg, 'game.frozen = false')
    say(pg, p1['pa'], True)  # máy chốt final câu cũ khi đang nhảy
    pg.wait_for_function(f'game.state === "playing" && game.round.id > {p1["id"]}', timeout=8000)

    # ---- câu 2: đọc lại câu cũ → không tính; đọc chính tả câu mới → qua, không thưởng
    p2 = phrase(pg); ev(pg, 'game.round.t = 0')
    ok(said_count(pg) == 0, 'câu mới: chưa tô chữ nào (transcript câu trước bị bỏ)')
    say(pg, p1['pa'], True, True); pg.wait_for_timeout(250)
    ok(ev(pg, 'game.state') == 'playing' and ev(pg, '__matched.length') == 1, 'đọc lại câu cũ → không tính')
    # chuẩn bị câu 3 cố định để thử "câu nói trước khi câu bắt đầu không được tính"
    target3 = ev(pg, '''(() => { const L = game.data.phrases.filter((p) => p.id !== game.round.phrase.id && p.level <= 2);
        const p = L[0]; game.__next = p; const orig = game.picker.pick.bind(game.picker);
        game.picker.pick = (n) => { if (game.__next) { const q = game.__next; game.__next = null; return q; } return orig(n); };
        return {ct: p.chinhTa, pa: p.phienAm}; })()''')
    say(pg, p2['ct'], False, True)
    pg.wait_for_function('game.state === "jumping"', timeout=2000)
    m = ev(pg, '__matched[1]')
    ok(m and m['dialect'] is False and m['gained'] == 100, f'đọc chính tả → qua ghe +100, không thưởng giọng ({m})')

    # ---- câu 3: người chơi nói câu 3 TRƯỚC khi câu 3 bắt đầu (lúc đang nhảy) → không tính
    pg.wait_for_function('game.jump && game.jump.t > .3', timeout=3000)
    say(pg, target3['ct'], False, True)    # kết quả tạm thời, còn dở lúc câu mới bắt đầu
    pg.wait_for_function('game.state === "playing" && game.round.phrase.chinhTa === ' + repr(target3['ct']).replace("'", '"'), timeout=8000)
    pg.wait_for_timeout(250)
    ok(ev(pg, '__matched.length') == 2, 'câu đọc trước khi ghe mới tới → không tính')
    say(pg, target3['ct'] + ' ờ')          # cùng result tạm thời nói thêm → phần cũ vẫn bị bỏ
    pg.wait_for_timeout(200)
    ok(ev(pg, '__matched.length') == 2, 'result tạm thời kéo dài chứa câu cũ → vẫn không tính')
    ev(pg, 'game.round.t = 0')
    # Safari tự dừng giữa chừng: nói nửa đầu, phiên tắt, tự khởi động lại, nói nửa sau → vẫn qua
    words = target3['ct'].split(); half = len(words) // 2
    starts0 = ev(pg, '__sr.starts')
    say(pg, ' '.join(words[:half]), True, True)
    ev(pg, '__srEnd()')
    pg.wait_for_function(f'__sr.starts > {starts0} && __srRunning()', timeout=3000)
    ok(True, 'phiên nhận giọng tự dừng → tự khởi động lại (1 lần)')
    say(pg, ' '.join(words[half:]))
    pg.wait_for_function('game.state === "jumping"', timeout=2000)
    ok(ev(pg, '__matched.length') == 3, 'nửa câu trước + nửa câu sau khi khởi động lại → qua ghe')
    pg.wait_for_function('game.state === "playing" && game.round.id > 3', timeout=8000)

    # ---- no-speech: không báo lỗi, chỉ khởi động lại
    starts0 = ev(pg, '__sr.starts')
    ev(pg, '__srError("no-speech")')
    pg.wait_for_function(f'__sr.starts > {starts0} && __srRunning()', timeout=3000)
    ok(not pg.is_visible('#overlay-speech') and not ev(pg, 'game.paused'), 'no-speech: không báo lỗi, nghe lại')

    # ---- đọc sai → không qua, hết giờ đụng
    say(pg, 'trời ơi đất hỡi', False, True)
    pg.wait_for_timeout(200)
    ok(ev(pg, 'game.state') == 'playing', 'đọc sai câu → không qua')
    wait_state(pg, 'crash', 20000)
    pg.wait_for_function('game.crash.t > .28', timeout=3000)
    ev(pg, 'game.frozen = true'); pg.wait_for_timeout(80)
    pg.screenshot(path=f'{QA}/b4_4_crash.png')
    ev(pg, 'game.frozen = false')
    pg.wait_for_timeout(100)
    ok(not ev(pg, '__srRunning()'), 'đụng ghe → tắt micro')
    wait_state(pg, 'over', 5000); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{QA}/b4_5_result.png')
    ok(ev(pg, 'game.score') == 300 + 100 + 100, f'điểm = 300 + 100 + 100 (thang trăm 2026-11-18) (score={ev(pg, "game.score")})')
    # chơi lại: mở micro lại
    starts0 = ev(pg, '__sr.starts')
    pg.click('#btn-again'); wait_state(pg, 'playing')
    ok(ev(pg, '__sr.starts') == starts0 + 1 and ev(pg, '__srRunning()'), 'Chơi lại → mở micro lại')

    # ---- tab ẩn → tạm dừng + tắt micro; Chơi tiếp → nghe lại
    ev(pg, '''Object.defineProperty(document, "hidden", {configurable: true, get: () => true}); document.dispatchEvent(new Event("visibilitychange"))''')
    pg.wait_for_timeout(150)
    ok(ev(pg, 'game.paused') and not ev(pg, '__srRunning()'), 'tab ẩn → tạm dừng, tắt micro')
    ev(pg, 'Object.defineProperty(document, "hidden", {configurable: true, get: () => false})')
    pg.click('#btn-resume'); pg.wait_for_function('!game.paused', timeout=3000)
    ok(ev(pg, '__srRunning()'), 'Chơi tiếp → nghe lại')
    p = phrase(pg); say(pg, p['ct'], False, True)
    pg.wait_for_function('game.state === "jumping"', timeout=2000)
    ok(True, 'sau khi chơi tiếp vẫn đọc qua ghe được')
    ok(not errs, 'console không lỗi' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


def run_errors(b):
    print('\n== lỗi micro / mạng')
    ctx, pg, errs = open_page(b)
    # từ chối micro
    ev(pg, '__sr.failNext = "not-allowed"')
    pg.click('#btn-start')
    pg.wait_for_selector('#overlay-speech', state='visible', timeout=3000)
    txt = ev(pg, 'document.getElementById("overlay-speech").innerText')
    ok('Micro đang bị tắt' in txt and 'aA' in txt and 'Cài đặt > Safari > Micro' in txt and 'ổ khoá' in txt, 'từ chối micro: hướng dẫn bật lại cho Safari iPhone + Chrome Android')
    ok(ev(pg, 'game.state') == 'title', 'từ chối micro: game chưa chạy')
    pg.screenshot(path=f'{QA}/b4_6_denied.png')
    pg.click('#btn-speech-retry'); wait_state(pg, 'playing')
    ok(not pg.is_visible('#overlay-speech'), 'Thử lại (cho phép) → vào chơi')
    # mất mạng giữa chừng
    pg.wait_for_timeout(300)
    ev(pg, '__srError("network")')
    pg.wait_for_selector('#overlay-speech', state='visible', timeout=3000)
    t0 = ev(pg, 'game.round.t'); pg.wait_for_timeout(300)
    ok(ev(pg, 'game.paused') and ev(pg, 'game.round.t') == t0, 'mất mạng: game tạm dừng')
    ok('Cần mạng để nhận giọng' in ev(pg, 'document.getElementById("overlay-speech").innerText'), 'mất mạng: báo "Cần mạng để nhận giọng"')
    ok(not pg.is_visible('#overlay-pause'), 'mất mạng: không chồng màn Tạm dừng')
    pg.screenshot(path=f'{QA}/b4_7_network.png')
    pg.click('#btn-speech-retry'); pg.wait_for_function('!game.paused', timeout=3000)
    ok(ev(pg, '__srRunning()') and ev(pg, 'game.state') == 'playing', 'Thử lại → nghe lại, chơi tiếp')
    # service-not-allowed (iOS tắt Đọc chính tả) giữa chừng
    ev(pg, '__srError("service-not-allowed")')
    pg.wait_for_selector('#overlay-speech', state='visible', timeout=3000)
    ok('Đọc chính tả' in ev(pg, 'document.getElementById("overlay-speech").innerText'), 'service-not-allowed: nhắc bật Đọc chính tả (iPhone)')
    pg.click('#btn-speech-home'); pg.wait_for_selector('#screen-start', state='visible')
    ok(ev(pg, 'game.state') == 'title' and not ev(pg, 'game.paused'), 'Về bến → màn bắt đầu')
    # micro chết liền liên tục → dừng, báo lỗi (không lặp vô hạn)
    ev(pg, '__sr.dieFast = true; window.__s0 = __sr.starts')
    pg.click('#btn-start')
    pg.wait_for_selector('#overlay-speech', state='visible', timeout=10000)
    n = ev(pg, '__sr.starts - __s0'); pg.wait_for_timeout(800)
    ok('Micro chưa chạy ổn' in ev(pg, 'document.getElementById("overlay-speech").innerText') and ev(pg, '__sr.starts - __s0') == n and n <= 7,
       f'micro chết liền: dừng sau {n} lần, báo lỗi')
    ev(pg, '__sr.dieFast = false')
    ok(not errs, 'console không lỗi (lỗi micro)' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


def run_nospeech(b):
    print('\n== trình duyệt không nghe được giọng')
    ctx, pg, errs = open_page(b, init=NO_SR)
    ok(pg.is_visible('#screen-nospeech') and not pg.is_visible('#screen-start'), 'không có SpeechRecognition → báo sớm, không có nút Bắt đầu')
    txt = ev(pg, 'document.getElementById("screen-nospeech").innerText')
    ok('Trình duyệt này chưa nghe được giọng nói' in txt and 'Chrome' in txt and 'Safari' in txt, 'báo đúng + hướng dẫn Chrome/Safari')
    pg.screenshot(path=f'{QA}/b4_8_nospeech.png')
    pg.click('#btn-copy-link'); pg.wait_for_timeout(300)
    lbl = ev(pg, 'document.getElementById("btn-copy-link").textContent')
    box = pg.is_visible('#link-box')
    ok(lbl == 'Đã chép link' or box, f'Sao chép link: "{lbl}"' + (' (hiện ô link)' if box else ''))
    if lbl == 'Đã chép link':
        clip = ev(pg, 'navigator.clipboard.readText()')
        ok(clip.startswith('http://127.0.0.1') and 'index.html' in clip, f'clipboard = {clip}')
    # dự phòng: clipboard hỏng → hiện ô link
    ev(pg, '''Object.defineProperty(navigator, "clipboard", {value: {writeText: () => Promise.reject(new Error("x"))}, configurable: true});
              document.getElementById("btn-copy-link").textContent = "Sao chép link"''')
    pg.click('#btn-copy-link'); pg.wait_for_timeout(200)
    ok(pg.is_visible('#link-box') and 'index.html' in ev(pg, 'document.getElementById("link-box").value'), 'clipboard hỏng → hiện ô link để tự chép')
    pg.touchscreen.tap(W * .5, H * .5); pg.wait_for_timeout(100)
    ok(ev(pg, 'game.state') == 'title', 'chạm màn không vào game')
    ok(not errs, 'console không lỗi (no speech)' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()

    print('\n== trình duyệt trong app (Zalo Android)')
    ctx, pg, errs = open_page(b, ua=UA_ZALO)
    ok(pg.is_visible('#screen-nospeech'), 'Zalo: báo sớm')
    txt = ev(pg, 'document.getElementById("screen-nospeech").innerText')
    ok('Zalo' in txt and pg.is_visible('#btn-open-chrome') and pg.is_visible('#btn-try-here'), 'Zalo: nhắc mở bằng Chrome, có nút Mở bằng Chrome + Vẫn thử ở đây')
    href = ev(pg, 'document.getElementById("btn-open-chrome").getAttribute("href")')
    ok(href.startswith('intent://127.0.0.1') and 'package=com.android.chrome' in href, f'link intent Chrome: {href[:60]}…')
    pg.screenshot(path=f'{QA}/b4_9_inapp.png')
    pg.click('#btn-try-here'); wait_state(pg, 'playing')
    ok(ev(pg, '__srRunning()'), 'Vẫn thử ở đây → mở micro, vào chơi')
    ok(not errs, 'console không lỗi (in-app)' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
    ctx.close()


if __name__ == '__main__':
    os.makedirs(QA, exist_ok=True)
    srv = server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            run_main(b)
            run_errors(b)
            run_nospeech(b)
            b.close()
    finally:
        srv.terminate()
    print('\n' + ('TẤT CẢ OK' if not problems else f'{len(problems)} LỖI'))
    sys.exit(1 if problems else 0)
