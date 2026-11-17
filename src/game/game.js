// Vòng chơi lõi: trạng thái, ghe hàng, nhảy, đụng, điểm, bong bóng chửi. Không vẽ gì ở đây (xem renderer.js).
// B5: bố cục chạy ngang kiểu game khủng long trong khung dọc — ghe mình cố định bên trái, ghe hàng chạy từ phải sang
// trên cùng một làn nước. API giọng nói (B4): game.onPhraseMatched(roundId, { dialect: boolean }).
// Sự kiện (game.addEventListener): state, round, matched, landed, tier, crash, over, pause, taunt.
import { CONFIG } from '../config.js?v=69dfb0d0';
import { PhrasePicker, roundTime, levelForPasses } from './phrases.js?v=69dfb0d0';
import { loadBest, saveBest } from './storage.js?v=69dfb0d0';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smoother = (k) => { k = clamp01(k); return k * k * k * (k * (k * 6 - 15) + 10); };

export class Game extends EventTarget {
  constructor({ phrases, manifest, rnd = Math.random }) {
    super();
    this.data = phrases;
    this.manifest = manifest;
    this.rnd = rnd;
    this.picker = new PhrasePicker(phrases.phrases, rnd);
    this.vendors = manifest.vendors;
    this.state = 'title';
    this.paused = false;
    this.frozen = false;         // chỉ dùng cho QA (chụp giữa cú nhảy)
    this.time = 0;               // giây trôi của cảnh (cả khi ở màn bắt đầu)
    this.best = loadBest();
    this.viewH = 844;            // chiều cao khung (u), renderer cập nhật
    this.insetBottom = 0;        // vùng an toàn dưới (u)
    this.taunts = [];            // bong bóng chửi đang hiện
    this.lastTaunt = {};
    this.resetRun();
  }

  // ---------------------------------------------------------------- vòng đời
  resetRun() {
    this.score = 0; this.passed = 0; this.tier = 0; this.roundSeq = 0;
    this.round = null; this.stall = null; this.lastVendor = null;
    this.jump = null; this.crash = null; this.cocky = 0;
    this.taunts = [];
    this.prevBest = this.best;
    this.picker.reset();
  }

  start() {
    this.resetRun();
    this.best = loadBest(); this.prevBest = this.best;
    this.setState('playing');
    this.newRound();
  }

  toTitle() { this.resetRun(); this.setState('title'); }

  setState(s) {
    this.state = s;
    this.dispatchEvent(new CustomEvent('state', { detail: { state: s } }));
  }

