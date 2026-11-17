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
