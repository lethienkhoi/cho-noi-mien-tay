// Vẽ cảnh bằng Canvas 2D từ sprite đã nướng sẵn (xem assets.js).
// Toạ độ thế giới: đơn vị u (khung thiết kế rộng 390u như keyframe), chiều cao = chiều cao màn / tỉ lệ.
import { CONFIG } from '../config.js?v=c077d626';

const DEG = Math.PI / 180;

// mật độ nướng tối đa theo nhóm sprite (= cỡ vẽ lớn nhất trong game, B5: ghe nhỏ chạy ngang)
function maxScale(name, man) {
  if (name.startsWith('hero_boat') || name.startsWith('veh_')) {
    const minW = Math.min(...man.vehicles.map((v) => (man.sprites[v.play || v.sprite] || { w: 234 }).w));
    return (CONFIG.HERO_W / minW) * 1.05;
  }
  if (name.startsWith('stall_') || /_(normal|shock|yell)$/.test(name)) return (CONFIG.STALL_W / 281) * 1.05;
  if (name === 'hero_scream' || name === 'nonla') return 0.5;
  if (name === 'bowl' || name === 'fish' || name === 'durian') return 0.8;
  return 1;
}

const OUT = '#2a2420';
const easeOutBack = (k) => { const c = 1.9; k = Math.min(1, Math.max(0, k)) - 1; return 1 + (c + 1) * k * k * k + c * k * k; };

export class Renderer {
  constructor(canvas, assets, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets; this.game = game;
    this.unit = 1; this.dpr = 1; this.W = CONFIG.DESIGN_W; this.H = 844;
    this.names = [];
    this.uiTop = 100; this.uiBottom = 680; // mép dưới HUD / mép trên khung chữ (u), main.js đo
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
    if (this.game.stall && this.game.state === 'playing') this.game.placeStall();
  }

  bakeAll() {
    const k0 = this.unit * this.dpr;
    for (const n of this.names) this.assets.bake(n, k0 * maxScale(n, this.assets.manifest));
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
    if (g.state === 'crash' && g.crash && g.crash.t < CONFIG.SHAKE_TIME) {
      const a = (1 - g.crash.t / CONFIG.SHAKE_TIME) * 8;
      c.translate(Math.sin(t * 90) * a, Math.cos(t * 77) * a * 0.6);
    }

    // nền: trời, bờ, nước (ảnh 390x844; màn dài hơn thì nối màu nước)
    const bgm = this.assets.meta('background');
    c.fillStyle = (this.assets.manifest.background && this.assets.manifest.background.waterBottom) || '#17777a';
    c.fillRect(-20, -20, W + 40, H + 40);
    if (!this.spr('background', 0, 0, 1)) { c.fillStyle = '#8fd3e8'; c.fillRect(0, 0, W, HZ); }
    else if (bgm && H > bgm.h) { /* phần nước dưới đã tô ở trên */ }

    // nước trôi
    const drift = live ? dt * g.driftFactor : 0;
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
      this.spr(b.name, b.x, HZ + 50 + Math.sin(t * 1.5 + b.x) * 0.9, 0.8, { flip: b.flip }); // nhỏ hơn ghe trên làn cho rõ xa gần
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
    if (g.state === 'crash' || (g.state === 'over' && g.crash)) this.drawCrashFx();

    // tiền cảnh mờ
    for (const f of this.fg) {
      f.x -= CONFIG.DRIFT_FG * drift; if (f.x < -120) f.x += 660;
      this.spr(f.name, f.x, H - f.fb + Math.sin(t * 1.7 + f.x * 0.01) * 2, 1);
    }
    this.spr('fg_branch', 312, -10 + Math.sin(t * 0.9) * 2, 1, { rot: Math.sin(t * 0.8) * 2 });

    // trên cùng: chữ RẦM! và bong bóng chửi (không bị tiền cảnh che)
    if (g.crash && (g.state === 'crash' || g.state === 'over')) this.drawBoom(g.crash);
    for (const b of g.taunts) this.drawTaunt(b);
  }

