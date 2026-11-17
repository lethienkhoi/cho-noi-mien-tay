// Hằng số chỉnh game (B3). Đơn vị toạ độ: "u" = 1px của khung thiết kế rộng 390 (như keyframe pv1).
export const CONFIG = {
  // ---- thời gian mỗi câu: (nền + mỗi chữ) x hệ số giảm theo số ghe đã qua
  TIME_BASE: 1.6,           // giây
  TIME_PER_WORD: 0.55,      // giây cho mỗi chữ (âm tiết) của câu phiên âm
  TIME_DECAY_PER_PASS: 0.012, // mỗi ghe qua được, thời gian còn (1 - n*decay)
  TIME_MIN_FACTOR: 0.6,     // không nhanh hơn 60% thời gian gốc

  // ---- level câu theo số ghe đã qua: qua >= mốc thì mở level kế
  LEVEL_AT: [0, 5, 10, 16], // level 1 từ 0, level 2 từ 5, level 3 từ 10, level 4 từ 16
  LOWER_LEVEL_CHANCE: 0.25, // thỉnh thoảng lấy câu level thấp hơn cho đỡ ngộp
  AVOID_RECENT: 4,          // không lặp lại N câu gần nhất

  // ---- điểm
  SCORE_PASS: 1,            // qua ghe +1
  SCORE_DIALECT_BONUS: 2,   // thêm khi máy nghe đúng giọng miền Tây (B4) — chờ Khôi chốt cách tính
  PASSES_PER_TIER: 5,       // cứ 5 câu lên đời phương tiện
  MAX_TIER: 5,

  // ---- bố cục (u). Các toạ độ y tính từ ĐÁY khung để màn dài/ngắn vẫn đúng chỗ khung chữ.
  DESIGN_W: 390,
  HORIZON: 250,             // y từ trên xuống, như pv1
  HERO_X: 124, HERO_FROM_BOTTOM: 228,
  HERO_SCALE: [1.15, 0.98, 1.04, 0.92, 1.0, 0.92], // theo cấp phương tiện
  STALL_START: { x: 384, fromBottom: 430, s: 0.55 },
  STALL_HIT:   { x: 262, fromBottom: 256, s: 0.84 },
  STALL_EXIT:  { x: -190, fromBottom: 190, s: 1.02 },
  SHOCK_AT: 0.62,           // tiến độ ghe hàng (0..1) bắt đầu hết hồn

  // ---- nhảy
  JUMP_TIME: 0.95,          // giây
  JUMP_HEIGHT: 290,         // u
  JUMP_FORWARD: 46,         // u nhích tới trước ở đỉnh cung
  STALL_UNDER_AT: 0.5,      // tỉ lệ thời gian nhảy khi ghe hàng tới ngay dưới
  EXIT_EXTRA: 0.45,         // giây ghe hàng trôi tiếp ra khỏi màn sau khi đáp
  COCKY_TIME: 0.7,          // giây mặt đắc chí sau khi đáp
  NEXT_ROUND_DELAY: 0.15,   // giây chờ trước câu kế

  // ---- đụng
  CRASH_TO_RESULT: 1.5,     // giây trước khi hiện bảng kết quả

  // ---- render
  MAX_DPR: 2,               // dpr 3 vẫn vẽ ở 2 để giữ 60fps và bộ nhớ (iOS)
  WATER_STREAKS: 16,
  DRIFT_FAR: 9, DRIFT_MID: 18, DRIFT_FG: 70, // u/giây, cảnh trôi sang trái

  STORAGE_KEY: 'choNoiMienTay.best.v1',
};
