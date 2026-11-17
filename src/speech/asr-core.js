// Lõi nhận giọng cục bộ (B4b): bọc module WebAssembly sherpa-onnx (assets/asr/chonoi-asr.{js,wasm}).
// Script thường (không phải ES module) để dùng được trong Web Worker (importScripts) lẫn Node (require) khi thử.
// Không đụng DOM. Mô hình: Zipformer tiếng Việt INT8 (offline transducer), giải mã một lần cả đoạn âm thanh.
(function (root) {
  'use strict';

  // Tệp mô hình: tên trong manifest -> tên trong bộ nhớ ảo của module
  const MODEL_FILES = ['encoder.int8.onnx', 'decoder.onnx', 'joiner.int8.onnx', 'tokens.txt', 'bpe.vocab'];

  // Chữ cho hotwords: NFC, chữ HOA (mô hình viết hoa), bỏ dấu câu.
  function hotwordText(text) {
    return String(text || '').normalize('NFC').toUpperCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  // Câu hiện tại -> chuỗi hotwords (các cụm cách nhau bởi "/"): cả câu chính tả và câu phiên âm;
  // withWords: thêm từng chữ riêng lẻ (giúp bắt lại chữ sau khi lệch giữa câu).
  function phraseHotwords(phrase, withWords) {
    if (!phrase) return '';
    const out = [];
    const add = (h) => { if (h && out.indexOf(h) < 0) out.push(h); };
    for (const t of [phrase.chinhTa, phrase.phienAm]) add(hotwordText(t));
    if (withWords) for (const t of [phrase.chinhTa, phrase.phienAm]) hotwordText(t).split(' ').forEach(add);
    return out.join('/');
  }

  // Module: đối tượng emscripten đã khởi tạo. files: { tên: Uint8Array } (bị chiếm, không chép lại).
  // opts: { method: 'modified_beam_search' | 'greedy_search', hotwordsScore, maxActivePaths, debug }
  function createEngine(Module, files, opts) {
    opts = opts || {};
    const FS = Module.FS;
    const dir = '/m';
    try { FS.mkdir(dir); } catch (e) { /* đã có */ }
    for (const name of MODEL_FILES) {
      const data = files[name];
      if (!data) throw new Error('thiếu tệp mô hình ' + name);
      FS.writeFile(dir + '/' + name, data, { canOwn: true });   // MEMFS giữ luôn mảng, không chép
      files[name] = null;
    }
    const str = (s) => { const n = Module.lengthBytesUTF8(s) + 1, p = Module._malloc(n); Module.stringToUTF8(s, p, n); return p; };
    const args = [dir + '/encoder.int8.onnx', dir + '/decoder.onnx', dir + '/joiner.int8.onnx', dir + '/tokens.txt', dir + '/bpe.vocab',
      opts.method || 'modified_beam_search'].map(str);
    const rec = Module._cn_create(args[0], args[1], args[2], args[3], args[4], args[5],
      opts.maxActivePaths || 4, opts.hotwordsScore == null ? 1.5 : opts.hotwordsScore, 1, opts.debug ? 1 : 0);
    args.forEach((p) => Module._free(p));
    // mô hình đã nằm trong bộ nhớ của onnxruntime: xoá bản trong bộ nhớ ảo cho nhẹ
    for (const name of MODEL_FILES) { try { FS.unlink(dir + '/' + name); } catch (e) { /* bỏ qua */ } }
    if (!rec) throw new Error('không tạo được bộ nhận giọng');

    let bufPtr = 0, bufCap = 0;
    return {
      // samples: Float32Array 16 kHz mono. Trả { text, ms }
      decode(samples, hotwords) {
        const n = samples.length;
        if (n > bufCap) {
          if (bufPtr) Module._free(bufPtr);
          bufCap = Math.max(n, 16000 * 4);
          bufPtr = Module._malloc(bufCap * 4);
        }
        Module.HEAPF32.set(samples, bufPtr >> 2);
        const hw = hotwords ? str(hotwords) : 0;
        const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
        const p = Module._cn_decode(rec, bufPtr, n, 16000, hw);
        const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
        if (hw) Module._free(hw);
        let text = '';
        if (p) { text = Module.UTF8ToString(p); Module._free(p); }
        return { text: text.trim(), ms };
      },
      heapBytes() { return Module.HEAPU8 ? Module.HEAPU8.length : 0; },
      destroy() { if (bufPtr) Module._free(bufPtr); bufPtr = 0; Module._cn_destroy(rec); },
    };
  }

  // Đo hệ số thời gian thực: giải mã đoạn tiếng ồn nhỏ dài sec giây (lần đầu để làm nóng). Trả RTF của lần sau.
  function benchmark(engine, sec) {
    sec = sec || 3;
    const n = Math.round(16000 * sec), x = new Float32Array(n);
    let s = 12345;
    for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; x[i] = ((s / 0x7fffffff) - 0.5) * 0.02 * (1 + Math.sin(i / 800)); }
    engine.decode(x.subarray(0, 16000), '');
    const r = engine.decode(x, '');
    return { rtf: r.ms / (sec * 1000), ms: r.ms, sec };
  }

  const api = { MODEL_FILES, hotwordText, phraseHotwords, createEngine, benchmark };
  root.ChoNoiAsrCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
