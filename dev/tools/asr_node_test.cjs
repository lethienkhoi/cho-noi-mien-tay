// Thử lõi nhận giọng WebAssembly (assets/asr) bằng Node: giải mã wav, tính WER, tỉ lệ "qua ghe" theo bộ chấm của game,
// hệ số thời gian thực (RTF), so có/không hotwords.
//   node dev/tools/asr_node_test.cjs --model-wavs <thư mục test_wavs của gói mô hình> --phrase-wavs <thư mục make_tts_wavs.py>
//        [--configs greedy,beam,hw1.5,hw2]
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const A = path.join(ROOT, 'assets', 'asr');
const Core = require(path.join(ROOT, 'src', 'speech', 'asr-core.js'));
const createChoNoiAsr = require(path.join(A, 'chonoi-asr.js'));

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }

function readWav(file) { // PCM16 / float32 mono
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + n);
    p += 8 + n + (n & 1);
  }
  const ch = fmt.ch, out = new Float32Array(Math.floor(data.length / (fmt.bits / 8) / ch));
  for (let i = 0; i < out.length; i++) {
    out[i] = fmt.bits === 16 ? data.readInt16LE(i * 2 * ch) / 32768 : data.readFloatLE(i * 4 * ch);
  }
  if (fmt.sr !== 16000) throw new Error(file + ': cần 16 kHz, có ' + fmt.sr);
  return out;
}

function wer(ref, hyp) {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i].concat(Array(hyp.length).fill(0)));
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
  return d[ref.length][hyp.length];
}

(async () => {
  const M = await import(path.join(ROOT, 'src', 'speech', 'matcher.js'));
  const t0 = Date.now();
  const Module = await createChoNoiAsr({ wasmBinary: fs.readFileSync(path.join(A, 'chonoi-asr.wasm')), print() {}, printErr() {} });
  const configs = arg('configs', 'greedy,beam,hw1.5,hw2').split(',');
  const engines = {};
  const mk = (method, score) => {
    const files = {};
    for (const n of Core.MODEL_FILES) files[n] = new Uint8Array(fs.readFileSync(path.join(A, n)));
    return Core.createEngine(Module, files, { method, hotwordsScore: score });
  };
  // một engine greedy + một engine beam (hotwords đổi theo từng lần giải mã, điểm thưởng đặt lúc tạo)
  for (const c of configs) {
    if (c === 'greedy') engines[c] = mk('greedy_search', 1.5);
    else if (c.startsWith('hw')) engines[c] = mk('modified_beam_search', parseFloat(c.slice(2)));  // hw2w = có thêm từng chữ
  }
  if (configs.includes('beam')) engines.beam = engines['hw1.5'] || mk('modified_beam_search', 1.5);
  console.log(`nạp module + ${Object.keys(engines).length} engine: ${Date.now() - t0} ms, heap wasm ${(Module.HEAPU8.length / 1048576).toFixed(0)} MB, rss ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);
  const b = Core.benchmark(Object.values(engines)[0], 3);
  console.log(`benchmark tiếng ồn 3s: ${b.ms.toFixed(0)} ms, RTF ${b.rtf.toFixed(3)}`);

  const mw = arg('model-wavs');
  if (mw) {
    console.log('\n== test_wavs trong gói mô hình (greedy)');
    const eng = engines.greedy || Object.values(engines)[0];
    for (const f of fs.readdirSync(mw).filter((f) => f.endsWith('.wav')).sort()) {
      const x = readWav(path.join(mw, f));
      const r = eng.decode(x, '');
      console.log(`${f}: "${r.text}"  ${(x.length / 16000).toFixed(2)}s, ${r.ms.toFixed(0)} ms, RTF ${(r.ms / (x.length / 16)).toFixed(3)}`);
    }
  }

  const pw = arg('phrase-wavs');
  if (pw) {
    const labels = JSON.parse(fs.readFileSync(path.join(pw, 'labels.json'), 'utf8'));
    const show = process.argv.includes('--verbose');
    console.log('\n== câu trong data/phrases.json đọc bằng TTS (Piper vi_VN-vais1000)');
    for (const c of configs) {
      const eng = engines[c];
      let E = 0, N = 0, pass = 0, passCt = 0, passPa = 0, nCt = 0, nPa = 0, ms = 0, sec = 0, fp = 0;
      const ents = Object.entries(labels);
      for (const [k, [fn, l]] of ents.entries()) {
        const x = readWav(path.join(pw, fn));
        const W = c.endsWith('w'); const hw = c.startsWith('hw') ? Core.phraseHotwords(l, W) : '';
        const r = eng.decode(x, hw);
        ms += r.ms; sec += x.length / 16000;
        const ref = M.normalizeWords(l.text), hyp = M.normalizeWords(r.text);
        E += wer(ref, hyp); N += ref.length;
        const ok = M.matchPhrase(hyp, l).matched;
        pass += ok; if (l.kind === 'ct') { nCt++; passCt += ok; } else { nPa++; passPa += ok; }
        if (show) console.log(`  [${c}] ${fn} ${ok ? 'QUA ' : 'trượt'} | ${l.text} | ${r.text}`);
        // nhận nhầm: đọc câu này nhưng gợi ý (hotwords) là câu khác -> có bị chấm qua câu khác không
        if (c.startsWith('hw')) {
          const other = ents[(k + 6) % ents.length][1];
          const r2 = eng.decode(x, Core.phraseHotwords(other, W));
          if (M.matchPhrase(M.normalizeWords(r2.text), other).matched) { fp++; if (show) console.log(`  [${c}] NHẬN NHẦM ${fn} -> ${other.text} | ${r2.text}`); }
        }
      }
      console.log(`${c.padEnd(7)} WER ${(100 * E / N).toFixed(1)}%  qua ghe ${pass}/${nCt + nPa} (chính tả ${passCt}/${nCt}, phiên âm ${passPa}/${nPa})  RTF ${(ms / sec / 1000).toFixed(3)}${c.startsWith('hw') ? `  nhận nhầm khi gợi ý câu khác ${fp}/${ents.length}` : ''}`);
    }
  }
  console.log(`\nheap wasm cuối: ${(Module.HEAPU8.length / 1048576).toFixed(0)} MB, rss ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);
})().catch((e) => { console.error(e); process.exit(1); });
