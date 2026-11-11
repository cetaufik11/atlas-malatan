// Bandingkan elevasi tercatat di sites.json dengan model DEM (Terrarium) di titik yang sama.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const sites = JSON.parse(fs.readFileSync('src/data/sites.json', 'utf8'));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
await p.goto('about:blank');
const out = await p.evaluate(async (sites) => {
  const Z = 15;
  const cache = {};
  async function tile(x, y) {
    const k = x + '/' + y;
    if (!cache[k]) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
      const bmp = await createImageBitmap(await res.blob());
      const c = new OffscreenCanvas(256, 256);
      const g = c.getContext('2d');
      g.drawImage(bmp, 0, 0);
      cache[k] = g.getImageData(0, 0, 256, 256).data;
    }
    return cache[k];
  }
  const res = [];
  for (const s of sites) {
    const n = 2 ** Z, fx = ((s.lng + 180) / 360) * n, r = (s.lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const d = await tile(Math.floor(fx), Math.floor(fy));
    const px = Math.floor((fx % 1) * 256), py = Math.floor((fy % 1) * 256), i = (py * 256 + px) * 4;
    res.push([s.id, s.elev, Math.round(d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768)]);
  }
  return res;
}, sites);
for (const [id, rec, dem] of out) console.log(id.padEnd(20), 'tercatat', rec, ' DEM', dem, ' selisih', dem - rec);
await b.close();
