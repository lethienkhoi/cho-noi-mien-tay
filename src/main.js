// Khởi động game: nạp dữ liệu + sprite, nối Game <-> Renderer <-> UI, vòng lặp requestAnimationFrame.
// Mọi đường dẫn đều tương đối để chạy được trong thư mục con của GitHub Pages.
import { CONFIG } from './config.js';
import { Assets } from './game/assets.js';
import { Game } from './game/game.js';
import { Renderer } from './game/renderer.js';
import { Hud } from './ui/hud.js';
import { Panel } from './ui/panel.js';
import { Screens } from './ui/screens.js';

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
  ['background', 'hero_scream', 'nonla', 'fg_hyacinth', 'fg_branch'].forEach(add);
  Object.keys(S).filter((n) => /^(far|mid)_\d+$/.test(n)).forEach(add);
  for (const v of man.vehicles) [v.sprite, v.cocky, v.empty, v.play, v.playCocky, v.jump].forEach(add);
  for (const k of man.vendors) for (const f of man.vendorFaces) add(`${k}_${f}`);
  for (const p of phrases.phrases) { const st = man.stallMap[p.stall]; add(st); if (S[st]) add(S[st].back); }
  return [...out];
}

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
    if (first) { renderer.bakeAll(); first = false; }
    else { clearTimeout(bakeTimer); bakeTimer = setTimeout(() => renderer.bakeAll(), 160); }
    checkOrientation();
  }

  // ---- xoay màn: điện thoại nằm ngang thì che và tạm dừng
  function checkOrientation() {
    const land = window.innerWidth > window.innerHeight && window.innerHeight < 520;
    screens.setRotate(land);
    if (land && running()) game.pause('rotate');
  }
  const running = () => game.state === 'playing' || game.state === 'jumping' || game.state === 'crash';

  // ---- nối sự kiện game -> UI
  game.addEventListener('round', (e) => panel.play(e.detail.phrase));
  game.addEventListener('matched', (e) => panel.passed(e.detail.phrase, e.detail));
  game.addEventListener('crash', (e) => panel.crash(e.detail.phrase));
  game.addEventListener('over', (e) => {
    panel.show(false);
    screens.showResult(e.detail, man.vehicles, (n) => assets.url(n));
  });
  game.addEventListener('state', (e) => { app.dataset.state = e.detail.state; });
  game.addEventListener('pause', (e) => screens.setPaused(e.detail.paused && e.detail.reason !== 'qa'));

  function startRun() {
    screens.hideStart(); screens.hideResult();
    hud.show(true); panel.show(true);
    game.start();
  }
  function toTitle() {
    screens.hideResult(); panel.show(false); hud.show(false);
    game.toTitle();
    screens.showStart(game.best);
  }

  // ---- điều khiển tạm (B3): chạm = đọc đúng. B4 thay bằng game.onPhraseMatched(roundId, {dialect}).
  app.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || game.paused) return;
    if (game.state === 'playing') { e.preventDefault(); game.tap(); }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'Enter') && game.state === 'playing' && !game.paused) { e.preventDefault(); game.tap(); }
  });
  document.getElementById('btn-start').addEventListener('click', startRun);
  document.getElementById('btn-again').addEventListener('click', startRun);
  document.getElementById('btn-home').addEventListener('click', toTitle);
  document.getElementById('btn-resume').addEventListener('click', () => { if (!screens.rotateEl.hidden) return; game.resume(); });
  document.getElementById('btn-reload').addEventListener('click', () => location.reload());
  document.getElementById('btn-continue').addEventListener('click', () => screens.hideError());

  // ---- tab ẩn: tạm dừng
  document.addEventListener('visibilitychange', () => { if (document.hidden && running()) game.pause('hidden'); });
  window.addEventListener('pagehide', () => { if (running()) game.pause('hidden'); });

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  layout();

  // ---- vòng lặp
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;          // tab vừa hiện lại / máy giật: không nhảy cóc
    if (document.hidden) dt = 0;
    game.update(dt);
    renderer.frame(dt);
    if (game.state === 'playing') panel.setTime(game.remainingFrac);
    if (game.state !== 'title') hud.update(game);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  screens.setLoading(null);
  app.classList.remove('is-loading');
  screens.showStart(game.best);
  app.dataset.state = 'title';

  if (failed.length) {
    console.warn('[cho-noi] sprite nạp lỗi:', failed.join(', '));
    screens.showError(`Thiếu ${failed.length} hình (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}). Tải lại trang thử nha, hoặc chơi tạm.`, true);
  }

  // cho B4 và kiểm thử
  window.game = game;
  window.__choNoi = { game, renderer, assets, panel, hud, screens, startRun, toTitle };
}

boot().catch((e) => {
  console.warn('[cho-noi] lỗi khởi động', e);
  screens.setLoading(null);
  screens.showError('Game gặp lỗi khi khởi động. Tải lại trang thử nha.', false);
});
