// Màn bắt đầu, bảng kết quả, lớp phủ (tạm dừng, xoay màn, đang tải, lỗi).
const STEP_NAMES = ['Ghe chèo', 'Cano máy', 'Vê Ép 5', 'Du thuyền', 'Máy bay', 'Tàu vũ trụ'];

export class Screens {
  constructor(app) {
    this.app = app;
    const q = (s) => app.querySelector(s);
    this.start = q('#screen-start'); this.result = q('#screen-result');
    this.pauseEl = q('#overlay-pause'); this.rotateEl = q('#overlay-rotate');
    this.loadingEl = q('#overlay-loading'); this.errorEl = q('#overlay-error');
    this.loadFill = q('#load-fill');
    this.startBest = q('#start-best');
    this.res = {
      kicker: q('#res-kicker'), score: q('#res-score'), sub: q('#res-sub'), img: q('#res-veh-img'),
      tier: q('#res-tier'), steps: q('#res-steps'),
    };
    this.errorMsg = q('#error-msg');
  }

  showStart(best) { this.startBest.textContent = best; this.start.hidden = false; this.result.hidden = true; }
  hideStart() { this.start.hidden = true; }

  showResult({ score, prevBest, newRecord, tier }, vehicles, spriteUrl) {
    const r = this.res, v = vehicles[tier] || vehicles[0];
    r.kicker.textContent = newRecord ? 'KỶ LỤC MỚI' : 'HẾT LƯỢT';
    r.score.textContent = score;
    r.sub.textContent = newRecord ? `Kỷ lục cũ: ${prevBest} điểm` : `Kỷ lục: ${Math.max(prevBest, score)} điểm`;
    r.img.src = spriteUrl(v.sprite); r.img.alt = v.name;
    r.tier.textContent = `Lên tới cấp ${tier + 1}: ${v.name.charAt(0).toLowerCase() + v.name.slice(1)}`;
    r.steps.textContent = '';
    STEP_NAMES.forEach((n, i) => {
      const d = document.createElement('div');
      d.className = 'step' + (i <= tier ? ' on' : '') + (i === tier ? ' cur' : '');
      d.innerHTML = `<span class="step-dot">${i + 1}</span><span class="step-name"></span>`;
      d.querySelector('.step-name').textContent = n;
      r.steps.appendChild(d);
    });
    this.result.hidden = false;
  }
  hideResult() { this.result.hidden = true; }

  setPaused(on) { this.pauseEl.hidden = !on; }
  setRotate(on) { this.rotateEl.hidden = !on; }
  setLoading(frac) {
    if (frac === null) { this.loadingEl.hidden = true; return; }
    this.loadingEl.hidden = false;
    this.loadFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
  }
  showError(msg, canContinue) {
    if (msg) this.errorMsg.textContent = msg;
    this.errorEl.querySelector('#btn-continue').hidden = !canContinue;
    this.errorEl.hidden = false;
  }
  hideError() { this.errorEl.hidden = true; }
}
