// Tambahkan maxzoom tiap rilis ke src/data/imagery.json (zoom tertinggi yang punya ubin di Malatan).
import fs from 'node:fs';

const file = 'src/data/imagery.json';
const list = JSON.parse(fs.readFileSync(file, 'utf8'));
const LAT = -7.28575, LNG = 110.01215;
const tile = (z) => {
  const n = 2 ** z, r = (LAT * Math.PI) / 180;
  return [Math.floor(((LNG + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};
for (const im of list) {
  im.maxzoom = 16;
  for (const z of [17, 18, 19]) {
    const [x, y] = tile(z);
    const res = await fetch(`https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${im.release}/${z}/${y}/${x}`, { redirect: 'manual' });
    if (res.status === 200) im.maxzoom = z;
    else break;
  }
  console.log(im.date, im.release, 'maxzoom', im.maxzoom);
}
fs.writeFileSync(file, JSON.stringify(list, null, 2));
