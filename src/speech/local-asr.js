// Bộ nghe tiếng Việt chạy ngay trong trình duyệt (B4b): sherpa-onnx WebAssembly + Zipformer tiếng Việt INT8,
// chạy trong Web Worker (asr-worker.js); micro qua getUserMedia + AudioWorklet (mic-worklet.js), hạ mẫu 16 kHz mono.
//
// Cùng giao diện sự kiện với SpeechInput (recognizer.js) để VoiceControl/matcher dùng lại nguyên:
//   start({gesture}), stop(), active; sự kiện listening, result {results:[{transcript,isFinal}]}, end, activity {on},
//   error {code: denied | audio-capture | start-failed}.
// Thêm: load() tải + khởi tạo mô hình (sự kiện load-progress {loaded,total}, load-ready {rtf,...}, load-error {code}),
//   setContext(phrase, {maxSec}) gọi mỗi câu mới (hotwords + mốc cắt âm thanh); setContext(null) = ngừng giải mã.
// Mỗi câu (context) là một result riêng trong danh sách; câu cũ được chốt isFinal khi câu mới bắt đầu.

const HERE = new URL('.', import.meta.url);
const ASR_BASE = new URL('../../assets/asr/', import.meta.url);
let ctxSeq = 0;

// Trình duyệt chạy được bộ nghe cục bộ không (WebAssembly SIMD, Worker, AudioWorklet, getUserMedia, https)
export function localAsrSupport(win = window) {
  const why = [];
  try {
    // module nhỏ có lệnh SIMD (i8x16.splat + popcnt) — onnxruntime bản simd cần
    const simd = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
    if (typeof WebAssembly !== 'object' || !WebAssembly.validate(simd)) why.push('wasm-simd');
  } catch (e) { why.push('wasm'); }
  if (typeof win.Worker !== 'function') why.push('worker');
  if (typeof win.AudioWorkletNode !== 'function') why.push('audioworklet');
  if (!(win.navigator && win.navigator.mediaDevices && win.navigator.mediaDevices.getUserMedia)) why.push('getusermedia');
  if (win.isSecureContext === false) why.push('https');
  return { ok: !why.length, why };
}

export class LocalSpeechInput extends EventTarget {
  constructor({ base = ASR_BASE, opts = {} } = {}) {
    super();
    this.base = new URL(base, location.href).href;
    this.opts = opts;
    this.worker = null; this.ready = false; this.loadState = 'idle'; // idle | loading | ready | error
    this.info = null;
    this.audio = null;          // { ctx, stream, src, node }
    this.state = 'idle';        // idle | starting | running
    this.want = false;
    this.results = []; this.curId = 0;
    this.lastResultAt = 0; this.stats = { decodes: 0, msSum: 0, msMax: 0, lagMax: 0 };
  }

