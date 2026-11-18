// Bộ chấm câu đọc. Hàm thuần, không đụng DOM: chạy được cả trên trình duyệt lẫn node (dev/tests).
//
// Một câu khớp khi trong transcript có một dãy chữ liên tiếp, đúng thứ tự, đủ số chữ của câu. Mỗi vị trí được chấm điểm
// so với chữ chính tả HOẶC chữ phiên âm cùng vị trí (lấy điểm cao hơn):
//   1    trùng chính xác;
//   0.75 chỉ sai dấu thanh (máy nghe iPhone hay nhầm dấu);
//   0.5  sai 1 ký tự nhưng cùng phụ âm đầu (chữ dài ≥ 3 ký tự);
//   0    sai chữ / sai phụ âm đầu.
// Qua khi KHÔNG vị trí nào 0 và điểm trung bình ≥ PASS_AVG. Đọc lộn thứ tự, thiếu chữ, sai chữ → không qua.
// (2026-11-17: Khôi thử iPhone thấy máy nghe sai nhiều, nới từ "trùng chính xác" sang chấm điểm như trên.)
// Chữ thừa trước/sau dãy khớp thì vẫn được.
// dialect = có ít nhất một vị trí (chính tả ≠ phiên âm) mà chữ nghe được trùng CHÍNH XÁC dạng phiên âm.

export const PASS_AVG = 0.8;

const DIGITS = { 0: 'không', 1: 'một', 2: 'hai', 3: 'ba', 4: 'bốn', 5: 'năm', 6: 'sáu', 7: 'bảy', 8: 'tám', 9: 'chín', 10: 'mười' };

// NFC, chữ thường, bỏ dấu câu (gạch nối coi như khoảng trắng), gộp khoảng trắng → mảng chữ.
// "ghẻ" và "gẻ", "nghe" và "nge" là cùng một âm (chính tả bắt viết gh/ngh trước e, ê, i): so sánh theo một dạng.
const canon = (w) => w.replace(/^ngh/, 'ng').replace(/^gh/, 'g');

export function normalizeWords(text) {
  if (!text) return [];
  const s = String(text).normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!s) return [];
  return s.split(/\s+/).map((w) => canon(Object.prototype.hasOwnProperty.call(DIGITS, w) ? DIGITS[w] : w));
}
export const normalizeText = (text) => normalizeWords(text).join(' ');

const TONES = /[\u0300\u0301\u0303\u0309\u0323]/g;
export const detone = (w) => w.normalize('NFD').replace(TONES, '').normalize('NFC');
const ONSET = /^(ngh|ng|nh|ch|tr|th|ph|kh|gh|gi|qu|[bcdđghklmnprstvxw])/;
const onset = (w) => (w.match(ONSET) || [''])[0];
function lev1(a, b) { // khoảng cách sửa có ≤ 1 không
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}

// Điểm của một chữ nghe được so với chữ đích (xem bảng ở đầu file).
export function wordScore(heard, target) {
  if (heard === target) return 1;
  const h = detone(heard), t = detone(target);
  if (h === t) return 0.75;
  if (t.length >= 3 && onset(h) === onset(t) && lev1(h, t)) return 0.5;
  return 0;
}
// giữ tên cũ cho chỗ khác dùng: 0 = trùng, Infinity = không tính được
export function wordDistance(heard, target) { return heard === target ? 0 : Infinity; }

// Chuẩn bị câu: hai dạng chữ, cùng số chữ thì so theo vị trí; lệch số chữ thì xét từng dạng riêng.
export function preparePhrase(phrase) {
  const ct = normalizeWords(phrase.chinhTa), pa = normalizeWords(phrase.phienAm);
  if (ct.length === pa.length) return [{ ct, pa }];
  // dữ liệu lệch số chữ: mỗi dạng tự khớp; khớp trọn dạng phiên âm thì tính giọng miền Tây
  return [{ ct, pa: ct }, { ct: pa, pa, dialectIfMatched: pa.join(' ') !== ct.join(' ') }];
}

// Khớp theo DÃY CON đúng thứ tự (2026-11-18, theo Khôi): các chữ của câu phải xuất hiện đúng thứ tự trong transcript,
// nhưng ĐƯỢC CHEN chữ lạ ở giữa — đọc trật một chữ thì đọc lại chữ đó / đọc tiếp phần còn lại vẫn được tính.
// Giới hạn chữ chen: tối đa MAX_GAP_WORDS(n) chữ lạ trong cả đoạn khớp, để nói lung tung không tự lọt qua.
export const MAX_GAP_WORDS = (n) => 2 * n + 4;

