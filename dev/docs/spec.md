# Game chợ nổi miền Tây — đề bài và các quyết định đã duyệt

Cập nhật: 2026-11-18 (B4b). Người duyệt: Khôi. Ký tên sản phẩm: "made by Khoi M1nhon".
Link chơi: https://lethienkhoi.github.io/cho-noi-mien-tay/ · Code: github.com/lethienkhoi/cho-noi-mien-tay

## 1. Ý tưởng
- POV người miền Tây đi chợ nổi. Nhân vật chính đội nón lá, chèo ghe.
- Một thao tác duy nhất: đọc to câu của ghe hàng đang tới. Đọc kịp và đủ → nhảy qua ghe đó. Không kịp → đụng ghe, thua.
- Ghe hàng đổi liên tục, mỗi ghe một món tượng trưng treo trên cây bẹo, câu đọc gắn với món đó.
- Level càng lên: câu dài hơn, nhiều chữ hơn, ghe tới nhanh hơn.
- Nhảy qua được: người bán chửi yêu kiểu miền Tây (tiếng + bong bóng chữ).
- Đụng: cảnh hai ghe đụng nhau vui nhộn, nhân vật văng lên trời, kèm tiếng chửi miền Tây.
- Chạy trên điện thoại iOS và Android, trình duyệt, màn dọc.

## 2. Nội dung chữ
- Nguồn duy nhất: `data/phrases.json` — 27 câu, 5 mức khó (câu 19–27 lẹo lưỡi, duyệt 2026-11-17); câu chửi khi bị nhảy qua và khi đụng; danh sách 6 phương tiện.
- Quy tắc phiên âm: r→g, v→d, đuôi -n→-ng, đuôi -t→-c, qu→w, về→dìa, rồi→gồi.
- Khung chữ: phiên âm to (âm bị đổi tô đỏ) + chính tả nhỏ trong ngoặc, ví dụ "Búng giêu (Bún riêu)". Không hiện câu kế tiếp.

## 3. Cách chấm
- Qua ghe = đọc kịp và đủ câu, đúng thứ tự; khớp dạng chính tả HOẶC dạng phiên âm đều tính (máy nhận giọng hay tự sửa về chính tả). Ở mỗi vị trí, chữ nghe được khớp chữ chính tả hoặc chữ phiên âm cùng vị trí đều được (đọc trộn vẫn qua).
- Khớp CHÍNH XÁC từng chữ (sau chuẩn hoá NFC, chữ thường, bỏ dấu câu), không dung sai: đọc lộn thứ tự, thiếu chữ, sai dấu thanh, sai chữ → không qua, hết giờ là đụng (Khôi chốt 2026-11-17). Chữ thừa trước/sau câu thì vẫn được.
- Chỉ tính chữ nghe được sau khi ghe hiện tại bắt đầu; chấm trên kết quả tạm thời để nhảy ngay khi đọc xong.
- Thưởng "Chuẩn miền Tây" khi máy nghe ra dạng phiên âm ở ít nhất một chữ có đổi âm.
- Điểm: hiện tạm qua ghe +1, chuẩn miền Tây +2. (CHỜ KHÔI CHỐT)

## 4. Kỷ lục và lên đời
- Luôn hiện điểm cao nhất, lưu trên máy người chơi.
- Lên đời ngay trong lượt chơi, mỗi 5 câu một cấp (mốc 5, 10, 15, 20, 25): ghe chèo → cano máy → cano điện "Vê Ép 5" (kèm tia sét, không logo hãng) → du thuyền → máy bay → tàu vũ trụ. (Khôi viết "5 chữ", đang hiểu là 5 câu — CHỜ KHÔI CHỐT)

