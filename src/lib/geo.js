const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

/** Jarak dua titik [lng, lat] dalam meter. */
export function distance(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLength(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += distance(pts[i - 1], pts[i]);
  return t;
}

/** Luas poligon [lng, lat][] dalam m² (pendekatan bola). */
export function polygonArea(pts) {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs((s * R * R) / 2);
}

/** Arah kompas dari a ke b, derajat 0–360. */
export function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compassLabel(deg) {
  return ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'][Math.round(deg / 45) % 8];
}

/** Titik-titik sampel sepanjang lintasan, untuk profil elevasi. */
export function samplePath(pts, n = 80) {
  const total = pathLength(pts);
  if (!total) return pts.map((p) => ({ p, d: 0 }));
  const out = [];
  for (let k = 0; k <= n; k++) {
    let target = (total * k) / n;
    for (let i = 1; i < pts.length; i++) {
      const seg = distance(pts[i - 1], pts[i]);
      if (target <= seg || i === pts.length - 1) {
        const t = seg ? Math.min(1, target / seg) : 0;
        const a = pts[i - 1], b = pts[i];
        out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: (total * k) / n });
        break;
      }
      target -= seg;
    }
  }
  return out;
}

export function fmtDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function fmtArea(m2) {
  if (m2 < 10000) return `${Math.round(m2).toLocaleString('id-ID')} m²`;
  return `${(m2 / 10000).toFixed(2)} ha`;
}

/** Waktu jalan kaki di medan desa berlereng (~4 km/jam). */
export function walkMinutes(m) {
  return Math.max(1, Math.round(m / 67));
}

export function toDMS(v, pos, neg) {
  const abs = Math.abs(v);
  const d = Math.floor(abs);
  const mf = (abs - d) * 60;
  const m = Math.floor(mf);
  const s = ((mf - m) * 60).toFixed(1);
  return `${d}°${m}′${s}″ ${v >= 0 ? pos : neg}`;
}

export function fmtCoord(lat, lng) {
  return `${toDMS(lat, 'LU', 'LS')}, ${toDMS(lng, 'BT', 'BB')}`;
}

/** Konversi lng/lat ke indeks ubin XYZ. */
export function lngLatToTile(lng, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = rad(lat);
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [x, y];
}

export function bboxOf(pts, padDeg = 0) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of pts) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  return [w - padDeg, s - padDeg, e + padDeg, n + padDeg];
}
