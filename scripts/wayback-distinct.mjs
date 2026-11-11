// Cari rilis Esri Wayback yang citranya benar-benar berbeda di atas Malatan.
// Hasil: src/data/imagery.json (dipakai fitur Mesin Waktu).
import fs from 'node:fs';
import crypto from 'node:crypto';

const cfg = JSON.parse(fs.readFileSync('scripts/wayback.json', 'utf8'));
const LAT = -7.28575, LNG = 110.01215, Z = Number(process.argv[2] || 17);
const n = 2 ** Z;
const x = Math.floor(((LNG + 180) / 360) * n);
const latR = (LAT * Math.PI) / 180;
const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);

const releases = Object.entries(cfg)
  .map(([id, v]) => ({ id: +id, date: v.itemTitle.match(/(\d{4}-\d{2}-\d{2})/)[1] }))
  .sort((a, b) => a.date.localeCompare(b.date));

const out = [];
let prev = null;
for (const r of releases) {
  const url = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${r.id}/${Z}/${y}/${x}`;
  let hash = 'err';
  try {
    const res = await fetch(url);
    if (res.ok) hash = crypto.createHash('sha1').update(Buffer.from(await res.arrayBuffer())).digest('hex');
  } catch { /* lewati */ }
  if (hash !== 'err' && hash !== prev) {
    out.push({ release: r.id, date: r.date });
    prev = hash;
    console.log('baru:', r.date, r.id);
  }
}
fs.writeFileSync('src/data/imagery.json', JSON.stringify(out, null, 2));
console.log(out.length, 'citra berbeda');
