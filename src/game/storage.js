// Kỷ lục lưu trên máy. localStorage có thể bị chặn (Safari riêng tư, iframe, cookie tắt) -> giữ trong bộ nhớ.
import { CONFIG } from '../config.js?v=69dfb0d0';

let memBest = 0;
let usable = null;

function store() {
  if (usable === false) return null;
  try {
    const s = window.localStorage;
    const k = CONFIG.STORAGE_KEY + '.probe';
    s.setItem(k, '1'); s.removeItem(k);
    usable = true;
    return s;
  } catch (e) { usable = false; return null; }
}

export function loadBest() {
  const s = store();
  if (!s) return memBest;
  try { const v = parseInt(s.getItem(CONFIG.STORAGE_KEY) || '0', 10); return Number.isFinite(v) ? Math.max(v, memBest) : memBest; }
  catch (e) { return memBest; }
}

export function saveBest(v) {
  memBest = Math.max(memBest, v);
  const s = store();
  if (!s) return false;
  try { s.setItem(CONFIG.STORAGE_KEY, String(memBest)); return true; } catch (e) { return false; }
}

export function storageAvailable() { store(); return usable === true; }
