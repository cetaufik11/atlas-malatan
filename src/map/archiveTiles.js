// Peta Arsip 2018 sebagai ubin raster (protokol 'archive://').
// Gambar di-warp ke empat sudut georeferensinya (dua segitiga, transformasi afin),
// sehingga tetap benar setelah dikalibrasi miring/serong dan tidak terpotong di medan 3D.
import maplibregl from 'maplibre-gl';
import { lngToPx, latToPx } from '../lib/elevation.js';

const SRC = 'media/peta-arsip-2018.jpg';
let coords = null; // [[lng,lat] × 4]: barat laut, timur laut, tenggara, barat daya
let version = 0;
let imgPromise = null;
let blank = null;

const toBuffer = (canvas) => new Promise((resolve) => canvas.toBlob((b) => b.arrayBuffer().then(resolve), 'image/png'));

function loadImage() {
  if (!imgPromise) {
    imgPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        imgPromise = null;
        reject(new Error('Peta arsip tidak termuat'));
      };
      img.src = SRC;
    });
  }
  return imgPromise;
}

/** Matriks afin yang memetakan segitiga sumber s ke segitiga tujuan d (untuk ctx.setTransform). */
function affine(s, d) {
  const [[x0, y0], [x1, y1], [x2, y2]] = s;
  const det = x0 * (y1 - y2) - x1 * (y0 - y2) + x2 * (y0 - y1);
  const solve = (u0, u1, u2) => [
    (u0 * (y1 - y2) - u1 * (y0 - y2) + u2 * (y0 - y1)) / det,
    (x0 * (u1 - u2) - x1 * (u0 - u2) + x2 * (u0 - u1)) / det,
    (x0 * (y1 * u2 - y2 * u1) - x1 * (y0 * u2 - y2 * u0) + x2 * (y0 * u1 - y1 * u0)) / det,
  ];
  const [a, c, e] = solve(d[0][0], d[1][0], d[2][0]);
  const [b, dd, f] = solve(d[0][1], d[1][1], d[2][1]);
  return [a, b, c, dd, e, f];
}

maplibregl.addProtocol('archive', async (params) => {
  const m = params.url.match(/archive:\/\/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  if (!m || !coords) return { data: await toBuffer(c) };
  const z = +m[2], ox = +m[3] * 256, oy = +m[4] * 256;
  const dst = coords.map(([lng, lat]) => [lngToPx(lng, z) - ox, latToPx(lat, z) - oy]);
  const xs = dst.map((p) => p[0]), ys = dst.map((p) => p[1]);
  if (Math.max(...xs) < 0 || Math.max(...ys) < 0 || Math.min(...xs) > 256 || Math.min(...ys) > 256) {
    if (!blank) blank = await toBuffer(c);
    return { data: blank };
  }
  const img = await loadImage();
  const W = img.naturalWidth, H = img.naturalHeight;
  const src = [[0, 0], [W, 0], [W, H], [0, H]];
  const ctx = c.getContext('2d');
  for (const tri of [[0, 1, 2], [0, 2, 3]]) {
    const s = tri.map((i) => src[i]), d = tri.map((i) => dst[i]);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d[0][0], d[0][1]);
    ctx.lineTo(d[1][0], d[1][1]);
    ctx.lineTo(d[2][0], d[2][1]);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(...affine(s, d));
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  return { data: await toBuffer(c) };
});

/** Set sudut georeferensi; kembalikan templat URL ubin (versi baru agar cache lama tak terpakai). */
export function setArchiveCoords(c) {
  coords = c;
  version++;
  return archiveTilesUrl();
}

export const archiveTilesUrl = () => `archive://${version}/{z}/{x}/{y}`;
export const ARCHIVE_IMAGE = SRC;
