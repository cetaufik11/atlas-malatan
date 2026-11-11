// Cek situs publik setelah deploy: muat, peta tampil, detail situs terbuka, aset inti tersedia.
// Pakai: node scripts/live-check.mjs [url]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.argv[2] || 'https://cetaufik11.github.io/atlas-malatan/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('scripts/shots', { recursive: true });

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--window-size=1440,980', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const bad = [];
p.on('response', (r) => r.url().startsWith(URL) && r.status() >= 400 && bad.push(`HTTP ${r.status()} ${r.url()}`));
p.on('pageerror', (e) => bad.push('PAGEERROR ' + e.message));

const res = await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('status halaman:', res.status());
await sleep(12000);
const state = await p.evaluate(() => ({
  judul: document.title,
  pin: document.querySelectorAll('.pin').length,
  tab: [...document.querySelectorAll('.rail-btn')].map((e) => e.innerText.trim()).join(', '),
  medan3d: !!window.__atlasMap?.getTerrain(),
  elevasiKamera: Math.round(window.__atlasMap?.transform.elevation ?? 0),
}));
console.log(JSON.stringify(state, null, 1));
await p.$eval('.pin[data-id="masjid-jami"]', (e) => e.click());
await sleep(6000);
console.log('detail terbuka:', await p.$eval('.detail h2', (e) => e.innerText).catch(() => 'TIDAK'));
await p.screenshot({ path: 'scripts/shots/live.png' });

// Tautan langsung dari QR plang.
await p.goto(URL + '?situs=makam-leluhur', { waitUntil: 'domcontentloaded' });
await sleep(8000);
console.log('tautan QR ?situs=makam-leluhur:', await p.$eval('.detail h2', (e) => e.innerText).catch(() => 'TIDAK TERBUKA'));

for (const path of ['manifest.webmanifest', 'sw.js', 'media/peta-arsip-2018.jpg', 'icon-192.png']) {
  const r = await fetch(URL + path);
  console.log(path.padEnd(28), r.status);
  if (!r.ok) bad.push(`aset hilang: ${path}`);
}
console.log(bad.length ? 'MASALAH:\n' + bad.join('\n') : 'Tidak ada masalah.');
await b.close();
