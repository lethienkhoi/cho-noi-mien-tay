// Chọn câu theo level + tách phần âm đổi (tô đỏ) giữa phiên âm và chính tả.
import { CONFIG } from '../config.js';

export function levelForPasses(passed) {
  let lv = 1;
  CONFIG.LEVEL_AT.forEach((at, i) => { if (passed >= at) lv = i + 1; });
  return lv;
}

export function wordCount(text) {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function roundTime(phrase, passed) {
  const base = CONFIG.TIME_BASE + CONFIG.TIME_PER_WORD * wordCount(phrase.phienAm);
  const f = Math.max(CONFIG.TIME_MIN_FACTOR, 1 - passed * CONFIG.TIME_DECAY_PER_PASS);
  return base * f;
}

export class PhrasePicker {
  constructor(list, rnd = Math.random) { this.list = list; this.recent = []; this.rnd = rnd; }
  reset() { this.recent = []; }
  pick(passed) {
    const lv = levelForPasses(passed);
    let want = lv;
    if (lv > 1 && this.rnd() < CONFIG.LOWER_LEVEL_CHANCE) want = 1 + Math.floor(this.rnd() * (lv - 1));
    let pool = this.list.filter((p) => p.level === want && !this.recent.includes(p.id));
    if (!pool.length) pool = this.list.filter((p) => p.level <= lv && !this.recent.includes(p.id));
    if (!pool.length) pool = this.list.slice();
    const p = pool[Math.floor(this.rnd() * pool.length)];
    this.recent.push(p.id);
    if (this.recent.length > CONFIG.AVOID_RECENT) this.recent.shift();
    return p;
  }
}

// ---------------------------------------------------------------- tô đỏ âm đổi
// Tách âm tiết thành phụ âm đầu + vần chính + âm cuối, so từng phần với chữ chính tả tương ứng.
const ONSETS = ['ngh', 'ng', 'nh', 'ch', 'tr', 'th', 'ph', 'kh', 'gh', 'gi', 'qu', 'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'x', 'w'];
const CODAS = ['ng', 'nh', 'ch', 'c', 'm', 'n', 'p', 't'];
const VOWEL = /[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

function split(syl) {
  const low = syl.toLowerCase();
  let on = '';
  for (const o of ONSETS) {
    if (low.startsWith(o)) {
      // "gi"/"qu" chỉ là phụ âm đầu khi sau nó còn nguyên âm (gì = g + ì)
      if ((o === 'gi' || o === 'qu') && !VOWEL.test(low.slice(2))) continue;
      on = o; break;
    }
  }
  let rest = low.slice(on.length), co = '';
  for (const c of CODAS) { if (rest.endsWith(c) && rest.length > c.length) { co = c; break; } }
  return [on.length, rest.length - co.length, co.length];
}

// Trả về mảng đoạn [{t, hl}] cho chữ phiên âm.
export function phoneticSegments(phienAm, chinhTa) {
  const A = phienAm.split(/(\s+)/), B = chinhTa.split(/\s+/);
  const out = [];
  let wi = 0;
  for (const tok of A) {
    if (/^\s+$/.test(tok) || !tok) { out.push({ t: tok, hl: false }); continue; }
    const b = B[wi++] || '';
    const m = tok.match(/^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u), n = b.match(/^([^\p{L}]*)([\p{L}]+)([^\p{L}]*)$/u);
    if (!m || !n || m[2].toLowerCase() === n[2].toLowerCase()) { out.push({ t: tok, hl: false }); continue; }
    const w = m[2], sa = split(w), sb = split(n[2]);
    const pa = [w.slice(0, sa[0]), w.slice(sa[0], sa[0] + sa[1]), w.slice(sa[0] + sa[1])];
    const lb = n[2].toLowerCase();
    const pb = [lb.slice(0, sb[0]), lb.slice(sb[0], sb[0] + sb[1]), lb.slice(sb[0] + sb[1])];
    if (m[1]) out.push({ t: m[1], hl: false });
    // "gi" + "êu" đọc như "r" + "iêu": so vần có tính chữ i nằm trong "gi"
    const nuc = (on, v) => (on === 'gi' && !/^[iíìỉĩị]/.test(v) ? 'i' + v : v);
    const same = [pa[0].toLowerCase() === pb[0], nuc(pa[0].toLowerCase(), pa[1].toLowerCase()) === nuc(pb[0], pb[1]), pa[2].toLowerCase() === pb[2]];
    for (let i = 0; i < 3; i++) if (pa[i]) out.push({ t: pa[i], hl: !same[i] });
    if (m[3]) out.push({ t: m[3], hl: false });
  }
  // gộp đoạn liền kề cùng loại
  const merged = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.hl === s.hl) last.t += s.t; else merged.push({ ...s });
  }
  return merged;
}
