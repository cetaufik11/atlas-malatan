// Uji fitur analisis & kalibrasi (Chrome dengan GPU asli).
// Pakai: npm run build && npx vite preview --port 4173, lalu node scripts/analysis-test.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const OUT = 'scripts/shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--window-size=1440,980', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setBypassServiceWorker(true);
page.on('console', async (m) => {
  if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
  const parts = await Promise.all(
    m.args().map((a) => a.evaluate((v) => (v instanceof Error ? v.stack || v.message : typeof v === 'object' ? JSON.stringify(v, Object.getOwnPropertyNames(v || {})).slice(0, 500) : String(v))).catch(() => '?')),
  );
  errors.push('KONSOL: ' + parts.join(' | ').slice(0, 900));
});
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
await sleep(9000);

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const clickText = (sel, text) =>
  page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text));
    el?.click();
    return !!el;
  }, sel, text);
const step = async (name, fn) => {
  try {
    await fn();
    console.log('ok   ', name);
  } catch (e) {
    errors.push(`LANGKAH ${name}: ${e.message}`);
    await page.screenshot({ path: `${OUT}/gagal-${name.replace(/[^a-z]+/gi, '-')}.png` }).catch(() => {});
    console.log('GAGAL', name, e.message);
  }
};
const must = (ok, what) => { if (!ok) throw new Error('tidak ketemu: ' + what); };
const text = (sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');

await step('buka tab Analisis', async () => {
  must(await clickText('.rail-btn', 'Analisis'), 'tab Analisis');
  await sleep(600);
});

await step('kontur', async () => {
  must(await clickText('.card label.check', 'Tampilkan kontur'), 'cek kontur');
  // Kontur dihitung di web worker dari ubin DEM; di jaringan lambat bisa butuh puluhan detik.
  await page.waitForFunction(() => window.__atlasMap.queryRenderedFeatures({ layers: ['contours'] }).length > 0, { timeout: 40000, polling: 1000 }).catch(() => {});
  await sleep(1500);
  const n = await page.evaluate(() => window.__atlasMap.queryRenderedFeatures({ layers: ['contours'] }).length);
  console.log('      fitur kontur terender:', n);
  must(n > 0, 'garis kontur di peta');
  await shot('20-kontur');
});

await step('lereng', async () => {
  must(await clickText('.card button', 'Hitung peta lereng'), 'tombol lereng');
  await page.waitForSelector('.stack-bar', { timeout: 30000 });
  await sleep(2500);
  console.log('     ', (await text('.result')).replace(/\n+/g, ' | ').slice(0, 260));
  await shot('21-lereng');
});

await step('viewshed dari situs', async () => {
  await page.$eval('.pin[data-id="makam-leluhur"]', (e) => e.click());
  await sleep(3500);
  must(await clickText('.card button', 'Dari Makam'), 'tombol viewshed dari situs');
  await page.waitForFunction(() => document.querySelector('.result')?.innerText.includes('terlihat'), { timeout: 40000 });
  await page.$eval('.detail-nav .icon-btn[aria-label="Tutup detail"]', (e) => e.click());
  await page.evaluate(() => window.__atlasMap.easeTo({ zoom: 13.6, pitch: 0, duration: 0 }));
  await sleep(4000);
  console.log('     ', (await text('.result')).replace(/\n+/g, ' | ').slice(0, 300));
  await shot('22-viewshed');
});

await step('matahari pagi', async () => {
  await page.evaluate(() => window.__atlasMap.easeTo({ zoom: 14.2, pitch: 60, duration: 0 }));
  must(await clickText('.card label.check', 'Aktifkan pencahayaan'), 'cek matahari');
  await sleep(500);
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('input[type=range]')].find((e) => e.getAttribute('aria-label') === 'Jam');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, '6.25');
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await clickText('.overlay-bar button', 'Hapus');
  await sleep(5000);
  console.log('     ', (await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.innerText.includes('Simulasi matahari')).querySelector('.hud-stats').innerText)).replace(/\n+/g, ' | '));
  await shot('23-matahari-pagi');
  await clickText('.card label.check', 'Aktifkan pencahayaan');
});

