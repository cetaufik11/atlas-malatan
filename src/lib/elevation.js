// Baca elevasi langsung dari ubin DEM Terrarium (AWS Open Data, ~30 m/piksel di Jawa).
// Tidak bergantung pada mode 3D peta, jadi profil & analisis selalu bisa dihitung.
import { DEM_URL } from '../map/style.js';

const tileCache = new Map();

/** Ubin DEM → Float32Array 256×256 berisi elevasi (m). */
export function loadDemTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, 256, 256).data;
      const out = new Float32Array(256 * 256);
      for (let i = 0; i < out.length; i++) out[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
      resolve(out);
    };
    img.onerror = () => {
      tileCache.delete(key);
      reject(new Error('Data elevasi tidak termuat (offline?)'));
    };
    img.src = DEM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  });
  tileCache.set(key, p);
  return p;
}

// ---- Konversi Web Mercator ----
export const lngToPx = (lng, z) => ((lng + 180) / 360) * 256 * 2 ** z;
export const latToPx = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z;
};
export const pxToLng = (px, z) => (px / (256 * 2 ** z)) * 360 - 180;
export const pxToLat = (py, z) => {
  const n = Math.PI - (2 * Math.PI * py) / (256 * 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
/** Ukuran satu piksel (meter) pada lintang & zoom tertentu. */
export const metersPerPx = (lat, z) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

/** Elevasi (m dpl) di [lng, lat], interpolasi bilinear pada zoom 15. */
export async function elevationAt(lng, lat) {
  const Z = 15;
  const fx = lngToPx(lng, Z) / 256, fy = latToPx(lat, Z) / 256;
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const data = await loadDemTile(Z, tx, ty);
  const px = Math.min(254, (fx - tx) * 256), py = Math.min(254, (fy - ty) * 256);
  const x0 = Math.floor(px), y0 = Math.floor(py), dx = px - x0, dy = py - y0;
  const at = (x, y) => data[y * 256 + x];
  return at(x0, y0) * (1 - dx) * (1 - dy) + at(x0 + 1, y0) * dx * (1 - dy) + at(x0, y0 + 1) * (1 - dx) * dy + at(x0 + 1, y0 + 1) * dx * dy;
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

/**
 * Grid elevasi untuk bbox [w, s, e, n] pada zoom z, disusun dari beberapa ubin.
 * Hasil: { z, x0, y0 (piksel global pojok kiri-atas), w, h, data, cell (m/piksel) }.
 */
export async function demGrid(bbox, z) {
  const [w, s, e, n] = bbox;
  const tx0 = Math.floor(lngToPx(w, z) / 256), tx1 = Math.floor(lngToPx(e, z) / 256);
  const ty0 = Math.floor(latToPx(n, z) / 256), ty1 = Math.floor(latToPx(s, z) / 256);
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
  if (nx * ny > 16) throw new Error('Wilayah analisis terlalu luas.');
  const W = nx * 256, H = ny * 256;
  const data = new Float32Array(W * H);
  await Promise.all(
    Array.from({ length: nx * ny }, async (_, k) => {
      const i = k % nx, j = Math.floor(k / nx);
      const t = await loadDemTile(z, tx0 + i, ty0 + j);
      for (let r = 0; r < 256; r++) data.set(t.subarray(r * 256, r * 256 + 256), (j * 256 + r) * W + i * 256);
    }),
  );
  return { z, x0: tx0 * 256, y0: ty0 * 256, w: W, h: H, data, cell: metersPerPx((s + n) / 2, z) };
}

/** Sudut gambar (untuk sumber 'image' MapLibre) dari kotak piksel global. */
export function pxRectToCoords(z, x0, y0, w, h) {
  const W = pxToLng(x0, z), E = pxToLng(x0 + w, z), N = pxToLat(y0, z), S = pxToLat(y0 + h, z);
  return [[W, N], [E, N], [E, S], [W, S]];
}
