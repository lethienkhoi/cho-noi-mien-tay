// Test bộ chấm câu (B4). Chạy: node --test dev/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  normalizeWords, wordDistance, matchPhrase, matchProgress, TranscriptCursor,
} from '../../src/speech/matcher.js';

const DATA = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/phrases.json', import.meta.url)), 'utf8'));
const P = Object.fromEntries(DATA.phrases.map((p) => [p.id, p]));
const m = (text, id) => matchPhrase(normalizeWords(text), P[id]);

test('chuẩn hoá: NFC, chữ thường, bỏ dấu câu, gộp khoảng trắng, số thành chữ', () => {
  const nfd = 'Bún riêu'.normalize('NFD');
  assert.deepEqual(normalizeWords(`  ${nfd},  CUA!! `), ['bún', 'riêu', 'cua']);
  assert.deepEqual(normalizeWords('ốp-la... ăn 1 lần'), ['ốp', 'la', 'ăn', 'một', 'lần']);
  assert.deepEqual(normalizeWords(''), []);
});

test('1. đọc chính tả câu ngắn', () => {
  const r = m('bún riêu', 2);
  assert.equal(r.matched, true); assert.equal(r.dialect, false);
});

test('2. đọc phiên âm → chuẩn miền Tây', () => {
  const r = m('búng giêu', 2);
  assert.equal(r.matched, true); assert.equal(r.dialect, true);
});

test('3. câu dài đọc chính tả, có dấu câu và hoa thường', () => {
  const r = m('Con cá rô bỏ trong rổ. Rổ rách, cá rô ra rạch!', 16);
  assert.equal(r.matched, true); assert.equal(r.dialect, false);
});

test('4. câu dài đọc phiên âm', () => {
  const r = m('gụ ga gồi góc ga ly gáng dô mộc ly gồi dìa', 17);
  assert.equal(r.matched, true); assert.equal(r.dialect, true);
});

test('5. trộn chính tả và phiên âm từng chữ', () => {
  const r = m('vịt dìa rồi dịch vô vườn rau', 15);
  assert.equal(r.matched, true); assert.equal(r.dialect, true);
});

test('6. thiếu chữ → không qua', () => {
  assert.equal(m('cơm tấm sườn', 7).matched, false);
  assert.equal(m('cà phê sữa đá liền', 8).matched, false);
});

test('7. thừa chữ trước và sau → vẫn qua', () => {
  const r = m('ờ ờ cho tui sầu riêng nha cô', 4);
  assert.equal(r.matched, true); assert.equal(r.start, 4);
});

test('8. chữ chen giữa câu → không qua (phải liên tiếp)', () => {
  assert.equal(m('bún ờ riêu', 2).matched, false);
});

test('9. sai 1 ký tự: câu ngắn không qua, câu dài lệch một chữ thì qua', () => {
  assert.equal(m('rau muốm', 3).matched, false);        // trung bình 0.75 < 0.8
  assert.equal(m('cơm tấm sường bì', 7).matched, true);  // 1 chữ lệch trong 4 chữ
});

test('10. sai dấu thanh do máy nghe nhầm → vẫn qua; nhiều chữ sai dấu cùng lúc → không qua', () => {
  assert.equal(m('sầu riếng', 4).matched, true);
  assert.equal(m('cá rồ', 1).matched, true);
  assert.equal(m('bánh tét lá cẫm', 6).matched, true);
  assert.equal(m('ca ro', 1).matched, false);            // cả hai chữ đều sai dấu: trung bình 0.75
});

test('11. sai phụ âm đầu → không qua', () => {
  assert.equal(m('sầu diêng', 4).matched, false);
  assert.equal(m('lau muống', 3).matched, false);
});

test('12. đảo thứ tự hai chữ → không qua', () => {
  assert.equal(m('riêu bún', 2).matched, false);
  assert.equal(m('nước mía rề rẻ', 5).matched, false);
  assert.equal(m('cà phê đá sữa vô liền', 8).matched, false);
});

test('12b. sai một chữ trong câu dài → không qua', () => {
  assert.equal(m('nước mía rẻ rề', 5).matched, true);
  assert.equal(m('nước miếng rẻ rề', 5).matched, false);
});

test('13. dialect chỉ khi chữ nghe gần dạng phiên âm hơn', () => {
  assert.equal(m('rau muốn', 3).dialect, true);   // muốn = dạng phiên âm
  assert.equal(m('rau muống', 3).dialect, false);
  assert.equal(m('cá rô', 1).dialect, false);
});

test('14. câu khác hẳn → không qua', () => {
  assert.equal(m('hủ tiếu ngon quá trời', 2).matched, false);
  assert.equal(m('', 2).matched, false);
});

test('15. tô dần: số chữ đầu câu đã đọc đúng', () => {
  assert.equal(matchProgress(normalizeWords('cơm tấm'), P[7]), 2);
  assert.equal(matchProgress(normalizeWords('ừ cơm tấm sừng'), P[7]), 3);
  assert.equal(matchProgress(normalizeWords('trời ơi'), P[7]), 0);
  assert.equal(matchProgress(normalizeWords('cơm tấm sườn bì'), P[7]), 4);
});

test('16. con trỏ: transcript câu trước không được tính (result đã final)', () => {
  const c = new TranscriptCursor();
  c.setResults([{ transcript: 'búng giêu', isFinal: true }]);
  c.mark();                                   // câu mới bắt đầu
  assert.deepEqual(c.words(), []);
  assert.equal(matchPhrase(c.words(), P[2]).matched, false);
  c.setResults([{ transcript: 'búng giêu', isFinal: true }, { transcript: 'cá gô', isFinal: false }]);
  assert.deepEqual(c.words(), ['cá', 'gô']);
});

test('17. con trỏ: result tạm thời đang dở → chỉ lấy chữ mới thêm', () => {
  const c = new TranscriptCursor();
  c.setResults([{ transcript: 'bún riêu', isFinal: false }]);
  c.mark();
  c.setResults([{ transcript: 'bún riêu bún', isFinal: false }]);
  assert.equal(matchPhrase(c.words(), P[2]).matched, false); // "bún riêu" cũ không được tính lại
  c.setResults([{ transcript: 'bún riêu bún riêu', isFinal: true }]);
  assert.equal(matchPhrase(c.words(), P[2]).matched, true);
});

test('18. con trỏ: phiên khởi động lại giữ chữ của câu hiện tại', () => {
  const c = new TranscriptCursor();
  c.setResults([{ transcript: 'cá rô', isFinal: true }]);
  c.mark();
  c.setResults([{ transcript: 'cá rô', isFinal: true }, { transcript: 'cơm tấm', isFinal: true }]);
  c.newSession();
  c.setResults([{ transcript: 'sừng bì', isFinal: false }]);
  assert.deepEqual(c.words(), ['cơm', 'tấm', 'sừng', 'bì']);
  assert.deepEqual(matchPhrase(c.words(), P[7]), { matched: true, dialect: true, start: 0, length: 4 });
  c.mark(); // câu kế: bỏ hết
  assert.deepEqual(c.words(), []);
});

test('19. mọi câu trong data khớp được cả 2 dạng; dạng phiên âm có giọng miền Tây', () => {
  for (const p of DATA.phrases) {
    const a = matchPhrase(normalizeWords(p.chinhTa), p), b = matchPhrase(normalizeWords(p.phienAm), p);
    assert.equal(a.matched, true, p.chinhTa); assert.equal(a.dialect, false, p.chinhTa);
    assert.equal(b.matched, true, p.phienAm); assert.equal(b.dialect, true, p.phienAm);
  }
});
