// HUD trên cùng: Điểm, Kỷ lục, nhãn phương tiện (giống pv1).
import { CONFIG } from '../config.js?v=b170c2bd';

const pad2 = (n) => String(n).padStart(2, '0');

export class Hud {
  constructor(root, vehicles) {
    this.el = root;
    this.score = root.querySelector('#hud-score');
    this.best = root.querySelector('#hud-best');
    this.veh = root.querySelector('#hud-vehicle');
    this.vehicles = vehicles;
    this.last = '';
  }
  show(on) { this.el.hidden = !on; }
  update(game) {
    const tier = game.tier, v = this.vehicles[tier] || this.vehicles[0];
    let label = v.name;
    if (tier < CONFIG.MAX_TIER && game.state !== 'crash' && game.state !== 'over') {
      const left = CONFIG.PASSES_PER_TIER - (game.passed % CONFIG.PASSES_PER_TIER);
      label += ` · còn ${left} câu nữa lên đời`;
    }
    const key = game.score + '|' + game.liveBest + '|' + label;
    if (key === this.last) return;
    this.last = key;
    this.score.textContent = pad2(game.score);
    this.best.textContent = pad2(game.liveBest);
    this.veh.textContent = label;
  }
}