## 5. Hình ảnh
- Không dùng Higgsfield hay ảnh AI. Toàn bộ vẽ bằng code, 2D, không 3D.
- Style theo ref Khôi gửi (kênh Capital Case): đầu tròn to, viền đậm, tô màu chuyển mềm, bóng một bên mặt, mắt tròn, lông mày dày biểu cảm, mồ hôi khi sợ, gân đỏ khi giận. Ai cũng có tóc hoặc nón lá.
- Xa gần kiểu ống kính: bờ sông và ghe xa mờ, trung cảnh nét, tiền cảnh lục bình và chôm chôm mờ mạnh. Sông lấp lánh, hàng dừa, nhà sàn.
- Nhân vật chính: nón lá, áo bà ba tím, khăn rằn caro có tua. 4 biểu cảm: vui (đang chèo), đắc chí (qua ghe, phá kỷ lục), đụng ghe (hét, văng, mất nón), thua (mếu, mây mưa).
- Người bán 5 kiểu: cô gái, bà già, ông già, thanh niên, thanh niên kính đen. Mặt đổi: thường → hết hồn khi ghe mình tới gần → la/chửi khi bị nhảy qua hoặc bị đụng.
- Cảnh đụng: hai ghe chổng mũi, bọt nước tròn, chữ RẦM!, nhân vật văng, nón bay, đồ ăn bay, người bán nổi gân chửi.
- Máy bay: đầu nhân vật thò lên khỏi thân. Tàu vũ trụ: vòm kính to thấy rõ mặt.
- Keyframe đã duyệt (7 khung): https://claude.ai/artifact/K3Xm7FUaNYBAL5xgKGLemX. Code vẽ: `design/gen4.py`.

## 6. Kỹ thuật
- Web tĩnh, JS thuần, không build; hình SVG xuất sẵn, vẽ bằng Canvas 2D; chữ và giao diện bằng HTML.
- Giọng nói (B4b, Khôi chọn 2026-11-17 vì bộ nghe của Apple nghe tiếng Việt sai nhiều): MẶC ĐỊNH là bộ nghe tiếng Việt chạy ngay trong trình duyệt — sherpa-onnx WebAssembly + mô hình Zipformer tiếng Việt INT8 (Apache-2.0), không gửi âm thanh đi đâu, không cần mạng sau lần tải đầu. Dự phòng: nhận giọng có sẵn của trình duyệt (Web Speech API, vi-VN, cần mạng).
  - Tải lần đầu ~87 MB (wasm 13,7 MB + mô hình 77 MB, gồm encoder 71 MB), có thanh tiến độ "Đang tải bộ nghe tiếng Việt… X% (a/b MB)" ở màn bắt đầu, tải song song lúc đọc hướng dẫn; lưu Cache Storage, lần sau không tải lại. Lỗi mạng: nút Thử lại. Nút Bắt đầu chỉ bật khi bộ nghe sẵn sàng (hoặc đã chuyển sang Web Speech).
  - Chạy trong Web Worker (`src/speech/asr-worker.js`); micro: getUserMedia (echoCancellation, noiseSuppression, autoGainControl) + AudioWorklet (`mic-worklet.js`) hạ mẫu 16 kHz mono; AudioContext tạo/resume ngay trong cú bấm (iOS).
  - Mô hình offline nên giải mã lặp lại đoạn âm thanh từ tiếng đầu tiên của câu hiện tại (lùi 0,3s; tối đa thời gian câu + ân hạn + chờ + 1s), mỗi ≥350 ms khi có tiếng (VAD năng lượng, hết tiếng sau 600 ms im), giãn nhịp bằng thời gian giải mã nếu máy chậm (không xếp hàng). Mỗi câu là một kết quả riêng; câu cũ chốt khi câu mới tới; nhảy/đụng thì ngừng giải mã.
  - Gợi ý câu (hotwords, modified_beam_search, điểm thưởng 2.0): mỗi câu đưa cả câu chính tả và câu phiên âm (chữ HOA, bỏ dấu câu) qua stream mới, không nạp lại mô hình.
  - Tự chuyển về Web Speech kèm dòng thông báo nhỏ khi: trình duyệt thiếu WebAssembly SIMD/Worker/AudioWorklet (Safari cần iOS 16.4+), tải mô hình lỗi, hoặc đo lúc khởi động hệ số thời gian thực > 1,5. Tham số URL: `?asr=webspeech` ép Web Speech (qa_b4/qa_b5 dùng), `?asr=local` ép cục bộ.
  - Dựng lại wasm: `dev/asr-build/build.sh` (emsdk 4.0.23, sherpa-onnx 2.0.1); sau khi đổi tệp trong `assets/asr/` chạy `python3 dev/tools/asr_manifest.py`. Nguồn + giấy phép: `dev/docs/licenses.md`.
