# Nguồn và giấy phép

Cập nhật: 2026-11-18 (B4b). Văn bản giấy phép đầy đủ đi kèm game: `assets/asr/LICENSES.txt`. Trong game: nút "Nguồn và giấy phép" ở màn bắt đầu.

## Bộ nghe tiếng Việt chạy trong trình duyệt (`assets/asr/`)

| Tệp | Nguồn | Phiên bản | Giấy phép |
|---|---|---|---|
| `encoder.int8.onnx`, `decoder.onnx`, `joiner.int8.onnx`, `tokens.txt` | Gói `sherpa-onnx-zipformer-vi-int8-2025-04-20` (GitHub release `asr-models` của k2-fsa/sherpa-onnx), gốc từ HuggingFace `zzasdf/viet_iter3_pseudo_label` (Zipformer transducer, ~70.000 giờ dữ liệu) | 2025-04-20, epoch-12-avg-8 | Apache-2.0 (thẻ mô hình trên HuggingFace ghi `license: apache-2.0`) |
| `bpe.vocab` | Sinh từ `bpe.model` của cùng gói (sentencepiece: mảnh + điểm), cần cho hotwords | — | Apache-2.0 (dẫn xuất từ mô hình) |
| `chonoi-asr.js`, `chonoi-asr.wasm` | Tự dựng từ mã nguồn sherpa-onnx (github.com/k2-fsa/sherpa-onnx, commit `aa273e80`, phiên bản 2.0.1) bằng emscripten 4.0.23; lớp bọc C riêng ở `dev/asr-build/` | 2.0.1 | Apache-2.0 |
| (bên trong wasm) onnxruntime | Bản static `onnxruntime-wasm-static_lib-simd-1.28.2.zip` từ github.com/csukuangfj/onnxruntime-libs | 1.28.2 | MIT (Microsoft) |
| (bên trong wasm) kaldi-native-fbank 1.23.1, kaldi_native_io 1.23.2, kaldifst 1.9.0, kaldi-decoder 0.4.0, kaldi-hmm-gmm 1.2.1, simple-sentencepiece 0.7, OpenFst 1.8.5 | github (đúng tag sherpa-onnx dùng) | | Apache-2.0 |
| (bên trong wasm) utf8proc 2.12.0, nlohmann/json 3.12.0 | github | | MIT |
| (bên trong wasm) kissfft (febd4cae) | github | | BSD-3-Clause |
| (bên trong wasm) Eigen 5.0.1 | gitlab.com/libeigen/eigen | | MPL-2.0 (chỉ header, chưa sửa) |

Không phụ thuộc CDN/HuggingFace lúc chạy: mọi tệp nằm trong repo, GitHub Pages phục vụ, lưu vào Cache Storage của trình duyệt.

## Chỉ dùng để kiểm thử (KHÔNG đưa vào repo/game)

- `test_wavs/0.wav, 1.wav, 2.wav` trong gói mô hình: lấy từ HuggingFace `nguyenvulebinh/wav2vec2-base-vietnamese-250h` (CC BY-NC 4.0) → chỉ dùng thử, không chép vào repo.
- Giọng đọc thử: Piper `vi_VN-vais1000-medium` (dữ liệu VAIS-1000, CC BY 4.0; tải từ GitHub release `tts-models` của k2-fsa/sherpa-onnx), chạy bằng gói pip `piper-tts` 1.8.0 (GPL-3.0) qua `dev/tools/make_tts_wavs.py`. Wav sinh ra để ở /tmp, không đưa vào repo.

## Khác

- Phông chữ: Baloo 2, Be Vietnam Pro (Google Fonts, SIL OFL 1.1), tải từ Google Fonts lúc chạy.
- Hình ảnh: vẽ bằng code (`dev/design/gen4.py`, `dev/tools/art.py`).
