"""Ghi assets/asr/manifest.json cho bộ nghe cục bộ (B4b): danh sách tệp, kích thước, phiên bản (băm nội dung).
Tệp > 95 MB được chia thành <tên>.part0, .part1… (GitHub giới hạn 100 MB/tệp); worker tải từng phần rồi ghép.
Chạy lại mỗi khi đổi tệp trong assets/asr:  python3 dev/tools/asr_manifest.py
"""
import hashlib, json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A = os.path.join(ROOT, 'assets', 'asr')
FILES = ['chonoi-asr.js', 'chonoi-asr.wasm', 'encoder.int8.onnx', 'decoder.onnx', 'joiner.int8.onnx', 'tokens.txt', 'bpe.vocab']
LIMIT = 95 * 1024 * 1024
PART = 90 * 1024 * 1024

h = hashlib.sha256()
out = []
for n in FILES:
    p = os.path.join(A, n)
    if os.path.exists(p):
        data = open(p, 'rb').read()
    else:  # đã chia phần từ lần trước: ghép lại để băm
        parts = sorted([x for x in os.listdir(A) if x.startswith(n + '.part')], key=lambda x: int(x.rsplit('part', 1)[1]))
        data = b''.join(open(os.path.join(A, x), 'rb').read() for x in parts)
    h.update(n.encode()); h.update(hashlib.sha256(data).digest())
    f = {'name': n, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    for old in [x for x in os.listdir(A) if x.startswith(n + '.part')]:
        os.remove(os.path.join(A, old))
    if len(data) > LIMIT:
        f['parts'] = []
        for i in range(0, len(data), PART):
            pn = f'{n}.part{i // PART}'
            open(os.path.join(A, pn), 'wb').write(data[i:i + PART])
            f['parts'].append({'name': pn, 'size': len(data[i:i + PART])})
        os.remove(p)
    out.append(f)
man = {'version': h.hexdigest()[:12], 'files': out,
       'total': sum(f['size'] for f in out)}
json.dump(man, open(os.path.join(A, 'manifest.json'), 'w'), indent=1)
print(man['version'], f"{man['total'] / 1048576:.1f} MB", [(f['name'], f['size']) for f in out])
