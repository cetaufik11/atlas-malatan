// Analisis medan dari DEM: kelas kemiringan lereng & keterlihatan (viewshed).
// Semua dihitung di browser; hasilnya gambar tembus pandang yang ditumpuk di peta.
import { demGrid, lngToPx, latToPx, pxToLng, pxToLat } from './elevation.js';

// Kelas kemiringan lereng yang lazim dipakai di Indonesia (persen).
export const SLOPE_CLASSES = [
  { max: 8, label: 'Datar (0–8%)', color: [56, 168, 96] },
  { max: 15, label: 'Landai (8–15%)', color: [186, 214, 80] },
  { max: 25, label: 'Agak curam (15–25%)', color: [250, 204, 60] },
  { max: 45, label: 'Curam (25–45%)', color: [240, 128, 48] },
  { max: Infinity, label: 'Sangat curam (>45%)', color: [205, 50, 60] },
];

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Peta kelas lereng (metode Horn 3×3).
 * @param bbox [w,s,e,n]  @param boundary poligon [lng,lat][] untuk statistik (opsional)
 */
export async function slopeMap(bbox, boundary) {
  const z = 14;
  const g = await demGrid(bbox, z);
  const { w, h, data, cell } = g;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const poly = boundary?.map(([lng, lat]) => [lngToPx(lng, z) - g.x0, latToPx(lat, z) - g.y0]);
  const counts = new Array(SLOPE_CLASSES.length).fill(0);
  let total = 0, sum = 0, max = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = data[i - w - 1], b = data[i - w], c = data[i - w + 1];
      const d = data[i - 1], f = data[i + 1];
      const gg = data[i + w - 1], hh = data[i + w], ii = data[i + w + 1];
      const dzdx = (c + 2 * f + ii - (a + 2 * d + gg)) / (8 * cell);
      const dzdy = (gg + 2 * hh + ii - (a + 2 * b + c)) / (8 * cell);
      const pct = Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100;
      const k = SLOPE_CLASSES.findIndex((s) => pct < s.max);
      const col = SLOPE_CLASSES[k].color;
      img.data[i * 4] = col[0];
      img.data[i * 4 + 1] = col[1];
      img.data[i * 4 + 2] = col[2];
      img.data[i * 4 + 3] = 200;
      if (!poly || inPolygon(x, y, poly)) {
        counts[k]++;
        total++;
        sum += pct;
        if (pct > max) max = pct;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    canvas,
    z,
    x0: g.x0,
    y0: g.y0,
    smooth: true,
    stats: {
      shares: counts.map((n) => (total ? n / total : 0)),
      mean: total ? sum / total : 0,
      max,
      areaHa: (total * cell * cell) / 10000,
      scoped: !!poly && total > 0,
    },
  };
}

/**
 * Viewshed: wilayah yang terlihat dari satu titik.
 * Untuk tiap sel dalam radius, telusuri garis pandang dari pengamat dan
 * bandingkan sudut elevasi sel dengan sudut tertinggi yang menghalangi.
 */
export async function viewshed([lng, lat], { radius = 2500, eye = 1.6 } = {}) {
  const z = 13;
  const dLat = radius / 111320, dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const g = await demGrid([lng - dLng, lat - dLat, lng + dLng, lat + dLat], z);
  const { w, h, data, cell } = g;
  const ox = Math.round(lngToPx(lng, z) - g.x0), oy = Math.round(latToPx(lat, z) - g.y0);
  const R = Math.round(radius / cell);
  const size = 2 * R + 1;
  const eyeZ = data[oy * w + ox] + eye;
  const vis = new Uint8Array(size * size);
  let seen = 0, total = 0;

  for (let ty = -R; ty <= R; ty++) {
    for (let tx = -R; tx <= R; tx++) {
      const dist = Math.hypot(tx, ty);
      if (dist > R) continue;
      const gx = ox + tx, gy = oy + ty;
      if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
      total++;
      if (dist < 1.5) {
        vis[(ty + R) * size + tx + R] = 1;
        seen++;
        continue;
      }
      const targetTan = (data[gy * w + gx] - eyeZ) / (dist * cell);
      const steps = Math.ceil(dist);
      let blocked = false;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const sx = ox + tx * t, sy = oy + ty * t;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        const i = y0 * w + x0;
        const e = data[i] * (1 - fx) * (1 - fy) + data[i + 1] * fx * (1 - fy) + data[i + w] * (1 - fx) * fy + data[i + w + 1] * fx * fy;
        if ((e - eyeZ) / (dist * t * cell) > targetTan + 1e-4) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        vis[(ty + R) * size + tx + R] = 1;
        seen++;
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = (y * size + x) * 4;
      if (Math.hypot(x - R, y - R) > R) continue;
      if (vis[y * size + x]) img.data.set([64, 224, 208, 150], k);
      else img.data.set([20, 16, 12, 150], k);
    }
  }
  ctx.putImageData(img, 0, 0);

  const isVisible = (lng2, lat2) => {
    const x = Math.round(lngToPx(lng2, z) - g.x0) - ox + R, y = Math.round(latToPx(lat2, z) - g.y0) - oy + R;
    if (x < 0 || y < 0 || x >= size || y >= size || Math.hypot(x - R, y - R) > R) return null; // di luar radius
    return vis[y * size + x] === 1;
  };

  return {
    canvas,
    z,
    x0: g.x0 + ox - R,
    y0: g.y0 + oy - R,
    smooth: false,
    stats: { share: total ? seen / total : 0, areaHa: (seen * cell * cell) / 10000, eyeZ, radius },
    isVisible,
    origin: [pxToLng(g.x0 + ox, z), pxToLat(g.y0 + oy, z)],
  };
}
