// Bộ chấm câu đọc (B4). Hàm thuần, không đụng DOM: chạy được cả trên trình duyệt lẫn node (dev/tests).
//
// Một câu khớp khi trong transcript có một dãy chữ liên tiếp, đúng thứ tự, khớp toàn bộ câu. Ở mỗi vị trí, chữ nghe
// được phải trùng CHÍNH XÁC (NFC, chữ thường, bỏ dấu câu) chữ chính tả HOẶC chữ phiên âm cùng vị trí.
// Không dung sai: đọc lộn thứ tự, thiếu chữ, sai dấu thanh, sai chữ → không qua (Khôi chốt 2026-11-17).
// Chữ thừa trước/sau dãy khớp thì vẫn được.
// dialect = có ít nhất một vị trí (chính tả ≠ phiên âm) mà chữ nghe được là dạng phiên âm.

const DIGITS = { 0: 'không', 1: 'một', 2: 'hai', 3: 'ba', 4: 'bốn', 5: 'năm', 6: 'sáu', 7: 'bảy', 8: 'tám', 9: 'chín', 10: 'mười' };

// NFC, chữ thường, bỏ dấu câu (gạch nối coi như khoảng trắng), gộp khoảng trắng → mảng chữ.
export function normalizeWords(text) {
  if (!text) return [];
  const s = String(text).normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!s) return [];
  return s.split(/\s+/).map((w) => (Object.prototype.hasOwnProperty.call(DIGITS, w) ? DIGITS[w] : w));
}
export const normalizeText = (text) => normalizeWords(text).join(' ');

// Chữ nghe được phải trùng CHÍNH XÁC chữ đích (sau chuẩn hoá): sai dấu thanh, sai chữ là không khớp.
// 0 = khớp, Infinity = không khớp (giữ dạng số để so "gần dạng nào hơn" khi chấm giọng).
export function wordDistance(heard, target) {
  return heard === target ? 0 : Infinity;
}

// Chuẩn bị câu: hai dạng chữ, cùng số chữ thì so theo vị trí; lệch số chữ thì xét từng dạng riêng.
export function preparePhrase(phrase) {
  const ct = normalizeWords(phrase.chinhTa), pa = normalizeWords(phrase.phienAm);
  if (ct.length === pa.length) return [{ ct, pa }];
  // dữ liệu lệch số chữ: mỗi dạng tự khớp; khớp trọn dạng phiên âm thì tính giọng miền Tây
  return [{ ct, pa: ct }, { ct: pa, pa, dialectIfMatched: pa.join(' ') !== ct.join(' ') }];
}

function matchAt(words, start, form) {
  let dialect = false;
  for (let i = 0; i < form.ct.length; i++) {
    const h = words[start + i];
    if (h === undefined) return null;
    const dc = wordDistance(h, form.ct[i]), dp = wordDistance(h, form.pa[i]);
    if (dc === Infinity && dp === Infinity) return null;
    if (form.ct[i] !== form.pa[i] && dp < dc) dialect = true;
  }
  return { dialect };
}

// words: mảng chữ đã chuẩn hoá. Trả { matched, dialect, start } — ưu tiên lần khớp có giọng miền Tây.
export function matchPhrase(words, phrase) {
  let best = null;
  for (const form of preparePhrase(phrase)) {
    const n = form.ct.length;
    if (!n) continue;
    for (let s = 0; s + n <= words.length; s++) {
      const m = matchAt(words, s, form);
      if (!m) continue;
      const dialect = m.dialect || !!form.dialectIfMatched;
      if (!best || (dialect && !best.dialect)) best = { matched: true, dialect, start: s, length: n };
      if (best.dialect) return best;
    }
  }
  return best || { matched: false, dialect: false, start: -1, length: 0 };
}

// Số chữ đầu câu đã đọc đúng (để tô dần trên khung chữ): dãy dài nhất trong transcript khớp phần đầu câu.
export function matchProgress(words, phrase) {
  let bestK = 0;
  for (const form of preparePhrase(phrase)) {
    const n = form.ct.length;
    for (let s = 0; s < words.length; s++) {
      let k = 0;
      while (k < n && s + k < words.length) {
        const h = words[s + k];
        if (wordDistance(h, form.ct[k]) === Infinity && wordDistance(h, form.pa[k]) === Infinity) break;
        k++;
      }
      if (k > bestK) bestK = k;
      if (bestK === n) return n;
    }
  }
  return bestK;
}

// ---------------------------------------------------------------- con trỏ transcript
// Web Speech trả về danh sách result (cái cuối có thể còn tạm thời và bị sửa). Con trỏ ghi lại "đã nghe tới đâu"
// lúc câu hiện tại bắt đầu: chỉ số result + số chữ đã dùng trong result đó. Chỉ chữ sau con trỏ được chấm.
// Khi phiên nhận giọng tự khởi động lại (danh sách result làm lại từ đầu), chữ của câu hiện tại được giữ trong carry.
export class TranscriptCursor {
  constructor() { this.results = []; this.ri = 0; this.skip = 0; this.carry = []; }

  // results: [{ transcript, isFinal }] — toàn bộ danh sách của phiên hiện tại
  setResults(results) { this.results = results.map((r) => ({ words: normalizeWords(r.transcript), isFinal: !!r.isFinal })); }

  // câu mới bắt đầu: mọi chữ đã nghe tới giờ không tính nữa
  mark() {
    const R = this.results, last = R[R.length - 1];
    this.carry = [];
    if (!last) { this.ri = 0; this.skip = 0; return; }
    if (last.isFinal) { this.ri = R.length; this.skip = 0; } else { this.ri = R.length - 1; this.skip = last.words.length; }
  }

  // phiên nhận giọng kết thúc (sẽ khởi động lại): giữ chữ của câu hiện tại, danh sách mới bắt đầu từ 0
  newSession() { this.carry = this.words(); this.results = []; this.ri = 0; this.skip = 0; }

  words() {
    const out = this.carry.slice();
    for (let i = this.ri; i < this.results.length; i++) {
      const w = this.results[i].words;
      out.push(...(i === this.ri ? w.slice(this.skip) : w));
    }
    return out;
  }
}
