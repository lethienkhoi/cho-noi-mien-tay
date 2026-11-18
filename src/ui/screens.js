// Màn bắt đầu, bảng kết quả, lớp phủ (tạm dừng, xoay màn, đang tải, lỗi, micro/giọng nói).
import { fmtScore } from './format.js?v=c077d626';
import { Fireworks } from './fireworks.js?v=c077d626';

export class Screens {
  constructor(app) {
    this.app = app;
    const q = (s) => app.querySelector(s);
    this.start = q('#screen-start'); this.result = q('#screen-result');
    this.pauseEl = q('#overlay-pause'); this.rotateEl = q('#overlay-rotate');
    this.loadingEl = q('#overlay-loading'); this.errorEl = q('#overlay-error');
    this.loadFill = q('#load-fill');
    this.startBest = q('#start-best');
    this.res = {
      badge: q('#res-badge'), score: q('#res-score'), roast: q('#res-roast'), top: q('#res-top'),
      shot: q('#res-shot'), shotCv: q('#res-shot-cv'),
    };
    this.fireworks = new Fireworks(q('#fireworks'));
    this.errorMsg = q('#error-msg');
    this.micEl = q('#overlay-mic'); this.speechEl = q('#overlay-speech'); this.noSpeechEl = q('#screen-nospeech');
  }

  // ---------------------------------------------------------------- micro / giọng nói (B4)
  showMicWait(on) { this.micEl.hidden = !on; }

  // code: denied | need-tap | network | audio-capture | unsupported-lang | stuck | start-failed
  showSpeechError(code, sup = {}) {
    const q = (s) => this.speechEl.querySelector(s);
    const T = SPEECH_ERRORS[code] || SPEECH_ERRORS['start-failed'];
    q('#speech-title').textContent = T.title;
    q('#speech-lead').textContent = T.lead;
    const howto = q('#speech-howto');
    howto.textContent = '';
    let blocks = T.howto || [];
    if (code === 'denied') blocks = sup.android ? [HOW_ANDROID, HOW_IOS] : [HOW_IOS, HOW_ANDROID];
    for (const b of blocks) howto.appendChild(howtoBlock(b));
    howto.hidden = !blocks.length;
    q('#btn-speech-retry').textContent = T.retry || 'Thử lại';
    this.speechEl.hidden = false;
  }
  hideSpeechError() { this.speechEl.hidden = true; }

  // trình duyệt không nghe được giọng nói: báo sớm thay cho màn bắt đầu
  showNoSpeech(sup, url) {
    const q = (s) => this.noSpeechEl.querySelector(s);
    let lead, blocks;
    if (!sup.secure) {
      q('#nospeech-title').textContent = 'Cần mở bằng link https';
      lead = 'Micro chỉ chạy khi trang mở bằng link an toàn (https). Mở đúng link game bên dưới bằng Chrome hoặc Safari.';
      blocks = [];
    } else if (sup.inApp) {
      lead = `Đang mở trong ${sup.inApp}, trình duyệt trong app thường không cho nghe micro. Mở link bằng ${sup.ios ? 'Safari' : 'Chrome'} để chơi.`;
      blocks = [sup.ios ? HOW_INAPP_IOS : HOW_INAPP_ANDROID];
    } else {
      lead = 'Mở link game bằng Chrome (điện thoại Android) hoặc Safari (iPhone) để chơi.';
      blocks = [HOW_OPEN];
    }
    q('#nospeech-lead').textContent = lead;
    const howto = q('#nospeech-howto');
    howto.textContent = '';
    for (const b of blocks) howto.appendChild(howtoBlock(b));
    howto.hidden = !blocks.length;
    // nút Mở bằng Chrome: chỉ Android trong app (intent://)
    const a = q('#btn-open-chrome');
    if (sup.android && sup.inApp) {
      const u = new URL(url);
      a.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
      a.hidden = false;
    } else a.hidden = true;
    q('#btn-try-here').hidden = !(sup.api && sup.inApp && sup.secure);
    q('#link-box').value = url;
    this.noSpeechEl.hidden = false; this.start.hidden = true;
  }
  hideNoSpeech() { this.noSpeechEl.hidden = true; }

