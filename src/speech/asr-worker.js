// Web Worker của bộ nghe cục bộ (B4b). Script thường (importScripts), chạy riêng luồng để game không giật.
// Việc: tải mô hình (có Cache Storage + tiến độ) -> khởi tạo sherpa-onnx WebAssembly -> đo tốc độ ->
// nhận âm thanh 16 kHz từ trang -> VAD theo năng lượng -> giải mã lặp lại đoạn âm thanh từ lúc câu hiện tại bắt đầu.
//
// Tin vào:  {type:'load', base, manifest, opts}  | {type:'audio', samples:Float32Array}
//           {type:'context', id, hotwords, maxSec} (id=0: tạm ngừng giải mã) | {type:'reset'}
// Tin ra:   {type:'progress', loaded, total} | {type:'ready', rtf, benchMs, loadMs, heapMB, cached}
//           {type:'load-error', code:'network'|'init', message} | {type:'activity', on}
//           {type:'result', id, text, ms, audioSec, at (giây âm thanh tính từ lúc mở micro, cuối đoạn), interval}
/* global ChoNoiAsrCore, createChoNoiAsr */
'use strict';
importScripts('asr-core.js?v=c077d626');

const SR = 16000;
const FRAME = 320;                 // 20 ms
const PREROLL = 0.3 * SR;          // lấy thêm 0,3 s trước tiếng đầu tiên
const MIN_NEW = 0.15 * SR;         // có ít nhất 150 ms âm thanh mới mới giải mã lại
const MIN_GAP_MS = 350;            // nhịp giải mã tối thiểu
const MAX_GAP_MS = 1500;
const HANGOVER_FRAMES = 30;        // 600 ms im lặng thì coi là hết tiếng
const RING_SEC = 30;
const CACHE_PREFIX = 'cho-noi-asr-';

let engine = null, opts = {};
// ---------------------------------------------------------------- bộ đệm vòng
const ring = new Float32Array(RING_SEC * SR);
let total = 0;                       // tổng số mẫu đã nhận (vị trí tuyệt đối)
function push(x) {
  let off = total % ring.length, i = 0;
  while (i < x.length) {
    const n = Math.min(x.length - i, ring.length - off);
    ring.set(x.subarray(i, i + n), off);
    i += n; off = 0;
  }
  total += x.length;
}
function slice(a, b) {               // [a, b) tuyệt đối
  a = Math.max(a, total - ring.length, 0); b = Math.min(b, total);
  const out = new Float32Array(Math.max(0, b - a));
  let o = 0;
  for (let p = a; p < b;) {
    const off = p % ring.length, n = Math.min(b - p, ring.length - off);
    out.set(ring.subarray(off, off + n), o);
    o += n; p += n;
  }
  return out;
}

// ---------------------------------------------------------------- VAD theo năng lượng
let frameBuf = new Float32Array(FRAME), frameLen = 0;
let floor = 0.002, voicedRun = 0, silentRun = 0, speaking = false, lastVoiceAt = 0;
function vad(x) {
  for (let i = 0; i < x.length; i++) {
    frameBuf[frameLen++] = x[i];
    if (frameLen < FRAME) continue;
    frameLen = 0;
    let e = 0;
    for (let k = 0; k < FRAME; k++) e += frameBuf[k] * frameBuf[k];
    const rms = Math.sqrt(e / FRAME);
    const voiced = rms > Math.max(0.006, floor * 3);
    // nền ồn: theo xuống nhanh, lên chậm
    floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor + (rms - floor) * 0.003;
    const at = total - x.length + i + 1;
    if (voiced) {
      voicedRun++; silentRun = 0; lastVoiceAt = at;
      if (!speaking && voicedRun >= 3) { speaking = true; onSpeech(at - 3 * FRAME); }
    } else {
      voicedRun = 0;
      if (speaking && ++silentRun >= HANGOVER_FRAMES) { speaking = false; postMessage({ type: 'activity', on: false }); }
    }
  }
}

// ---------------------------------------------------------------- câu hiện tại + lịch giải mã
let ctx = null;            // { id, hotwords, start, firstVoice, maxSamples, decodedTo, lastText }
let timer = 0, nextAt = 0, gap = MIN_GAP_MS;

function onSpeech(at) {
  postMessage({ type: 'activity', on: true });
  if (ctx && ctx.firstVoice < 0) ctx.firstVoice = Math.max(ctx.start, at - PREROLL);
  schedule();
}

