// Menyajikan hasil analisis (kanvas) sebagai ubin raster lewat protokol 'overlay://'.
// Kenapa bukan sumber 'image'? Saat medan 3D aktif, MapLibre memotong sumber 'image'
// di batas ubin. Ubin raster biasa ikut terbungkus ke medan tanpa masalah.
import maplibregl from 'maplibre-gl';
import { pxToLng, pxToLat } from '../lib/elevation.js';

let current = null; // { canvas, z, x0, y0, smooth }
let version = 0;
let blank = null;

const toBuffer = (canvas) => new Promise((resolve) => canvas.toBlob((b) => b.arrayBuffer().then(resolve), 'image/png'));

async function blankTile() {
  if (!blank) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    blank = await toBuffer(c);
  }
  return blank;
}

maplibregl.addProtocol('overlay', async (params) => {
  const m = params.url.match(/overlay:\/\/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
  const o = current;
  if (!m || !o || +m[1] !== version) return { data: await blankTile() };
  const z = +m[2], x = +m[3], y = +m[4];
  // Ubin (z,x,y) dalam satuan piksel pada zoom asli kanvas.
  const scale = 2 ** (o.z - z);
  const sx = x * 256 * scale - o.x0, sy = y * 256 * scale - o.y0, size = 256 * scale;
  if (sx + size <= 0 || sy + size <= 0 || sx >= o.canvas.width || sy >= o.canvas.height) return { data: await blankTile() };
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = !!o.smooth;
  // Potong ke bagian yang beririsan agar aman di semua browser.
  const ix = Math.max(0, sx), iy = Math.max(0, sy);
  const iw = Math.min(o.canvas.width, sx + size) - ix, ih = Math.min(o.canvas.height, sy + size) - iy;
  ctx.drawImage(o.canvas, ix, iy, iw, ih, ((ix - sx) / size) * 256, ((iy - sy) / size) * 256, (iw / size) * 256, (ih / size) * 256);
  return { data: await toBuffer(c) };
});

/** Daftarkan kanvas hasil analisis; kembalikan definisi sumber raster MapLibre. */
export function registerOverlay(o) {
  current = o;
  version++;
  if (!o) return null;
  return {
    type: 'raster',
    tiles: [`overlay://${version}/{z}/{x}/{y}`],
    tileSize: 256,
    minzoom: Math.max(8, o.z - 5),
    maxzoom: o.z,
    bounds: [pxToLng(o.x0, o.z), pxToLat(o.y0 + o.canvas.height, o.z), pxToLng(o.x0 + o.canvas.width, o.z), pxToLat(o.y0, o.z)],
  };
}
