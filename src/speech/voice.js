// Nối bộ nhận giọng với vòng chơi: mỗi câu mới đặt con trỏ transcript, chấm trên kết quả tạm thời,
// khớp là gọi game.onPhraseMatched(roundId, {dialect}) ngay (không chờ kết quả cuối).
import { TranscriptCursor, matchPhrase, matchProgress } from './matcher.js';

export class VoiceControl {
  constructor({ game, speech, panel }) {
    this.game = game; this.speech = speech; this.panel = panel;
    this.cursor = new TranscriptCursor();
    this.roundId = 0; this.phrase = null; this.done = false;

    game.addEventListener('round', (e) => {
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
    const m = matchPhrase(words, this.phrase);
    if (m.matched) {
      this.done = g.onPhraseMatched(this.roundId, { dialect: m.dialect });
      return;
    }
    this.panel.setProgress(matchProgress(words, this.phrase));
  }
}