- BỎ HẲN điều khiển chạm và chế độ dự phòng bằng chạm (Khôi 2026-11-17: "chưa nhận mic đọc không được, bỏ cái bấm tay vô nhảy"). Chạm chỉ dùng cho nút.
- Trình duyệt không nghe được (Firefox, trình duyệt trong app Zalo/Facebook/Messenger…): báo sớm, hướng dẫn mở bằng Chrome/Safari, nút Sao chép link. Từ chối micro / mất mạng: màn hướng dẫn + nút Thử lại.
- Code: `src/speech/` (matcher.js chấm, local-asr.js + asr-worker.js + asr-core.js + mic-worklet.js bộ nghe cục bộ, recognizer.js Web Speech, voice.js nối với game). Test: `node --test dev/tests/matcher.test.mjs`, `python3 dev/tools/qa_b4.py`, `python3 dev/tools/qa_b5.py`, `python3 dev/tools/qa_hold.py`, `python3 dev/tools/qa_b4b.py` (micro giả đọc wav), `node dev/tools/asr_node_test.cjs` (WER, hotwords, tốc độ).
- Tiếng chửi: file âm thanh thu sẵn (giọng AI hoặc Khôi thu).
- Đưa lên GitHub Pages (https) để micro chạy được trên điện thoại.

