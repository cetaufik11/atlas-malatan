// Uji narasi rekaman: tiap suara memutar berkasnya sendiri, pilihan tersimpan, tur ikut memakai suara terpilih.
// Pakai: npm run build && npx vite preview --port 4173, lalu node scripts/narration-test.mjs [url]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.argv[2] || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = JSON.parse(fs.readFileSync('src/data/narration.json', 'utf8'));
const voices = manifest.voices || [];
const problems = [];
const check = (ok, what) => {
  console.log((ok ? 'ok    ' : 'GAGAL ') + what);
  if (!ok) problems.push(what);
};

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  args: ['--window-size=1440,980', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.setBypassServiceWorker(true);
p.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
p.on('response', (r) => /\.mp3/.test(r.url()) && r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
await p.evaluateOnNewDocument(() => {
  window.__played = [];
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played.push(new URL(this.src).pathname.split('/').slice(-2).join('/'));
    window.__a = this;
    return P.call(this);
  };
});

await p.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(9000);
await p.$eval('.pin[data-id="makam-leluhur"]', (e) => e.click());
await sleep(4000);

const listen = () => p.evaluate(() => document.querySelector('.detail .actions button').click());
const lastPlayed = () => p.evaluate(() => window.__played[window.__played.length - 1]);
const pickerValue = (root) => p.evaluate((root) => document.querySelector(`${root} .voice-picker select`)?.value ?? null, root);
const pick = (root, v) =>
  p.evaluate((root, v) => {
    const s = document.querySelector(`${root} .voice-picker select`);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, v);
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, root, v);

check(voices.length >= 2, `manifest berisi ${voices.length} suara: ${voices.join(', ')}`);
check((await pickerValue('.detail')) === voices[0], `pemilih suara tampil, awalnya "${voices[0]}"`);

for (const v of voices) {
  await pick('.detail', v);
  await sleep(300);
  await listen();
  // Pemutaran pertama di Chrome otomatis (audio dibisukan) bisa butuh beberapa detik sampai
  // posisinya bergerak, jadi tunggu sampai benar-benar berjalan alih-alih memakai jeda tetap.
  await p.waitForFunction(() => window.__a && !window.__a.paused && window.__a.currentTime > 0.5, { timeout: 20000, polling: 250 }).catch(() => {});
  const st = await p.evaluate(() => ({ t: window.__a?.currentTime ?? 0, paused: window.__a?.paused, tts: speechSynthesis.speaking, btn: document.querySelector('.detail .actions button').innerText.trim() }));
  check((await lastPlayed()) === `${v.toLowerCase()}/makam-leluhur.mp3`, `${v}: memutar ${await lastPlayed()}`);
  check(!st.paused && st.t > 0 && !st.tts && st.btn === 'Berhenti', `${v}: audio berjalan (${st.t.toFixed(1)} dtk), tanpa suara perangkat`);
  await listen(); // berhenti
  await sleep(400);
}

// Ganti suara saat sedang memutar → pemutaran berhenti, tombol kembali.
await listen();
await sleep(1500);
await pick('.detail', voices[0]);
await sleep(500);
const after = await p.evaluate(() => ({ paused: window.__a.paused, btn: document.querySelector('.detail .actions button').innerText.trim() }));
check(after.paused && after.btn === 'Dengarkan', 'ganti suara saat memutar: berhenti & tombol kembali ke "Dengarkan"');

// Pilihan tersimpan setelah muat ulang.
await pick('.detail', voices[1]);
await p.reload({ waitUntil: 'domcontentloaded' });
await sleep(8000);
await p.$eval('.pin[data-id="masjid-jami"]', (e) => e.click());
await sleep(3500);
check((await pickerValue('.detail')) === voices[1], `pilihan "${voices[1]}" tersimpan setelah muat ulang`);
await p.$eval('.detail-nav .icon-btn[aria-label="Tutup detail"]', (e) => e.click());

// Tur sinematik memakai suara terpilih.
await p.evaluate(() => [...document.querySelectorAll('.rail-btn')].find((e) => e.textContent.includes('Tur')).click());
await sleep(600);
check((await pickerValue('.panel')) === voices[1], 'pemilih suara juga ada di panel Tur');
await p.evaluate(() => { window.__played = []; [...document.querySelectorAll('.card.tour button')].find((e) => e.textContent.includes('Sinematik')).click(); });
await sleep(7000);
const tourPlayed = await lastPlayed();
check(!!tourPlayed && tourPlayed.startsWith(voices[1].toLowerCase() + '/'), `tur memutar rekaman suara terpilih (${tourPlayed})`);
await p.evaluate(() => document.querySelector('.tour-hud .icon-btn[aria-label="Akhiri tur"]')?.click());

// Semua berkas di manifest benar-benar ada di server.
let missing = 0, total = 0;
for (const v of voices) {
  for (const it of Object.values(manifest.items[v])) {
    total++;
    const r = await fetch(URL + it.file, { method: 'HEAD' });
    if (!r.ok) missing++;
  }
}
check(missing === 0, `${total} berkas rekaman tersedia di server`);

console.log(problems.length ? '\nMASALAH:\n' + problems.join('\n') : '\nTidak ada masalah.');
await b.close();
process.exit(problems.length ? 1 : 0);
