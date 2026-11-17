// AudioWorklet: lấy micro, trộn về mono, hạ mẫu về 16 kHz (lọc trung bình theo khoảng), gửi từng khúc ~100 ms.
class ChoNoiMic extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.acc = 0; this.cnt = 0; this.t = 0;
    this.buf = new Float32Array(1600); this.n = 0;
    this.on = true;
    this.port.onmessage = (e) => { if (e.data && typeof e.data.on === 'boolean') { this.on = e.data.on; this.n = 0; } };
  }
  process(inputs) {
    const inp = inputs[0];
    if (!this.on || !inp || !inp.length || !inp[0]) return true;
    const ch = inp.length, len = inp[0].length;
    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += inp[c][i];
      this.acc += s / ch; this.cnt++; this.t += 1;
      if (this.t >= this.ratio) {
        this.buf[this.n++] = this.acc / this.cnt;
        this.acc = 0; this.cnt = 0; this.t -= this.ratio;
        if (this.n === this.buf.length) {
          const out = this.buf; this.buf = new Float32Array(1600); this.n = 0;
          this.port.postMessage(out, [out.buffer]);
        }
      }
    }
    return true;
  }
}
registerProcessor('cho-noi-mic', ChoNoiMic);
