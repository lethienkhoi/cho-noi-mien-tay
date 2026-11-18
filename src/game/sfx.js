// Âm thanh (B6): tiếng động + nhạc nền tự tổng hợp bằng Web Audio, giọng chửi của người bán (file MP3 tạo sẵn).
// Một AudioContext dùng chung cho mọi âm thanh của game (bộ nghe trong src/speech/ dùng AudioContext riêng cho micro).
//
// Đường tín hiệu: [tiếng động] -> sfxBus ┐
//                 [nhạc nền]   -> musicBus ┼-> master -> limiter -> loa
//                 [giọng chửi] -> voiceBus ┘
// Chế độ (nút loa, nhớ trong localStorage): 'all' bật hết · 'sfx' tắt nhạc · 'off' tắt hết.
// Nhạc nền: mặc định bật, nhỏ ở màn bắt đầu/kết quả; trong lúc chơi (micro đang nghe) hạ xuống rất nhỏ (MUSIC_RUN)
// để không lấn tiếng người chơi và bộ nghe không nghe nhầm; khi người bán chửi thì hạ thêm (ducking).
// Giọng chửi: assets/audio/taunts/manifest.json; file thu tay trong assets/audio/taunts_custom/ (manifest.json liệt kê)
// được ưu tiên. Nạp lười: mỗi câu ghe mới, game chọn trước câu chửi -> prefetch() tải + giải mã đúng 2 file.
// Chưa tải xong lúc cần phát thì bỏ qua, không chờ.

const LS_KEY = 'choNoiMienTay.sound.v1';
const MODES = ['all', 'sfx', 'off'];
const ROOT = new URL('../../', import.meta.url);
const TAUNT_DIR = new URL('assets/audio/taunts/', ROOT);
const CUSTOM_DIR = new URL('assets/audio/taunts_custom/', ROOT);

const MASTER = 0.9;
const MUSIC_BASE = 0.16;   // màn bắt đầu / kết quả
const MUSIC_RUN = 0.045;   // đang chơi, micro đang nghe (≈ -11 dB so với MUSIC_BASE)
const MUSIC_DUCK = 0.25;   // nhân thêm khi người bán chửi
const SFX_GAIN = 0.8;
const VOICE_GAIN = 1.0;
const CACHE_MAX = 16;      // số câu chửi đã giải mã giữ trong bộ nhớ

function readMode() {
  try { const m = localStorage.getItem(LS_KEY); return MODES.includes(m) ? m : 'all'; } catch (e) { return 'all'; }
}
function saveMode(m) { try { localStorage.setItem(LS_KEY, m); } catch (e) { /* chế độ riêng tư: chỉ nhớ trong phiên */ } }

