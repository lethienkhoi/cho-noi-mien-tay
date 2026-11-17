# Game chợ nổi miền Tây — đề bài và các quyết định đã duyệt

Cập nhật: 2026-11-17. Người duyệt: Khôi. Ký tên sản phẩm: "made by Khoi M1nhon".
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
- Nguồn duy nhất: `data/phrases.json` — 18 câu, 4 mức khó; câu chửi khi bị nhảy qua và khi đụng; danh sách 6 phương tiện.
- Quy tắc phiên âm: r→g, v→d, đuôi -n→-ng, đuôi -t→-c, qu→w, về→dìa, rồi→gồi.
- Khung chữ: phiên âm to (âm bị đổi tô đỏ) + chính tả nhỏ trong ngoặc, ví dụ "Búng giêu (Bún riêu)". Không hiện câu kế tiếp.

## 3. Cách chấm
- Qua ghe = đọc kịp và đủ câu; khớp dạng chính tả HOẶC dạng phiên âm đều tính (máy nhận giọng hay tự sửa về chính tả).
- Thưởng "Chuẩn miền Tây" khi máy nghe ra đúng dạng phiên âm.
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
- Giọng nói 3 tầng: (1) nhận giọng có sẵn của trình duyệt → (2) model tiếng Việt chạy trên máy khi trình duyệt không hỗ trợ → (3) chế độ chạm khi người chơi từ chối micro.
- Tiếng chửi: file âm thanh thu sẵn (giọng AI hoặc Khôi thu).
- Đưa lên GitHub Pages (https) để micro chạy được trên điện thoại.

## 7. Các bước
1. Duyệt chữ — XONG.
2. Duyệt keyframe — XONG.
3. B3: khung game + vòng chơi lõi, điều khiển tạm bằng chạm — XONG, đã lên link chơi.
4. B4: giọng nói 3 tầng + bộ chấm.
5. B5: hiệu ứng nhảy, cảnh đụng, bong bóng chửi, âm thanh.
6. B6: độ khó theo level, điểm, kỷ lục, hiệu ứng lên đời 6 cấp.
7. B7: thử trên iPhone và Android thật, tối ưu.
