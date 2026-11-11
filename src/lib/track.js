// Perekam jejak GPS: berjalan menyusuri batas dusun, jalan, atau sungai untuk memetakannya.
import { useStore } from '../store.js';
import { db } from './storage.js';
import { distance } from './geo.js';
import { startTracking } from './gps.js';

const MIN_MOVE_M = 3; // abaikan getaran GPS saat diam
const MAX_ACC_M = 35; // buang titik yang terlalu tidak akurat

let unsub = null;
let wakeLock = null;

export async function startRecording() {
  const st = useStore.getState();
  if (!st.tracking) {
    const ok = await startTracking();
    if (!ok) return false;
  }
  st.setRecording({ started: Date.now(), points: [] });
  // Jaga layar tetap menyala agar GPS tidak dimatikan sistem.
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opsional */ }

  unsub = useStore.subscribe((s, prev) => {
    if (s.userPos === prev.userPos || !s.userPos || !s.recording) return;
    const p = s.userPos;
    if (p.acc > MAX_ACC_M) return;
    const pts = s.recording.points;
    const last = pts[pts.length - 1];
    if (last && distance([last.lng, last.lat], [p.lng, p.lat]) < MIN_MOVE_M) return;
    s.setRecording({ ...s.recording, points: [...pts, { lng: p.lng, lat: p.lat, ele: p.alt ?? null, acc: Math.round(p.acc), t: p.t || Date.now() }] });
  });
  st.notify('Perekaman jejak dimulai. Berjalanlah, layar dijaga tetap menyala.', 'success');
  return true;
}

export async function stopRecording(name) {
  unsub?.();
  unsub = null;
  try { await wakeLock?.release(); } catch { /* abaikan */ }
  wakeLock = null;
  const st = useStore.getState();
  const rec = st.recording;
  st.setRecording(null);
  if (!rec || rec.points.length < 2) {
    st.notify('Jejak terlalu pendek, tidak disimpan.');
    return null;
  }
  const track = {
    id: `jejak-${rec.started.toString(36)}`,
    name: name || `Jejak ${new Date(rec.started).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`,
    created: new Date(rec.started).toISOString(),
    points: rec.points,
  };
  const next = [track, ...st.tracks];
  st.setTracks(next);
  await db.saveTracks(next);
  st.notify('Jejak tersimpan di perangkat.', 'success');
  return track;
}

export function trackLength(points) {
  let t = 0;
  for (let i = 1; i < points.length; i++) t += distance([points[i - 1].lng, points[i - 1].lat], [points[i].lng, points[i].lat]);
  return t;
}
