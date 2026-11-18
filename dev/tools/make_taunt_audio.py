"""Tạo file giọng chửi của người bán (B6 âm thanh) từ data/phrases.json -> assets/audio/taunts/.

Giọng: Piper vi_VN-vais1000-medium (dữ liệu VAIS-1000, CC BY 4.0, một giọng nữ). Gói pip piper-tts (GPL-3.0)
chỉ là công cụ chạy trên máy dev, không đưa vào game. Mỗi kiểu người bán đổi tốc độ/cao độ (ffmpeg rubberband)
từ cùng một giọng gốc: cô gái, bà già (chậm, cao, run run), ông già (trầm, chậm), thanh niên, thanh niên kính đen.

Chữ đưa vào TTS được "nắn" cho gần giọng miền Nam (chỉ để đọc, bong bóng vẫn hiện câu gốc):
dấu ngã đọc thành dấu hỏi, phụ âm đầu v -> d, vần cuối -n -> -ng và -t -> -c (trừ sau i/ê/y).

Ra: assets/audio/taunts/{jumped|crash}_{NN}_{vendor}.mp3 (MP3 mono 22,05 kHz 40 kbps — Safari iOS, Chrome,
Firefox đều giải mã được) + manifest.json (câu, chữ đã nắn, băm nội dung để chống bộ nhớ đệm cũ).

  pip install piper-tts
  # giọng: https://huggingface.co/rhasspy/piper-voices/tree/main/vi/vi_VN/vais1000/medium (.onnx + .onnx.json)
  python3 dev/tools/make_taunt_audio.py --voice /tmp/voices/vi_VN-vais1000-medium.onnx
"""
import argparse, hashlib, json, os, re, subprocess, tempfile, unicodedata, wave

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'audio', 'taunts')
KIND_PREFIX = {'jumpedOver': 'jumped', 'crash': 'crash'}

# kiểu người bán -> cách đọc. length: hệ số độ dài của Piper (>1 chậm hơn); pitch: hệ số cao độ (rubberband,
# formant đi theo cao độ nên hạ thấp nghe ra giọng nam); tempo: tốc độ sau cùng; extra: bộ lọc ffmpeg thêm.
VENDORS = {
    'girl':   {'label': 'cô gái',             'length': 0.92, 'pitch': 1.06, 'tempo': 1.0, 'noise_w': 0.9, 'extra': ''},
    'granny': {'label': 'bà già',             'length': 1.22, 'pitch': 1.13, 'tempo': 1.0, 'noise_w': 1.0, 'extra': '', 'vib': (5.5, 0.0006, 0.10)},
    'oldman': {'label': 'ông già',            'length': 1.10, 'pitch': 0.72, 'tempo': 1.0, 'noise_w': 0.9, 'extra': 'lowpass=f=5200,'},
    'dude':   {'label': 'thanh niên',         'length': 0.88, 'pitch': 0.80, 'tempo': 1.0, 'noise_w': 0.9, 'extra': ''},
    'cool':   {'label': 'thanh niên kính đen', 'length': 1.02, 'pitch': 0.77, 'tempo': 1.0, 'noise_w': 0.7, 'extra': 'bass=g=3:f=180,'},
}

def southernize_word(w):
    """nắn một chữ (đã thường) cho TTS đọc gần giọng miền Nam. Dấu thanh nằm yên trên nguyên âm cũ."""
    b = unicodedata.normalize('NFC', unicodedata.normalize('NFD', w).replace('\u0303', '\u0309'))  # ngã -> hỏi
    if b.startswith('v'): b = 'd' + b[1:]                                                        # v -> d
    plain = unicodedata.normalize('NFC', ''.join(ch for ch in unicodedata.normalize('NFD', b) if ch not in '\u0300\u0301\u0309\u0323'))
    m = re.match(r'^(.*?)([aăâeêioôơuưy]+)(n|t)$', plain)
    if m:
        nu = m.group(2)
        if nu[-1] not in 'iy' and (nu[-1] != 'ê' or nu.endswith(('iê', 'yê'))):
            b = b[:-1] + ('ng' if m.group(3) == 'n' else 'c')                                    # -n -> -ng, -t -> -c
    return b


