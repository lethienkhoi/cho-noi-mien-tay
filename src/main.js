// Khởi động game: nạp dữ liệu + sprite, nối Game <-> Renderer <-> UI, vòng lặp requestAnimationFrame.
// Mọi đường dẫn đều tương đối để chạy được trong thư mục con của GitHub Pages.
import { CONFIG } from './config.js?v=8d4b1e05';
import { Assets } from './game/assets.js?v=8d4b1e05';
import { Game } from './game/game.js?v=8d4b1e05';
import { Renderer } from './game/renderer.js?v=8d4b1e05';
import { Hud } from './ui/hud.js?v=8d4b1e05';
import { Panel } from './ui/panel.js?v=8d4b1e05';
import { Screens } from './ui/screens.js?v=8d4b1e05';
import { SpeechInput, speechSupport } from './speech/recognizer.js?v=8d4b1e05';
import { LocalSpeechInput, SpeechSwitch, localAsrSupport } from './speech/local-asr.js?v=8d4b1e05';
import { VoiceControl } from './speech/voice.js?v=8d4b1e05';
import { sfx, playTaunt } from './game/sfx.js?v=8d4b1e05';
import { SoundButton } from './ui/sound-button.js?v=8d4b1e05';

const app = document.getElementById('app');
const canvas = document.getElementById('scene');
const screens = new Screens(app);

// ---------------------------------------------------------------- chặn zoom/cuộn khi chạm
const stop = (e) => { if (e.cancelable) e.preventDefault(); };
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('gesturestart', stop, { passive: false });
document.addEventListener('dblclick', stop, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTouchEnd < 320 && !e.target.closest('button')) stop(e); lastTouchEnd = n; }, { passive: false });
document.addEventListener('contextmenu', stop);

function setUnit() {
  const r = app.getBoundingClientRect();
  app.style.setProperty('--u', (r.width / CONFIG.DESIGN_W).toFixed(4));
  return r;
}
setUnit();

function spriteList(man, phrases) {
  const S = man.sprites, out = new Set();
  const add = (n) => { if (n && S[n]) out.add(n); };
  ['background', 'hero_scream', 'nonla', 'fg_hyacinth', 'fg_branch', 'bowl', 'fish', 'durian'].forEach(add);
  Object.keys(S).filter((n) => /^(far|mid)_\d+$/.test(n)).forEach(add);
  for (const v of man.vehicles) [v.sprite, v.cocky, v.empty, v.play, v.playCocky, v.jump].forEach(add);
  for (const k of man.vendors) for (const f of man.vendorFaces) add(`${k}_${f}`);
  for (const p of phrases.phrases) { const st = man.stallMap[p.stall]; add(st); if (S[st]) add(S[st].back); }
  return [...out];
}

// ---------------------------------------------------------------- bộ nghe (B4b)
// Mặc định: bộ nghe tiếng Việt chạy ngay trong trình duyệt (sherpa-onnx WebAssembly). Tham số URL:
//   ?asr=webspeech  ép dùng Web Speech của trình duyệt (bản B4, cần mạng) — qa_b4/qa_b5 dùng chế độ này
//   ?asr=local      ép dùng bộ nghe cục bộ (không tự chuyển về Web Speech khi máy chậm)
const ASR_PARAM = new URLSearchParams(location.search).get('asr') || '';
// đo lúc khởi động: chậm hơn mức này thì chuyển về Web Speech (nếu có). ?asrmaxrtf=… chỉ để kiểm thử.
const ASR_MAX_RTF = parseFloat(new URLSearchParams(location.search).get('asrmaxrtf')) || 1.5;
const localSup = localAsrSupport();
const localAsr = ASR_PARAM !== 'webspeech' && (localSup.ok || ASR_PARAM === 'local')
  ? new LocalSpeechInput({ opts: { method: 'modified_beam_search', hotwordsScore: 2.0 } }) : null;
if (localAsr && localSup.ok) localAsr.load();       // tải ngay, song song với hình và lúc người chơi đọc hướng dẫn

