// Unduh ubin peta wilayah Malatan ke cache agar bisa dipakai tanpa sinyal di lapangan.
// Cache 'atlas-tiles' sama dengan yang dipakai service worker (vite.config.js),
// jadi ubin yang diunduh di sini langsung terpakai saat offline.
import { lngLatToTile } from './geo.js';

const CACHE = 'atlas-tiles';

export function tileUrlsForArea(bbox, templates, minZ, maxZ) {
  const [w, s, e, n] = bbox;
  const urls = [];
  for (let z = minZ; z <= maxZ; z++) {
    const [x0, y0] = lngLatToTile(w, n, z);
    const [x1, y1] = lngLatToTile(e, s, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (const t of templates) urls.push(t.replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return urls;
}

export async function cacheTiles(urls, onProgress, signal) {
  if (!('caches' in window)) throw new Error('Browser ini tidak mendukung penyimpanan offline.');
  const cache = await caches.open(CACHE);
  let done = 0, failed = 0;
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      if (signal?.aborted) return;
      const url = queue.shift();
      try {
        const hit = await cache.match(url);
        if (!hit) {
          const res = await fetch(url, { mode: 'cors', signal });
          if (res.ok) await cache.put(url, res);
          else failed++;
        }
      } catch {
        failed++;
      }
      done++;
      onProgress?.(done, urls.length, failed);
    }
  }
  // Paralel kecil agar sopan terhadap server ubin.
  await Promise.all(Array.from({ length: 4 }, worker));
  return { done, failed };
}

export async function cachedTileCount() {
  if (!('caches' in window)) return 0;
  try {
    const cache = await caches.open(CACHE);
    return (await cache.keys()).length;
  } catch {
    return 0;
  }
}

export async function clearTileCache() {
  if ('caches' in window) await caches.delete(CACHE);
}
