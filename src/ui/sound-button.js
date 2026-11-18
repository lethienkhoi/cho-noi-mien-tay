// Nút loa góc trên phải (B6): bấm xoay vòng Bật hết -> Tắt nhạc -> Tắt hết. Biểu tượng SVG đổi theo chế độ,
// chữ nhỏ hiện ~1,2s cho biết vừa chọn gì. Chế độ nhớ trong localStorage (xem src/game/sfx.js).
const LABEL = { all: 'Bật hết tiếng', sfx: 'Tắt nhạc nền', off: 'Tắt hết tiếng' };

export class SoundButton {
  constructor(el, sfx) {
    this.el = el; this.sfx = sfx;
    this.tip = el.querySelector('.sound-tip');
    this.timer = 0;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.unlock();                       // cũng là cử chỉ bấm: mở khoá âm thanh
      const m = sfx.cycleMode();
      this.flash(LABEL[m]);
    });
    sfx.onMode((m) => this.render(m));
    this.render(sfx.mode);
  }
  render(m) {
    this.el.dataset.mode = m;
    this.el.setAttribute('aria-label', `Âm thanh: ${LABEL[m].toLowerCase()}. Bấm để đổi`);
    this.el.title = LABEL[m];
  }
  flash(text) {
    if (!this.tip) return;
    this.tip.textContent = text; this.tip.hidden = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.tip.hidden = true; }, 1200);
  }
}
