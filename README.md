# Chợ nổi miền Tây

Game điện thoại: đọc to câu theo giọng miền Tây để ghe nhảy qua ghe hàng ở chợ nổi.

Chơi: https://lethienkhoi.github.io/cho-noi-mien-tay/

## Cách chơi
- Mở link bằng **Chrome** (Android) hoặc **Safari** (iPhone). Trình duyệt trong Zalo/Facebook/Messenger thường không nghe được micro: bấm Sao chép link rồi mở bằng Chrome/Safari.
- Bấm **Bắt đầu**, cho phép micro.
- Ghe hàng chạy tới: **đọc to câu trên khung chữ** trước khi hết giờ. Đọc giọng miền Tây (chữ to) hay chính tả (chữ nhỏ trong ngoặc) đều được, nhưng phải đủ chữ, đúng thứ tự, đúng dấu.
- Dòng "Đang nghe" cho biết máy nghe được gì; chữ đã đọc đúng chuyển xanh.
- Qua ghe +1, máy nghe ra giọng miền Tây thêm +2. Mỗi 5 câu lên đời phương tiện.
- Không có điều khiển chạm: chạm chỉ để bấm nút. Cần mạng để nhận giọng.

- Game: các file ở thư mục gốc (HTML, CSS, JS thuần, không cần build).
- `dev/docs/spec.md`: các quyết định đã duyệt.
- `dev/data/phrases.json`: câu đọc (bản game dùng ở `data/phrases.json`).
- `src/speech/`: nhận giọng (Web Speech API) và bộ chấm câu.
- `dev/tests/`: test bộ chấm (`node --test dev/tests/`). `dev/tools/qa_b4.py`: kiểm tra trên Chromium với micro giả.
- `dev/design/gen4.py`, `dev/tools/`: code vẽ và xuất hình.

made by Khoi M1nhon
