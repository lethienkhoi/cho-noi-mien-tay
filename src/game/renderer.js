// Vẽ cảnh bằng Canvas 2D từ sprite đã nướng sẵn (xem assets.js).
// Toạ độ thế giới: đơn vị u (khung thiết kế rộng 390u như keyframe), chiều cao = chiều cao màn / tỉ lệ.
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;

// mật độ nướng tối đa theo nhóm sprite (= cỡ vẽ lớn nhất trong game)
function maxScale(name) {
  if (name.startsWith('hero_boat') || name.startsWith('veh_')) return Math.max(...CONFIG.HERO_SCALE) * 1.02;
  if (name.startsWith('stall_') || /_(normal|shock|yell)$/.test(name)) return CONFIG.STALL_EXIT.s * 1.02;
  if (name === 'hero_scream' || name === 'nonla') return 1.15;
  return 1;
}

export class Renderer {
  constructor(canvas, assets, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets; this.game = game;
    this.unit = 1; this.dpr = 1; this.W = CONFIG.DESIGN_W; this.H = 844;
    this.names = [];
    this.fps = 60; this._fpsAcc = 0; this._fpsN = 0;
    this.initScenery();
  }

  setSprites(names) { this.names = names; }

  // gọi khi đổi cỡ khung. Trả về true nếu cần nướng lại.
  resize(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
    this.cssW = cssW; this.cssH = cssH;
    this.unit = cssW / CONFIG.DESIGN_W; this.dpr = dpr;
    this.H = cssH / this.unit;
    this.game.viewH = this.H;
    this.cv.width = Math.max(1, Math.round(cssW * dpr));
    this.cv.height = Math.max(1, Math.round(cssH * dpr));
    this.cv.style.width = cssW + 'px'; this.cv.style.height = cssH + 'px';
    if (this.game.stall && this.game.state === 'playing') this.game.placeStall(this.game.stall.p);
  }

  bakeAll() {
    const k0 = this.unit * this.dpr;
    for (const n of this.names) this.assets.bake(n, k0 * maxScale(n));
  }

  initScenery() {
    const R = Math.random;
    this.streaks = Array.from({ length: CONFIG.WATER_STREAKS }, () => ({ x: R() * 420, t: R() ** 1.3, w: 0 }));
    this.twinkles = Array.from({ length: 14 }, () => ({ x: R() * 390, t: R(), ph: R() * 6 }));
    this.far = [0, 1, 2, 3].map((i) => ({ name: 'far_' + i, x: 390 * (0.1 + i * 0.27), flip: i % 2 === 0 }));
    this.mid = [0, 1].map((i) => ({ name: 'mid_' + i, x: 390 * (0.14 + i * 0.5), flip: i === 1 }));
    this.fg = [{ name: 'fg_hyacinth', x: 352, fb: 194 }, { name: 'fg_hyacinth', x: 352 + 330, fb: 150 }];
  }