  // gọi trong click: chép link, không được thì hiện ô link để tự chép
  copyLink(url, btn) {
    const box = this.noSpeechEl.querySelector('#link-box');
    const fallback = () => {
      box.hidden = false; box.value = url;
      try { box.focus(); box.select(); box.setSelectionRange(0, url.length); } catch (e) { /* bỏ qua */ }
      btn.textContent = 'Giữ vào ô link để chép';
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => { btn.textContent = 'Đã chép link'; }, fallback);
        return;
      }
    } catch (e) { /* rơi xuống dự phòng */ }
    fallback();
  }

  showStart(best) { this.startBest.textContent = fmtScore(best); this.start.hidden = false; this.result.hidden = true; }
  hideStart() { this.start.hidden = true; }

  // 2026-11-18 Khôi: không HẾT LƯỢT, không các cấp phương tiện. Điểm to nhất, câu chọc, 4 điểm cao nhất,
  // ảnh khoảnh khắc đụng cuối (main.js vẽ vào #res-shot-cv sau khi bảng hiện, theo cỡ khung), pháo hoa khi phá kỷ lục.
  showResult({ score, newRecord, top = [], rank = -1 }, roast = '') {
    const r = this.res;
    r.badge.hidden = !newRecord;
    const txt = fmtScore(score);
    r.score.textContent = txt;
    r.score.style.setProperty('--len', String(Math.max(3, txt.length)));
    r.roast.textContent = roast || '';
    r.roast.hidden = !roast;
    r.top.textContent = '';
    for (let i = 0; i < 4; i++) {
      const row = top[i];
      const li = document.createElement('li');
      li.className = 'top-row' + (i === rank ? ' is-me' : '') + (row ? '' : ' is-empty');
      const n = document.createElement('span'); n.className = 'top-rank'; n.textContent = String(i + 1);
      const v = document.createElement('span'); v.className = 'top-score'; v.textContent = row ? fmtScore(row.s) : '—';
      const d = document.createElement('span'); d.className = 'top-date'; d.textContent = row ? (row.d || 'trước đây') : '';
      li.append(n, v, d);
      r.top.appendChild(li);
    }
    this.result.hidden = false;
    if (newRecord) this.fireworks.start(); else this.fireworks.stop();
  }
  hideResult() { this.result.hidden = true; this.fireworks.stop(); }

  setPaused(on) { this.pauseEl.hidden = !on; }
  setRotate(on) { this.rotateEl.hidden = !on; }
  setLoading(frac) {
    if (frac === null) { this.loadingEl.hidden = true; return; }
    this.loadingEl.hidden = false;
    this.loadFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
  }
  showError(msg, canContinue) {
    if (msg) this.errorMsg.textContent = msg;
    this.errorEl.querySelector('#btn-continue').hidden = !canContinue;
    this.errorEl.hidden = false;
  }
  hideError() { this.errorEl.hidden = true; }
}

// ---------------------------------------------------------------- chữ hướng dẫn
function howtoBlock({ head, steps }) {
  const d = document.createElement('div'); d.className = 'howto-block';
  const h = document.createElement('div'); h.className = 'howto-head'; h.textContent = head; d.appendChild(h);
  const ol = document.createElement('ol');
  for (const s of steps) { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); }
  d.appendChild(ol);
  return d;
}

const HOW_IOS = { head: 'iPhone (Safari)', steps: [
  'Bấm biểu tượng "aA" trên thanh địa chỉ > Cài đặt trang web > Micro > Cho phép.',
  'Hoặc: Cài đặt > Safari > Micro > Cho phép.',
  'Cần bật Đọc chính tả: Cài đặt > Cài đặt chung > Bàn phím > Đọc chính tả.',
] };
const HOW_ANDROID = { head: 'Android (Chrome)', steps: [
  'Bấm biểu tượng ổ khoá (hoặc biểu tượng cài đặt) cạnh địa chỉ trang.',
  'Chọn Quyền > Micro > Cho phép.',
] };
const HOW_INAPP_IOS = { head: 'Mở bằng Safari', steps: [
  'Bấm Sao chép link bên dưới.',
  'Mở Safari, dán link vào thanh địa chỉ.',
  'Hoặc bấm nút ⋯ / chia sẻ ở góc màn hình > Mở bằng trình duyệt.',
] };
const HOW_INAPP_ANDROID = { head: 'Mở bằng Chrome', steps: [
  'Bấm Mở bằng Chrome, hoặc nút ⋮ ở góc trên > Mở bằng trình duyệt.',
  'Không được thì Sao chép link rồi dán vào Chrome.',
] };
const HOW_OPEN = { head: 'Cách mở', steps: [
  'Bấm Sao chép link.',
  'Mở Chrome (Android) hoặc Safari (iPhone), dán link vào thanh địa chỉ.',
] };

const SPEECH_ERRORS = {
  denied: { title: 'Micro đang bị tắt', lead: 'Game cần micro để nghe đọc. Bật lại quyền micro cho trang này rồi bấm Thử lại.' },
  'need-tap': { title: 'Micro vừa tắt', lead: 'Điện thoại vừa ngắt micro. Bấm Nghe tiếp để mở lại.', retry: 'Nghe tiếp' },
  network: { title: 'Cần mạng để nhận giọng', lead: 'Máy nhận giọng của trình duyệt cần mạng. Kiểm tra wifi hoặc 4G rồi bấm Thử lại.' },
  'audio-capture': { title: 'Không thấy micro', lead: 'Kiểm tra micro, hoặc tắt app khác đang dùng micro (gọi điện, ghi âm) rồi bấm Thử lại.' },
  'unsupported-lang': { title: 'Chưa nghe được tiếng Việt', lead: 'Trình duyệt này chưa nhận giọng tiếng Việt. Mở bằng Chrome (Android) hoặc Safari (iPhone) bản mới.' },
  stuck: { title: 'Micro chưa chạy ổn', lead: 'Micro mở lên rồi tắt liên tục. Bấm Thử lại, hoặc tải lại trang.' },
  'start-failed': { title: 'Chưa mở được micro', lead: 'Có lỗi khi mở micro. Bấm Thử lại, hoặc tải lại trang.' },
};
