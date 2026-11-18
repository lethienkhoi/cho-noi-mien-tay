"""QA bước B4b (bộ nghe tiếng Việt chạy trong trình duyệt): Chromium + micro giả đọc từ file wav.

Cần wav đọc câu (tạo bằng dev/tools/make_tts_wavs.py, mặc định /tmp/cho-noi-wav).
Chạy:  python3 dev/tools/qa_b4b.py [--wavs /tmp/cho-noi-wav]
Ra:    dev/qa/b4b_*.png + số đo (thời gian tải, RTF, độ trễ, bộ nhớ đỉnh); thoát mã 1 nếu có lỗi.

Máy chủ thử (cổng 8767) phục vụ thư mục gốc repo; GET /__asrfail?on=1 làm mọi tệp assets/asr/*.onnx trả 503 (giả mất mạng),
GET /__asrslow?on=1 phục vụ assets/asr chậm lại (~10 MB/s) để chụp màn đang tải.
"""
import argparse, http.server, json, os, socketserver, subprocess, sys, threading, time, wave
import numpy as np
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(__file__))
import qa_b4 as B

ROOT, QA = B.ROOT, B.QA
PORT = 8767
BASE = f'http://127.0.0.1:{PORT}/index.html'
problems = B.problems
ok, ev = B.ok, B.ev
FAIL = {'on': False, 'slow': False}


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith('/__asrslow'):
            FAIL['slow'] = 'on=1' in self.path
            self.send_response(200); self.end_headers(); self.wfile.write(b'ok'); return
        if self.path.startswith('/__asrfail'):
            FAIL['on'] = 'on=1' in self.path
            self.send_response(200); self.end_headers(); self.wfile.write(b'ok'); return
        if FAIL['on'] and '/assets/asr/' in self.path and '.onnx' in self.path:
            self.send_response(503); self.end_headers(); return
        return super().do_GET()
    def copyfile(self, src, dst):
        if not (FAIL['slow'] and '/assets/asr/' in self.path):
            return super().copyfile(src, dst)
        while True:   # giả mạng chậm (~10 MB/s) để chụp màn đang tải
            b = src.read(256 * 1024)
            if not b: break
            dst.write(b); time.sleep(0.025)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def serve():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def mic_wav(src, dst, lead=1.2, tail=2.0):
    """wav 48 kHz mono cho micro giả: im lặng + câu + im lặng (Chromium phát lặp lại)."""
    with wave.open(src) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
        sr = w.getframerate()
    t = np.arange(int(len(x) * 48000 / sr)) * sr / 48000
    y = np.interp(t, np.arange(len(x)), x)
    y = np.concatenate([np.zeros(int(lead * 48000)), y, np.zeros(int(tail * 48000))]).astype(np.int16)
    with wave.open(dst, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000); w.writeframes(y.tobytes())
    return len(y) / 48000


def chrome_rss():
    """Tổng RSS (MB) các tiến trình Chromium headless + RSS lớn nhất của một tiến trình (tiến trình trang + worker)."""
    try:
        out = subprocess.run(['ps', '-eo', 'rss,args'], capture_output=True, text=True).stdout.splitlines()[1:]
    except Exception:
        return 0, 0
    v = [int(l.split(None, 1)[0]) for l in out if 'chrome-headless-shell' in l or ('chrom' in l.lower() and '--type=' in l)]
    return sum(v) / 1024, (max(v) / 1024 if v else 0)


class Peak:
    def __init__(self): self.total = 0; self.proc = 0; self.stop = False
    def run(self):
        while not self.stop:
            t, p = chrome_rss(); self.total = max(self.total, t); self.proc = max(self.proc, p); time.sleep(0.25)


def launch(p, wav):
    return p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
                                   f'--use-file-for-fake-audio-capture={wav}', '--autoplay-policy=no-user-gesture-required'])


def new_page(b, url, init=None):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.grant_permissions(['microphone'], origin=f'http://127.0.0.1:{PORT}')
    if init: ctx.add_init_script(init)
    pg = ctx.new_page()
    errs, logs = [], []
    pg.on('console', lambda m: (errs if m.type == 'error' else logs).append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url)
    pg.wait_for_function('document.getElementById("app").dataset.state === "title"', timeout=30000)
    pg.evaluate('document.fonts.ready')
    return ctx, pg, errs, logs


