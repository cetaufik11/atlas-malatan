// Pelacakan GPS + arah kompas. Hasil ditulis ke store (userPos).
import { useStore } from '../store.js';

let watchId = null;
let heading = null;

function onOrientation(e) {
  // iOS: webkitCompassHeading; lainnya: alpha absolut.
  if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === 'number') heading = (360 - e.alpha) % 360;
  const pos = useStore.getState().userPos;
  if (pos) useStore.getState().setUserPos({ ...pos, heading });
}

export async function startTracking() {
  const st = useStore.getState();
  if (!('geolocation' in navigator)) {
    st.notify('Perangkat ini tidak mendukung GPS.', 'error');
    return false;
  }
  // iOS butuh izin eksplisit untuk kompas.
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  } catch { /* kompas opsional */ }
  window.addEventListener('deviceorientationabsolute', onOrientation, true);
  window.addEventListener('deviceorientation', onOrientation, true);

  return new Promise((resolve) => {
    let first = true;
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        useStore.getState().setUserPos({
          lng: p.coords.longitude,
          lat: p.coords.latitude,
          acc: p.coords.accuracy,
          alt: p.coords.altitude,
          heading: p.coords.heading ?? heading,
          t: p.timestamp,
        });
        if (first) {
          first = false;
          useStore.getState().setTracking(true);
          resolve(true);
        }
      },
      (err) => {
        const msg = err.code === 1 ? 'Izin lokasi ditolak. Aktifkan di pengaturan browser.' : 'Lokasi belum didapat. Coba di tempat terbuka.';
        useStore.getState().notify(msg, 'error');
        stopTracking();
        resolve(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  });
}

export function stopTracking() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  window.removeEventListener('deviceorientationabsolute', onOrientation, true);
  window.removeEventListener('deviceorientation', onOrientation, true);
  const st = useStore.getState();
  st.setTracking(false);
  st.setUserPos(null);
}

/** Ambil satu posisi akurat (untuk mencatat titik temuan). */
export function getOnePosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('GPS tidak didukung'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
  });
}
