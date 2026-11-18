// Định dạng điểm kiểu Việt: 1200 -> "1.200" (không đệm số 0).
export function fmtScore(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