function schedule() {
  if (timer || !engine || !ctx || ctx.firstVoice < 0) return;
  if (total - ctx.decodedTo < MIN_NEW) return;
  // hết tiếng và đã giải mã tới sau tiếng cuối: thôi
  if (!speaking && ctx.decodedTo >= lastVoiceAt + 0.2 * SR) return;
  const wait = Math.max(0, nextAt - Date.now());
  timer = setTimeout(run, wait);
}

function run() {
  timer = 0;
  if (!engine || !ctx || ctx.firstVoice < 0) return;
  const end = total;
  const a = Math.max(ctx.firstVoice, end - ctx.maxSamples);
  const x = slice(a, end);
  if (x.length < 0.2 * SR) { ctx.decodedTo = end; return; }
  const r = engine.decode(x, ctx.hotwords);
  ctx.decodedTo = end;
  // giải mã chậm thì giãn nhịp (không để dồn hàng): nghỉ ít nhất bằng thời gian vừa giải mã
  gap = Math.min(MAX_GAP_MS, Math.max(MIN_GAP_MS, r.ms * 1.1));
  nextAt = Date.now() + gap;
  if (r.text !== ctx.lastText) {
    ctx.lastText = r.text;
    postMessage({ type: 'result', id: ctx.id, text: r.text, ms: Math.round(r.ms), audioSec: +(x.length / SR).toFixed(2), at: +(end / SR).toFixed(2), interval: Math.round(gap) });
  }
  // nếu trong lúc giải mã đã có âm thanh mới, các tin 'audio' xếp hàng sẽ gọi schedule(); gọi thêm ở đây cho chắc
  schedule();
}

// ---------------------------------------------------------------- tải mô hình (Cache Storage + tiến độ)
async function openCache(version) {
  if (typeof caches === 'undefined') return null;
  try {
    const name = CACHE_PREFIX + version;
    for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX) && k !== name) caches.delete(k);
    return await caches.open(name);
  } catch (e) { return null; }
}

async function fetchBytes(url, size, onBytes) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status + ' ' + url), { code: 'network' });
  if (!res.body || !res.body.getReader) {
    const b = new Uint8Array(await res.arrayBuffer()); onBytes(b.length); return b;
  }
  const reader = res.body.getReader();
  let out = new Uint8Array(size || 1 << 20), n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (n + value.length > out.length) { const t = new Uint8Array(Math.max(out.length * 2, n + value.length)); t.set(out.subarray(0, n)); out = t; }
    out.set(value, n); n += value.length;
    onBytes(value.length);
  }
  return n === out.length ? out : out.slice(0, n);
}

// Một tệp trong manifest: {name, size, parts?:[{name,size}]} (tệp > 95 MB được chia phần, ghép lại ở đây).
// Có Cache Storage: luồng tải đổ thẳng vào cache (không giữ thêm bản sao trong bộ nhớ), rồi đọc ra một lần.
async function getPiece(cache, base, version, name, size, progress) {
  const key = new URL(name + '?v=' + version, base).href;
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const b = new Uint8Array(await hit.arrayBuffer());
        if (b.length === size) { progress(size); return { bytes: b, cached: true }; }
        await cache.delete(key);
      }
    } catch (e) { /* đọc cache lỗi: tải lại */ }
  }
  if (cache && typeof TransformStream === 'function') {
    let ok = false;
    try {
      const res = await fetch(key, { cache: 'no-cache' });
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status + ' ' + name), { code: 'network' });
      const counter = new TransformStream({ transform(chunk, c) { progress(chunk.length); c.enqueue(chunk); } });
      await cache.put(key, new Response(res.body.pipeThrough(counter), { headers: { 'Content-Type': 'application/octet-stream' } }));
      ok = true;
    } catch (e) {
      if (e && e.code === 'network') throw e;
      if (e && e.name !== 'QuotaExceededError') throw Object.assign(new Error(String(e && e.message || e)), { code: 'network' });
      // đầy bộ nhớ: tải thẳng không cache
    }
    if (ok) {
      const hit = await cache.match(key);
      const b = hit ? new Uint8Array(await hit.arrayBuffer()) : null;
      if (b && b.length === size) return { bytes: b, cached: false };
      try { await cache.delete(key); } catch (e) { /* bỏ qua */ }
      throw Object.assign(new Error(`tải thiếu ${name}: ${b ? b.length : 0}/${size}`), { code: 'network' });
    }
  }
  const bytes = await fetchBytes(key, size, progress);
  if (bytes.length !== size) throw Object.assign(new Error(`tải thiếu ${name}: ${bytes.length}/${size}`), { code: 'network' });
  return { bytes, cached: false };
}

