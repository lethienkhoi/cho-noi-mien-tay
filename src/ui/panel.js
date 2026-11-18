// Khung chữ dưới: phiên âm to (âm đổi tô đỏ) + chính tả nhỏ trong ngoặc + thanh thời gian
// + dòng "Đang nghe: …" (B4) và tô dần các chữ đã đọc đúng. Không bao giờ hiện câu kế tiếp.
import { phoneticSegments } from '../game/phrases.js?v=b170c2bd';
import { CONFIG } from '../config.js?v=b170c2bd';

// cỡ chữ (px ở khung 390) theo độ dài câu phiên âm
function fontSizeFor(text) {
  const n = text.length;
  if (n <= 10) return 58;
  if (n <= 16) return 46;
  if (n <= 24) return 38;
  if (n <= 36) return 32;
  return 27;
}

export class Panel {
  constructor(root) {
    this.el = root;
    this.title = root.querySelector('#panel-title');
    this.big = root.querySelector('#phrase-big');
    this.small = root.querySelector('#phrase-small');
    this.bar = root.querySelector('#bar');
    this.fill = root.querySelector('#bar-fill');
    this.chips = root.querySelector('#chips');
    this.heard = root.querySelector('#heard');
    this.heardText = root.querySelector('#heard-text');
    this.words = []; this.progress = 0;
    this.lastFrac = -1; this.pulseTimer = 0;
  }
  show(on) { this.el.hidden = !on; }

  // mỗi chữ phiên âm một span.w (để tô dần), bên trong tô đỏ phần âm đổi
  setPhrase(p, size) {
    this.big.textContent = '';
    this.words = [];
    const A = p.phienAm.split(/\s+/).filter(Boolean), B = p.chinhTa.split(/\s+/).filter(Boolean);
    A.forEach((w, i) => {
      if (i) this.big.appendChild(document.createTextNode(' '));
      const ws = document.createElement('span'); ws.className = 'w';
      for (const s of phoneticSegments(w, B[i] || w)) {
        if (s.hl) { const sp = document.createElement('span'); sp.className = 'hl'; sp.textContent = s.t; ws.appendChild(sp); }
        else ws.appendChild(document.createTextNode(s.t));
      }
      this.big.appendChild(ws);
      if (/[\p{L}\p{N}]/u.test(w)) this.words.push(ws);
    });
    this.progress = 0;
    this.small.textContent = `(${p.chinhTa})`;
    this.el.style.setProperty('--fs', size || fontSizeFor(p.phienAm));
    this.small.style.fontSize = p.chinhTa.length > 36 ? 'calc(16px * var(--u))' : '';
  }

  play(p) {
    this.el.classList.remove('is-passed', 'is-crash');
    this.title.hidden = true; this.chips.hidden = true; this.bar.hidden = false; this.heard.hidden = false;
    this.setPhrase(p);
    this.setHeard('');
    this.lastFrac = -1; this.setTime(1);
  }

  passed(p, { dialect, gained }) {
    this.el.classList.add('is-passed');
    this.bar.hidden = true; this.title.hidden = true;
    this.setPhrase(p, Math.min(40, fontSizeFor(p.phienAm)));
    this.chips.textContent = '';
    const a = document.createElement('span'); a.className = 'chip-green'; a.textContent = `Qua ghe +${CONFIG.SCORE_PASS}`; this.chips.appendChild(a);
    if (dialect) { const b = document.createElement('span'); b.className = 'chip-outline'; b.textContent = `Chuẩn miền Tây +${CONFIG.SCORE_DIALECT_BONUS}`; this.chips.appendChild(b); }
    this.chips.hidden = false;
  }

  crash(p) {
    this.el.classList.remove('is-passed'); this.el.classList.add('is-crash');
    this.bar.hidden = true; this.chips.hidden = true; this.title.hidden = false;
    this.setPhrase(p, Math.min(34, fontSizeFor(p.phienAm)));
    this.heard.hidden = false; // giữ dòng máy nghe được để người chơi biết sai chỗ nào
  }

  // số chữ đầu câu đã đọc đúng
  setProgress(k) {
    if (k === this.progress) return;
    this.progress = k;
    this.words.forEach((w, i) => w.classList.toggle('said', i < k));
  }

  setHeard(text) {
    const t = text ? text : '…';
    if (this.heardText.textContent !== t) this.heardText.textContent = t;
    this.heard.classList.toggle('is-empty', !text);
  }

  // micro: off | wait | on ; pulseMic(): nháy mạnh khi có tiếng/chữ mới
  setMic(state) { this.el.dataset.mic = state; }
  setActivity(on) { this.el.classList.toggle('is-speaking', !!on); }
  pulseMic() {
    this.el.classList.add('is-speaking');
    clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => this.el.classList.remove('is-speaking'), 450);
  }

  setTime(frac) {
    const f = Math.round(frac * 400) / 400;
    if (f === this.lastFrac) return;
    this.lastFrac = f;
    this.fill.style.transform = `scaleX(${f})`;
  }
}
