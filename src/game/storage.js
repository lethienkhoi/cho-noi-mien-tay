// Kỷ lục + bảng 4 điểm cao nhất, lưu trên máy. localStorage có thể bị chặn (Safari riêng tư, iframe, cookie tắt)
// -> giữ trong bộ nhớ. 2026-11-18: điểm theo thang trăm (qua ghe +100). Kỷ lục cũ (khoá v1, thang +1) đổi ×100 một lần.
import { CONFIG } from '../config.js?v=8d4b1e05';

const TOP_N = 4;
let memTop = null;   // [{ s: điểm, d: 'dd/mm' }] giảm dần — bản trong bộ nhớ khi không ghi được localStorage
let usable = null;

function store() {
  if (usable === false) return null;
  try {
    const s = window.localStorage;
    const k = CONFIG.TOP_KEY + '.probe';
    s.setItem(k, '1'); s.removeItem(k);
    usable = true;
    return s;
  } catch (e) { usable = false; return null; }
}

const clean = (list) => (Array.isArray(list) ? list : [])
  .map((r) => ({ s: Math.max(0, Math.round(Number(r && r.s) || 0)), d: typeof (r && r.d) === 'string' ? r.d.slice(0, 5) : '' }))
  .filter((r) => r.s > 0)
  .sort((a, b) => b.s - a.s)
  .slice(0, TOP_N);

export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}`;
}

// đọc bảng; lần đầu chưa có bảng mà có kỷ lục cũ (thang +1) thì đổi sang thang trăm và ghi bảng mới
export function loadTop() {
  const s = store();
  if (!s) return (memTop || []).slice();
  let top = memTop || [];
  {
    try {
      const raw = s.getItem(CONFIG.TOP_KEY);
      if (raw !== null) top = clean(JSON.parse(raw));
      else {
        const old = parseInt(s.getItem(CONFIG.LEGACY_BEST_KEY) || '0', 10);
        if (Number.isFinite(old) && old > 0) top = clean([{ s: old * 100, d: "" }]);
        try { s.setItem(CONFIG.TOP_KEY, JSON.stringify(top)); } catch (e) { /* đầy bộ nhớ: giữ trong RAM */ }
      }
    } catch (e) { /* hỏng dữ liệu: dùng bản trong bộ nhớ */ }
  }
  memTop = top;
  return top.slice();
}

export function loadBest() { const t = loadTop(); return t.length ? t[0].s : 0; }

// ghi điểm một lượt. Trả { top, rank } (rank 0..3 nếu lọt top, -1 nếu không; điểm 0 không ghi).
export function recordScore(score, date = today()) {
  const top = loadTop();
  score = Math.max(0, Math.round(score) || 0);
  if (score <= 0) return { top, rank: -1 };
  const entry = { s: score, d: date };
  // cùng điểm: lượt mới xếp sau lượt cũ
  let i = top.findIndex((r) => r.s < score);
  if (i < 0) i = top.length;
  top.splice(i, 0, entry);
  const next = top.slice(0, TOP_N);
  const rank = i < TOP_N ? i : -1;
  memTop = next;
  const s = store();
  if (s) { try { s.setItem(CONFIG.TOP_KEY, JSON.stringify(next)); } catch (e) { /* giữ trong bộ nhớ */ } }
  return { top: next.slice(), rank };
}

export function storageAvailable() { store(); return usable === true; }
