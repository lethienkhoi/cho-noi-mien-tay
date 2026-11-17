// Nạp sprite SVG (assets/sprites) thành Image rồi "nướng" sẵn ra canvas bitmap đúng độ phân giải màn.
// Lý do: drawImage từ SVG mỗi khung hình buộc trình duyệt raster lại vector + filter blur (rất chậm trên Safari iOS);
// nướng một lần thì mỗi khung chỉ còn là chép bitmap -> giữ 60fps trên máy tầm trung.

const SPRITE_DIR = 'assets/sprites/';

export class Assets {
  constructor() {
    this.manifest = null;
    this.images = new Map();   // tên -> HTMLImageElement
    this.baked = new Map();    // tên -> { canvas, k }  (k = số pixel bitmap trên 1u vẽ)
    this.failed = [];
  }

  async loadManifest() {
    const res = await fetch(SPRITE_DIR + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    this.manifest = await res.json();
    return this.manifest;
  }

  meta(name) { return this.manifest && this.manifest.sprites[name]; }
  url(name) { const m = this.meta(name); return m ? SPRITE_DIR + m.file : ''; }

  // Nạp danh sách sprite; không ném lỗi, ghi lại tên nạp hỏng để báo.
  async loadImages(names, onProgress) {
    let done = 0;
    await Promise.all(names.map(async (name) => {
      const m = this.meta(name);
      try {
        if (!m) throw new Error('không có trong manifest');
        const img = new Image();
        img.decoding = 'async';
        img.src = SPRITE_DIR + m.file;
        if (img.decode) await img.decode();
        else await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; });
        if (!img.naturalWidth && !img.width) throw new Error('ảnh rỗng');
        this.images.set(name, img);
      } catch (e) {
        this.failed.push(name);
      }
      done++;
      if (onProgress) onProgress(done / names.length);
    }));
    return this.failed.slice();
  }

  // Nướng sprite ở mật độ k (pixel bitmap / 1u). Nướng lại khi k đổi (xoay màn, đổi cỡ cửa sổ).
  bake(name, k) {
    const cur = this.baked.get(name);
    if (cur && Math.abs(cur.k - k) < 0.01) return cur;
    const img = this.images.get(name), m = this.meta(name);
    if (!img || !m) return null;
    const cw = Math.max(1, Math.ceil(m.w * k)), ch = Math.max(1, Math.ceil(m.h * k));
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    try { g.drawImage(img, 0, 0, cw, ch); }
    catch (e) { return null; }
    const out = { canvas: c, k, m };
    this.baked.set(name, out);
    return out;
  }

  get(name) { return this.baked.get(name) || null; }
}