def force_phrase(pg, pid):
    return ev(pg, f'''(() => {{ const p = game.data.phrases.find((q) => q.id === {pid}); game.__next = p;
        if (!game.__wrapped) {{ const orig = game.picker.pick.bind(game.picker); game.__wrapped = true;
          game.picker.pick = (n) => {{ if (game.__next) {{ const q = game.__next; game.__next = null; return q; }} return orig(n); }}; }}
        return {{ ct: p.chinhTa, pa: p.phienAm }}; }})()''')


READY = 'window.__choNoi && __choNoi.localAsr && __choNoi.localAsr.ready'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wavs', default='/tmp/cho-noi-wav')
    ap.add_argument('--pid', type=int, default=8)
    a = ap.parse_args()
    os.makedirs(QA, exist_ok=True)
    src = os.path.join(a.wavs, f'p{a.pid}_ct.wav')
    if not os.path.exists(src):
        raise SystemExit(f'thiếu {src}: chạy dev/tools/make_tts_wavs.py trước')
    wav = '/tmp/cho-noi-mic.wav'
    loop = mic_wav(src, wav)
    global SPEECH_END
    with wave.open(src) as w: SPEECH_END = 1.2 + w.getnframes() / w.getframerate() - 0.5   # wav TTS có 0,5 s im lặng cuối
    httpd = serve()
    metrics = {}
    peak = Peak(); th = threading.Thread(target=peak.run, daemon=True); th.start()
    try:
        with sync_playwright() as p:
            b = launch(p, wav)
            print('\n== tải lần đầu (?asr=local)')
            FAIL['slow'] = True
            t0 = time.time()
            ctx, pg, errs, logs = new_page(b, BASE + '?asr=local')
            pg.wait_for_function('document.getElementById("asr-text").textContent.includes("%") && document.getElementById("app").dataset.state === "title"', timeout=20000)
            pg.wait_for_function('parseInt(document.getElementById("asr-text").textContent.split("…")[1]) >= 30', timeout=60000)
            pg.screenshot(path=f'{QA}/b4b_1_loading.png')
            txt = ev(pg, 'document.getElementById("asr-text").textContent')
            FAIL['slow'] = False
            ok(('chợ đang dọn hàng ra' in txt and '%' in txt or 'sắp mở chợ' in txt) and ev(pg, 'document.getElementById("btn-start").disabled'),
               f'màn tải: "{txt}", nút Bắt đầu tắt')
            pg.wait_for_function(READY, timeout=180000)
            info = ev(pg, '__choNoi.localAsr.info')
            metrics['first_load_s_slow_net'] = round(time.time() - t0, 1)
            metrics['ready'] = info
            ok(not info['cached'], f'lần đầu tải từ mạng: {info}')
            ok(not ev(pg, 'document.getElementById("btn-start").disabled'), 'sẵn sàng → nút Bắt đầu bật')
            ok('sẵn sàng' in ev(pg, 'document.getElementById("asr-text").textContent'), 'báo "Bộ nghe tiếng Việt sẵn sàng"')
            pg.screenshot(path=f'{QA}/b4b_2_ready.png')
            pg.click('#btn-licenses'); pg.wait_for_timeout(150)
            lic = ev(pg, 'document.getElementById("overlay-licenses").innerText')
            ok('Apache-2.0' in lic and 'sherpa-onnx' in lic and 'onnxruntime' in lic, 'màn Nguồn và giấy phép')
            pg.screenshot(path=f'{QA}/b4b_3_licenses.png')
            pg.click('#btn-licenses-close')

            print('\n== chơi: micro giả đọc câu', a.pid)
            target = force_phrase(pg, a.pid)
            ev(pg, '''window.__t = {}; game.addEventListener("round", () => { __t.round = performance.now(); });
                      game.addEventListener("matched", (e) => { __t.matched = performance.now(); __t.dialect = e.detail.dialect; });
                      __choNoi.localAsr.addEventListener("result", (e) => { const r = e.detail.results; __t.last = r[r.length - 1].transcript; const d = __choNoi.localAsr.lastDecode; (__t.hist = __t.hist || []).push([Math.round(performance.now() - (__t.round || 0)), r[r.length - 1].transcript, d.at, d.ms]); });''')
            pg.click('#btn-start')
            B.wait_state(pg, 'playing', 15000)
            ok(ev(pg, '__choNoi.speech.kind') == 'local', 'đang dùng bộ nghe cục bộ')
            ok(ev(pg, 'game.round.phrase.chinhTa') == target['ct'], f'câu: {target["ct"]}')
            try:
                pg.wait_for_function('document.getElementById("heard-text").textContent.length > 2 && game.state === "playing"', timeout=12000)
                ev(pg, 'game.frozen = true'); pg.wait_for_timeout(100)
                pg.screenshot(path=f'{QA}/b4b_4_heard.png'); ev(pg, 'game.frozen = false')
            except Exception:
                pass
            jumped = True
            try:
                pg.wait_for_function('game.state === "jumping"', timeout=20000)
            except Exception:
                jumped = False
            t = ev(pg, '__t')
            st = ev(pg, '({s: __choNoi.localAsr.stats, l: __choNoi.localAsr.lastDecode})')
            ok(jumped, f'nghe câu qua micro giả → nhảy (nghe được: "{t.get("last")}")')
            # B6: game phát tiếng (AudioContext riêng) cùng lúc bộ nghe thu micro (AudioContext riêng của src/speech)
            au = ev(pg, '''({ g: __choNoi.sfx.ctx && __choNoi.sfx.ctx.state, m: __choNoi.localAsr.audio && __choNoi.localAsr.audio.ctx.state,
                same: !!(__choNoi.localAsr.audio && __choNoi.sfx.ctx === __choNoi.localAsr.audio.ctx), c: __choNoi.sfx.counts })''')
            ok(au['g'] == 'running' and au['m'] == 'running' and not au['same'] and au['c'].get('beep', 0) >= 1 and au['c'].get('musicStart', 0) >= 1,
               f'phát tiếng + thu micro cùng lúc: context game {au["g"]}, context micro {au["m"]}, tiếng đã gọi {au["c"]}')
            if jumped:
                metrics['round_to_jump_ms'] = round(t['matched'] - t['round'])
                pg.wait_for_function('game.jump && game.jump.t > .35', timeout=3000)
                ev(pg, 'game.frozen = true'); pg.wait_for_timeout(100)
                pg.screenshot(path=f'{QA}/b4b_5_jump.png'); ev(pg, 'game.frozen = false')
            metrics['decodes'] = st
            # độ trễ: micro giả phát lặp wav (im lặng LEAD s + câu + im lặng); câu kết thúc ở LEAD + dur (mod chu kỳ)
            if jumped and t.get('hist'):
                at, ms = t['hist'][-1][2], t['hist'][-1][3]
                k = int((at - SPEECH_END) // loop)
                end_k = k * loop + SPEECH_END
                metrics['latency_ms_after_speech_end'] = round((at - end_k) * 1000 + ms)
            metrics['history'] = t.get('hist', [])[:12]

            print('\n== câu khác (micro vẫn đọc câu cũ) → không được qua, đụng')
            other = force_phrase(pg, 21)
            pg.wait_for_function('game.state === "playing" && game.round.phrase.id === 21', timeout=15000)
            # tab ẩn giữa câu → tạm dừng, trả micro; Chơi tiếp → xin micro lại, vẫn nghe câu đang dở
            ev(pg, '''Object.defineProperty(document, "hidden", {configurable: true, get: () => true}); document.dispatchEvent(new Event("visibilitychange"))''')
            pg.wait_for_timeout(300)
            ok(ev(pg, 'game.paused') and ev(pg, '__choNoi.localAsr.audio') is None, 'tab ẩn → tạm dừng, trả micro')
            ev(pg, 'Object.defineProperty(document, "hidden", {configurable: true, get: () => false})')
            ev(pg, 'window.__nres = 0; __choNoi.localAsr.addEventListener("result", () => __nres++)')
            pg.click('#btn-resume'); pg.wait_for_function('!game.paused', timeout=5000)
            pg.wait_for_function('__nres > 0', timeout=12000)
            ok(ev(pg, '__choNoi.localAsr.state') == 'running' and ev(pg, '__choNoi.localAsr.curId') > 0, 'Chơi tiếp → nghe lại câu đang dở')
            B.wait_state(pg, 'crash', 40000)
            ok(ev(pg, 'game.passed') == (1 if jumped else 0), f'đọc sai câu ("{other["ct"]}") → đụng, không qua')
            B.wait_state(pg, 'over', 6000); pg.wait_for_timeout(300)
            pg.screenshot(path=f'{QA}/b4b_6_result.png')
            pg.wait_for_timeout(300)
            ok(not errs, 'console không lỗi' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
            metrics['logs'] = [l for l in logs if 'cho-noi' in l][:6]

            print('\n== tải lại trang: lấy từ Cache Storage')
            t0 = time.time()
            pg.reload()
            pg.wait_for_function(READY, timeout=120000)
            info2 = ev(pg, '__choNoi.localAsr.info')
            metrics['cached_load_s'] = round(time.time() - t0, 1)
            metrics['ready_cached'] = info2
            ok(info2['cached'], f'lần sau không tải lại ({info2["loadMs"]} ms)')
            ctx.close()

            print('\n== lỗi mạng khi tải (?asr=local) → Thử lại')
            subprocess.run(['curl', '-s', f'http://127.0.0.1:{PORT}/__asrfail?on=1'], capture_output=True)
            ctx, pg, errs, logs = new_page(b, BASE + '?asr=local')
            pg.wait_for_selector('#btn-asr-retry', state='visible', timeout=60000)
            ok(ev(pg, 'document.getElementById("btn-start").disabled') and 'lỗi mạng' in ev(pg, 'document.getElementById("asr-text").textContent'),
               'lỗi mạng: báo lỗi, có Thử lại, nút Bắt đầu tắt')
            pg.screenshot(path=f'{QA}/b4b_7_neterror.png')
            subprocess.run(['curl', '-s', f'http://127.0.0.1:{PORT}/__asrfail?on=0'], capture_output=True)
            pg.click('#btn-asr-retry')
            pg.wait_for_function(READY, timeout=120000)
            ok(not ev(pg, 'document.getElementById("btn-start").disabled'), 'Thử lại → tải xong, bật nút Bắt đầu')
            ok(all('503' in e or 'Failed to load resource' in e for e in errs), 'console chỉ có lỗi 503 do giả mất mạng' + ('' if not errs else f' ({len(errs)})'))
            ctx.close()

            print('\n== mặc định + lỗi mạng → tự dùng Web Speech')
            subprocess.run(['curl', '-s', f'http://127.0.0.1:{PORT}/__asrfail?on=1'], capture_output=True)
            ctx, pg, errs, logs = new_page(b, BASE, init=B.FAKE_SR)
            pg.wait_for_selector('#btn-asr-retry', state='visible', timeout=60000)
            ok(ev(pg, '__choNoi.speech.kind') == 'webspeech' and not ev(pg, 'document.getElementById("btn-start").disabled'),
               'chuyển về Web Speech, vẫn bấm Bắt đầu được')
            ok('bộ nghe của trình duyệt' in ev(pg, 'document.getElementById("asr-text").textContent'), 'có dòng thông báo nhỏ')
            pg.screenshot(path=f'{QA}/b4b_8_fallback.png')
            pg.click('#btn-start'); B.wait_state(pg, 'playing')
            ph = B.phrase(pg); B.say(pg, ph['ct'], False, True)
            pg.wait_for_function('game.state === "jumping"', timeout=3000)
            ok(True, 'chơi bằng Web Speech (giả) vẫn qua ghe')
            subprocess.run(['curl', '-s', f'http://127.0.0.1:{PORT}/__asrfail?on=0'], capture_output=True)
            ctx.close()

            print('\n== mặc định, máy "chậm" (ngưỡng RTF giả 0,0001) → Web Speech')
            ctx, pg, errs, logs = new_page(b, BASE + '?asrmaxrtf=0.0001', init=B.FAKE_SR)
            pg.wait_for_function('document.getElementById("asr-text").textContent.includes("chậm")', timeout=120000)
            ok(ev(pg, '__choNoi.speech.kind') == 'webspeech', 'máy chậm → Web Speech')
            ok(not errs, 'console không lỗi (máy chậm)' + ('' if not errs else ': ' + ' | '.join(errs[:3])))
            ctx.close()

            print('\n== ?asr=webspeech không tải mô hình')
            ctx, pg, errs, logs = new_page(b, BASE + '?asr=webspeech', init=B.FAKE_SR)
            ok(ev(pg, '__choNoi.localAsr') is None and ev(pg, '__choNoi.speech.kind') == 'webspeech' and pg.is_hidden('#asr-box'),
               'ép Web Speech: không tải bộ nghe, không hiện khung tải')
            ctx.close()
            b.close()
    finally:
        peak.stop = True; th.join(1)
        httpd.shutdown()
    metrics['chromium_peak_rss_total_mb'] = round(peak.total)
    metrics['chromium_peak_rss_proc_mb'] = round(peak.proc)
    print('\n== số đo')
    print(json.dumps(metrics, ensure_ascii=False, indent=1))
    print('\n' + ('TẤT CẢ OK' if not problems else f'{len(problems)} LỖI'))
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
