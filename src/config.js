// Hằng số chỉnh game (B3). Đơn vị toạ độ: "u" = 1px của khung thiết kế rộng 390 (như keyframe pv1).
export const CONFIG = {
  // ---- thời gian mỗi câu (B5: nhanh hơn, có sàn cho máy nhận giọng kịp trả kết quả)
  // T = max(SÀN, (TIME_BASE + TIME_PER_WORD x số chữ) x hệ số giảm theo số ghe đã qua).
  // T là thời gian thanh đỏ chạy hết = lúc ghe hàng tới SÁT MŨI ghe mình. Sau đó còn TIME_GRACE ân hạn
  // (ghe hàng nhích nốt khoảng cách cuối) rồi mới đụng: đọc khớp trong ân hạn vẫn nhảy.
  // 2026-11-17 (lần 2): Khôi thấy vẫn nhanh -> 2,6s + 0,8s/chữ, giảm 1%/ghe tới 70%, sàn 2,2s + 0,35s/chữ; ân hạn 0,4s.
  // Ví dụ (chưa tính ân hạn): câu 2 chữ 4,2s -> 2,9s; câu 6 chữ 7,4s -> 5,2s; câu 15 chữ 14,6s -> 10,2s.
  TIME_BASE: 2.6,           // giây, lúc mới vào
  TIME_PER_WORD: 0.8,      // giây cho mỗi chữ (âm tiết) của câu phiên âm, lúc mới vào
  TIME_DECAY_PER_PASS: 0.01, // mỗi ghe qua được, thời gian còn (1 - n*decay)
  TIME_MIN_FACTOR: 0.7,     // không nhanh hơn 70% thời gian gốc (sau 30 ghe)
  TIME_FLOOR_BASE: 2.2,     // SÀN cứng: không dưới 2,2s + 0,35s/chữ
  TIME_FLOOR_PER_WORD: 0.35,
  // Chờ người đang đọc (máy nghe iPhone trả chữ trễ): ghe hàng dừng sát mũi tối đa HOLD_MAX giây
  // nếu đã đọc đúng >= HOLD_MIN_FRAC số chữ và vừa có chữ đúng mới trong HOLD_FRESH giây.
  HOLD_MAX: 1.2,
  HOLD_MIN_FRAC: 0.5,
  HOLD_FRESH: 1.0,
  TIME_GRACE: 0.4,         // giây ân hạn sau khi thanh thời gian hết, trước khi hai ghe chạm

  // ---- level câu theo số ghe đã qua: qua >= mốc thì mở level kế (level 5 chưa có câu -> lấy level cao nhất có sẵn)
  LEVEL_AT: [0, 3, 7, 13, 20], // level 1: 0–2, level 2: 3–6, level 3: 7–12, level 4: 13–19, level 5: 20+
  LOWER_LEVEL_CHANCE: 0.2,  // thỉnh thoảng lấy câu level thấp hơn cho đỡ ngộp
  AVOID_RECENT: 4,          // không lặp lại N câu gần nhất

  // ---- điểm
  // 2026-11-18 Khôi: điểm theo đơn vị trăm. Lên đời và mức câu vẫn tính theo SỐ GHE qua, không theo điểm.
  SCORE_PASS: 100,          // qua ghe +100
  SCORE_DIALECT_BONUS: 200, // thưởng "Chuẩn miền Tây" +200
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
  CRASH_SNAP_T: 0.42,       // giây sau va chạm thì chụp ảnh cho bảng kết quả (RẦM!, nhân vật đang văng, bong bóng chửi đã nảy xong)

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

  LEGACY_BEST_KEY: 'choNoiMienTay.best.v1', // kỷ lục cũ thang +1 — chỉ đọc một lần để đổi ×100
  TOP_KEY: 'choNoiMienTay.top.v2',          // bảng 4 điểm cao nhất [{s, d:'dd/mm'}] thang trăm
};
