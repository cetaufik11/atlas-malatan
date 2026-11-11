// Buat rekaman narasi tiap situs dengan Gemini TTS, lalu daftarkan di src/data/narration.json.
// Resepnya mengikuti voice bot DataNusantara: model TTS Gemini → PCM 24 kHz → mastering ffmpeg → MP3.
//
// Pakai:
//   GEMINI_API_KEYS=kunci1,kunci2 node scripts/generate-narration.mjs
//   (atau taruh GEMINI_API_KEYS=... di berkas .env.local — berkas itu tidak ikut ke git)
//
// Opsi:
//   --voices Charon,Kore   daftar suara yang direkam (bawaan). Suara pertama jadi pilihan awal di aplikasi.
//                          Tersedia: Charon (pria, berat), Kore (wanita, jernih), Aoede, Fenrir, Puck
//   --only id1,id2         hanya situs tertentu
//   --force                buat ulang walau teksnya tidak berubah
//   --dry                  tampilkan teks yang akan dibacakan, tanpa memanggil API
//
// Rekaman hanya dibuat ulang bila teks situs berubah (dicek lewat sidik jari teks).
// Proses yang terputus (mis. kuota habis) aman diulang: yang sudah jadi dilewati.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { narrationText, textHash } from '../src/lib/narration-text.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

