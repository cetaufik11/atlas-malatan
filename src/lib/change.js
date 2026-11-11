// Deteksi perubahan lahan antara dua citra satelit (Esri Wayback).
// Cara kerja: kedua citra dibagi menjadi blok ±10 m, lalu tiap blok dibandingkan
// kecerahan dan "kehijauan"-nya. Nilai dinormalkan per citra (z-score) supaya
// perbedaan cahaya/musim antar pemotretan tidak langsung dianggap perubahan.
// Ambang ditentukan dari sebaran selisih itu sendiri (median ± k·MAD), jadi yang
// ditandai adalah blok yang perubahannya paling menonjol dibanding sekitarnya.
import { waybackUrl } from '../map/style.js';
import { lngToPx, latToPx, metersPerPx } from './elevation.js';

const BLOCK = 8; // piksel per blok

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Citra tidak termuat (offline?)'));
    img.src = url;
  });
}

async function mosaic(release, z, tx0, ty0, nx, ny) {
  const c = document.createElement('canvas');
  c.width = nx * 256;
  c.height = ny * 256;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const tpl = waybackUrl(release);
  await Promise.all(
    Array.from({ length: nx * ny }, async (_, k) => {
      const i = k % nx, j = Math.floor(k / nx);
      const img = await loadImage(tpl.replace('{z}', z).replace('{x}', tx0 + i).replace('{y}', ty0 + j));
      ctx.drawImage(img, i * 256, j * 256);
    }),
  );
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Rata-rata kecerahan & indeks kehijauan per blok, dinormalkan (z-score). */
function blockFeatures(img) {
  const bw = img.width / BLOCK, bh = img.height / BLOCK;
  const lum = new Float32Array(bw * bh), grn = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let r = 0, g = 0, b = 0;
      for (let y = 0; y < BLOCK; y++) {
        let p = ((by * BLOCK + y) * img.width + bx * BLOCK) * 4;
        for (let x = 0; x < BLOCK; x++, p += 4) {
          r += img.data[p];
          g += img.data[p + 1];
          b += img.data[p + 2];
        }
      }
      const k = by * bw + bx;
      lum[k] = (0.299 * r + 0.587 * g + 0.114 * b) / (BLOCK * BLOCK);
      grn[k] = (2 * g - r - b) / (r + g + b + 1); // Excess Green ternormalisasi
    }
  }
  const zscore = (a) => {
    let m = 0;
    for (const v of a) m += v;
    m /= a.length;
    let s = 0;
    for (const v of a) s += (v - m) ** 2;
    s = Math.sqrt(s / a.length) || 1;
    return a.map((v) => (v - m) / s);
  };
  return { bw, bh, lum: zscore(lum), grn: zscore(grn) };
}

/**
 * @param a,b  entri imagery.json ({release, date, maxzoom}); a = lama, b = baru
 * @param bbox [w,s,e,n]
 * @param k ambang dalam satuan simpangan robust: 1.5 (peka) … 4 (ketat)
 */
export async function detectChange(a, b, bbox, k = 2.5) {
  const z = Math.min(a.maxzoom ?? 17, b.maxzoom ?? 17, 17);
  const [w, s, e, n] = bbox;
  const tx0 = Math.floor(lngToPx(w, z) / 256), tx1 = Math.floor(lngToPx(e, z) / 256);
  const ty0 = Math.floor(latToPx(n, z) / 256), ty1 = Math.floor(latToPx(s, z) / 256);
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
  if (nx * ny > 64) throw new Error('Wilayah terlalu luas untuk dibandingkan.');

  const [ia, ib] = await Promise.all([mosaic(a.release, z, tx0, ty0, nx, ny), mosaic(b.release, z, tx0, ty0, nx, ny)]);
  const fa = blockFeatures(ia), fb = blockFeatures(ib);
  const { bw, bh } = fa;

  const canvas = document.createElement('canvas');
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(bw, bh);
  let greener = 0, lessGreen = 0, other = 0;

  const dG = fa.grn.map((v, i) => fb.grn[i] - v);
  const dL = fa.lum.map((v, i) => fb.lum[i] - v);
  const robust = (arr) => {
    const sorted = Float32Array.from(arr).sort();
    const med = sorted[sorted.length >> 1];
    const dev = Float32Array.from(arr, (v) => Math.abs(v - med)).sort();
    return { med, sigma: 1.4826 * dev[dev.length >> 1] || 1 };
  };
  const rg = robust(dG), rl = robust(dL);

  for (let i = 0; i < bw * bh; i++) {
    const dg = (dG[i] - rg.med) / rg.sigma;
    const dl = (dL[i] - rl.med) / rl.sigma;
    const p = i * 4;
    if (Math.abs(dg) > k) {
      const alpha = Math.min(235, 120 + (Math.abs(dg) - k) * 45);
      if (dg > 0) {
        out.data.set([40, 200, 90, alpha], p);
        greener++;
      } else {
        out.data.set([226, 60, 160, alpha], p);
        lessGreen++;
      }
    } else if (Math.abs(dl) > k * 1.3) {
      out.data.set([250, 204, 60, Math.min(220, 110 + (Math.abs(dl) - k * 1.3) * 40)], p);
      other++;
    }
  }
  ctx.putImageData(out, 0, 0);


  const total = bw * bh;
  const blockM = BLOCK * metersPerPx((s + n) / 2, z);
  return {
    // Satu blok = satu piksel pada zoom (z − 3), jadi kanvas blok bisa langsung disajikan sebagai ubin.
    canvas,
    z: z - Math.log2(BLOCK),
    x0: (tx0 * 256) / BLOCK,
    y0: (ty0 * 256) / BLOCK,
    smooth: false,
    stats: {
      greener: greener / total,
      lessGreen: lessGreen / total,
      other: other / total,
      changed: (greener + lessGreen + other) / total,
      areaHa: (total * blockM * blockM) / 10000,
      blockM,
    },
  };
}