  pause(reason = 'hidden') {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new CustomEvent('pause', { detail: { paused: true, reason } }));
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.dispatchEvent(new CustomEvent('pause', { detail: { paused: false } }));
  }

  // ---------------------------------------------------------------- hình học làn chạy (u)
  get H() { return this.viewH - this.insetBottom; } // mốc đáy để đặt cảnh (trừ vùng an toàn)
  get laneY() {
    const max = this.H - CONFIG.PANEL_MAX_H - CONFIG.LANE_PANEL_GAP;
    return Math.max(CONFIG.LANE_MIN_Y, Math.min(this.viewH * CONFIG.LANE_Y_FRAC, max));
  }
  heroScale(tier = this.tier) {
    const v = this.manifest.vehicles[tier] || this.manifest.vehicles[0];
    const m = this.manifest.sprites[v.play || v.sprite] || { w: 251 };
    return CONFIG.HERO_W / m.w;
  }
  // phần thân ghe mình bên trái / phải tâm (u)
  heroExt() {
    const v = this.manifest.vehicles[this.tier] || this.manifest.vehicles[0];
    const m = this.manifest.sprites[v.play || v.sprite] || { w: 251, ox: 123 };
    const s = this.heroScale();
    return { left: m.ox * s, right: (m.w - m.ox) * s };
  }
  stallScale(key) { const m = this.manifest.sprites[key] || { w: 281 }; return CONFIG.STALL_W / m.w; }
  // ghe hàng lật (mũi quay trái): phần bên trái tâm = (w-ox)*s, bên phải = ox*s
  stallExt(key, s) { const m = this.manifest.sprites[key] || { w: 281, ox: 138 }; return { left: (m.w - m.ox) * s, right: m.ox * s }; }
  get heroPos() { return { x: CONFIG.HERO_X, y: this.laneY, s: this.heroScale() }; }
  // các mốc x (tâm ghe hàng) của vòng hiện tại
  stallMarks(st = this.stall) {
    const e = this.stallExt(st.key, st.s), h = this.heroExt();
    const touch = CONFIG.HERO_X + h.right + e.left;
    return {
      start: CONFIG.DESIGN_W + e.left - 4,          // mũi vừa ló ở mép phải
      near: touch + CONFIG.STALL_GAP,               // thanh thời gian hết
      hit: touch - CONFIG.STALL_OVERLAP,            // hết ân hạn: đụng
      clear: CONFIG.HERO_X - h.left - e.right - 6,  // đã lọt hẳn qua dưới ghe mình
      touch,
    };
  }

  // ---------------------------------------------------------------- vòng câu
  newRound() {
    const phrase = this.picker.pick(this.passed);
    let vendor;
    do { vendor = this.vendors[Math.floor(this.rnd() * this.vendors.length)]; } while (vendor === this.lastVendor && this.vendors.length > 1);
    this.lastVendor = vendor;
    const T = roundTime(phrase, this.passed);
    this.round = { id: ++this.roundSeq, phrase, T, grace: CONFIG.TIME_GRACE, t: 0, level: levelForPasses(this.passed), hold: 0, partialK: 0, partialAt: -1 };
    const key = this.manifest.stallMap[phrase.stall] || 'stall_fruit';
    const s = this.stallScale(key);
    this.stall = { key, vendor, face: 'normal', p: 0, x: 0, y: this.laneY, s, rot: 0, phase: this.rnd() * 6 };
    this.placeStall();
    // bong bóng của ghe trước (đã trôi khỏi màn) bắt đầu mờ khi ghe mới tới, khỏi chỉ nhầm vào ghe mình
    const fadeAt = CONFIG.TAUNT_HOLD + 0.2;
    for (const b of this.taunts) if (b.stall !== this.stall) b.t = Math.max(b.t, fadeAt);
    this.dispatchEvent(new CustomEvent('round', { detail: { ...this.round } }));
  }

  // tốc độ ghe hàng hiện tại (u/giây) và hệ số trôi cảnh
  get stallSpeed() {
    if (!this.round || !this.stall) return 0;
    const m = this.stallMarks();
    return (m.start - m.near) / this.round.T;
  }
  get driftFactor() { return Math.min(CONFIG.SPEED_DRIFT_MAX, 1 + this.passed * 0.06); }

  // vị trí ghe hàng theo thời gian vòng: tới "sát mũi" đúng lúc thanh thời gian hết, rồi nhích nốt trong ân hạn
  placeStall() {
    const r = this.round, st = this.stall;
    if (!r || !st) return;
    const m = this.stallMarks();
    if (r.t <= r.T) { st.p = r.t / r.T; st.x = lerp(m.start, m.near, st.p); }
    else { st.p = 1; st.x = lerp(m.near, m.hit, clamp01((r.t - r.T) / r.grace)); }
    st.y = this.laneY;
  }

  // Gọi từ bộ nhận giọng (src/speech/voice.js) khi đọc khớp câu. Trả true nếu được nhận (kể cả trong ân hạn).
  // Giọng nói báo tiến độ: đã đọc đúng k chữ đầu của câu (k tăng thì ghi lại thời điểm).
  notePartial(roundId, k) {
    const r = this.round;
    if (!r || r.id !== roundId || this.state !== 'playing') return;
    if (k > r.partialK) { r.partialK = k; r.partialAt = this.time; }
  }

  onPhraseMatched(roundId, { dialect = false } = {}) {
    if (this.state !== 'playing' || this.paused || !this.round || roundId !== this.round.id) return false;
    const gained = CONFIG.SCORE_PASS + (dialect ? CONFIG.SCORE_DIALECT_BONUS : 0);
    this.score += gained; this.passed += 1;
    const st = this.stall, m = this.stallMarks();
    st.face = 'shock';
    // đường ghe hàng trong lúc nhảy: tăng tốc mượt (smootherstep), lọt hẳn qua trước khi ghe mình đáp
    const total = CONFIG.JUMP_TIME + CONFIG.EXIT_EXTRA;
    const kClear = smoother((CONFIG.JUMP_TIME * 0.84) / total);
    const x0 = st.x;
    const exit = Math.min(-st.s * 300, x0 - (x0 - m.clear) / kClear);
    this.jump = { t: 0, x0, exit, total, taunted: false, landed: false, grace: this.round.t > this.round.T };
    this.setState('jumping');
    this.dispatchEvent(new CustomEvent('matched', { detail: { roundId, dialect, gained, phrase: this.round.phrase, score: this.score, passed: this.passed, grace: this.jump.grace } }));
    return true;
  }

  get liveBest() { return Math.max(this.best, this.score); }
  get remainingFrac() { return this.round ? clamp01(1 - this.round.t / this.round.T) : 0; }

  // ---------------------------------------------------------------- bong bóng chửi
  pickTaunt(kind) {
    const list = (this.data.taunts && this.data.taunts[kind]) || [];
    if (!list.length) return '';
    let i = Math.floor(this.rnd() * list.length);
    if (list.length > 1 && list[i] === this.lastTaunt[kind]) i = (i + 1) % list.length;
    this.lastTaunt[kind] = list[i];
    return list[i];
  }
  taunt(kind) {
    const st = this.stall; if (!st) return;
    const text = this.pickTaunt(kind); if (!text) return;
    st.face = 'yell';
    this.taunts = [{ kind, text, t: 0, stall: st }]; // mỗi lúc một bong bóng
    this.dispatchEvent(new CustomEvent('taunt', { detail: { kind, text, vendor: st.vendor } }));
  }

  // ---------------------------------------------------------------- cập nhật
  update(dt) {
    if (this.paused || this.frozen) return;
    this.time += dt;
    if (this.cocky > 0) this.cocky -= dt;
    const life = CONFIG.TAUNT_HOLD + CONFIG.TAUNT_FADE + 0.2;
    for (const b of this.taunts) b.t += dt;
    if (this.taunts.length) this.taunts = this.taunts.filter((b) => b.t < life);

    if (this.state === 'playing') {
      const r = this.round;
      // Đang đọc đúng dần mà máy nghe (iPhone) trả chữ chậm: trong lúc ân hạn, ghe hàng dừng sát mũi chờ thêm
      // tối đa HOLD_MAX giây, chỉ khi đã đọc đúng ≥ HOLD_MIN_FRAC số chữ và vừa có chữ mới trong HOLD_FRESH giây.
      const words = r.phrase.phienAm.trim().split(/\s+/).length;
      const holding = r.t >= r.T && r.hold < CONFIG.HOLD_MAX && r.partialK >= Math.ceil(words * CONFIG.HOLD_MIN_FRAC)
        && this.time - r.partialAt < CONFIG.HOLD_FRESH;
      if (holding) r.hold += dt; else r.t += dt;
      this.placeStall();
      if (r.t / r.T >= CONFIG.SHOCK_AT && this.stall.face === 'normal') this.stall.face = 'shock';
      if (r.t >= r.T + r.grace) this.doCrash();
    } else if (this.state === 'jumping') {
      this.updateJump(dt);
    } else if (this.state === 'crash') {
      this.updateCrash(dt);
    }
  }

  updateJump(dt) {
    const j = this.jump, J = CONFIG.JUMP_TIME, st = this.stall;
    j.t += dt;
    st.x = lerp(j.x0, j.exit, smoother(j.t / j.total));
    st.y = this.laneY;
    if (!j.taunted && j.t >= J * 0.38) { j.taunted = true; this.taunt('jumpedOver'); }
    if (j.t >= J && !j.landed) {
      j.landed = true;
      this.cocky = CONFIG.COCKY_TIME;
      const tier = Math.min(CONFIG.MAX_TIER, Math.floor(this.passed / CONFIG.PASSES_PER_TIER));
      if (tier !== this.tier) {
        this.tier = tier;
        this.dispatchEvent(new CustomEvent('tier', { detail: { tier } }));
      }
      this.dispatchEvent(new CustomEvent('landed', { detail: { score: this.score } }));
    }
    if (j.t >= j.total + CONFIG.NEXT_ROUND_DELAY) {
      this.jump = null;
      this.setState('playing');
      this.newRound();
    }
  }

  // độ cao + góc của phương tiện mình khi đang nhảy (cung lên nhanh, xuống êm)
  jumpPose() {
    if (!this.jump) return null;
    const u = clamp01(this.jump.t / CONFIG.JUMP_TIME);
    const arc = Math.sin(Math.PI * Math.pow(u, 0.8));
    return { dy: -CONFIG.JUMP_HEIGHT * arc, dx: CONFIG.JUMP_FORWARD * arc, rot: lerp(-16, 10, u), u };
  }

  doCrash() {
    const st = this.stall, h = this.heroPos, R = this.rnd;
    const m = this.stallMarks();
    const hx = h.x, hy = h.y - 22;
    const foods = ['bowl', 'fish', 'durian'].map((name, i) => ({
      name, x: m.touch - 14 + i * 10, y: h.y - 24 - i * 6,
      vx: -70 + i * 95 + (R() - 0.5) * 40, vy: -430 - R() * 160, rot: R() * 360, vr: (R() < 0.5 ? -1 : 1) * (280 + R() * 300),
    }));
    this.crash = {
      t: 0, done: false, taunted: false,
      at: { x: CONFIG.HERO_X + this.heroExt().right - CONFIG.STALL_OVERLAP / 2, y: h.y - 14 },
      hx, hy, vx: -28, vy: -640, rot: -10, vr: -620,
      hatX: hx + 4, hatY: hy - 34, hvx: 38, hvy: -520, hatRot: 0,
      foods,
      drops: Array.from({ length: 9 }, (_, i) => ({ a: Math.PI * (1.05 + 0.9 * (i / 8)), v: 120 + R() * 140, r: 3 + R() * 4 })),
    };
    st.face = 'shock';
    this.setState('crash');
    this.dispatchEvent(new CustomEvent('crash', { detail: { phrase: this.round.phrase, score: this.score, t: this.round.t } }));
  }

  updateCrash(dt) {
    const c = this.crash;
    c.t += dt;
    c.vy += 1000 * dt; c.hx += c.vx * dt; c.hy += c.vy * dt; c.rot += c.vr * dt;
    c.hvy += 520 * dt; c.hatX += c.hvx * dt; c.hatY += c.hvy * dt; c.hatRot += 380 * dt;
    for (const f of c.foods) { f.vy += 1000 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
    if (!c.taunted && c.t >= 0.12) { c.taunted = true; this.taunt('crash'); }
    if (c.t >= CONFIG.CRASH_TO_RESULT && !c.done) { c.done = true; this.finish(); }
  }

  finish() {
    const prev = this.prevBest;
    const newRecord = this.score > prev;
    if (newRecord) { this.best = this.score; saveBest(this.score); }
    this.setState('over');
    this.dispatchEvent(new CustomEvent('over', { detail: { score: this.score, passed: this.passed, prevBest: prev, best: this.best, newRecord, tier: this.tier } }));
  }
}
