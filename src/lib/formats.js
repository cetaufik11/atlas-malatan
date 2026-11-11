// Baca & tulis format geodata umum: GeoJSON, GPX, KML.

const num = (s) => Number.parseFloat(s);

function parseGpx(doc) {
  const features = [];
  for (const trk of doc.querySelectorAll('trk')) {
    const name = trk.querySelector('name')?.textContent || 'Jejak';
    for (const seg of trk.querySelectorAll('trkseg')) {
      const coords = [...seg.querySelectorAll('trkpt')].map((p) => [num(p.getAttribute('lon')), num(p.getAttribute('lat'))]);
      if (coords.length > 1) features.push({ type: 'Feature', properties: { name }, geometry: { type: 'LineString', coordinates: coords } });
    }
  }
  for (const rte of doc.querySelectorAll('rte')) {
    const coords = [...rte.querySelectorAll('rtept')].map((p) => [num(p.getAttribute('lon')), num(p.getAttribute('lat'))]);
    if (coords.length > 1) features.push({ type: 'Feature', properties: { name: rte.querySelector('name')?.textContent || 'Rute' }, geometry: { type: 'LineString', coordinates: coords } });
  }
  for (const w of doc.querySelectorAll('wpt')) {
    features.push({
      type: 'Feature',
      properties: { name: w.querySelector('name')?.textContent || 'Titik' },
      geometry: { type: 'Point', coordinates: [num(w.getAttribute('lon')), num(w.getAttribute('lat'))] },
    });
  }
  return features;
}

function kmlCoords(el) {
  return (el?.textContent || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.split(',').slice(0, 2).map(num))
    .filter((c) => c.length === 2 && c.every(Number.isFinite));
}

function parseKml(doc) {
  const features = [];
  for (const pm of doc.querySelectorAll('Placemark')) {
    const properties = { name: pm.querySelector('name')?.textContent || 'Objek' };
    for (const pt of pm.querySelectorAll('Point > coordinates')) {
      const c = kmlCoords(pt)[0];
      if (c) features.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: c } });
    }
    for (const ls of pm.querySelectorAll('LineString > coordinates')) {
      const c = kmlCoords(ls);
      if (c.length > 1) features.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: c } });
    }
    for (const pg of pm.querySelectorAll('Polygon')) {
      const outer = kmlCoords(pg.querySelector('outerBoundaryIs coordinates'));
      if (outer.length > 3) features.push({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [outer] } });
    }
  }
  return features;
}

function normalizeGeoJSON(j) {
  if (j.type === 'FeatureCollection') return j.features || [];
  if (j.type === 'Feature') return [j];
  if (j.type && j.coordinates) return [{ type: 'Feature', properties: {}, geometry: j }];
  throw new Error('Bukan GeoJSON yang dikenali.');
}

/** File .geojson/.json/.gpx/.kml → FeatureCollection. */
export async function parseGeoFile(file) {
  const text = await file.text();
  const ext = file.name.split('.').pop().toLowerCase();
  let features;
  if (ext === 'gpx' || ext === 'kml') {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Berkas XML rusak.');
    features = ext === 'gpx' ? parseGpx(doc) : parseKml(doc);
  } else {
    features = normalizeGeoJSON(JSON.parse(text));
  }
  features = features.filter((f) => f?.geometry?.coordinates);
  if (!features.length) throw new Error('Tidak ada geometri di berkas ini.');
  return { type: 'FeatureCollection', features };
}

/** Kotak pembatas FeatureCollection → [w,s,e,n]. */
export function bboxOfFeatures(fc) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else c.forEach(walk);
  };
  fc.features.forEach((f) => walk(f.geometry.coordinates));
  return [w, s, e, n];
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Jejak { name, points: [{lng,lat,ele,t}] } → teks GPX 1.1. */
export function toGPX(track) {
  const pts = track.points
    .map((p) => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : ''}<time>${new Date(p.t).toISOString()}</time></trkpt>`)
    .join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Atlas Malatan" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(track.name)}</name>
    <trkseg>
      ${pts}
    </trkseg>
  </trk>
</gpx>`;
}
