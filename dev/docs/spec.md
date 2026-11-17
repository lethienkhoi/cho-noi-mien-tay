# Game chợ nổi miền Tây — spec (chỉ ghi điều đã duyệt)

Cập nhật: 2026-11-13. Người duyệt: Khôi. Ký tên sản phẩm: "made by Khoi M1nhon".

## 1. Ý tưởng (đã duyệt)
- POV người miền Tây đi chợ nổi. Nhân vật đội nón lá, đi thuyền.
- Một thao tác duy nhất: đọc thành tiếng câu của ghe hàng kế tiếp. Đọc kịp và đủ → nhảy qua ghe đó. Không kịp → đụng thuyền.
- Ghe hàng đổi liên tục, mỗi ghe một món tượng trưng, câu đọc gắn với món đó.
- Chữ hiển thị: PHIÊN ÂM miền Tây (to, để đọc theo) + CHÍNH TẢ đúng ngay kế bên (nhỏ hơn).
- Level càng lên: câu dài hơn, nhiều chữ hơn, ghe tới nhanh hơn.
- Nhảy qua được: người bán chửi yêu kiểu miền Tây (audio + bong bóng chữ).
- Đụng: cảnh 3D hai thuyền đụng nhau vui nhộn, người ngồi văng đi, kèm tiếng chửi miền Tây.
- Hình: chợ nổi nhiều màu, hàng cây, sông thơ mộng lấp lánh. KHÔNG theo graphic game gốc (nón lá/phố/cột điện). 3D ở chỗ cần đẹp.
- Chạy trên điện thoại iOS và Android (web, màn dọc).

## 2. Nội dung chữ (đã duyệt)
Nguồn duy nhất: `data/phrases.json` (18 câu, 4 mức; câu chửi `taunts`; danh sách phương tiện `vehicles`).

## 3. Cách chấm (đã duyệt)
- Qua thuyền = đọc kịp + đủ câu; khớp dạng chính tả HOẶC dạng phiên âm đều tính (máy nhận giọng hay tự sửa về chính tả).
- Thưởng "Chuẩn miền Tây" khi máy nghe ra đúng dạng phiên âm.

## 4. Kỷ lục và nâng cấp phương tiện (đã duyệt ý tưởng)
- Luôn hiện điểm cao nhất (lưu trên máy người chơi).
- Lên đời ngay trong lượt chơi: cứ đọc được 5 câu (qua 5 ghe) thì đổi lên một cấp (mốc 5, 10, 15, 20, 25). (Khôi nói "5 chữ"; tech lead hiểu là 5 câu, chờ xác nhận)
  ghe chèo → cano máy → cano điện → du thuyền → máy bay → tàu vũ trụ.
- Cano điện: sơn chữ "Vê Ép 5" kèm ký hiệu tia sét. Không dùng logo hãng. (đã duyệt)

## 4b. Góp ý hình ngày 2026-11-13 (đã duyệt hướng, chờ duyệt hình mới)
- Có xa gần kiểu ống kính: tiền cảnh mờ, trung cảnh nét, hậu cảnh bokeh; vật xa nhỏ và nhạt dần.
- Khung chữ gọn: chỉ còn phiên âm to + chính tả trong ngoặc, ví dụ "Búng giêu (Bún riêu)". Bỏ nhãn "Chính tả:". Bỏ dòng "Kế tiếp" (không lộ đề).
- Khăn rằn phải ra khăn rằn: caro đen trắng nhỏ, quấn cổ, hai đầu có tua thả trước ngực.
- Mặt biểu cảm mạnh, thay đổi theo tình huống. Người bán đa dạng: cô gái, bà già, ông già, thanh niên, thanh niên đeo kính đen.
- Hình phải đẹp hơn, dí dỏm hơn bản SVG phẳng đầu tiên. Hướng: 3D hoạt hình kiểu đồ chơi đất sét.

## 5. Kiến trúc (đã duyệt)
- Three.js cho cảnh 3D; lớp HTML phủ cho chữ và giao diện.
- Giọng nói 3 tầng: (1) Web Speech của trình duyệt → (2) model tiếng Việt chạy trên máy (sherpa-onnx) khi máy không hỗ trợ → (3) chế độ chạm theo nhịp khi từ chối micro.
- Tiếng chửi: file âm thanh thu sẵn.
- Luồng: phrases.json → chọn câu theo level → màn chơi → bộ chấm → nhảy/đụng → âm thanh, điểm, kỷ lục.
- Thư mục: `docs/`, `data/`, `src/{speech,game,scene3d,ui,audio}`, `assets/`.

## 6. Các bước
1. Duyệt chữ — XONG.
2. Duyệt keyframe — XONG (canvas: https://claude.ai/artifact/K3Xm7FUaNYBAL5xgKGLemX, 7 khung).
3. Khung dự án + vòng chơi lõi (điều khiển tạm bằng chạm).
4. Giọng nói 3 tầng + bộ chấm.
5. Cảnh 3D: sông, cây, ghe hàng, nhân vật.
6. Cảnh đụng thuyền 3D + âm thanh chửi.
7. Độ khó theo level, điểm, màn kết thúc.
8. Kỷ lục + 6 cấp phương tiện.
9. Thử iOS/Android, tối ưu.

## 7. Hình ảnh (ĐÃ DUYỆT 2026-11-14)
- Không dùng Higgsfield/ảnh AI. Toàn bộ hình vẽ bằng code (SVG 2D), không làm 3D.
- Style theo ref Khôi gửi (kênh Capital Case): đầu tròn to, viền nâu đen đậm ~4px, tô gradient mềm + bóng một bên mặt, mắt tròn trắng con ngươi đen, lông mày dày biểu cảm, giọt mồ hôi/gân giận. Đội nón lá hoặc có tóc.
- Xa gần kiểu ống kính: bờ sông + ghe xa làm mờ (blur), trung cảnh nét, tiền cảnh lục bình/chôm chôm mờ mạnh.
- Mã nguồn hình mẫu: design/gen4.py (Opus dựng game dùng lại các hàm vẽ nhân vật, ghe, phương tiện).

- Cảnh đụng thuyền: làm 2D theo style này (thay cho "đoạn 3D" ban đầu): hai ghe chổng mũi, bọt nước tròn, chữ RẦM!, nhân vật văng lên trời, nón bay, đồ ăn bay, người bán nổi gân chửi.
- Biểu cảm nhân vật chính (khung 7): vui (đang chèo/đọc), đắc chí (qua ghe, phá kỷ lục), đụng ghe (hét, văng, mất nón), thua (mếu, mây mưa).
- Máy bay: đầu nhân vật thò lên khỏi thân. Tàu vũ trụ: vòm kính to thấy rõ mặt.
- Người bán (5 kiểu): cô gái, bà già, ông già, thanh niên, thanh niên kính đen; mỗi ghe gán ngẫu nhiên một người, đổi mặt: thường → hết hồn (ghe mình tới gần) → la/chửi (bị nhảy qua hoặc bị đụng).

## 8. Kế hoạch dựng (cập nhật 2026-11-14)
- B3. Khung dự án + xuất sprite SVG từ design/gen4.py + vòng chơi lõi (điều khiển tạm bằng chạm). ← đang làm
- B4. Giọng nói 3 tầng + bộ chấm.
- B5. Hiệu ứng: nhảy, đụng (đoạn văng), bong bóng chửi, âm thanh.
- B6. Level, điểm, kỷ lục, lên đời 6 cấp.
- B7. Thử iOS/Android, tối ưu, đưa lên link chạy được micro.