// ---- Konfigurasi ----
function loadEnvLocal() {
  if (!fs.existsSync('.env.local')) return;
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const VOICES = opt('voices', process.env.GEMINI_TTS_VOICES || 'Charon,Kore').split(',').map((v) => v.trim()).filter(Boolean);
const STYLE = process.env.GEMINI_TTS_STYLE || ''; // mis. "Bacakan dengan hangat dan tenang:"
const OUT_ROOT = 'public/media/narasi';
const MANIFEST = 'src/data/narration.json';
const DRY = flag('dry');

// Rantai mastering yang sama dengan voice bot (jernih + volume seragam antar-situs).
const MASTERING =
  'highpass=f=75,lowpass=f=11500,equalizer=f=220:width_type=h:width=120:g=2.8,' +
  'equalizer=f=3500:width_type=h:width=1200:g=2.2,acompressor=threshold=-16dB:ratio=3:attack=5:release=50,loudnorm=I=-16:TP=-1.5:LRA=10';

const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean);
if (!DRY && !keys.length) {
  console.error('Tidak ada kunci. Set GEMINI_API_KEYS (boleh beberapa, pisahkan koma) di lingkungan atau .env.local.');
  process.exit(1);
}
let keyIdx = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Panggil Gemini TTS (rotasi kunci saat kuota habis) ----
async function synthesize(text, voice) {
  let lastErr;
  for (let attempt = 0; attempt < keys.length * 2 + 1; attempt++) {
    const key = keys[keyIdx % keys.length];
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: STYLE ? `${STYLE} ${text}` : text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429 || /quota|exhausted/i.test(body?.error?.message || '')) {
        console.log(`\n   kunci #${(keyIdx % keys.length) + 1} kehabisan kuota, pindah ke kunci berikutnya…`);
        keyIdx++;
        lastErr = new Error('Kuota habis di semua kunci.');
        if (attempt >= keys.length - 1) await sleep(20000); // semua kunci sudah dicoba: tunggu jendela kuota
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error?.message || 'gagal'}`);
      const part = body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw new Error('Respons tidak berisi audio.');
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
      return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate };
    } catch (e) {
      lastErr = e;
      if (/HTTP 4\d\d/.test(e.message)) break; // salah model/suara/kunci: mengulang tidak membantu
      await sleep(3000);
    }
  }
  throw lastErr;
}

// ---- PCM mentah → MP3 mono ter-mastering ----
function toMp3(pcm, rate, outFile) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0', '-af', MASTERING, '-ar', '44100', '-ac', '1', '-b:a', '80k', outFile],
    { input: pcm },
  );
  if (r.error) throw new Error('ffmpeg tidak ditemukan. Pasang ffmpeg lalu ulangi.');
  if (r.status !== 0) throw new Error('ffmpeg gagal: ' + r.stderr.toString().slice(0, 300));
}

// ---- Jalankan ----
const sites = JSON.parse(fs.readFileSync('src/data/sites.json', 'utf8'));
let manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
// Bentuk manifest: { model, generated, voices: [..], items: { <Suara>: { <idSitus>: { file, hash, seconds } } } }
if (!manifest.items || Object.values(manifest.items).some((v) => v && typeof v.file === 'string')) manifest = { items: {} }; // format lama (satu suara)
const only = opt('only', '').split(',').filter(Boolean);
const save = () => {
  manifest.model = MODEL;
  manifest.voices = VOICES.filter((v) => Object.keys(manifest.items[v] || {}).length);
  manifest.generated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
};

let made = 0, skipped = 0, failed = 0;
for (const voice of VOICES) {
  const dir = voice.toLowerCase();
  if (!DRY) fs.mkdirSync(path.join(OUT_ROOT, dir), { recursive: true });
  manifest.items[voice] ||= {};
  for (const site of sites) {
    if (only.length && !only.includes(site.id)) continue;
    const text = narrationText(site);
    const hash = textHash(text);
    const file = `media/narasi/${dir}/${site.id}.mp3`;
    const abs = path.join('public', file);
    const prev = manifest.items[voice][site.id];

    if (DRY) {
      if (voice === VOICES[0]) console.log(`\n[${site.id}] ${text.split(/\s+/).length} kata\n${text}`);
      continue;
    }
    if (!flag('force') && prev?.hash === hash && fs.existsSync(abs)) {
      skipped++;
      continue;
    }
    process.stdout.write(`• ${voice} · ${site.id} … `);
    try {
      const { pcm, rate } = await synthesize(text, voice);
      toMp3(pcm, rate, abs);
      const seconds = Math.round(pcm.length / 2 / rate);
      manifest.items[voice][site.id] = { file, hash, seconds };
      save(); // simpan tiap selesai satu rekaman, supaya proses yang terputus bisa dilanjutkan
      console.log(`${seconds} dtk, ${Math.round(fs.statSync(abs).size / 1024)} KB`);
      made++;
      await sleep(1500); // sopan terhadap batas permintaan per menit
    } catch (e) {
      console.log('GAGAL: ' + e.message);
      failed++;
    }
  }
}

// Bersih-bersih: suara yang tidak lagi dipakai, situs yang sudah dihapus, dan berkas format lama.
if (!DRY && !only.length) {
  const ids = new Set(sites.map((s) => s.id));
  for (const voice of Object.keys(manifest.items)) {
    if (!VOICES.includes(voice)) {
      fs.rmSync(path.join(OUT_ROOT, voice.toLowerCase()), { recursive: true, force: true });
      delete manifest.items[voice];
      continue;
    }
    for (const id of Object.keys(manifest.items[voice])) {
      if (!ids.has(id)) {
        fs.rmSync(path.join('public', manifest.items[voice][id].file), { force: true });
        delete manifest.items[voice][id];
      }
    }
  }
  for (const f of fs.readdirSync(OUT_ROOT)) if (f.endsWith('.mp3')) fs.rmSync(path.join(OUT_ROOT, f)); // rekaman lama tanpa folder suara
  for (const d of fs.readdirSync(OUT_ROOT)) {
    const p = path.join(OUT_ROOT, d);
    if (fs.statSync(p).isDirectory() && !VOICES.some((v) => v.toLowerCase() === d)) fs.rmSync(p, { recursive: true, force: true });
  }
  save();
}
if (!DRY) console.log(`\nSelesai: ${made} dibuat, ${skipped} sudah ada, ${failed} gagal. Model ${MODEL}, suara ${VOICES.join(' + ')}.`);
process.exit(failed ? 1 : 0);