def southernize(text):
    def rep(m):
        w = m.group(0)
        s = southernize_word(w.lower())
        return s[0].upper() + s[1:] if w[0].isupper() else s
    return re.sub(r'[^\W\d_]+', rep, unicodedata.normalize('NFC', text))


def synth(voice, text, cfg, path):
    import numpy as np
    from piper import SynthesisConfig
    syn = SynthesisConfig(length_scale=cfg['length'], noise_scale=0.7, noise_w_scale=cfg['noise_w'])
    chunks = list(voice.synthesize(text, syn_config=syn))
    x = np.concatenate([c.audio_float_array for c in chunks]).astype(np.float32)
    x = np.clip(np.nan_to_num(x), -1, 1)                       # phòng mẫu NaN làm rubberband sập
    sr = chunks[0].sample_rate
    if cfg.get('vib'):                                         # giọng run (bà già): rung cao độ + rung âm lượng
        f, amp, trem = cfg['vib']                              # (bộ lọc vibrato của ffmpeg cho ra giá trị vô cực nên tự làm)
        n = np.arange(len(x)); ph = 2 * np.pi * f * n / sr
        pos = n - (amp * sr) * (1 + np.sin(ph))
        x = np.interp(pos, n, x, left=0).astype(np.float32) * (1 - trem * (0.5 + 0.5 * np.sin(ph * 0.5 + 1))).astype(np.float32)
    x = np.concatenate([np.zeros(1100, np.float32), x, np.zeros(2200, np.float32)])
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype('<i2').tobytes())


def encode(src, dst, cfg):
    af = (f"rubberband=pitch={cfg['pitch']}:tempo={cfg['tempo']}:formant=shifted,{cfg['extra']}"
          "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.04:stop_periods=-1:stop_threshold=-50dB:stop_duration=0.2,"
          "highpass=f=90,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,loudnorm=I=-17:TP=-2:LRA=9,"
          "apad=pad_dur=0.05")
    # hai bước: lọc ra wav 16-bit trước (chặn mẫu NaN/vô cực làm LAME sập), rồi mới nén MP3
    mid = src + '.f.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', mid], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mid, '-c:a', 'libmp3lame', '-b:a', '40k', '-write_xing', '1', dst], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', required=True, help='đường dẫn file .onnx của giọng Piper (kèm .onnx.json cạnh bên)')
    ap.add_argument('--only', default='', help='chỉ tạo cho kiểu người bán này (thử nhanh)')
    a = ap.parse_args()
    from piper import PiperVoice
    voice = PiperVoice.load(a.voice)
    data = json.load(open(os.path.join(ROOT, 'data', 'phrases.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    man = {'_note': 'Tạo bằng dev/tools/make_taunt_audio.py. Giọng Piper vi_VN-vais1000-medium (VAIS-1000, CC BY 4.0). '
                    'File thu tay đặt ở assets/audio/taunts_custom/ cùng tên sẽ được ưu tiên.',
           'voice': 'piper vi_VN-vais1000-medium', 'format': 'mp3', 'vendors': {k: v['label'] for k, v in VENDORS.items()},
           'kinds': {}}
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for kind, prefix in KIND_PREFIX.items():
            items = []
            for i, text in enumerate(data['taunts'][kind]):
                tts = southernize(text)
                files = {}
                for vk, cfg in VENDORS.items():
                    if a.only and vk != a.only: continue
                    name = f'{prefix}_{i:02d}_{vk}.mp3'
                    wav = os.path.join(tmp, name + '.wav')
                    for attempt in range(4):              # rubberband thỉnh thoảng sập (SIGABRT): đọc lại rồi thử lần nữa
                        try:
                            synth(voice, tts, cfg, wav); encode(wav, os.path.join(OUT, name), cfg); break
                        except subprocess.CalledProcessError:
                            if attempt == 3: raise
                            print('  thử lại', name)
                    b = open(os.path.join(OUT, name), 'rb').read()
                    total += len(b)
                    files[vk] = {'file': name, 'h': hashlib.sha1(b).hexdigest()[:8], 'bytes': len(b)}
                items.append({'id': i, 'text': text, 'tts': tts, 'files': files})
                print(f'{prefix}_{i:02d}: {text}  ->  {tts}')
            man['kinds'][kind] = {'prefix': prefix, 'items': items}
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'xong: {total / 1024:.0f} KB -> {OUT}')


if __name__ == '__main__':
    main()