// ---------------------------------------------------------------- nhạc nền: vòng lặp ngũ cung kiểu đờn tranh + đờn kìm
// Hơi Bắc (vui): hò xự xang xê cống ~ G A C D E. 116 nhịp/phút, 8 ô nhịp 4/4 (16,6 s), móc đơn = 1 ô lưới.
// Đờn tranh: tiếng gảy tổng hợp cộng hoạ âm, nốt dài có luyến lên (vuốt) và rung (nhấn). Đờn kìm: bè trầm.
// Song lang: tiếng gõ gỗ phách 2 và 4. Đuôi nốt quấn vòng về đầu bộ đệm nên vòng lặp liền, không có tiếng tách.
const MEL = [
  'G4 A4 C5 - A4 G4 E4 G4', 'A4 - - G4 A4 C5 D5 -', 'E5 D5 C5 A4 C5 - A4 G4', 'E4 G4 A4 - G4 - - .',
  'C5 D5 E5 - D5 C5 A4 C5', 'D5 - C5 A4 G4 A4 C5 -', 'A4 G4 E4 G4 A4 C5 A4 G4', 'E4 - D4 E4 G4 - - .',
];
const BASS = ['C3', 'A2', 'C3', 'G2', 'C3', 'D3', 'A2', 'G2'];
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n) => 12 * (parseInt(n.slice(1), 10) + 1) + NOTE[n[0]];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function renderMusic(sr) {
  const BPM = 116, step = 60 / BPM / 2, steps = MEL.length * 8, len = Math.round(steps * step * sr);
  const out = new Float32Array(len);
  // gảy dây: cộng hoạ âm, tắt dần (hoạ âm cao tắt nhanh hơn), luyến từ dưới lên và rung sau 0,18s cho nốt dài
  const pluck = (t0, m, dur, amp, { harm = 5, bright = 1.1, decay = 0.55, slide = 0, vib = 0 } = {}) => {
    const f0 = hz(m), n0 = Math.round(t0 * sr), n = Math.round(Math.min(dur + decay * 2.2, 3) * sr);
    const ph = new Float64Array(harm), a = [], tau = [];
    for (let h = 0; h < harm; h++) { a.push(amp / Math.pow(h + 1, bright)); tau.push(decay / (1 + 0.7 * h)); }
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let semi = 0;
      if (slide && t < 0.07) semi = -slide * (1 - t / 0.07);
      if (vib && t > 0.18) semi += vib * Math.sin(2 * Math.PI * 5.2 * (t - 0.18)) * Math.min(1, (t - 0.18) / 0.15);
      const f = f0 * Math.pow(2, semi / 12);
      const att = t < 0.004 ? t / 0.004 : 1;
      const rel = t > dur + decay * 1.6 ? Math.max(0, 1 - (t - dur - decay * 1.6) / (decay * 0.6)) : 1;
      let s = 0;
      for (let h = 0; h < harm; h++) {
        ph[h] += 2 * Math.PI * f * (h + 1) / sr;
        s += a[h] * Math.exp(-t / tau[h]) * Math.sin(ph[h]);
      }
      out[(n0 + i) % len] += s * att * rel;
    }
  };
  // song lang (gỗ): tiếng gõ khô ngắn
  const wood = (t0, f, amp) => {
    const n0 = Math.round(t0 * sr), n = Math.round(0.06 * sr);
    let seed = 12345 + n0;
    for (let i = 0; i < n; i++) {
      const t = i / sr; seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const nz = (seed / 0x7fffffff) * 2 - 1;
      out[(n0 + i) % len] += amp * Math.exp(-t / 0.012) * (0.75 * Math.sin(2 * Math.PI * f * t) + 0.25 * nz);
    }
  };
  MEL.forEach((bar, b) => {
    const toks = bar.split(/\s+/);
    toks.forEach((tok, k) => {
      if (tok === '-' || tok === '.') return;
      let d = 1; while (toks[k + d] === '-') d++;
      const t0 = (b * 8 + k) * step, long = d >= 2;
      pluck(t0, midi(tok), d * step, 0.2, { harm: 5, bright: 1.05, decay: long ? 0.7 : 0.42, slide: long && k % 2 === 0 ? 2 : 0, vib: long ? 0.35 : 0 });
      if (k % 4 === 0 && !long) pluck(t0 + 0.035, midi(tok) - 12, step, 0.05, { harm: 3, decay: 0.3 }); // tiếng phụ một quãng tám dưới
    });
    const root = midi(BASS[b]);
    pluck(b * 8 * step, root, 2 * step, 0.2, { harm: 4, bright: 1.4, decay: 0.5 });
    pluck((b * 8 + 4) * step, root + 7, 2 * step, 0.15, { harm: 4, bright: 1.4, decay: 0.45 });
    pluck((b * 8 + 6) * step, root + 12, step, 0.09, { harm: 4, bright: 1.4, decay: 0.3 });
    for (const k of [2, 6]) wood((b * 8 + k) * step, 1750, 0.16);
    wood((b * 8 + 7) * step, 1750, 0.07);
    wood(b * 8 * step, 520, 0.12);
  });
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = peak > 0 ? 0.9 / peak : 1; for (let i = 0; i < len; i++) out[i] *= k;
  return out;
}

