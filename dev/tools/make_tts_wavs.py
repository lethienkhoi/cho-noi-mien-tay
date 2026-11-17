"""Tạo wav tiếng Việt (16 kHz mono) đọc các câu trong data/phrases.json để thử bộ nghe cục bộ (B4b).

Giọng: Piper vi_VN-vais1000-medium (tải từ GitHub release tts-models của k2-fsa/sherpa-onnx;
dữ liệu VAIS-1000, CC BY 4.0). Chạy bằng gói pip piper-tts (GPL-3.0, chỉ dùng làm công cụ, không đưa vào game).
Chỉ là công cụ thử, KHÔNG đưa wav vào repo.

  python3 dev/tools/make_tts_wavs.py --voice /tmp/tts/vits-piper-vi_VN-vais1000-medium --out /tmp/cho-noi-wav
Ra: <out>/p<id>_ct.wav (đọc chính tả), <out>/p<id>_pa.wav (đọc phiên âm), <out>/labels.json
"""
import argparse, json, os
import numpy as np
from piper import PiperVoice, SynthesisConfig
import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def resample(x, sr, to=16000):
    n = int(round(len(x) * to / sr))
    t = np.arange(n) * sr / to
    return np.interp(t, np.arange(len(x)), x).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', required=True)
    ap.add_argument('--out', default='/tmp/cho-noi-wav')
    ap.add_argument('--speed', type=float, default=1.0)
    a = ap.parse_args()
    v = a.voice
    name = [f for f in os.listdir(v) if f.endswith('.onnx')][0]
    voice = PiperVoice.load(os.path.join(v, name))
    syn = SynthesisConfig(length_scale=1.0 / a.speed)
    data = json.load(open(os.path.join(ROOT, 'data', 'phrases.json'), encoding='utf-8'))
    os.makedirs(a.out, exist_ok=True)
    labels = {}
    for p in data['phrases']:
        for kind, text in (('ct', p['chinhTa']), ('pa', p['phienAm'])):
            chunks = list(voice.synthesize(text, syn_config=syn))
            sr = chunks[0].sample_rate
            x = resample(np.concatenate([c.audio_float_array for c in chunks]).astype(np.float32), sr)
            pad = np.zeros(int(0.5 * 16000), dtype=np.float32)
            x = np.concatenate([pad, x, pad])
            fn = f'p{p["id"]}_{kind}.wav'
            sf.write(os.path.join(a.out, fn), x, 16000, subtype='PCM_16')
            labels[fn] = {'id': p['id'], 'kind': kind, 'text': text, 'chinhTa': p['chinhTa'], 'phienAm': p['phienAm'], 'level': p['level']}
    json.dump(labels, open(os.path.join(a.out, 'labels.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(labels), 'wav ->', a.out)


if __name__ == '__main__':
    main()