  drawStall(st, t) {
    const c = this.ctx, a = this.assets;
    const m = a.meta(st.key); if (!m) return;
    const water = (m.anchors && m.anchors.water) || [0, 12];
    const seat = (m.anchors && m.anchors.seat) || [-36, 14];
    const bob = Math.sin(t * 2.1 + st.phase) * 2.2;
    let rot = Math.sin(t * 1.6 + st.phase) * 1.2;
    if (this.game.state === 'crash' || this.game.state === 'over') rot = 12;
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
    let x = h.x, y = h.y, rot = Math.sin(t * 2.0) * 1.5 - 1, bob = Math.sin(t * 2.6) * 1.6;
    if (g.state === 'jumping' && g.jump) {
      const p = g.jumpPose();
      if (!g.jump.landed) { x += p.dx; y += p.dy; rot = p.rot; bob = 0; }
    }
    const crashed = g.crash && (g.state === 'crash' || g.state === 'over');
    if (crashed) { rot = -14; x -= 6; }
    this.spr(name, x, y - water[1] * h.s + bob, h.s, { rot });
    if (crashed && g.state === 'crash') { // bảng kết quả hiện thì thôi vẽ người/đồ đang rơi
      const cr = g.crash;
      this.spr('hero_scream', cr.hx, cr.hy, h.s * 1.05, { rot: cr.rot });
      if (g.tier <= 1) this.spr('nonla', cr.hatX, cr.hatY, h.s * 1.0, { rot: cr.hatRot });
      for (const f of cr.foods) this.spr(f.name, f.x, f.y, 0.62, { rot: f.rot });
    }
  }

