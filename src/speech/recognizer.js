// Nhận giọng tiếng Việt bằng Web Speech API của trình duyệt (B4).
// - start() phải gọi trong cử chỉ người dùng (iOS Safari bắt buộc): nút Bắt đầu, Chơi tiếp, Thử lại.
// - Safari/Chrome hay tự dừng sau vài giây hoặc khi im lặng → chỉ khởi động lại ở onend (Chrome Android bíp mỗi lần start),
//   có giới hạn khi phiên chết liền liên tục để tránh vòng lặp lỗi. Không gọi start() khi đang chạy.
// Sự kiện: listening (micro đã mở), result {results:[{transcript,isFinal}]}, end, activity {on}, error {code}.
//   code: denied | need-tap | network | audio-capture | unsupported-lang | stuck | start-failed

// ---------------------------------------------------------------- phát hiện hỗ trợ
const IN_APP = [
  [/FBAN\/Messenger|FB_IAB\/MESSENGER|MessengerForiOS|\bMessenger\b/i, 'Messenger'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, 'Facebook'],
  [/Instagram/i, 'Instagram'],
  [/Zalo/i, 'Zalo'],
  [/\bLine\//i, 'LINE'],
  [/MicroMessenger/i, 'WeChat'],
  [/TikTok|musical_ly|BytedanceWebview|aweme/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/Twitter/i, 'X (Twitter)'],
];

export function detectInApp(ua) {
  for (const [re, name] of IN_APP) if (re.test(ua)) return name;
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return 'ứng dụng này';
  return '';
}

export function speechSupport(win = window) {
  const nav = win.navigator || {};
  const ua = nav.userAgent || '';
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition || null;
  const host = (win.location && win.location.hostname) || '';
  const secure = win.isSecureContext !== false || host === 'localhost' || host === '127.0.0.1';
  const ios = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return { Ctor, api: !!Ctor, inApp: detectInApp(ua), secure, ios, android: /Android/.test(ua) };
}

// ---------------------------------------------------------------- bộ nhận giọng
const FAST_FAIL_MS = 1500;   // phiên chết trước mốc này mà không có chữ nào = chết liền
const MAX_FAST_FAILS = 6;    // chết liền liên tục bấy nhiêu lần thì dừng hẳn, báo lỗi
const LISTEN_FALLBACK_MS = 3000; // trình duyệt không báo audiostart: coi như đã nghe sau mốc này

export class SpeechInput extends EventTarget {
  constructor({ Ctor, lang = 'vi-VN' }) {
    super();
    this.Ctor = Ctor; this.lang = lang;
    this.rec = null;
    this.state = 'idle';        // idle | starting | running | stopping
    this.want = false;          // game đang cần nghe
    this.fastFails = 0;
    this.hadSession = false;    // đã từng mở micro thành công trong trang này
    this.restartTimer = 0; this.listenTimer = 0;
  }

  get active() { return this.state === 'starting' || this.state === 'running'; }

  // gesture=true khi gọi từ click của người dùng
  start({ gesture = true } = {}) {
    this.want = true;
    if (gesture) this.fastFails = 0;
    clearTimeout(this.restartTimer);
    this.open(gesture);
  }

  stop() {
    this.want = false;
    clearTimeout(this.restartTimer); clearTimeout(this.listenTimer);
    if (this.rec && this.active) {
      this.state = 'stopping';
      try { this.rec.abort(); } catch (e) { /* đã dừng */ }
    }
  }

  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  make() {
    const rec = new this.Ctor();
    rec.lang = this.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    const mine = (fn) => (e) => { if (rec === this.rec) fn(e); };   // bỏ qua sự kiện của phiên cũ đã bỏ
    rec.onstart = mine(() => this.onStart());
    rec.onaudiostart = mine(() => this.onListening());
    rec.onresult = mine((e) => this.onResult(e));
    rec.onerror = mine((e) => this.onError(e));
    rec.onend = mine(() => this.onEnd());
    rec.onsoundstart = rec.onspeechstart = mine(() => this.emit('activity', { on: true }));
    rec.onsoundend = rec.onspeechend = mine(() => this.emit('activity', { on: false }));
    return rec;
  }

  open(gesture) {
    if (this.active) return;                              // đang nghe rồi: không start lại
    if (this.state === 'stopping' || !this.rec) {         // phiên cũ chưa kịp tắt: bỏ nó, tạo phiên mới
      if (this.rec) { const old = this.rec; this.rec = null; old.onend = old.onerror = old.onresult = null; }
      this.rec = this.make();
    }
    this.state = 'starting';
    this.fromGesture = gesture; this.sessionAt = Date.now(); this.gotResult = false; this.listened = false;
    try {
      this.rec.start();
    } catch (e) {
      if (e && e.name === 'InvalidStateError') { this.state = 'running'; return; } // thật ra đang chạy
      this.state = 'idle';
      console.warn('[cho-noi] speech start', e);
      this.want = false;
      this.emit('error', { code: 'start-failed' });
    }
  }

  onStart() {
    this.state = 'running';
    clearTimeout(this.listenTimer);
    this.listenTimer = setTimeout(() => this.onListening(), LISTEN_FALLBACK_MS);
  }

  onListening() {
    clearTimeout(this.listenTimer);
    if (this.listened) return;
    this.listened = true; this.hadSession = true;
    this.emit('listening');
  }

  onResult(e) {
    this.gotResult = true;
    if (!this.listened) this.onListening();
    const out = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      out.push({ transcript: (r[0] && r[0].transcript) || '', isFinal: !!r.isFinal });
    }
    this.emit('result', { results: out });
  }

  onError(e) {
    const err = e.error || 'unknown';
    if (err === 'no-speech' || err === 'aborted') return;   // im lặng / do mình tắt: onend sẽ lo
    let code = null;
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      // iOS có thể chặn start() tự khởi động lại ngoài cử chỉ người dùng → chỉ cần bấm một cái
      code = (!this.fromGesture && this.hadSession && err === 'not-allowed') ? 'need-tap' : 'denied';
    } else if (err === 'network') code = 'network';
    else if (err === 'audio-capture') code = 'audio-capture';
    else if (err === 'language-not-supported' || err === 'bad-grammar') code = 'unsupported-lang';
    if (!code) { console.warn('[cho-noi] speech error', err); return; } // lỗi lạ: để onend khởi động lại
    this.want = false;
    clearTimeout(this.restartTimer); clearTimeout(this.listenTimer);
    this.emit('error', { code, raw: err });
  }

  onEnd() {
    clearTimeout(this.listenTimer);
    this.state = 'idle';
    this.emit('end');
    if (!this.want) return;
    const quick = !this.gotResult && Date.now() - this.sessionAt < FAST_FAIL_MS;
    this.fastFails = quick ? this.fastFails + 1 : 0;
    if (this.fastFails >= MAX_FAST_FAILS) {
      this.want = false;
      this.emit('error', { code: 'stuck' });
      return;
    }
    const delay = quick ? 250 * this.fastFails : 0;
    this.restartTimer = setTimeout(() => { if (this.want) this.open(false); }, delay);
  }
}