## 7. Các bước
1. Duyệt chữ — XONG.
2. Duyệt keyframe — XONG.
3. B3: khung game + vòng chơi lõi, điều khiển tạm bằng chạm — XONG, đã lên link chơi.
4. B4: nhận giọng nói + bộ chấm, bỏ điều khiển chạm — XONG (chờ thử trên điện thoại thật).
5. B5: bố cục chạy ngang + bong bóng chửi + cảnh đụng + độ khó nhanh hơn — XONG (âm thanh chửi để sau).
   - Bố cục theo yêu cầu Khôi (2026-11-17, ref game khủng long Chrome), GIỮ KHUNG DỌC 9:16: ghe mình (~21% bề rộng) cố định bên trái ở ~20%, ghe hàng (~25%) chạy ngang từ mép phải sang trên cùng một làn nước nằm ở ~56% chiều cao (trên là hậu cảnh chợ nổi, dưới là khung chữ). Bỏ hiệu ứng ghe từ xa phóng to. Nhảy: ghe mình bay theo cung qua ghe hàng rồi đáp lại đúng làn. Hậu cảnh/tiền cảnh trôi ngang, nhanh dần theo số ghe qua. Ghe trung cảnh vẽ nhỏ lại 80% cho rõ xa gần.
   - Bong bóng chửi (vẽ trên canvas, trắng viền #2a2420, Baloo 2 đậm, nảy vào, giữ ~1,4s rồi mờ, bám ghe hàng, tự xuống dòng, không bị HUD/khung chữ che): nhảy qua → `taunts.jumpedOver`, đụng → `taunts.crash`; người bán đổi mặt yell lúc chửi. Âm thanh: hàm rỗng `playTaunt(kind, text)` trong `src/game/sfx.js`, gắn sẵn vào sự kiện `taunt`.
   - Cảnh đụng: rung màn 0,35s, sao vàng "RẦM!", bọt nước tròn trắng viền đậm, nhân vật (hero_scream) văng xoay vòng, nón lá bay riêng, tô bún/cá/sầu riêng bay, người bán yell + bong bóng; bảng kết quả sau 1,6s. Thua mà không phá kỷ lục: bảng kết quả có thêm mặt mếu (hero_sad).
   - Thời gian mỗi câu (config.js): T = max(1,6s + 0,22s/chữ ; (1,8s + 0,28s/chữ) × (1 − 0,015 × số ghe qua, thấp nhất 0,8)). Thanh thời gian hết đúng lúc ghe hàng tới sát mũi; thêm 0,25s ân hạn rồi mới đụng (đọc khớp trong ân hạn vẫn nhảy). Câu 2 chữ: 2,36s → 2,04s; câu 15 chữ: 6,0s → 4,9s. "Một nửa thời gian cũ" (0,8s + 0,28s/chữ) thấp hơn sàn nhận giọng nên sàn thắng.
   - Mức câu theo số ghe đã qua: 0–2 mức 1, 3–6 mức 2, 7–12 mức 3, 13–19 mức 4, 20+ mức 5 (chưa có câu mức 5 → lấy mức cao nhất có sẵn). 20% lấy câu mức thấp hơn cho đỡ ngộp. (Tính theo số ghe qua, không theo điểm, vì điểm có thưởng +2 làm mức nhảy quá nhanh — CHỜ KHÔI CHỐT.)
5b. B4b: bộ nghe tiếng Việt chạy trong trình duyệt (sherpa-onnx WebAssembly, Zipformer vi INT8, hotwords) thay Web Speech làm mặc định — XONG, chờ thử trên iPhone thật.
   - Đo trên máy thử (Chromium headless, CPU máy chủ x86, 1 luồng): hệ số thời gian thực 0,07–0,12; giải mã đoạn 1,5–2s mất ~120–220 ms; từ lúc nói xong tới lúc nhảy ~0,7s; tải lần đầu ~4s mạng nội bộ, lần sau ~2,5–3s (khởi tạo); bộ nhớ: heap wasm 133 MB, tiến trình trang ~400 MB khi chơi (game không bộ nghe ~190 MB), đỉnh lúc tải ~570 MB.
   - Thử bằng giọng TTS tiếng Việt (Piper, đọc 27 câu × 2 dạng): không hotwords qua ghe 2/54, có hotwords 10/54, không nhận nhầm câu khác (0/54). Giọng TTS máy khác xa người thật nên chỉ để so sánh tương đối.
6. B6: độ khó theo level, điểm, kỷ lục, hiệu ứng lên đời 6 cấp.
7. B7: thử trên iPhone và Android thật, tối ưu.

- 2026-11-17 (Khôi thử iPhone, nhận giọng chậm): trả thời gian về 1,6s + 0,55s/chữ, giảm tới 60%; ân hạn 0,4s; thêm "chờ người đang đọc": đã đọc đúng ≥ nửa câu và vừa có chữ đúng mới trong 1s thì ghe hàng dừng sát mũi chờ thêm tối đa 1,2s.
- 2026-11-17 (Khôi: máy nghe sai nhiều, thua liên tục): chấm theo điểm từng chữ — trùng 1; chỉ sai dấu thanh 0,75; sai 1 ký tự cùng phụ âm đầu 0,5; sai chữ 0. Qua khi không chữ nào 0 và trung bình ≥ 0,8. Lộn thứ tự, thiếu chữ, sai chữ vẫn không qua. Thưởng "Chuẩn miền Tây" chỉ khi trùng chính xác chữ phiên âm. Thêm khớp dự phòng trên cả phiên nhận giọng (iPhone viết lại kết quả tạm thời). Khi đụng, giữ dòng "Đang nghe" để thấy máy nghe được gì.
