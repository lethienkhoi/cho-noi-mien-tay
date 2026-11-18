// Pháo hoa khi phá kỷ lục: canvas riêng phủ trên màn kết quả, không nhận chạm (pointer-events: none).
// 5 chùm nhiều màu trong ~3 giây rồi tự tắt. prefers-reduced-motion: chỉ 1 chùm.
const COLORS = ['#ffd23f', '#e8402a', '#3fd0c9', '#ff7ac6', '#7be36b', '#ffffff', '#9b7bff', '#ff9f1c'];

export class Fireworks {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.raf = 0; this.parts = []; this.bursts = []; this.t = 0; this.running = false;
  }

  start() {
    this.stop();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = this.cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = reduce ? 1 : 5;
    // lịch nổ: rải đều trong ~2,2s đầu, vị trí phía trên nửa màn
    this.bursts = Array.from({ length: n }, (_, i) => ({
      at: reduce ? 0.1 : 0.08 + i * 0.5 + Math.random() * 0.15,
      x: this.w * (n === 1 ? 0.5 : 0.18 + 0.64 * ((i * 0.61 + Math.random() * 0.3) % 1)),
      y: this.h * (0.14 + Math.random() * 0.26),
      done: false,
    }));
    this.reduce = reduce;
    this.parts = []; this.t = 0; this.last = performance.now();
    this.cv.hidden = false; this.running = true;
    this.raf = requestAnimationFrame((now) => this.tick(now));
  }

  boom(b) {
    const k = this.w / 390, c1 = COLORS[Math.floor(Math.random() * COLORS.length)];
    const c2 = COLORS[Math.floor(Math.random() * COLORS.length)];
    const N = this.reduce ? 44 : 64, sp = (150 + Math.random() * 60) * k;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.12, v = sp * (0.55 + Math.random() * 0.5);
      this.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.1 + Math.random() * 0.6, t: 0,
        c: i % 3 ? c1 : c2, r: (2.8 + Math.random() * 2) * k });
    }
  }

  tick(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.t += dt;
    for (const b of this.bursts) if (!b.done && this.t >= b.at) { b.done = true; this.boom(b); }
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    const g = 120 * (this.w / 390);
    for (const p of this.parts) {
      p.t += dt; p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.max(0, 1 - p.t / p.life);
      if (a <= 0) continue;
      c.globalAlpha = a; c.fillStyle = p.c;
      c.beginPath(); c.arc(p.x, p.y, p.r * (0.6 + 0.4 * a), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.t < p.life);
    if (this.t > 3.2 || (this.bursts.every((b) => b.done) && !this.parts.length)) { this.stop(); return; }
    this.raf = requestAnimationFrame((n) => this.tick(n));
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.parts = [];
    if (this.ctx && this.w) this.ctx.clearRect(0, 0, this.w, this.h);
    this.cv.hidden = true;
  }
}
