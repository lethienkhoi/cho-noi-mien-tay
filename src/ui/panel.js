// Khung chữ dưới: phiên âm to (âm đổi tô đỏ) + chính tả nhỏ trong ngoặc + thanh thời gian.
// Không bao giờ hiện câu kế tiếp.
import { phoneticSegments } from '../game/phrases.js';
import { CONFIG } from '../config.js';

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
    this.lastFrac = -1;
  }
  show(on) { this.el.hidden = !on; }

  setPhrase(p, size) {
    this.big.textContent = '';
    for (const s of phoneticSegments(p.phienAm, p.chinhTa)) {
      if (s.hl) { const sp = document.createElement('span'); sp.className = 'hl'; sp.textContent = s.t; this.big.appendChild(sp); }
      else this.big.appendChild(document.createTextNode(s.t));
    }
    this.small.textContent = `(${p.chinhTa})`;
    this.el.style.setProperty('--fs', size || fontSizeFor(p.phienAm));
    this.small.style.fontSize = p.chinhTa.length > 36 ? 'calc(16px * var(--u))' : '';
  }

  play(p) {
    this.el.classList.remove('is-passed', 'is-crash');
    this.title.hidden = true; this.chips.hidden = true; this.bar.hidden = false;
    this.setPhrase(p);
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
  }

  setTime(frac) {
    const f = Math.round(frac * 400) / 400;
    if (f === this.lastFrac) return;
    this.lastFrac = f;
    this.fill.style.transform = `scaleX(${f})`;
  }
}
