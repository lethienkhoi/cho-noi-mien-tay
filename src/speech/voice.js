// Nối bộ nhận giọng với vòng chơi: mỗi câu mới đặt con trỏ transcript, chấm trên kết quả tạm thời,
// khớp là gọi game.onPhraseMatched(roundId, {dialect}) ngay (không chờ kết quả cuối).
import { TranscriptCursor, matchPhrase, matchProgress } from './matcher.js?v=69dfb0d0';

export class VoiceControl {
  constructor({ game, speech, panel }) {
    this.game = game; this.speech = speech; this.panel = panel;
    this.cursor = new TranscriptCursor();
    this.roundId = 0; this.phrase = null; this.done = false; this.prevPhraseId = null;

    game.addEventListener('round', (e) => {
      this.prevPhraseId = this.phrase ? this.phrase.id : null;
      this.roundId = e.detail.id; this.phrase = e.detail.phrase; this.done = false;
      this.cursor.mark();
      panel.setHeard(''); panel.setProgress(0);
    });
    speech.addEventListener('result', (e) => {
      this.cursor.setResults(e.detail.results);
      panel.pulseMic();
      this.evaluate();
    });
    speech.addEventListener('end', () => this.cursor.newSession());
  }

  evaluate() {
    const g = this.game;
    if (!this.phrase || this.done || g.state !== 'playing' || g.paused || !g.round || g.round.id !== this.roundId) return;
    const words = this.cursor.words();
    this.panel.setHeard(words.slice(-7).join(' '));
    let m = matchPhrase(words, this.phrase);
    // iPhone hay viết lại kết quả tạm thời làm con trỏ lệch: thử khớp trên cả phiên, miễn không phải câu vừa đọc ở lượt trước
    if (!m.matched && this.phrase.id !== this.prevPhraseId) {
      const all = this.cursor.allWords();
      const m2 = matchPhrase(all.words, this.phrase);
      if (m2.matched && m2.start + m2.length > all.mark) m = m2;
    }
    if (m.matched) {
      this.done = g.onPhraseMatched(this.roundId, { dialect: m.dialect });
      return;
    }
    const k = matchProgress(words, this.phrase);
    this.panel.setProgress(k);
    if (g.notePartial) g.notePartial(this.roundId, k);
  }
}