// ---------------------------------------------------------------- bộ âm thanh
class Sound {
  constructor() {
    this.ctx = null;
    this.mode = readMode();
    this.counts = {};               // QA: số lần mỗi tiếng được gọi (kể cả khi đang tắt tiếng)
    this.log = [];                  // QA: 200 lần gọi gần nhất {n, t, mode, played}
    this.inRun = false;             // đang chơi: micro đang nghe -> nhạc rất nhỏ
    this.duckUntil = 0;
    this.music = null;              // { buf, src }
    this.taunts = null;             // manifest
    this.custom = new Set();        // tên file trong taunts_custom
    this.tauntsLoading = null;
    this.buffers = new Map();       // url -> Promise<AudioBuffer|null> (LRU)
    this.listeners = new Set();
    this.hidden = typeof document !== 'undefined' && document.hidden;
  }

  // ---- đếm cho QA
  note(n, played) {
    this.counts[n] = (this.counts[n] || 0) + 1;
    this.log.push({ n, t: Math.round(performance.now()), mode: this.mode, played: !!played });
    if (this.log.length > 200) this.log.shift();
  }

  // ---- mở khoá: GỌI TRONG CỬ CHỈ BẤM (iOS chỉ cho phát tiếng sau cú chạm)
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -10; this.limiter.knee.value = 6; this.limiter.ratio.value = 8;
        this.limiter.attack.value = 0.003; this.limiter.release.value = 0.2;
        this.master = ctx.createGain(); this.master.gain.value = this.mode === 'off' ? 0 : MASTER;
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = SFX_GAIN;
        this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = VOICE_GAIN;
        this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0;
        this.sfxBus.connect(this.master); this.voiceBus.connect(this.master); this.musicBus.connect(this.master);
        this.master.connect(this.limiter); this.limiter.connect(ctx.destination);
        const nb = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noise = nb;
        // iOS: chuyển phiên âm thanh khi bật micro có thể làm context bị 'interrupted' -> thử chạy lại
        ctx.onstatechange = () => { if (ctx.state !== 'running' && ctx.state !== 'closed' && !this.hidden) ctx.resume().catch(() => {}); };
      }
      const ctx = this.ctx;
      if (ctx.state !== 'running' && !this.hidden) ctx.resume().catch(() => {});
      // iOS cũ: phát một mẫu im lặng ngay trong cú bấm để mở khoá hẳn
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      this.ensureMusic();
    } catch (e) { console.info('[cho-noi] âm thanh không mở được', e); }
  }

  get ready() { return !!(this.ctx && this.ctx.state === 'running'); }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---- chế độ
  setMode(m) {
    if (!MODES.includes(m)) return;
    this.mode = m; saveMode(m);
    if (this.master) this.master.gain.setTargetAtTime(m === 'off' ? 0 : MASTER, this.now, 0.03);
    this.ensureMusic(); this.updateMusic();
    for (const f of this.listeners) f(m);
  }
  cycleMode() { const m = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]; this.setMode(m); return m; }
  onMode(f) { this.listeners.add(f); }

  // ---- tab ẩn: tắt tiếng hẳn (suspend), quay lại thì chạy tiếp
  setHidden(h) {
    this.hidden = h;
    if (!this.ctx) return;
    if (h) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  // ---- nhạc nền
  ensureMusic() {
    if (!this.ctx || this.music || this.mode !== 'all') return;
    this.music = { buf: null, src: null };
    // dựng vòng lặp sau cú bấm (không làm chậm cử chỉ), ~16 s mono 22,05 kHz
    setTimeout(() => {
      try {
        const sr = 22050, data = renderMusic(sr);
        const buf = this.ctx.createBuffer(1, data.length, sr);
        buf.getChannelData(0).set(data);
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const tone = this.ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200;
        src.connect(tone); tone.connect(this.musicBus);
        src.start(this.now + 0.05);
        this.music = { buf, src };
        this.note('musicStart', this.mode === 'all');
        this.updateMusic();
      } catch (e) { console.info('[cho-noi] nhạc nền lỗi', e); }
    }, 30);
  }
  // đang chơi (micro mở) hay không: gọi từ main theo trạng thái game
  setRun(on) { if (this.inRun !== on) { this.inRun = on; this.updateMusic(); } }
  musicLevel() {
    if (this.mode !== 'all') return 0;
    let g = this.inRun ? MUSIC_RUN : MUSIC_BASE;
    if (this.now < this.duckUntil) g *= MUSIC_DUCK;
    return g;
  }
  updateMusic() {
    if (!this.musicBus) return;
    const t = this.now;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(this.musicLevel(), t, 0.12);
    if (this.now < this.duckUntil) {
      const back = this.duckUntil;
      this.musicBus.gain.setTargetAtTime(this.mode === 'all' ? (this.inRun ? MUSIC_RUN : MUSIC_BASE) : 0, back, 0.25);
    }
  }
  duck(sec) { this.duckUntil = Math.max(this.duckUntil, this.now + sec); this.updateMusic(); }
  get musicGainNow() { return this.musicBus ? this.musicBus.gain.value : 0; }

  // ---- khối dựng tiếng
  canPlay() { return !!(this.ctx && this.mode !== 'off' && !this.hidden); }
  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  osc(type, f0, f1, t, dur, peak, { a = 0.005, to = this.sfxBus } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, a, peak, dur);
    o.connect(g); g.connect(to); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  noiseHit(t, dur, peak, { type = 'bandpass', f0 = 1000, f1 = 0, q = 1, a = 0.004, to = this.sfxBus, rate = 1 } = {}) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = rate;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
    this.env(g, t, a, peak, dur);
    s.connect(f); f.connect(g); g.connect(to);
    const off = Math.random() * 0.5;
    s.start(t, off); s.stop(t + a + dur + 0.05);
  }

  // ---- tiếng động
  // mái chèo khua nước (nhẹ, trầm, để không lẫn với giọng người chơi)
  paddle() {
    const ok = this.canPlay(); this.note('paddle', ok); if (!ok) return;
    const t = this.now + 0.01;
    this.noiseHit(t, 0.22, 0.05, { f0: 520, f1: 900, q: 1.4, a: 0.04 });
    this.noiseHit(t + 0.05, 0.14, 0.02, { type: 'lowpass', f0: 400, q: 0.7, a: 0.02 });
    this.osc('sine', 210, 140, t + 0.02, 0.09, 0.025);
  }
  // vút khi nhảy
  whoosh() {
    const ok = this.canPlay(); this.note('whoosh', ok); if (!ok) return;
    const t = this.now + 0.005;
    this.noiseHit(t, 0.3, 0.2, { f0: 380, f1: 2600, q: 2.2, a: 0.08 });
    this.osc('sine', 320, 760, t, 0.22, 0.03, { a: 0.06 });
  }
  // tõm + bọt nước khi đáp
  splash() {
    const ok = this.canPlay(); this.note('splash', ok); if (!ok) return;
    const t = this.now + 0.005;
    this.osc('sine', 520, 120, t, 0.16, 0.32, { a: 0.004 });
    this.noiseHit(t + 0.01, 0.38, 0.12, { type: 'highpass', f0: 1400, q: 0.6, a: 0.01 });
    this.noiseHit(t, 0.2, 0.1, { type: 'lowpass', f0: 700, q: 0.8, a: 0.005 });
    for (let i = 0; i < 5; i++) {                          // bọt: tiếng "bóc" nhỏ đi lên
      const tt = t + 0.08 + i * 0.045 + Math.random() * 0.03, f = 650 + Math.random() * 900;
      this.osc('sine', f, f * 1.6, tt, 0.04, 0.045, { a: 0.003 });
    }
  }
  // ting khi qua ghe; dialect: "ting ting" cao hơn (Chuẩn miền Tây)
  ting(dialect = false) {
    const n = dialect ? 'ting2' : 'ting'; const ok = this.canPlay(); this.note(n, ok); if (!ok) return;
    const t = this.now + 0.03;
    const bell = (tt, f, p) => { this.osc('sine', f, f, tt, 0.5, p, { a: 0.003 }); this.osc('sine', f * 2.01, f * 2.01, tt, 0.18, p * 0.25, { a: 0.003 }); this.osc('triangle', f * 3, f * 3, tt, 0.06, p * 0.08, { a: 0.002 }); };
    if (!dialect) bell(t, 1318.5, 0.16);                   // E6
    else { bell(t, 1568, 0.15); bell(t + 0.1, 2093, 0.15); } // G6 rồi C7
  }
  // RẦM: tiếng đục + gỗ nứt + nước văng; kèm rung máy (Android) cho có cảm giác
  crash() {
    const ok = this.canPlay(); this.note('crash', ok);
    try { if (this.mode !== 'off' && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([90, 40, 60]); } catch (e) { /* bỏ qua */ }
    if (!ok) return;
    const t = this.now + 0.005;
    this.osc('sine', 110, 38, t, 0.45, 0.6, { a: 0.003 });
    this.osc('triangle', 70, 45, t, 0.3, 0.25, { a: 0.003 });
    this.noiseHit(t, 0.4, 0.35, { type: 'lowpass', f0: 600, f1: 180, q: 0.9, a: 0.003 });
    this.noiseHit(t, 0.07, 0.22, { f0: 1900, q: 3, a: 0.002 });             // gỗ nứt
    this.noiseHit(t + 0.03, 0.05, 0.14, { f0: 1300, q: 4, a: 0.002 });
    this.noiseHit(t + 0.05, 0.7, 0.16, { type: 'highpass', f0: 1100, q: 0.5, a: 0.02 }); // nước văng
    for (let i = 0; i < 6; i++) { const tt = t + 0.15 + Math.random() * 0.35, f = 500 + Math.random() * 1000; this.osc('sine', f, f * 1.5, tt, 0.04, 0.04, { a: 0.003 }); }
  }
  // pháo hoa: tiếng nổ bụp + lách tách
  crackle() {
    const ok = this.canPlay(); this.note('crackle', ok); if (!ok) return;
    const t = this.now + 0.005;
    this.noiseHit(t, 0.18, 0.2, { type: 'lowpass', f0: 900, q: 0.7, a: 0.003 });
    this.osc('sine', 160, 60, t, 0.14, 0.18, { a: 0.003 });
    for (let i = 0; i < 22; i++) {
      const tt = t + 0.12 + Math.random() * 0.7;
      this.noiseHit(tt, 0.012 + Math.random() * 0.012, 0.03 + Math.random() * 0.06, { type: 'highpass', f0: 2500 + Math.random() * 3000, q: 0.7, a: 0.001 });
    }
  }
  // kèn ngắn khi lên đời phương tiện
  fanfare() {
    const ok = this.canPlay(); this.note('fanfare', ok); if (!ok) return;
    const c = this.ctx, t0 = this.now + 0.03;
    const seq = [[72, 0, 0.09], [76, 0.1, 0.09], [79, 0.2, 0.09], [84, 0.3, 0.42]];  // C5 E5 G5 C6
    for (const [m, dt, d] of seq) {
      const t = t0 + dt, f = hz(m);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1400, t + d);
      const g = c.createGain(); this.env(g, t, 0.02, 0.09, d);
      for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + 0.1); }
      lp.connect(g); g.connect(this.sfxBus);
    }
  }
  // bíp nhẹ khi micro bắt đầu nghe
  micBeep() {
    const ok = this.canPlay(); this.note('beep', ok); if (!ok) return;
    const t = this.now + 0.01;
    this.osc('sine', 880, 880, t, 0.08, 0.07, { a: 0.008 });
    this.osc('sine', 1320, 1320, t + 0.09, 0.07, 0.05, { a: 0.008 });
  }

  // ---------------------------------------------------------------- giọng chửi
  loadTaunts() {
    if (this.tauntsLoading) return this.tauntsLoading;
    const get = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    this.tauntsLoading = Promise.all([get(new URL('manifest.json', TAUNT_DIR)), get(new URL('manifest.json', CUSTOM_DIR))]).then(([m, c]) => {
      this.taunts = m && m.kinds ? m : null;
      this.custom = new Set(((c && c.files) || []).map((x) => (typeof x === 'string' ? x : x.file)));
      this.customH = {}; for (const x of (c && c.files) || []) if (x && x.file) this.customH[x.file] = x.h || '';
      return this.taunts;
    });
    return this.tauntsLoading;
  }
  // đường dẫn file cho (kind, chỉ số câu, kiểu người bán): file thu tay > file TTS
  tauntUrl(kind, index, vendor, text) {
    const k = this.taunts && this.taunts.kinds[kind]; if (!k) return null;
    let it = k.items[index];
    if (!it || (text && it.text !== text)) it = k.items.find((x) => x.text === text);
    if (!it) return null;                                      // câu mới chưa có tiếng
    const base = `${k.prefix}_${String(it.id).padStart(2, '0')}`;
    for (const ext of ['m4a', 'mp3', 'wav']) {
      for (const n of [`${base}_${vendor}.${ext}`, `${base}.${ext}`]) {
        if (this.custom.has(n)) return new URL(`${n}?h=${this.customH[n] || ''}`, CUSTOM_DIR).href;
      }
    }
    const f = it.files[vendor] || Object.values(it.files)[0];
    return f ? new URL(`${f.file}?h=${f.h}`, TAUNT_DIR).href : null;
  }
  decode(ab) {
    return new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(ab, res, rej);         // dạng callback cho Safari cũ
      if (p && p.then) p.then(res, rej);
    });
  }
  buffer(url) {
    let p = this.buffers.get(url);
    if (p) { this.buffers.delete(url); this.buffers.set(url, p); return p; }   // LRU: đưa lên cuối
    p = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => this.decode(ab))
      .then((b) => { p.buf = b; return b; })
      .catch((e) => { console.info('[cho-noi] không nạp được tiếng chửi', url, e && e.message); this.buffers.delete(url); return null; });
    this.buffers.set(url, p);
    while (this.buffers.size > CACHE_MAX) this.buffers.delete(this.buffers.keys().next().value);
    return p;
  }
  // gọi khi ghe mới tới: nạp sẵn đúng 2 câu chửi game đã chọn trước cho ghe này
  prefetch(vendor, pick) {
    if (!this.ctx || !pick) return;
    this.loadTaunts().then(() => {
      for (const kind of Object.keys(pick)) {
        const u = this.tauntUrl(kind, pick[kind], vendor, null);
        if (u) this.buffer(u);
      }
    });
  }
  playTaunt(kind, text, vendor, index) {
    const url = this.taunts ? this.tauntUrl(kind, index, vendor, text) : null;
    const p = url && this.buffers.get(url);
    const buf = p && p.buf;
    if (!buf) { this.note('tauntSkipped', false); if (!this.taunts) this.loadTaunts(); return; }
    const ok = this.canPlay(); this.note('taunt', ok); if (!ok) return;
    this.lastTaunt = { kind, vendor, url, dur: buf.duration };
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    s.connect(this.voiceBus); s.start(this.now + 0.01);
    this.duck(buf.duration + 0.2);
  }
}

export const sfx = new Sound();

// kind: 'jumpedOver' | 'crash'; text: câu đang hiện trong bong bóng; vendor: kiểu người bán; index: số thứ tự câu
export function playTaunt(kind, text, vendor, index) { sfx.playTaunt(kind, text, vendor, index); }