  // bọt nước tròn trắng viền đậm tại điểm va
  drawCrashFx() {
    const c = this.ctx, cr = this.game.crash, t = cr.t, at = cr.at;
    if (t > 0.9) return;
    c.save();
    c.lineWidth = 2.4; c.strokeStyle = OUT; c.fillStyle = '#ffffff';
    const k = Math.min(1, t / 0.35), fade = Math.max(0, 1 - Math.max(0, t - 0.45) / 0.45);
    // vòng bọt dưới chân hai ghe
    const ring = [[-26, 4, 9], [-12, -6, 12], [4, -10, 14], [20, -5, 11], [33, 4, 8], [-38, 8, 6], [44, 9, 6]];
    for (const [dx, dy, r] of ring) {
      const rr = r * (0.4 + 0.8 * k) * fade; if (rr < 0.6) continue;
      c.beginPath(); c.arc(at.x + dx * (0.6 + 0.6 * k), at.y + 10 + dy * (0.5 + k), rr, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    // giọt bắn tung
    for (const d of cr.drops) {
      const x = at.x + Math.cos(d.a) * d.v * t, y = at.y + Math.sin(d.a) * d.v * t + 520 * t * t;
      const rr = d.r * (1 - t / 0.9); if (rr < 0.5) continue;
      c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.restore();
  }

  // chữ RẦM! trên sao vàng viền đậm, bật ra tại điểm va
  drawBoom(cr) {
    const c = this.ctx, t = cr.t;
    const s = t < 0.18 ? easeOutBack(t / 0.18) : 1 + Math.sin((t - 0.18) * 9) * 0.03 * Math.max(0, 1 - t);
    if (s <= 0.01) return;
    const x = cr.at.x - 4, y = cr.at.y - 58;
    this.boomRight = x + 62;
    c.save();
    c.translate(x, y); c.rotate(-8 * DEG); c.scale(s, s);
    const n = 11, R1 = 50, R2 = 33;
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? R2 : R1 * (i % 4 === 0 ? 1 : 0.88);
      c.lineTo(Math.cos(a) * r * 1.18, Math.sin(a) * r * 0.86);
    }
    c.closePath();
    c.fillStyle = '#ffd23f'; c.fill();
    c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
    c.font = `800 27px 'Baloo 2', 'Arial Rounded MT Bold', sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeStyle = OUT; c.strokeText('RẦM!', 0, 3);
    c.fillStyle = '#e8402a'; c.fillText('RẦM!', 0, 3);
    c.restore();
  }

  // đỉnh đầu người bán trên màn (u)
  vendorHead(st) {
    const m = this.assets.meta(st.key), vm = this.assets.meta(`${st.vendor}_yell`);
    const seat = (m && m.anchors && m.anchors.seat) || [-36, 14];
    const water = (m && m.anchors && m.anchors.water) || [0, 12];
    const oy = st.y - water[1] * st.s;
    return { x: st.x - seat[0] * st.s, y: oy + seat[1] * st.s - ((vm && vm.oy) || 200) * st.s * 0.92 };
  }

  wrap(text, maxW) {
    const c = this.ctx, words = text.split(/\s+/), lines = [];
    let cur = '';
    for (const w of words) {
      const tryL = cur ? cur + ' ' + w : w;
      if (c.measureText(tryL).width <= maxW || !cur) cur = tryL; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // bong bóng chửi: trắng viền đậm, đuôi chỉ vào người bán, nảy vào, giữ rồi mờ; bám theo ghe hàng
  drawTaunt(b) {
    const c = this.ctx, W = this.W, F = CONFIG.TAUNT_FONT;
    const life = CONFIG.TAUNT_HOLD + 0.2;
    const alpha = b.t < life ? 1 : Math.max(0, 1 - (b.t - life) / CONFIG.TAUNT_FADE);
    if (alpha <= 0) return;
    const pop = b.t < 0.2 ? easeOutBack(b.t / 0.2) : 1;
    c.save();
    c.font = `800 ${F}px 'Baloo 2', 'Arial Rounded MT Bold', sans-serif`;
    const padX = 12, padY = 7, lh = F * 1.12;
    const lines = this.wrap(b.text, CONFIG.TAUNT_MAX_W - padX * 2);
    const tw = Math.max(...lines.map((l) => c.measureText(l).width));
    const bw = Math.ceil(tw + padX * 2), bh = Math.ceil(lines.length * lh + padY * 2);
    const head = this.vendorHead(b.stall);
    const M = 8, tail = 16;
    const tipX = Math.max(M + 6, Math.min(W - M - 6, head.x));
    let bottom = head.y - 4 - tail;
    bottom = Math.max(this.uiTop + 6 + bh, Math.min(this.uiBottom - 6, bottom));
    let want = head.x + bw * 0.12;
    if (b.kind === 'crash') { want = Math.max(head.x + bw * 0.3, (this.boomRight || 0) + bw / 2 + 4); bottom = Math.min(bottom, head.y - 30); }
    const cx = Math.max(M + bw / 2, Math.min(W - M - bw / 2, want));
    const tipY = Math.max(bottom + 8, Math.min(head.y - 4, bottom + tail));
    const L = cx - bw / 2, R = cx + bw / 2, T = bottom - bh, B = bottom, rad = 13;
    const tb = Math.max(L + rad + 4, Math.min(R - rad - 22, tipX - 8)); // chân đuôi
    this.lastTaunt = { L, R, T, B, tipX, tipY, lines: lines.length, kind: b.kind, text: b.text };
    c.globalAlpha = alpha;
    c.translate(tipX, tipY); c.scale(pop, pop); c.translate(-tipX, -tipY);
    c.beginPath();
    c.moveTo(L + rad, T); c.lineTo(R - rad, T); c.quadraticCurveTo(R, T, R, T + rad);
    c.lineTo(R, B - rad); c.quadraticCurveTo(R, B, R - rad, B);
    c.lineTo(tb + 18, B); c.lineTo(tipX, tipY); c.lineTo(tb, B);
    c.lineTo(L + rad, B); c.quadraticCurveTo(L, B, L, B - rad);
    c.lineTo(L, T + rad); c.quadraticCurveTo(L, T, L + rad, T); c.closePath();
    c.fillStyle = '#ffffff'; c.fill();
    c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = b.kind === 'crash' ? '#c2331c' : OUT;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, cx, T + padY + lh * (i + 0.5) + 1));
    c.restore();
  }
}