  get active() { return this.state === 'starting' || this.state === 'running'; }
  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  // ---------------------------------------------------------------- tải mô hình
  async load() {
    if (this.loadState === 'loading' || this.loadState === 'ready') return;
    this.loadState = 'loading';
    let manifest;
    try {
      const r = await fetch(new URL('manifest.json', this.base), { cache: 'no-cache' });
      if (!r.ok) throw new Error('manifest ' + r.status);
      manifest = await r.json();
    } catch (e) {
      this.loadState = 'error';
      this.emit('load-error', { code: 'network', message: String(e.message || e) });
      return;
    }
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('asr-worker.js', HERE));
      } catch (e) {
        this.loadState = 'error';
        this.emit('load-error', { code: 'init', message: String(e.message || e) });
        return;
      }
      this.worker.onmessage = (e) => this.onWorker(e.data);
      this.worker.onerror = (e) => {
        console.warn('[cho-noi] asr worker', e.message || e);
        if (this.loadState === 'loading') { this.loadState = 'error'; this.emit('load-error', { code: 'init', message: String(e.message || 'worker') }); }
      };
    }
    this.manifest = manifest;
    this.worker.postMessage({ type: 'load', base: this.base, manifest, opts: this.opts });
  }

  onWorker(m) {
    if (m.type === 'progress') this.emit('load-progress', { loaded: m.loaded, total: m.total });
    else if (m.type === 'ready') { this.ready = true; this.loadState = 'ready'; this.info = m; this.emit('load-ready', m); }
    else if (m.type === 'load-error') { this.loadState = 'error'; this.emit('load-error', m); }
    else if (m.type === 'activity') { if (this.state === 'running') this.emit('activity', { on: m.on }); }
    else if (m.type === 'result') this.onResult(m);
  }

  onResult(m) {
    if (!this.want || m.id !== this.curId) return;
    const s = this.stats;
    s.decodes++; s.msSum += m.ms; s.msMax = Math.max(s.msMax, m.ms);
    this.lastDecode = m;
    const last = this.results[this.results.length - 1];
    if (!last) return;
    last.transcript = m.text;
    this.emitResults();
  }

  emitResults() { this.emit('result', { results: this.results.map((r) => ({ transcript: r.transcript, isFinal: r.isFinal })) }); }

  // ---------------------------------------------------------------- câu hiện tại
  setContext(phrase, { maxSec = 15 } = {}) {
    this.ctxPhrase = phrase || null; this.ctxMax = maxSec;     // nhớ để nghe tiếp câu này sau khi tạm dừng
    if (!this.worker) return;
    const last = this.results[this.results.length - 1];
    if (last && !last.isFinal) { last.isFinal = true; if (this.want) this.emitResults(); }
    if (!phrase) { this.curId = 0; this.worker.postMessage({ type: 'context', id: 0 }); return; }
    this.curId = ++ctxSeq;
    this.results.push({ transcript: '', isFinal: false });
    if (this.results.length > 8) this.results.splice(0, this.results.length - 8);   // giữ gọn (cursor đã mark xong)
    const hotwords = this.opts.hotwords === false ? '' : phraseHotwords(phrase);
    this.worker.postMessage({ type: 'context', id: this.curId, hotwords, maxSec });
  }

  // ---------------------------------------------------------------- micro
  // Gọi trong cử chỉ bấm: tạo/resume AudioContext NGAY (iOS), xin micro, nối worklet -> worker.
  start({ gesture = true } = {}) {
    this.want = true;
    if (this.active) return;
    this.state = 'starting';
    this.results = []; this.curId = 0;
    if (this.audio && !this.audio.stream.getAudioTracks().some((t) => t.readyState === 'live')) {
      this.dropAudio();                        // micro đã bị ngắt (cuộc gọi, rút tai nghe…): xin lại
    }
    if (this.audio) {
      const a = this.audio;
      const p = a.ctx.state !== 'running' ? a.ctx.resume() : Promise.resolve();   // resume ngay trong cú bấm (iOS)
      a.node.port.postMessage({ on: true });
      p.then(() => this.onListening(), () => this.onListening());
      return;
    }
    let ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    } catch (e) {
      this.fail('start-failed', e); return;
    }
    const constraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } };
    navigator.mediaDevices.getUserMedia(constraints).then(async (stream) => {
      if (!this.want) { stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); this.state = 'idle'; return; }
      await ctx.audioWorklet.addModule(new URL('mic-worklet.js', HERE));
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'cho-noi-mic', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
      node.port.onmessage = (e) => this.onAudio(e.data);
      // nối ra loa qua gain 0 (im lặng): Safari chỉ chạy worklet khi nút nằm trên đường tới destination
      const mute = ctx.createGain(); mute.gain.value = 0;
      src.connect(node); node.connect(mute); mute.connect(ctx.destination);
      for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => { if (this.want) this.fail('audio-capture', new Error('track ended')); });
      this.audio = { ctx, stream, src, node, mute };
      if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* iOS: chờ cú bấm sau */ } }
      this.onListening();
    }).catch((e) => {
      try { ctx.close(); } catch (er) { /* bỏ qua */ }
      const n = e && e.name;
      const code = (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') ? 'denied'
        : (n === 'NotFoundError' || n === 'NotReadableError' || n === 'OverconstrainedError' || n === 'AbortError' || n === 'DevicesNotFoundError') ? 'audio-capture'
          : 'start-failed';
      this.fail(code, e);
    });
  }

  onListening() {
    if (!this.want || this.state === 'running') return;
    this.state = 'running';
    // chơi tiếp giữa chừng một câu: đặt lại câu đó (âm thanh tính từ lúc nghe lại)
    if (this.ctxPhrase && !this.curId) this.setContext(this.ctxPhrase, { maxSec: this.ctxMax });
    this.emit('listening');
  }

  onAudio(samples) {
    if (!this.want || !this.worker) return;
    this.worker.postMessage({ type: 'audio', samples }, [samples.buffer]);
  }

  fail(code, e) {
    console.info('[cho-noi] local asr', code, e && (e.name || e.message));
    this.want = false; this.state = 'idle';
    if (this.audio) this.audio.node.port.postMessage({ on: false });
    this.emit('error', { code, raw: e && e.name });
  }

  stop() {
    this.want = false;
    if (this.worker) { this.worker.postMessage({ type: 'reset' }); }
    if (this.audio) this.audio.node.port.postMessage({ on: false });
    const was = this.state !== 'idle';
    this.state = 'idle'; this.curId = 0;
    if (was) this.emit('end');
  }

  // trả micro hẳn (trang ẩn / rời trang): tắt đèn micro trên điện thoại
  release() {
    this.stop();
    this.dropAudio();
  }

  dropAudio() {
    const a = this.audio; this.audio = null;
    if (!a) return;
    try { a.src.disconnect(); a.node.disconnect(); a.mute.disconnect(); } catch (e) { /* bỏ qua */ }
    a.stream.getTracks().forEach((t) => t.stop());
    a.ctx.close().catch(() => {});
  }
}

// Bộ chuyển: game giữ một đối tượng, bên trong là bộ nghe cục bộ hoặc Web Speech (dự phòng); chuyển tiếp sự kiện.
export class SpeechSwitch extends EventTarget {
  constructor() { super(); this.inner = null; this.kind = ''; this.off = null; }
  use(inner, kind) {
    if (this.inner === inner) return;
    if (this.inner) { this.inner.stop(); if (this.off) this.off(); }
    this.inner = inner; this.kind = kind;
    const types = ['listening', 'result', 'end', 'activity', 'error'];
    const fwd = (e) => this.dispatchEvent(new CustomEvent(e.type, { detail: e.detail }));
    types.forEach((t) => inner.addEventListener(t, fwd));
    this.off = () => types.forEach((t) => inner.removeEventListener(t, fwd));
  }
  get active() { return !!(this.inner && this.inner.active); }
  start(o) { if (this.inner) this.inner.start(o); }
  stop() { if (this.inner) this.inner.stop(); }
  setContext(p, o) { if (this.inner && this.inner.setContext) this.inner.setContext(p, o); }
  release() { if (!this.inner) return; if (this.inner.release) this.inner.release(); else this.inner.stop(); }
}

// giống ChoNoiAsrCore.phraseHotwords (asr-core.js chạy trong worker): câu chính tả + câu phiên âm, chữ HOA, bỏ dấu câu
function hotwordText(t) { return String(t || '').normalize('NFC').toUpperCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
export function phraseHotwords(phrase) {
  const out = [];
  for (const t of [phrase.chinhTa, phrase.phienAm]) { const h = hotwordText(t); if (h && !out.includes(h)) out.push(h); }
  return out.join('/');
}
