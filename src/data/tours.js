// Rute tur. Tambah rute baru cukup dengan menambah objek di TOURS.
import { distance } from '../lib/geo.js';

export const TOURS = [
  {
    id: 'kerukunan',
    title: 'Jejak Kerukunan',
    theme: 'Bina damai antarumat',
    blurb: 'Masjid, gereja, TPQ, dan ruang kesenian yang hidup berdampingan di satu dusun.',
    stops: ['masjid-jami', 'tpq-malatan', 'gkj-sindoro', 'gedung-kesenian', 'balai-warga'],
  },
  {
    id: 'air-jembatan',
    title: 'Air, Sungai & Jembatan',
    theme: 'Lanskap lereng Sindoro',
    blurb: 'Menyusuri mata air dan tiga jembatan yang menjadi gerbang Malatan.',
    stops: ['sendang-adat', 'jembatan-utara', 'jembatan-timur', 'jembatan-selatan'],
  },
  {
    id: 'keliling',
    title: 'Keliling Malatan',
    theme: 'Semua situs, rute terpendek',
    blurb: 'Rute otomatis mengunjungi semua situs dengan jarak jalan kaki sesingkat mungkin.',
    stops: 'auto',
  },
];

/** Urutan tetangga terdekat + perbaikan 2-opt, mulai dari situs pertama. */
export function shortestRoute(sites, startId) {
  const pts = sites.map((s) => [s.lng, s.lat]);
  const n = pts.length;
  if (n < 3) return sites.map((s) => s.id);
  let start = Math.max(0, sites.findIndex((s) => s.id === startId));
  const used = new Set([start]);
  const order = [start];
  while (order.length < n) {
    const last = pts[order[order.length - 1]];
    let best = -1, bd = Infinity;
    for (let i = 0; i < n; i++) {
      if (used.has(i)) continue;
      const d = distance(last, pts[i]);
      if (d < bd) { bd = d; best = i; }
    }
    used.add(best);
    order.push(best);
  }
  // 2-opt
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 2; i++) {
      for (let k = i + 1; k < n - 1; k++) {
        const a = pts[order[i - 1]], b = pts[order[i]], c = pts[order[k]], d = pts[order[k + 1]];
        if (distance(a, c) + distance(b, d) < distance(a, b) + distance(c, d) - 0.01) {
          order.splice(i, k - i + 1, ...order.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return order.map((i) => sites[i].id);
}

export function resolveStops(tour, sites) {
  if (tour.stops === 'auto') return shortestRoute(sites, 'posko-kkn');
  const ids = new Set(sites.map((s) => s.id));
  return tour.stops.filter((id) => ids.has(id));
}