async function getFile(cache, base, version, f, progress) {
  if (!f.parts || !f.parts.length) return getPiece(cache, base, version, f.name, f.size, progress);
  const bytes = new Uint8Array(f.size);
  let o = 0, cached = true;
  for (const p of f.parts) {
    const r = await getPiece(cache, base, version, p.name, p.size, progress);
    bytes.set(r.bytes, o); o += r.bytes.length; cached = cached && r.cached;
  }
  if (o !== f.size) throw Object.assign(new Error('ghép sai kích thước ' + f.name), { code: 'network' });
  return { bytes, cached };
}

let loading = false;
async function load(msg) {
  if (engine || loading) { if (engine) postMessage(readyMsg); return; }
  loading = true;
  const t0 = Date.now();
  const { base, manifest } = msg;
  opts = msg.opts || {};
  const totalBytes = manifest.files.reduce((s, f) => s + f.size, 0);
  let loaded = 0, lastPost = 0;
  const progress = (n) => {
    loaded += n;
    const now = Date.now();
    if (now - lastPost > 120 || loaded >= totalBytes) { lastPost = now; postMessage({ type: 'progress', loaded, total: totalBytes }); }
  };
  postMessage({ type: 'progress', loaded: 0, total: totalBytes });
  let files = {}, allCached = true;
  try {
    const cache = await openCache(manifest.version);
    // tải lần lượt (đỡ tốn bộ nhớ đỉnh hơn tải song song)
    for (const f of manifest.files) {
      const r = await getFile(cache, base, manifest.version, f, progress);
      files[f.name] = r.bytes; allCached = allCached && r.cached;
    }
  } catch (e) {
    loading = false; files = null;
    postMessage({ type: 'load-error', code: e.code || 'network', message: String(e && e.message || e) });
    return;
  }
  try {
    // phần JS của module cũng lấy từ cache (qua Blob URL) để lần sau không cần mạng
    const glue = files['chonoi-asr.js']; files['chonoi-asr.js'] = null;
    const glueUrl = URL.createObjectURL(new Blob([glue], { type: 'text/javascript' }));
    try { importScripts(glueUrl); } finally { URL.revokeObjectURL(glueUrl); }
    const wasmBinary = files['chonoi-asr.wasm']; files['chonoi-asr.wasm'] = null;
    const Module = await createChoNoiAsr({ wasmBinary, print() {}, printErr(t) { if (opts.debug) console.warn('[asr]', t); } });
    engine = ChoNoiAsrCore.createEngine(Module, files, { method: opts.method || 'modified_beam_search', hotwordsScore: opts.hotwordsScore || 2.0 });
    files = null;
    const b = ChoNoiAsrCore.benchmark(engine, 3);
    readyMsg = { type: 'ready', rtf: +b.rtf.toFixed(3), benchMs: Math.round(b.ms), loadMs: Date.now() - t0, heapMB: Math.round(engine.heapBytes() / 1048576), cached: allCached };
    loading = false;
    postMessage(readyMsg);
  } catch (e) {
    loading = false; engine = null;
    postMessage({ type: 'load-error', code: 'init', message: String(e && e.message || e) });
  }
}
let readyMsg = null;

function reset() {
  clearTimeout(timer); timer = 0;
  ctx = null; speaking = false; voicedRun = 0; silentRun = 0; frameLen = 0;
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'audio') {
    push(m.samples); vad(m.samples);
    schedule();
  } else if (m.type === 'context') {
    clearTimeout(timer); timer = 0;
    if (!m.id) { ctx = null; return; }
    ctx = { id: m.id, hotwords: m.hotwords || '', start: total, firstVoice: -1, maxSamples: Math.round((m.maxSec || 15) * SR), decodedTo: total, lastText: '' };
    // đang nói dở lúc câu mới bắt đầu: tính từ đây (lùi chút cho khỏi mất âm đầu)
    if (speaking) ctx.firstVoice = Math.max(0, total - Math.round(0.15 * SR));
    nextAt = 0;
    schedule();
  } else if (m.type === 'reset') {
    reset();
  } else if (m.type === 'load') {
    load(m);
  }
};