async function boot() {
  screens.setLoading(0.02);
  const assets = new Assets();
  let phrases, man;
  try {
    const [pr, mr] = await Promise.all([fetch('data/phrases.json', { cache: 'no-cache' }), assets.loadManifest()]);
    if (!pr.ok) throw new Error('phrases ' + pr.status);
    phrases = await pr.json(); man = mr;
  } catch (e) {
    screens.setLoading(null);
    screens.showError('Không tải được dữ liệu game. Kiểm tra mạng rồi tải lại trang.', false);
    console.warn('[cho-noi] boot', e);
    return;
  }
  const names = spriteList(man, phrases);
  const failed = await assets.loadImages(names, (f) => screens.setLoading(0.05 + f * 0.9));

  const game = new Game({ phrases, manifest: man });
  const renderer = new Renderer(canvas, assets, game);
  // ---- ảnh khoảnh khắc đụng cuối (2026-11-18): chụp cả khung canvas MỘT lần bằng drawImage sang canvas phụ
  // lúc RẦM!, nhân vật đang văng và bong bóng chửi (vẽ trên canvas) đã nảy xong; khi bảng kết quả hiện thì cắt
  // vùng quanh va chạm theo đúng tỉ lệ khung ảnh. Không dùng toDataURL.
  const shot = { cv: document.createElement('canvas'), box: null, ok: false };
  function snapCrash() {
    try {
      const W = canvas.width, H = canvas.height, k = renderer.unit * renderer.dpr;
      if (shot.cv.width !== W || shot.cv.height !== H) { shot.cv.width = W; shot.cv.height = H; }
      shot.cv.getContext('2d').drawImage(canvas, 0, 0);
      // hộp (u) bao: điểm va + chữ RẦM!, ghe hàng, nhân vật đang văng, bong bóng chửi
      const cr = game.crash, st = game.stall, hs = game.heroPos.s;
      let L = cr.at.x - 66, R = cr.at.x + 62, T = cr.at.y - 108, B = game.laneY + 22;
      const add = (l, t, r, b) => { L = Math.min(L, l); T = Math.min(T, t); R = Math.max(R, r); B = Math.max(B, b); };
      add(CONFIG.HERO_X - 48, game.laneY - 60, CONFIG.HERO_X + 48, game.laneY + 22);
      if (game.state === 'crash') add(cr.hx - 170 * hs, cr.hy - 200 * hs, cr.hx + 170 * hs, cr.hy + 120 * hs);
      if (st) add(st.x - 60, st.y - 120, st.x + 60, st.y + 22);
      const tb = renderer.lastTaunt;
      if (tb && game.taunts.length && game.taunts[0].kind === 'crash') add(tb.L, tb.T, tb.R, tb.B);
      shot.box = { L, T, R, B, k, W: W / k, H: H / k };
      shot.ok = true;
    } catch (err) { shot.ok = false; console.warn('[cho-noi] chụp vụ đụng lỗi', err); }
  }
  // vẽ ảnh đã chụp vào khung kết quả, cắt theo tỉ lệ khung
  function paintShot() {
    const frame = screens.res.shot, out = screens.res.shotCv;
    const fr = frame.getBoundingClientRect();
    if (!shot.ok || fr.width < 10 || fr.height < 10) { frame.hidden = !shot.ok; return; }
    frame.hidden = false;
    const b = shot.box, pad = 12, A = fr.width / fr.height;
    let w = b.R - b.L + pad * 2, h = b.B - b.T + pad * 2;
    const cx = (b.L + b.R) / 2, cy = (b.T + b.B) / 2;
    if (w / h < A) w = h * A; else h = w / A;           // nới cạnh ngắn cho đúng tỉ lệ khung
    if (w > b.W) { w = b.W; h = w / A; }                // không vượt khung game: giữ tỉ lệ khung, lề cắt bớt chút trên dưới
    if (h > b.H) { h = b.H; w = Math.min(b.W, h * A); }
    const x = Math.max(0, Math.min(b.W - w, cx - w / 2)), y = Math.max(0, Math.min(b.H - h, cy - h / 2));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ow = Math.round(Math.min(w * b.k, fr.width * dpr)), oh = Math.round(ow * h / w);
    out.width = ow; out.height = oh;
    out.getContext('2d').drawImage(shot.cv, x * b.k, y * b.k, w * b.k, h * b.k, 0, 0, ow, oh);
  }

  // ---- câu chọc ở màn kết quả (data/roasts.json). Lỗi thì không hiện câu, không vỡ màn.
  let roasts = null;
  fetch('data/roasts.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => { roasts = j; })
    .catch((e) => { console.info('[cho-noi] không tải được roasts.json', e); });
  const lastRoast = {};
  function pickRoast(score, newRecord) {
    try {
      if (!roasts) return '';
      let key = 'newBest', list = newRecord ? roasts.newBest : null;
      if (!Array.isArray(list) || !list.length) {
        const br = (roasts.brackets || []).find((x) => score >= x.min && score <= x.max);
        list = br && br.lines; key = br ? 'b' + br.min : '';
      }
      list = (Array.isArray(list) ? list : []).filter((x) => typeof x === 'string' && x.trim());
      if (!list.length) return '';
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && list[i] === lastRoast[key]) i = (i + 1) % list.length;
      lastRoast[key] = list[i];
      return list[i];
    } catch (e) { return ''; }
  }
  renderer.setSprites(names);
  const hud = new Hud(document.getElementById('hud'), man.vehicles);
  const panel = new Panel(document.getElementById('panel'));

  // ---- cỡ khung
  const probe = document.getElementById('safe-probe');
  let bakeTimer = 0, first = true;
  function layout() {
    const r = setUnit();
    renderer.resize(r.width, r.height);
    const cs = getComputedStyle(probe);
    game.insetBottom = (parseFloat(cs.paddingBottom) || 0) / renderer.unit;
    measureUI();
    if (first) { renderer.bakeAll(); first = false; }
    else { clearTimeout(bakeTimer); bakeTimer = setTimeout(() => renderer.bakeAll(), 160); }
    checkOrientation();
    if (!screens.result.hidden) paintShot();
  }

  // mép dưới HUD và mép trên khung chữ (u) để bong bóng chửi không bị che
  const hudEl = document.getElementById('hud'), panelEl = document.getElementById('panel');
  function measureUI() {
    const a = app.getBoundingClientRect(), u = renderer.unit || 1;
    const sb = document.getElementById('btn-sound');   // nút loa (B6) nằm ngay dưới ô Kỷ lục
    const hb = hudEl.hidden ? 0 : Math.max(hudEl.getBoundingClientRect().bottom, sb ? sb.getBoundingClientRect().bottom : 0) - a.top;
    renderer.uiTop = hb > 0 ? hb / u : 100;
    const pt = panelEl.hidden ? 0 : panelEl.getBoundingClientRect().top - a.top;
    renderer.uiBottom = pt > 0 ? pt / u : renderer.H - 160;
  }

  // ---- xoay màn: điện thoại nằm ngang thì che và tạm dừng
  function checkOrientation() {
    const land = window.innerWidth > window.innerHeight && window.innerHeight < 520;
    screens.setRotate(land);
    if (land && running()) game.pause('rotate');
  }
  const running = () => game.state === 'playing' || game.state === 'jumping' || game.state === 'crash';

  // ---- nối sự kiện game -> UI
  // bộ nghe cục bộ: mỗi câu mới đặt hotwords + mốc cắt âm thanh; nhảy/đụng thì ngừng giải mã cho nhẹ máy
  game.addEventListener('round', (e) => {
    sfx.prefetch(e.detail.vendor, e.detail.tauntPick);   // B6: nạp lười đúng 2 câu chửi của ghe này
    const T = e.detail.T || (game.round && game.round.T) || 8;
    speech.setContext(e.detail.phrase, { maxSec: T + CONFIG.TIME_GRACE + CONFIG.HOLD_MAX + 1 });
    panel.play(e.detail.phrase); measureUI();
  });
  game.addEventListener('matched', (e) => {
    speech.setContext(null); panel.passed(e.detail.phrase, e.detail); measureUI();
    sfx.whoosh(); sfx.ting(!!e.detail.dialect);
  });
  game.addEventListener('landed', () => sfx.splash());
  game.addEventListener('tier', () => sfx.fanfare());
  game.addEventListener('crash', (e) => {
    speech.setContext(null); panel.crash(e.detail.phrase); measureUI();
    shot.ok = false; shot.taken = false;
    sfx.crash();
  });
  game.addEventListener('taunt', (e) => playTaunt(e.detail.kind, e.detail.text, e.detail.vendor, e.detail.index));
  game.addEventListener('over', (e) => {
    panel.show(false); hud.show(false);
    if (!shot.taken) { shot.taken = true; snapCrash(); }  // dự phòng (vd. tạm dừng ngay lúc đụng)
    screens.showResult(e.detail, pickRoast(e.detail.score, e.detail.newRecord));
    paintShot();
  });
  // nhạc nền: đang chơi (micro mở) thì hạ rất nhỏ; màn bắt đầu/kết quả/tạm dừng thì to lại
  const syncRun = () => sfx.setRun(!game.paused && (game.state === 'playing' || game.state === 'jumping'));
  game.addEventListener('state', (e) => { app.dataset.state = e.detail.state; syncRun(); });
  game.addEventListener('pause', (e) => {
    syncRun();
    const { paused, reason } = e.detail;
    screens.setPaused(paused && reason !== 'qa' && reason !== 'speech');
    if (paused) { speech && speech.stop(); panel.setMic('off'); }
  });

  // ---- giọng nói (B4, B4b). Không có điều khiển chạm: chạm chỉ dùng cho nút.
  const support0 = speechSupport();
  // màn "không nghe được" coi như có API khi chạy được bộ nghe cục bộ
  const support = { ...support0, api: support0.api || !!(localAsr && localSup.ok) };
  const pageUrl = location.href.split('#')[0];
  const webSpeech = support0.api && support0.secure ? new SpeechInput({ Ctor: support0.Ctor, lang: 'vi-VN' }) : null;
  const speech = (localAsr || webSpeech) ? new SpeechSwitch() : null;
  let waitFor = null;           // 'start' | 'resume': đang chờ micro mở để bắt đầu / chơi tiếp
  let forceTry = false;         // bấm "Vẫn thử ở đây" trong trình duyệt của app
  const canListen = () => speech && (!support.inApp || forceTry);

  // ---- chọn bộ nghe + màn tải
  const asrBox = document.getElementById('asr-box'), asrText = document.getElementById('asr-text');
  const asrFill = document.getElementById('asr-fill'), asrBar = document.getElementById('asr-bar');
  const btnAsrRetry = document.getElementById('btn-asr-retry'), btnStart = document.getElementById('btn-start');
  let pendingUse = null;        // đổi bộ nghe khi đang chơi: để dành tới lúc về bến
  function useSpeech(inner, kind) {
    if (!speech) return;
    if (running() || waitFor) { pendingUse = [inner, kind]; return; }
    speech.use(inner, kind); app.dataset.asr = kind;
  }
  function asrUI(text, { frac = null, cls = '', retry = false } = {}) {
    asrBox.hidden = false;
    asrText.textContent = text;
    asrBox.classList.toggle('is-ready', cls === 'ready'); asrBox.classList.toggle('is-error', cls === 'error');
    asrBar.hidden = frac === null;
    if (frac !== null) asrFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
    btnAsrRetry.hidden = !retry;
    updateStartBtn();
  }
  function updateStartBtn() {
    const ok = !!(speech && speech.inner && (speech.kind === 'webspeech' || (localAsr && localAsr.ready)));
    btnStart.disabled = !ok;
    btnStart.textContent = ok ? 'Bắt đầu' : 'Chợ đang dọn hàng…';
  }
  const MB = (b) => (b / 1048576).toFixed(b < 10485760 ? 1 : 0);
  const fallbackWeb = (why) => {
    useSpeech(webSpeech, 'webspeech');
    console.info('[cho-noi] dùng Web Speech:', why);
  };
  if (localAsr && !localSup.ok) {
    // ép ?asr=local nhưng trình duyệt thiếu tính năng
    useSpeech(localAsr, 'local');
    asrUI(`Trình duyệt này chưa chạy được bộ nghe trên máy (thiếu ${localSup.why.join(', ')}).`, { cls: 'error' });
  } else if (localAsr) {
    useSpeech(localAsr, 'local');
    asrUI('Bạn chờ một chút nhé, chợ đang dọn hàng ra…', { frac: 0 });
    localAsr.addEventListener('load-progress', (e) => {
      const { loaded, total } = e.detail;
      if (speech.kind !== 'local') return;
      if (loaded >= total) asrUI('Hàng bày xong rồi, sắp mở chợ…', { frac: 1 });
      else asrUI(`Bạn chờ một chút nhé, chợ đang dọn hàng ra… ${Math.floor(100 * loaded / Math.max(1, total))}%`, { frac: loaded / Math.max(1, total) });
    });
    localAsr.addEventListener('load-ready', (e) => {
      const { rtf, cached, heapMB, loadMs } = e.detail;
      console.info(`[cho-noi] bộ nghe cục bộ sẵn sàng: RTF ${rtf}, ${loadMs} ms${cached ? ' (từ bộ nhớ đệm)' : ''}, heap ${heapMB} MB`);
      if (rtf > ASR_MAX_RTF && ASR_PARAM !== 'local' && webSpeech) {
        fallbackWeb('máy chậm, RTF ' + rtf);
        asrUI('Máy hơi chậm cho bộ nghe trên máy, tạm dùng bộ nghe của trình duyệt (cần mạng).', { cls: 'error' });
        return;
      }
      useSpeech(localAsr, 'local');
      asrUI('Bộ nghe tiếng Việt sẵn sàng, chạy ngay trên máy.', { cls: 'ready' });
    });
    localAsr.addEventListener('load-error', (e) => {
      console.warn('[cho-noi] tải bộ nghe lỗi:', e.detail.code, e.detail.message);
      const net = e.detail.code === 'network';
      if (webSpeech && ASR_PARAM !== 'local') {
        fallbackWeb('tải lỗi');
        asrUI(net ? 'Tải bộ nghe bị lỗi mạng. Tạm dùng bộ nghe của trình duyệt (cần mạng).' : 'Máy chưa chạy được bộ nghe trên máy. Tạm dùng bộ nghe của trình duyệt (cần mạng).',
          { cls: 'error', retry: net });
      } else {
        asrUI(net ? 'Tải bộ nghe bị lỗi mạng. Kiểm tra mạng rồi bấm Thử lại.' : 'Máy chưa chạy được bộ nghe tiếng Việt. Bấm Thử lại hoặc mở bằng trình duyệt khác.', { cls: 'error', retry: true });
      }
    });
    btnAsrRetry.addEventListener('click', () => {
      if (speech.kind !== 'local') asrUI('Đang tải lại bộ nghe tiếng Việt… (vẫn chơi được bằng bộ nghe của trình duyệt)', { frac: 0 });
      else asrUI('Đang tải lại bộ nghe tiếng Việt…', { frac: 0 });
      localAsr.load();
    });
  } else if (webSpeech) {
    useSpeech(webSpeech, 'webspeech');
    if (ASR_PARAM !== 'webspeech') asrUI('Trình duyệt này chưa chạy được bộ nghe trên máy, dùng bộ nghe của trình duyệt (cần mạng).', { cls: 'error' });
  }
  if (speech) updateStartBtn();

  if (speech) {
    new VoiceControl({ game, speech, panel });
    speech.addEventListener('listening', () => {
      panel.setMic('on');
      if (waitFor) { sfx.unlock(); sfx.micBeep(); }       // bíp nhẹ khi micro bắt đầu nghe (lúc bắt đầu / chơi tiếp)
      const w = waitFor; waitFor = null;
      screens.showMicWait(false);
      if (w === 'start') beginRun();
      else if (w === 'resume') game.resume();
    });
    speech.addEventListener('activity', (e) => panel.setActivity(e.detail.on));
    speech.addEventListener('error', (e) => onSpeechError(e.detail.code));
  }

  function onSpeechError(code) {
    console.info('[cho-noi] speech:', code);
    panel.setMic('off');
    screens.showMicWait(false);
    if (running()) { game.pause('speech'); waitFor = 'resume'; }
    else if (waitFor !== 'start') { if (game.state !== 'title') return; waitFor = 'start'; } // lỗi lúc không chơi: bỏ qua
    screens.showSpeechError(code, support);
  }

  // mở micro (trong click) rồi chờ 'listening'
  function listen(kind) {
    waitFor = kind;
    panel.setMic('wait');
    screens.showMicWait(kind === 'start');
    speech.start({ gesture: true });
  }

  function startRun() {
    sfx.unlock();                                        // iOS: mở khoá âm thanh ngay trong cú bấm Bắt đầu / Chơi lại
    if (btnStart.disabled && !screens.start.hidden) return;
    if (pendingUse && speech && !running()) { speech.use(...pendingUse); app.dataset.asr = pendingUse[1]; pendingUse = null; }
    screens.hideStart(); screens.hideResult(); screens.hideSpeechError();
    if (!canListen()) { showNoSpeech(); return; }
    game.toTitle();
    listen('start');
  }
  function beginRun() {
    hud.show(true); panel.show(true);
    game.start();
  }
  function toTitle() {
    waitFor = null; speech && speech.release();
    if (pendingUse && speech) { speech.use(...pendingUse); app.dataset.asr = pendingUse[1]; pendingUse = null; updateStartBtn(); }
    screens.hideResult(); screens.hideSpeechError(); screens.showMicWait(false); screens.setPaused(false);
    panel.show(false); hud.show(false);
    if (game.paused) game.resume();
    game.toTitle();
    if (canListen()) screens.showStart(game.best); else showNoSpeech();
  }
  function showNoSpeech() { hud.show(false); panel.show(false); screens.showNoSpeech(support, pageUrl); }
  function resumeRun() {
    sfx.unlock();
    if (!screens.rotateEl.hidden) return;
    screens.setPaused(false);
    listen('resume');
  }

  game.addEventListener('crash', () => { speech && speech.stop(); panel.setMic('off'); });
  game.addEventListener('over', () => { speech && speech.stop(); });

  document.getElementById('btn-start').addEventListener('click', startRun);
  document.getElementById('btn-again').addEventListener('click', startRun);
  document.getElementById('btn-home').addEventListener('click', toTitle);
  document.getElementById('btn-resume').addEventListener('click', resumeRun);
  document.getElementById('btn-mic-cancel').addEventListener('click', toTitle);
  document.getElementById('btn-speech-home').addEventListener('click', toTitle);
  document.getElementById('btn-speech-retry').addEventListener('click', () => {
    screens.hideSpeechError();
    if (waitFor === 'resume' && game.paused) listen('resume');
    else startRun();
  });
  const btnCopy = document.getElementById('btn-copy-link');
  btnCopy.addEventListener('click', () => screens.copyLink(pageUrl, btnCopy));
  document.getElementById('btn-try-here').addEventListener('click', () => { forceTry = true; screens.hideNoSpeech(); startRun(); });
  document.getElementById('btn-reload').addEventListener('click', () => location.reload());
  document.getElementById('btn-continue').addEventListener('click', () => screens.hideError());
  const licEl = document.getElementById('overlay-licenses');
  document.getElementById('btn-licenses').addEventListener('click', () => { licEl.hidden = false; });
  document.getElementById('btn-licenses-close').addEventListener('click', () => { licEl.hidden = true; });

  // ---- âm thanh (B6): nút loa, pháo hoa, tab ẩn thì tắt tiếng
  const soundBtn = new SoundButton(document.getElementById('btn-sound'), sfx);
  screens.fireworks.onBoom = () => sfx.crackle();
  // chạm lần đầu ở bất kỳ đâu cũng mở khoá (nhạc màn bắt đầu chạy sau cú chạm đầu tiên)
  document.addEventListener('pointerdown', () => sfx.unlock(), { once: true, capture: true });
  document.addEventListener('visibilitychange', () => sfx.setHidden(document.hidden));
  window.addEventListener('pageshow', () => sfx.setHidden(document.hidden));

  // ---- tab ẩn: tạm dừng
  // bộ nghe cục bộ: trang ẩn thì trả micro hẳn (tắt đèn micro), bấm Chơi tiếp sẽ xin lại
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (running()) game.pause('hidden');
    if (speech && speech.kind === 'local') speech.release();
  });
  window.addEventListener('pagehide', () => { if (running()) game.pause('hidden'); if (speech) speech.release(); sfx.setHidden(true); });

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  layout();

  // ---- vòng lặp
  let last = performance.now(), paddleT = 0.5;
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;          // tab vừa hiện lại / máy giật: không nhảy cóc
    if (document.hidden) dt = 0;
    game.update(dt);
    renderer.frame(dt);
    // mái chèo khua nước theo nhịp, chỉ khi đang chèo ghe (cấp 0) và ghe hàng đang tới
    if (game.state === 'playing' && !game.paused && !game.frozen && game.tier === 0 && dt > 0) {
      paddleT += dt;
      const every = 0.78 / Math.min(1.5, game.driftFactor);
      if (paddleT >= every) { paddleT = 0; sfx.paddle(); }
    } else paddleT = 0.5;
    if (game.state === 'crash' && !shot.taken && game.crash && game.crash.t >= CONFIG.CRASH_SNAP_T) { shot.taken = true; snapCrash(); }
    if (game.state === 'playing') panel.setTime(game.remainingFrac);
    if (game.state !== 'title') hud.update(game);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  screens.setLoading(null);
  app.classList.remove('is-loading');
  if (canListen()) screens.showStart(game.best); else showNoSpeech();
  app.dataset.state = 'title';

  if (failed.length) {
    console.warn('[cho-noi] sprite nạp lỗi:', failed.join(', '));
    screens.showError(`Thiếu ${failed.length} hình (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}). Tải lại trang thử nha, hoặc chơi tạm.`, true);
  }

  // cho B4 và kiểm thử
  window.game = game;
  window.__choNoi = { shot, paintShot, pickRoast, game, renderer, assets, panel, hud, screens, startRun, toTitle, speech, support, localAsr, webSpeech, localSup, sfx, soundBtn };
}

boot().catch((e) => {
  console.warn('[cho-noi] lỗi khởi động', e);
  screens.setLoading(null);
  screens.showError('Game gặp lỗi khi khởi động. Tải lại trang thử nha.', false);
});
