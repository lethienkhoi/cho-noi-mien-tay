"""Gắn ?v=<mã> vào mọi đường dẫn file code tương đối (import, Worker, worklet, importScripts, <script>, <link css>)
để điện thoại không lấy file cũ trong bộ nhớ đệm (GitHub Pages cho trình duyệt giữ file 10 phút) trộn với file mới.
Chạy trước mỗi lần đẩy lên: python3 dev/tools/stamp_version.py
"""
import os, re, time, hashlib, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
files = sorted(glob.glob(os.path.join(ROOT, 'src', '**', '*.js'), recursive=True)) + [os.path.join(ROOT, 'index.html'), os.path.join(ROOT, 'css', 'style.css')]

def strip(s):
    return re.sub(r'(\.(?:js|css))\?v=[0-9a-z]+', r'\1', s)

# mã phiên bản = băm nội dung (đã bỏ dấu cũ) của toàn bộ code, đổi code thì đổi mã
h = hashlib.sha1()
for f in files:
    h.update(strip(open(f, encoding='utf-8').read()).encode())
V = h.hexdigest()[:8]

PATTERNS = [
    r"""((?:from|import)\s*\(?\s*['"]\.{1,2}/[^'"?]+\.js)(?:\?v=[0-9a-z]+)?(['"])""",          # import ... from './x.js'
    r"""(new URL\(\s*['"][^'"/?]+\.js)(?:\?v=[0-9a-z]+)?(['"])""",                                # new URL('asr-worker.js', ...)
    r"""(importScripts\(\s*['"][^'"?]+\.js)(?:\?v=[0-9a-z]+)?(['"])""",                         # importScripts('asr-core.js')
    r"""(<script[^>]+src=["'](?!https?:)[^"'?]+\.js)(?:\?v=[0-9a-z]+)?(["'])""",                 # <script src="src/main.js">
    r"""(<link[^>]+href=["'](?!https?:)[^"'?]+\.css)(?:\?v=[0-9a-z]+)?(["'])""",                # <link href="css/style.css">
]
changed = 0
for f in files:
    s = open(f, encoding='utf-8').read()
    t = s
    for p in PATTERNS:
        t = re.sub(p, lambda m: f'{m.group(1)}?v={V}{m.group(2)}', t)
    if t != s:
        open(f, 'w', encoding='utf-8').write(t); changed += 1
print(f'phiên bản {V}: sửa {changed} file')


# B6: giọng chửi Khôi tự thu — liệt kê file trong assets/audio/taunts_custom/ vào manifest.json để game biết mà ưu tiên
# (game không dò file bằng cách thử tải, tránh lỗi 404 trên console). Tên file: <jumped|crash>_<NN>[_<vendor>].<m4a|mp3|wav>
CUSTOM = os.path.join(ROOT, 'assets', 'audio', 'taunts_custom')
if os.path.isdir(CUSTOM):
    import json
    NAME = re.compile(r'^(jumped|crash)_\d{2}(_(girl|granny|oldman|dude|cool))?\.(m4a|mp3|wav)$')
    found, skipped = [], []
    for n in sorted(os.listdir(CUSTOM)):
        if n == 'manifest.json' or n.startswith('.') or n.lower() == 'readme.txt': continue
        if NAME.match(n):
            found.append({'file': n, 'h': hashlib.sha1(open(os.path.join(CUSTOM, n), 'rb').read()).hexdigest()[:8]})
        else: skipped.append(n)
    out = {'_note': 'Tự tạo bởi dev/tools/stamp_version.py từ các file trong thư mục này. Đừng sửa tay.', 'files': found}
    mp = os.path.join(CUSTOM, 'manifest.json')
    old = open(mp, encoding='utf-8').read() if os.path.exists(mp) else ''
    new = json.dumps(out, ensure_ascii=False, indent=1) + '\n'
    if new != old: open(mp, 'w', encoding='utf-8').write(new)
    print(f'giọng tự thu: {len(found)} file' + (f'; BỎ QUA tên không đúng mẫu: {", ".join(skipped)}' if skipped else ''))
