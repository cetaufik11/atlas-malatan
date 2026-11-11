// Ubah scripts/legacy.json (dari peta lama) menjadi data Atlas v2.
// Sekali jalan saat migrasi. Setelah ini, data diedit lewat src/data/*.json atau mode Admin.
import fs from 'node:fs';

const legacy = JSON.parse(fs.readFileSync('scripts/legacy.json', 'utf8'));

const flip = (pts) => pts.map(([lat, lng]) => [lng, lat]);

function narrativeStatus(l) {
  if (l.id === 'makam-leluhur') return 'legenda';
  if (l.gpsVerified) return 'observasi';
  return 'draf';
}

function sourceType(cite) {
  if (/tutur|lisan|sesepuh/i.test(cite)) return 'lisan';
  if (/observasi|survei|pemetaan|dokumentasi spasial/i.test(cite)) return 'observasi';
  return 'dokumen';
}

const sites = legacy.locations.map((l) => {
  const specs = { ...l.specs };
  const mapSource = specs['Sumber Peta'];
  const sources = [{ title: l.quoteCite, type: sourceType(l.quoteCite), note: '' }];
  if (mapSource) sources.push({ title: mapSource, type: 'peta', note: 'Sumber posisi koordinat' });
  return {
    id: l.id,
    code: l.code,
    name: l.name,
    subtitle: l.subtitle,
    category: l.cat,
    icon: l.artType,
    lat: l.lat,
    lng: l.lng,
    elev: l.elev,
    coord: l.gpsVerified ? 'gps' : 'peta-2018',
    status: narrativeStatus(l),
    description: l.desc,
    quote: l.quote ? { text: l.quote, cite: l.quoteCite } : null,
    specs,
    sources,
    media: [],
    tags: [],
  };
});

const geo = {
  boundary: flip(legacy.boundary),
  mainRoad: flip(legacy.mainRoad),
  streets: legacy.streets.map(flip),
  rivers: [flip(legacy.riverNorth), flip(legacy.riverSouth)],
  archiveBounds: { west: 110.00855, south: -7.28825, east: 110.01445, north: -7.28395 },
};

fs.writeFileSync('src/data/sites.json', JSON.stringify(sites, null, 2));
fs.writeFileSync('src/data/geo.json', JSON.stringify(geo, null, 2));
console.log('sites:', sites.length, sites.map((s) => s.id + ':' + s.status).join(' '));
