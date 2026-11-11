// Baca elevasi langsung dari ubin DEM Terrarium (AWS Open Data, ~30 m/piksel di Jawa).
// Tidak bergantung pada mode 3D peta, jadi profil elevasi selalu bisa dihitung.
import { DEM_URL } from '../map/style.js';

const Z = 15;
const tileCache = new Map();

function loadTile(x, y) {
  const key = `${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, 256, 256).data);
    };
    img.onerror = () => {
      tileCache.delete(key);
      reject(new Error('DEM tidak termuat'));
    };
    img.src = DEM_URL.replace('{z}', Z).replace('{x}', x).replace('{y}', y);
  });
  tileCache.set(key, p);
  return p;
}

function pixel(data, px, py) {
  const i = (py * 256 + px) * 4;
  return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
}

/** Elevasi (m dpl) di [lng, lat], interpolasi bilinear. */
export async function elevationAt(lng, lat) {
  const n = 2 ** Z;
  const fx = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const data = await loadTile(tx, ty);
  const px = Math.min(254, (fx - tx) * 256), py = Math.min(254, (fy - ty) * 256);
  const x0 = Math.floor(px), y0 = Math.floor(py), dx = px - x0, dy = py - y0;
  const a = pixel(data, x0, y0), b = pixel(data, x0 + 1, y0);
  const c = pixel(data, x0, y0 + 1), d = pixel(data, x0 + 1, y0 + 1);
  return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
}

export async function elevationProfile(samples) {
  const out = [];
  for (const s of samples) {
    try {
      out.push({ ...s, e: await elevationAt(s.p[0], s.p[1]) });
    } catch {
      out.push({ ...s, e: null });
    }
  }
  return out;
}
