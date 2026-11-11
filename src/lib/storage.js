// Penyimpanan lokal di perangkat (IndexedDB). Semua dibungkus try/catch agar
// aplikasi tetap jalan di mode privat atau saat penyimpanan diblokir.
import { get, set, del } from 'idb-keyval';

async function safeGet(key, fallback) {
  try {
    const v = await get(key);
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

async function safeSet(key, value) {
  try {
    await set(key, value);
    return true;
  } catch {
    return false;
  }
}

export const db = {
  // Kiriman warga yang belum dikirim / sudah diekspor.
  contributions: () => safeGet('contributions', []),
  saveContributions: (list) => safeSet('contributions', list),

  // Suntingan admin atas data situs (menimpa src/data/sites.json).
  siteOverrides: () => safeGet('siteOverrides', null),
  saveSiteOverrides: (sites) => safeSet('siteOverrides', sites),
  clearSiteOverrides: async () => {
    try { await del('siteOverrides'); } catch { /* abaikan */ }
  },

  // Titik temuan lapangan (GPS).
  fieldPoints: () => safeGet('fieldPoints', []),
  saveFieldPoints: (list) => safeSet('fieldPoints', list),

  // Progres belajar.
  progress: () => safeGet('progress', { visited: [], quizBest: 0, badges: [] }),
  saveProgress: (p) => safeSet('progress', p),
};

export function localPref(key, fallback) {
  try {
    const v = localStorage.getItem('atlas:' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function setLocalPref(key, value) {
  try {
    localStorage.setItem('atlas:' + key, JSON.stringify(value));
  } catch { /* abaikan */ }
}

/** File (foto) → data URL kecil agar bisa disimpan & diekspor. */
export function fileToDataUrl(file, maxSide = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try { resolve(JSON.parse(r.result)); } catch (e) { reject(e); }
    };
    r.onerror = reject;
    r.readAsText(file);
  });
}
