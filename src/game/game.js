// Vòng chơi lõi: trạng thái, ghe hàng, nhảy, đụng, điểm. Không vẽ gì ở đây (xem renderer.js).
// API cho B4 (giọng nói): game.onPhraseMatched(roundId, { dialect: boolean })
// Sự kiện (game.addEventListener): state, round, matched, landed, tier, crash, over, pause.
import { CONFIG } from '../config.js';
import { PhrasePicker, roundTime, levelForPasses } from './phrases.js';
import { loadBest, saveBest } from './storage.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - (1 - t) * (1 - t);

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
    this.resetRun();
  }

  // ---------------------------------------------------------------- vòng đời
  resetRun() {
    this.score = 0; this.passed = 0; this.tier = 0; this.roundSeq = 0;
    this.round = null; this.stall = null; this.lastVendor = null;
    this.jump = null; this.crash = null; this.cocky = 0; this.afterJump = null;
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

  // ---------------------------------------------------------------- vòng câu
  newRound() {
    const phrase = this.picker.pick(this.passed);
    let vendor;
    do { vendor = this.vendors[Math.floor(this.rnd() * this.vendors.length)]; } while (vendor === this.lastVendor && this.vendors.length > 1);
    this.lastVendor = vendor;
    const T = roundTime(phrase, this.passed);
    this.round = { id: ++this.roundSeq, phrase, T, t: 0, level: levelForPasses(this.passed) };
    this.stall = {
      key: this.manifest.stallMap[phrase.stall] || 'stall_fruit',
      vendor, face: 'normal', p: 0, x: 0, y: 0, s: 1, phase: this.rnd() * 6,
    };
    this.placeStall(0);
    this.dispatchEvent(new CustomEvent('round', { detail: { ...this.round } }));
  }

  // Thay cho chạm ở B4. Trả true nếu được nhận.
  onPhraseMatched(roundId, { dialect = false } = {}) {
    if (this.state !== 'playing' || this.paused || !this.round || roundId !== this.round.id) return false;
    const gained = CONFIG.SCORE_PASS + (dialect ? CONFIG.SCORE_DIALECT_BONUS : 0);
    this.score += gained; this.passed += 1;
    const st = this.stall;
    st.face = 'yell';
    this.jump = { t: 0, from: { x: st.x, fb: this.H - st.y, s: st.s } };
    this.setState('jumping');
    this.dispatchEvent(new CustomEvent('matched', { detail: { roundId, dialect, gained, phrase: this.round.phrase, score: this.score, passed: this.passed } }));
    return true;
  }

  // điều khiển tạm B3: chạm = đọc đúng
  tap() {
    if (this.state === 'playing' && this.round) return this.onPhraseMatched(this.round.id, { dialect: false });
    return false;
  }

  get H() { return this.viewH - this.insetBottom; } // mốc đáy để đặt cảnh (trừ vùng an toàn)
  get liveBest() { return Math.max(this.best, this.score); }
  get remainingFrac() { return this.round ? clamp01(1 - this.round.t / this.round.T) : 0; }
  get heroPos() {
    return { x: CONFIG.HERO_X, y: this.H - CONFIG.HERO_FROM_BOTTOM, s: CONFIG.HERO_SCALE[this.tier] };
  }

  posAt(a, b, t) { // a,b: {x, fromBottom, s}
    return { x: lerp(a.x, b.x, t), y: this.H - lerp(a.fromBottom, b.fromBottom, t), s: lerp(a.s, b.s, t) };
  }
  placeStall(p) {
    const q = this.posAt(CONFIG.STALL_START, CONFIG.STALL_HIT, p);
    Object.assign(this.stall, q, { p });
  }

  // ---------------------------------------------------------------- cập nhật
  update(dt) {
    if (this.paused || this.frozen) return;
    this.time += dt;
    if (this.cocky > 0) this.cocky -= dt;

    if (this.state === 'playing') {
      const r = this.round;
      r.t += dt;
      const p = clamp01(r.t / r.T);
      this.placeStall(p);
      if (p >= CONFIG.SHOCK_AT && this.stall.face === 'normal') this.stall.face = 'shock';
      if (r.t >= r.T) this.doCrash();
    } else if (this.state === 'jumping') {
      this.updateJump(dt);
    } else if (this.state === 'crash') {
      const c = this.crash;
      c.t += dt;
      c.vy += 900 * dt; c.hx += c.vx * dt; c.hy += c.vy * dt; c.rot += c.vr * dt;
      c.hatX += c.vx * 1.25 * dt; c.hatY += (c.vy - 160) * dt; c.hatRot += 320 * dt;
      if (c.t >= CONFIG.CRASH_TO_RESULT && !c.done) { c.done = true; this.finish(); }
    }
  }

  updateJump(dt) {
    const j = this.jump, J = CONFIG.JUMP_TIME, st = this.stall;
    j.t += dt;
    // ghe hàng: tới điểm đụng rồi trôi tiếp ra khỏi màn bên trái
    const tu = J * 0.3, tEnd = J + CONFIG.EXIT_EXTRA;
    if (j.t <= tu) {
      const k = easeOut(j.t / tu);
      const a = { x: j.from.x, fromBottom: j.from.fb, s: j.from.s };
      Object.assign(st, this.posAt(a, CONFIG.STALL_HIT, k));
    } else {
      Object.assign(st, this.posAt(CONFIG.STALL_HIT, CONFIG.STALL_EXIT, clamp01((j.t - tu) / (tEnd - tu))));
    }
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
    if (j.t >= tEnd + CONFIG.NEXT_ROUND_DELAY) {
      this.jump = null;
      this.setState('playing');
      this.newRound();
    }
  }

  // độ cao + góc của phương tiện mình khi đang nhảy
  jumpPose() {
    if (!this.jump) return null;
    const u = clamp01(this.jump.t / CONFIG.JUMP_TIME);
    return { dy: -CONFIG.JUMP_HEIGHT * Math.sin(Math.PI * u), dx: CONFIG.JUMP_FORWARD * Math.sin(Math.PI * u), rot: lerp(-18, 10, u), u };
  }

  doCrash() {
    const st = this.stall, h = this.heroPos;
    st.face = 'yell';
    this.crash = {
      t: 0, hx: h.x, hy: h.y - 60 * h.s, vx: 30, vy: -600, rot: -20, vr: -160,
      hatX: h.x + 20, hatY: h.y - 150 * h.s, hatRot: 0, done: false,
    };
    this.setState('crash');
    this.dispatchEvent(new CustomEvent('crash', { detail: { phrase: this.round.phrase, score: this.score } }));
  }

  finish() {
    const prev = this.prevBest;
    const newRecord = this.score > prev;
    if (newRecord) { this.best = this.score; saveBest(this.score); }
    this.setState('over');
    this.dispatchEvent(new CustomEvent('over', { detail: { score: this.score, passed: this.passed, prevBest: prev, best: this.best, newRecord, tier: this.tier } }));
  }
}
