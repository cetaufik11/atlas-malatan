// Sekali jalan: ambil data dari peta-malatan-satelit.html lama ke JSON.
// Pakai: node scripts/extract-legacy.mjs ../peta-malatan-satelit.html
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(process.argv[2], 'utf8');
const BACKSLASH = String.fromCharCode(92);

function grab(name) {
  const start = src.indexOf(`const ${name} =`);
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('=', start) + 1;
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === '[' ? ']' : open === '{' ? '}' : null;
  let depth = 0, j = i, str = null;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (str) {
      if (ch === BACKSLASH) { j++; continue; }
      if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) break;
  }
  return vm.runInNewContext('(' + src.slice(i, j + 1) + ')');
}

const out = {
  locations: grab('MALATAN_LOCATIONS'),
  boundary: grab('MALATAN_BOUNDARY'),
  mainRoad: grab('MAIN_ROAD_COORDS'),
  streets: grab('VILLAGE_STREETS'),
  riverNorth: grab('RIVER_NORTH'),
  riverSouth: grab('RIVER_SOUTH'),
};
fs.writeFileSync('scripts/legacy.json', JSON.stringify(out, null, 2));

const m = src.match(/ARCHIVE_MAP_BASE64\s*=\s*["'`]data:image\/(\w+);base64,([A-Za-z0-9+/=]+)/);
if (m) {
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  fs.writeFileSync(`public/media/peta-arsip-2018.${ext}`, Buffer.from(m[2], 'base64'));
  console.log('archive map saved as', ext);
}
console.log(out.locations.length, 'locations; keys:', Object.keys(out.locations[0]).join(','));
console.log('cats:', [...new Set(out.locations.map(l => l.cat + '=' + l.catLabel + '=' + l.color))].join(' | '));
