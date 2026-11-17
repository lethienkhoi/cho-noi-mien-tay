// Hằng số chỉnh game (B3). Đơn vị toạ độ: "u" = 1px của khung thiết kế rộng 390 (như keyframe pv1).
export const CONFIG = {
  // ---- thời gian mỗi câu (B5: nhanh hơn, có sàn cho máy nhận giọng kịp trả kết quả)
  // T = max(SÀN, (TIME_BASE + TIME_PER_WORD x số chữ) x hệ số giảm theo số ghe đã qua).
  // T là thời gian thanh đỏ chạy hết = lúc ghe hàng tới SÁT MŨI ghe mình. Sau đó còn TIME_GRACE ân hạn
  // (ghe hàng nhích nốt khoảng cách cuối) rồi mới đụng: đọc khớp trong ân hạn vẫn nhảy.
  // Ví dụ (chưa tính ân hạn): câu 2 chữ 2,36s -> sàn 2,04s; câu 6 chữ 3,48s -> sàn 2,92s; câu 14 chữ 5,72s -> sàn 4,68s.
  // (B4 cũ: 1,6s + 0,55s/chữ, giảm tới 60%. "Một nửa" = 0,8s + 0,28s/chữ thấp hơn sàn ở mọi độ dài câu,
  //  nên giữ 0,28s/chữ như yêu cầu và dùng sàn 1,6s + 0,22s/chữ làm mức nhanh nhất.)
  TIME_BASE: 1.8,           // giây, lúc mới vào
  TIME_PER_WORD: 0.28,      // giây cho mỗi chữ (âm tiết) của câu phiên âm, lúc mới vào
  TIME_DECAY_PER_PASS: 0.015, // mỗi ghe qua được, thời gian còn (1 - n*decay)
  TIME_MIN_FACTOR: 0.8,     // hệ số thấp nhất (qua ~13 ghe là chạm sàn với mọi câu)
  TIME_FLOOR_BASE: 1.6,     // SÀN cứng: không dưới 1,6s + 0,22s/chữ ở cấp cao nhất
  TIME_FLOOR_PER_WORD: 0.22,
  TIME_GRACE: 0.25,         // giây ân hạn sau khi thanh thời gian hết, trước khi hai ghe chạm

  // ---- level câu theo số ghe đã qua: qua >= mốc thì mở level kế (level 5 chưa có câu -> lấy level cao nhất có sẵn)
  LEVEL_AT: [0, 3, 7, 13, 20], // level 1: 0–2, level 2: 3–6, level 3: 7–12, level 4: 13–19, level 5: 20+
  LOWER_LEVEL_CHANCE: 0.2,  // thỉnh thoảng lấy câu level thấp hơn cho đỡ ngộp
  AVOID_RECENT: 4,          // không lặp lại N câu gần nhất

  // ---- điểm
  SCORE_PASS: 1,            // qua ghe +1
  SCORE_DIALECT_BONUS: 2,   // thêm khi máy nghe đúng giọng miền Tây (B4) — chờ Khôi chốt cách tính
  PASSES_PER_TIER: 5,       // cứ 5 câu lên đời phương tiện
  MAX_TIER: 5,

  // ---- bố cục chạy ngang kiểu game khủng long (B5). y của làn tính từ ĐÁY khung để luôn nằm trên khung chữ.
  DESIGN_W: 390,
  HORIZON: 250,             // y từ trên xuống, như pv1
  // Giữ KHUNG DỌC 9:16 (Khôi xác nhận 2026-11-17): chỉ ghe chạy ngang trong khung dọc.
  LANE_Y_FRAC: 0.56,        // mặt nước của làn chạy = 56% chiều cao khung (giữa màn: trên là chợ nổi, dưới là khung chữ)
  LANE_MIN_Y: 380,          // màn thấp: làn không lên sát hậu cảnh hơn mốc này
  LANE_PANEL_GAP: 30,       // làn luôn cao hơn mép trên khung chữ (ước lượng khung cao nhất) ít nhất bấy nhiêu u
  PANEL_MAX_H: 250,         // khung chữ cao nhất (câu level 4, 3 dòng) + lề dưới 22u
  HERO_X: 80,               // tâm ghe mình (~20% bề rộng)
  HERO_W: 84,               // bề rộng ghe mình ~21% màn (u), mỗi cấp phương tiện tự tính tỉ lệ cho bằng cỡ này
  STALL_W: 96,              // bề rộng ghe hàng ~24–25% màn (u)
  STALL_GAP: 10,            // khoảng cách mũi-mũi lúc thanh thời gian hết (u); hết ân hạn thì chạm nhau
  STALL_OVERLAP: 8,         // lúc đụng hai mũi lấn vào nhau một chút cho thấy cú va
  SHOCK_AT: 0.6,            // tiến độ ghe hàng (0..1) bắt đầu hết hồn

  // ---- nhảy
  JUMP_TIME: 0.9,           // giây
  JUMP_HEIGHT: 130,         // u, cao hơn ghe hàng + người bán
  JUMP_FORWARD: 6,          // u nhích tới trước ở đỉnh cung
  EXIT_EXTRA: 0.4,          // giây ghe hàng trôi tiếp ra khỏi màn sau khi đáp
  COCKY_TIME: 0.7,          // giây mặt đắc chí sau khi đáp
  NEXT_ROUND_DELAY: 0.15,   // giây chờ trước câu kế

  // ---- đụng
  CRASH_TO_RESULT: 1.6,     // giây trước khi hiện bảng kết quả
  SHAKE_TIME: 0.35,

  // ---- bong bóng chửi
  TAUNT_HOLD: 1.4,          // giây giữ bong bóng (chưa tính lúc mờ đi)
  TAUNT_FADE: 0.3,
  TAUNT_MAX_W: 210,         // u
  TAUNT_FONT: 17,           // u

  // ---- tốc độ cảnh: trôi parallax nhân theo tốc độ ghe hàng (so với lúc mới vào)
  SPEED_DRIFT_MAX: 2.2,

  // ---- render
  MAX_DPR: 2,               // dpr 3 vẫn vẽ ở 2 để giữ 60fps và bộ nhớ (iOS)
  WATER_STREAKS: 16,
  DRIFT_FAR: 9, DRIFT_MID: 18, DRIFT_FG: 70, // u/giây, cảnh trôi sang trái

  STORAGE_KEY: 'choNoiMienTay.best.v1',
};