  // ---------------------------------------------------------------- vẽ sprite
  // đặt GỐC toạ độ hàm vẽ (ox,oy trong manifest) tại (x,y)
  spr(name, x, y, s = 1, { flip = false, rot = 0, alpha = 1 } = {}) {
    const b = this.assets.get(name);
    if (!b) return false;
    const m = b.m, c = this.ctx;
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot * DEG);
    c.scale(flip ? -s : s, s);
    if (alpha !== 1) c.globalAlpha = alpha;
    c.drawImage(b.canvas, -m.ox, -m.oy, m.w, m.h);
    c.restore();
    return true;
  }

  // ---------------------------------------------------------------- khung hình
  frame(dt) {
    if (dt > 0) { this._fpsAcc += dt; this._fpsN++; if (this._fpsAcc > 0.5) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; } }
    const g = this.game, c = this.ctx, H = this.H, W = this.W, HZ = CONFIG.HORIZON;
    const live = !g.paused && !g.frozen;
    const t = g.time;
    c.setTransform(this.unit * this.dpr, 0, 0, this.unit * this.dpr, 0, 0);

    // rung màn khi đụng
    if (g.state === 'crash' && g.crash && g.crash.t < 0.45) {
      const a = (1 - g.crash.t / 0.45) * 7;
      c.translate(Math.sin(t * 90) * a, Math.cos(t * 77) * a * 0.6);
    }

    // nền: trời, bờ, nước (ảnh 390x844; màn dài hơn thì nối màu nước)
    const bgm = this.assets.meta('background');
    c.fillStyle = (this.assets.manifest.background && this.assets.manifest.background.waterBottom) || '#17777a';
    c.fillRect(-20, -20, W + 40, H + 40);
    if (!this.spr('background', 0, 0, 1)) { c.fillStyle = '#8fd3e8'; c.fillRect(0, 0, W, HZ); }
    else if (bgm && H > bgm.h) { /* phần nước dưới đã tô ở trên */ }

    // nước trôi
    const drift = live ? dt : 0;
    c.lineCap = 'round';
    for (const s of this.streaks) {
      const y = HZ + 10 + s.t * (H - HZ - 20), rw = 8 + s.t * 40;
      s.x -= (14 + s.t * 120) * drift;
      if (s.x < -rw) { s.x = W + rw + Math.random() * 60; s.t = Math.random() ** 1.3; }
      c.globalAlpha = 0.22 + s.t * 0.22; c.strokeStyle = '#e8fff8'; c.lineWidth = 1 + s.t * 1.6;
      c.beginPath(); c.moveTo(s.x - rw, y); c.quadraticCurveTo(s.x, y - 2 - s.t * 3, s.x + rw, y); c.stroke();
    }
    c.globalAlpha = 1;

    // ghe xa, ghe trung (đã mờ sẵn)
    for (const b of this.far) {
      b.x -= CONFIG.DRIFT_FAR * drift; if (b.x < -40) b.x += W + 80;
      this.spr(b.name, b.x, HZ + 18 + Math.sin(t * 1.3 + b.x) * 0.6, 1, { flip: b.flip });
    }
    for (const b of this.mid) {
      b.x -= CONFIG.DRIFT_MID * drift; if (b.x < -60) b.x += W + 120;
      this.spr(b.name, b.x, HZ + 52 + Math.sin(t * 1.5 + b.x) * 0.9, 1, { flip: b.flip });
    }

    // lấp lánh
    for (const s of this.twinkles) {
      const y = HZ + 20 + s.t * (H - HZ - 60);
      const a = Math.max(0, Math.sin(t * 2.4 + s.ph));
      if (a < 0.05) continue;
      const r = (2 + s.t * 4) * a;
      c.globalAlpha = 0.85 * a; c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(s.x, y - r * 2); c.lineTo(s.x + r * 0.5, y - r * 0.5); c.lineTo(s.x + r * 2, y); c.lineTo(s.x + r * 0.5, y + r * 0.5);
      c.lineTo(s.x, y + r * 2); c.lineTo(s.x - r * 0.5, y + r * 0.5); c.lineTo(s.x - r * 2, y); c.lineTo(s.x - r * 0.5, y - r * 0.5); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;

    // ghe hàng (sau phương tiện mình)
    if (g.stall && g.state !== 'title') this.drawStall(g.stall, t);

    // phương tiện mình
    this.drawHero(t);

    // tiền cảnh mờ
    for (const f of this.fg) {
      f.x -= CONFIG.DRIFT_FG * drift; if (f.x < -120) f.x += 660;
      this.spr(f.name, f.x, H - f.fb + Math.sin(t * 1.7 + f.x * 0.01) * 2, 1);
    }
    this.spr('fg_branch', 312, -10 + Math.sin(t * 0.9) * 2, 1, { rot: Math.sin(t * 0.8) * 2 });
  }

  drawStall(st, t) {
    const c = this.ctx, a = this.assets;
    const m = a.meta(st.key); if (!m) return;
    const water = (m.anchors && m.anchors.water) || [0, 12];
    const seat = (m.anchors && m.anchors.seat) || [-36, 14];
    const bob = Math.sin(t * 2.1 + st.phase) * 2.2;
    let rot = Math.sin(t * 1.6 + st.phase) * 1.2;
    if (this.game.state === 'crash') rot = 14;
    const ox = st.x, oy = st.y - water[1] * st.s + bob;
    c.save();
    c.translate(ox, oy); c.rotate(rot * DEG); c.scale(-st.s, st.s); // lật: mũi ghe quay về bên trái
    const draw = (name, x, y) => { const b = a.get(name); if (b) c.drawImage(b.canvas, x - b.m.ox, y - b.m.oy, b.m.w, b.m.h); };
    if (m.back) draw(m.back, 0, 0);
    draw(`${st.vendor}_${st.face}`, seat[0], seat[1]);
    draw(st.key, 0, 0);
    c.restore();
  }

  heroSprite() {
    const g = this.game, v = this.assets.manifest.vehicles[g.tier] || this.assets.manifest.vehicles[0];
    if (g.state === 'crash') return v.empty;
    if (g.state === 'jumping' && g.jump && !g.jump.landed) return v.jump || v.cocky;
    if (g.cocky > 0) return v.playCocky || v.cocky;
    return v.play || v.sprite;
  }

  drawHero(t) {
    const g = this.game, h = g.heroPos;
    const name = this.heroSprite();
    const m = this.assets.meta(name);
    const water = (m && m.anchors && m.anchors.water) || [0, 12];
    let x = h.x, y = h.y, rot = Math.sin(t * 2.0) * 1.5 - 2, bob = Math.sin(t * 2.6) * 2.5;
    if (g.state === 'jumping' && g.jump) {
      const p = g.jumpPose();
      if (!g.jump.landed) { x += p.dx; y += p.dy; rot = p.rot; bob = 0; }
    }
    if (g.state === 'crash') { rot = -22; x -= 24; }
    this.spr(name, x, y - water[1] * h.s + bob, h.s, { rot });
    if (g.state === 'crash' && g.crash) {
      const cr = g.crash;
      this.spr('hero_scream', cr.hx, cr.hy, h.s * 0.9, { rot: cr.rot });
      if (g.tier <= 1) this.spr('nonla', cr.hatX, cr.hatY, h.s * 0.85, { rot: cr.hatRot });
    }
  }
}
