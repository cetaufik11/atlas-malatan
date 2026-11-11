// Uji asap: buka build di Chrome headless, jalankan alur utama, simpan screenshot.
// Pakai: npm run build && npx vite preview --port 4173  (terminal lain), lalu node scripts/smoke-test.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'scripts/shots';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  // GPU=1: jendela Chrome asli dengan GPU (render 3D akurat). Default: headless + swiftshader.
  headless: process.env.GPU ? false : 'new',
  args: process.env.GPU
    ? ['--window-size=1440,980', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function run(name, viewport, steps) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (process.env.NOSW) await page.setBypassServiceWorker(true);
  page.on('response', (r) => r.status() >= 400 && errors.push('[' + name + '] HTTP ' + r.status() + ' ' + r.url().slice(0, 140)));
  page.on('console', async (m) => {
    if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
    // Uraikan objek Error agar pesannya terbaca (bukan "JSHandle@error").
    const parts = await Promise.all(
      m.args().map((a) => a.evaluate((v) => (v instanceof Error ? v.stack || v.message : typeof v === 'object' ? JSON.stringify(v, Object.getOwnPropertyNames(v || {})).slice(0, 400) : String(v))).catch(() => '?')),
    );
    errors.push(`[${name}] KONSOL: ${parts.join(' | ').slice(0, 900)}`);
  });
  page.on('requestfailed', (r) => errors.push('[' + name + '] FAIL ' + r.url().slice(0, 140) + ' ' + r.failure()?.errorText));
  page.on('pageerror', (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(12000);
  try {
    await steps(page);
  } catch (e) {
    errors.push(`[${name}] LANGKAH GAGAL: ${e.message}`);
  }
  await page.close();
}

const shot = (page, n) =>
  page.screenshot({ path: `${OUT}/${n}.png`, timeout: 20000 }).catch((e) => errors.push(`screenshot ${n}: ${e.message}`));
const click = async (page, sel) => {
  await page.waitForSelector(sel, { timeout: 8000 });
  await page.$eval(sel, (el) => el.click());
};
const clickText = (page, sel, text) =>
  page.evaluate((sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text))?.click(), sel, text);

await run('desktop', { width: 1440, height: 900 }, async (page) => {
  await shot(page, '01-home');
  await click(page, '.pin[data-id="masjid-jami"]');
  await sleep(4000);
  await shot(page, '02-detail');
  await click(page, '.detail-nav .icon-btn[aria-label="Tutup detail"]');
  await click(page, '.fab[title="Mesin waktu citra satelit"]');
  await sleep(1500);
  await page.evaluate(() => {
    const r = document.querySelector('.tm-range');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(r, '0');
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(4000);
  await shot(page, '03-timemachine-2014');
  await clickText(page, '.tm button', 'Bandingkan');
  await sleep(4000);
  await shot(page, '04-swipe');
  await click(page, '.tm .icon-btn');
  for (const [i, tab] of ['Arsip', 'Cagar Budaya', 'Tur', 'Belajar', 'Kirim Cerita', 'Alat'].entries()) {
    await clickText(page, '.rail-btn', tab);
    await sleep(700);
    await shot(page, `05-tab-${i}-${tab.replace(/\s/g, '')}`);
  }
  // Ukur jarak + profil
  await clickText(page, '.tool', 'Jarak');
  const box = await page.$eval('.map', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.55, box.y + box.h * 0.4);
  await sleep(300);
  await page.mouse.click(box.x + box.w * 0.75, box.y + box.h * 0.6);
  await sleep(4000);
  await shot(page, '06-measure');
  // Admin
  await page.evaluate(() => document.querySelector('.hud .icon-btn')?.click());
  await clickText(page, 'button', 'Mode admin');
  await sleep(800);
  await page.type('.modal input[type=password]', 'malatan');
  await page.keyboard.press('Enter');
  await sleep(800);
  await clickText(page, '.admin-list li button', 'GKJ');
  await sleep(500);
  await shot(page, '07-admin');
});

await run('mobile', { width: 390, height: 844, hasTouch: false, deviceScaleFactor: 1 }, async (page) => {
  await shot(page, '10-mobile-home');
  await click(page, '.pin[data-id="makam-leluhur"]');
  await sleep(3500);
  await shot(page, '11-mobile-detail');
  await click(page, '.detail-nav .icon-btn[aria-label="Tutup detail"]');
  await clickText(page, '.rail-btn', 'Tur');
  await sleep(500);
  await clickText(page, '.card.tour button', 'Sinematik');
  await sleep(6000);
  await shot(page, '12-mobile-tour');
});

await browser.close();
fs.writeFileSync(`${OUT}/errors.txt`, errors.join('\n'));
console.log(errors.length ? errors.join('\n') : 'Tidak ada error konsol.');
