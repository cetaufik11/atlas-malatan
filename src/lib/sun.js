// Posisi matahari (rumus astronomi ringkas, galat < 1°; cukup untuk simulasi pencahayaan).
const rad = Math.PI / 180;

/** @returns {{altitude:number, azimuth:number}} derajat; azimuth dari utara searah jarum jam. */
export function sunPosition(date, lat, lng) {
  const d = date.getTime() / 86400000 - 10957.5; // hari sejak J2000
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const e = rad * 23.4397;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const theta = rad * (280.16 + 360.9856235 * d) + rad * lng;
  const H = theta - ra;
  const phi = rad * lat;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { altitude: altitude / rad, azimuth: ((az / rad + 180) % 360 + 360) % 360 };
}

/** Tanggal 'YYYY-MM-DD' + jam desimal WIB (UTC+7) → Date. */
export function wibDate(dateStr, hour) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (hour - 7) * 3600000);
}

/** Jam terbit & terbenam (WIB, desimal) dengan menyapu satu hari tiap 2 menit. */
export function sunTimes(dateStr, lat, lng) {
  let rise = null, set = null, noonAlt = -90, noon = 12;
  let prev = sunPosition(wibDate(dateStr, 0), lat, lng).altitude;
  for (let h = 1 / 30; h <= 24; h += 1 / 30) {
    const alt = sunPosition(wibDate(dateStr, h), lat, lng).altitude;
    if (prev < -0.833 && alt >= -0.833 && rise == null) rise = h;
    if (prev >= -0.833 && alt < -0.833 && set == null) set = h;
    if (alt > noonAlt) { noonAlt = alt; noon = h; }
    prev = alt;
  }
  return { rise, set, noon, noonAlt };
}

export function fmtHour(h) {
  if (h == null) return '—';
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`;
}

export function compassName(az) {
  return ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'][Math.round(az / 45) % 8];
}