// Quy hoạch động: tìm cách khớp n chữ đích vào words (đúng thứ tự, mỗi chữ nghe dùng 1 lần) có tổng điểm cao nhất
// trong các cách có số chữ chen ≤ giới hạn. Trả { k: số chữ đích khớp được tính từ đầu, score, start, end, dialect } cho k = n.
function bestSubsequence(words, form) {
  const n = form.ct.length, m = words.length;
  if (!n || !m) return null;
  const sc = form.ct.map((ct, i) => words.map((h) => {
    const a = wordScore(h, ct), b = wordScore(h, form.pa[i]);
    return { s: Math.max(a, b), dialect: ct !== form.pa[i] && h === form.pa[i] };
  }));
  let best = null;
  // thử mọi điểm bắt đầu (chữ đích đầu tiên khớp ở words[s]); n, m nhỏ nên đủ nhanh
  for (let s = 0; s < m; s++) {
    if (!sc[0][s].s) continue;
    // dp[i] = {sum, end, dialect} tốt nhất khi đã khớp i+1 chữ đầu, chữ thứ i ở vị trí end
    let cur = { sum: sc[0][s].s, end: s, dialect: sc[0][s].dialect };
    const limit = s + n + MAX_GAP_WORDS(n);
    let ok = true;
    for (let i = 1; i < n; i++) {
      // tham lam có nhìn trước: chọn vị trí kế tiếp có điểm cao nhất trong cửa sổ trước khi gặp chữ đích kế sau đó
      let pick = -1;
      for (let j = cur.end + 1; j < Math.min(m, limit); j++) {
        if (!sc[i][j].s) continue;
        if (pick < 0 || sc[i][j].s > sc[i][pick].s) pick = j;
        if (sc[i][j].s === 1) break;
        // nếu chữ đích kế tiếp đã xuất hiện thì thôi tìm xa hơn (không vượt mặt chữ sau)
        if (i + 1 < n && sc[i + 1][j] && sc[i + 1][j].s === 1 && pick >= 0) break;
      }
      if (pick < 0) { ok = false; break; }
      cur = { sum: cur.sum + sc[i][pick].s, end: pick, dialect: cur.dialect || sc[i][pick].dialect };
    }
    if (!ok) continue;
    const avg = cur.sum / n;
    if (avg < PASS_AVG) continue;
    const cand = { score: avg, start: s, end: cur.end, dialect: cur.dialect };
    if (!best || (cand.dialect && !best.dialect) || (cand.dialect === best.dialect && cand.score > best.score)) best = cand;
  }
  return best;
}

// words: mảng chữ đã chuẩn hoá. Trả { matched, dialect, start, length } — length = số chữ nghe từ đầu tới cuối đoạn khớp.
export function matchPhrase(words, phrase) {
  let best = null;
  for (const form of preparePhrase(phrase)) {
    const r = bestSubsequence(words, form);
    if (!r) continue;
    const dialect = r.dialect || !!form.dialectIfMatched;
    const cand = { matched: true, dialect, start: r.start, length: r.end - r.start + 1 };
    if (!best || (dialect && !best.dialect)) best = cand;
  }
  return best || { matched: false, dialect: false, start: -1, length: 0 };
}

// Số chữ đầu câu đã đọc đúng (để tô dần trên khung chữ): khớp dãy con đúng thứ tự, được chen chữ lạ, dài nhất có thể.
// Đọc trật rồi đọc tiếp thì phần đã đúng vẫn giữ màu.
export function matchProgress(words, phrase) {
  let bestK = 0;
  for (const form of preparePhrase(phrase)) {
    const n = form.ct.length;
    for (let s = 0; s < words.length; s++) {
      if (Math.max(wordScore(words[s], form.ct[0]), wordScore(words[s], form.pa[0])) === 0) continue;
      let k = 1, pos = s, gaps = 0;
      for (let j = s + 1; j < words.length && k < n; j++) {
        if (Math.max(wordScore(words[j], form.ct[k]), wordScore(words[j], form.pa[k])) > 0) { k++; pos = j; }
        else if (++gaps > MAX_GAP_WORDS(n)) break;
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

  // Dự phòng cho iPhone (viết lại kết quả tạm thời làm con trỏ lệch): mọi chữ của phiên hiện tại, kèm vị trí con trỏ.
  // Chỉ nên nhận một lần khớp có KẾT THÚC sau vị trí con trỏ (tức có chữ nói sau khi câu bắt đầu).
  allWords() {
    const out = [];
    let mark = 0;
    for (let i = 0; i < this.results.length; i++) {
      if (i < this.ri) mark += this.results[i].words.length;
      else if (i === this.ri) mark += Math.min(this.skip, this.results[i].words.length);
      out.push(...this.results[i].words);
    }
    return { words: this.carry.length ? this.carry.concat(out.slice(mark)) : out, mark: this.carry.length ? 0 : mark };
  }

  words() {
    const out = this.carry.slice();
    for (let i = this.ri; i < this.results.length; i++) {
      const w = this.results[i].words;
      out.push(...(i === this.ri ? w.slice(this.skip) : w));
    }
    return out;
  }
}