await step('deteksi perubahan', async () => {
  await page.evaluate(() => window.__atlasMap.easeTo({ zoom: 15.6, pitch: 0, bearing: 0, duration: 0 }));
  must(await clickText('.card button', 'Bandingkan'), 'tombol bandingkan');
  await page.waitForFunction(() => document.querySelector('.result')?.innerText.includes('terdeteksi berubah'), { timeout: 90000 });
  await sleep(3000);
  console.log('     ', (await text('.result')).replace(/\n+/g, ' | ').slice(0, 330));
  await shot('24-perubahan');
  await clickText('.overlay-bar button', 'Hapus');
});

await step('alat lapangan + cuaca', async () => {
  must(await clickText('.rail-btn', 'Alat'), 'tab Alat');
  await sleep(500);
  must(await clickText('.card button', 'Cek cuaca'), 'tombol cuaca');
  await sleep(4000);
  await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.innerText.includes('Cuaca lapangan')).scrollIntoView({ block: 'center' }));
  console.log('     ', (await page.evaluate(() => [...document.querySelectorAll('.card')].find((c) => c.innerText.includes('Cuaca lapangan')).innerText)).replace(/\n+/g, ' | ').slice(0, 200));
  await shot('25-alat-lapangan');
});

await step('impor GeoJSON', async () => {
  const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'uji' }, geometry: { type: 'LineString', coordinates: [[110.0105, -7.2852], [110.0125, -7.2862], [110.0135, -7.2858]] } }] };
  fs.writeFileSync(`${OUT}/uji.geojson`, JSON.stringify(fc));
  const input = await page.$('input[type=file][accept*=".gpx"]');
  await input.uploadFile(`${OUT}/uji.geojson`);
  await sleep(2500);
  const n = await page.evaluate(() => window.__atlasMap.querySourceFeatures('imports').length);
  must(n > 0, 'fitur impor di peta');
});

await step('admin → kalibrasi', async () => {
  must(await clickText('button', 'Mode admin'), 'tombol admin');
  await sleep(600);
  await page.type('.modal input[type=password]', 'malatan');
  await page.keyboard.press('Enter');
  await sleep(600);
  must(await clickText('.modal-head button', 'Kalibrasi posisi'), 'tab kalibrasi');
  await sleep(400);
  await page.type('.calib input[placeholder^="-7"]', '-7.2850, 110.0507');
  await clickText('.calib button', 'Pakai');
  await sleep(400);
  console.log('     ', (await text('.calib .callout')).replace(/\n+/g, ' ').slice(0, 200));
  await shot('26-kalibrasi');
  must(await clickText('.calib button', 'Atur sudut di peta'), 'tombol atur sudut');
  await sleep(3500);
  must((await page.$$('.cal-handle')).length === 5, '5 pegangan kalibrasi');
  await shot('27-kalibrasi-arsip');
  // Seret sudut 3 lalu simpan; peta arsip harus kembali tampil utuh di mode 3D.
  const handles = await page.$$('.cal-handle');
  const h = await handles[3].boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 70, h.y + 50, { steps: 8 });
  await page.mouse.up();
  await sleep(500);
  must(await clickText('.hud.cal button', 'Simpan posisi'), 'tombol simpan');
  await sleep(6000);
  const st = await page.evaluate(() => ({ terrain: !!window.__atlasMap.getTerrain(), vis: window.__atlasMap.getLayoutProperty('archive2018', 'visibility'), tiles: window.__atlasMap.getSource('archive2018').tiles[0] }));
  console.log('     ', JSON.stringify(st));
  must(st.terrain && st.vis === 'visible', 'peta arsip tampil + 3D pulih');
  await shot('28-arsip-3d-setelah-kalibrasi');
});

await browser.close();
fs.writeFileSync(`${OUT}/errors-analysis.txt`, errors.join('\n'));
console.log(errors.length ? '\nERROR:\n' + errors.join('\n') : '\nTidak ada error.');
