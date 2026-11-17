# Chợ nổi miền Tây

Game điện thoại: đọc to câu theo giọng miền Tây để ghe nhảy qua ghe hàng ở chợ nổi.

Chơi: https://lethienkhoi.github.io/cho-noi-mien-tay/

## Cách chơi
- Mở link bằng **Chrome** (Android) hoặc **Safari** (iPhone). Trình duyệt trong Zalo/Facebook/Messenger thường không nghe được micro: bấm Sao chép link rồi mở bằng Chrome/Safari.
- Bấm **Bắt đầu**, cho phép micro.
- Ghe hàng chạy tới: **đọc to câu trên khung chữ** trước khi hết giờ. Đọc giọng miền Tây (chữ to) hay chính tả (chữ nhỏ trong ngoặc) đều được, nhưng phải đủ chữ, đúng thứ tự, đúng dấu.
- Dòng "Đang nghe" cho biết máy nghe được gì; chữ đã đọc đúng chuyển xanh.
- Qua ghe +1, máy nghe ra giọng miền Tây thêm +2. Mỗi 5 câu lên đời phương tiện.
- Không có điều khiển chạm: chạm chỉ để bấm nút.
- Lần đầu mở, game tải bộ nghe tiếng Việt (~87 MB, có thanh tiến độ); xong thì nút Bắt đầu bật. Bộ nghe chạy ngay trên máy, không gửi âm thanh đi, lần sau không tải lại. Máy/trình duyệt không chạy được (Safari dưới iOS 16.4, máy quá chậm, tải lỗi) thì game tự dùng bộ nghe của trình duyệt (cần mạng).
- `?asr=webspeech` ép dùng bộ nghe của trình duyệt, `?asr=local` ép dùng bộ nghe trên máy.

- Game: các file ở thư mục gốc (HTML, CSS, JS thuần, không cần build).
- `dev/docs/spec.md`: các quyết định đã duyệt.
- `dev/data/phrases.json`: câu đọc (bản game dùng ở `data/phrases.json`).
- `src/speech/`: nhận giọng (bộ nghe cục bộ `local-asr.js` + `asr-worker.js` + `asr-core.js` + `mic-worklet.js`; dự phòng Web Speech `recognizer.js`) và bộ chấm câu.
- `assets/asr/`: lõi sherpa-onnx WebAssembly + mô hình Zipformer tiếng Việt INT8 + `manifest.json` + `LICENSES.txt`. Dựng lại: `dev/asr-build/build.sh`, rồi `python3 dev/tools/asr_manifest.py`. Nguồn và giấy phép: `dev/docs/licenses.md`.
- `dev/tests/`: test bộ chấm (`node --test dev/tests/matcher.test.mjs`). `dev/tools/qa_b4.py`, `qa_b5.py`, `qa_hold.py`: kiểm tra trên Chromium với Web Speech giả. `dev/tools/qa_b4b.py`: bộ nghe cục bộ với micro giả đọc wav (tạo wav bằng `dev/tools/make_tts_wavs.py`). `dev/tools/asr_node_test.cjs`: WER, hotwords, tốc độ bằng Node.
- `dev/design/gen4.py`, `dev/tools/`: code vẽ và xuất hình.

made by Khoi M1nhon

## Trước khi đẩy lên

Chạy `python3 dev/tools/stamp_version.py` để gắn mã phiên bản vào đường dẫn code, tránh điện thoại trộn file cũ (bộ nhớ đệm 10 phút của GitHub Pages) với file mới.
