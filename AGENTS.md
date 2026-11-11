# Panduan untuk agen AI (Gemini, Claude, dll.) dan kontributor

Atlas Malatan: peta digital Dusun Malatan (Proker KKN). Vite + React 18 + MapLibre GL 4.7, situs statis.
Situs publik: https://cetaufik11.github.io/atlas-malatan/ — ter-deploy otomatis setiap push ke `main`
(lihat `.github/workflows/deploy.yml`). Baca `README.md` untuk gambaran fitur.

## Aturan yang tidak boleh dilanggar

1. **Jangan mengarang isi sejarah.** Jangan menambah tahun, nama tokoh, kutipan, atau cerita yang tidak
   diberikan pengguna. Bila tidak ada keterangan, kosongkan (`""`).
2. **Jangan mengubah koordinat** (`lat`, `lng`, `elev` di `sites.json`, isi `geo.json`). Koordinat saat ini
   diketahui meleset ±4 km dan akan dikoreksi pemilik di lapangan lewat Mode Admin → Kalibrasi.
3. **Jangan menaikkan `status` situs** (mis. `draf` → `terverifikasi`) tanpa perintah eksplisit pengguna.
   Legenda harus tetap berlabel `legenda`.
4. Jangan memakai ubin raster Carto (butuh API key) dan jangan mengganti versi MapLibre tanpa membaca
   "Catatan teknis" di README (ada penangkal bug yang bergantung pada versi 4.7).
5. Foto/rekaman orang hanya dipublikasikan bila pengguna menyatakan sudah ada izin narasumber.

## Tugas paling umum: menambah foto / video / audio ke sebuah situs

1. Taruh berkas di `public/media/`. Nama berkas: huruf kecil, tanpa spasi, diawali id situs,
   mis. `masjid-jami-01.jpg`, `makam-leluhur-wawancara.mp3`, `gedung-kesenian-jaran-kepang.mp4`.
2. Kecilkan dulu:
   - Foto: JPG/WebP, sisi terpanjang ≤ 1600 px, ≤ 400 KB.
   - Video: MP4 (H.264 + AAC), ≤ 720p, **≤ 25 MB per berkas** (batas keras GitHub 100 MB; repo sebaiknya < 1 GB).
     Video panjang lebih baik diunggah ke YouTube lalu ditautkan sebagai `doc`.
   - Audio: MP3/M4A mono 64–96 kbps.
3. Tambahkan entri ke array `media` situs yang sesuai di `src/data/sites.json`:

```json
{
  "type": "photo",
  "src": "media/masjid-jami-01.jpg",
  "caption": "Serambi depan masjid",
  "credit": "Dok. KKN UNY 2026",
  "date": "2026"
}
```

   - `type`: `photo` | `video` | `audio` | `doc` (`doc` = tautan dokumen/halaman luar; `src` boleh URL penuh).
   - `src`: path **relatif tanpa garis miring di depan** (`media/...`), karena situs berjalan di subfolder.
   - `caption`, `credit`, `date`: isi sesuai keterangan pengguna; jangan ditebak.
   - `transcript` (opsional, untuk audio/video): transkrip wawancara.
4. Id situs yang tersedia: `masjid-jami`, `gkj-sindoro`, `gedung-kesenian`, `tpq-malatan`, `makam-leluhur`,
   `posko-kkn`, `sendang-adat`, `sentra-tembakau`, `balai-warga`, `masjid-jalan-utama`, `masjid-timur`,
   `jembatan-utara`, `jembatan-timur`, `jembatan-selatan`.
5. Periksa lalu publikasikan:

```bash
npm install          # sekali saja
npm run build        # harus selesai tanpa error
npm run preview      # buka http://localhost:4173, klik situsnya, pastikan media tampil
git add -A && git commit -m "Tambah foto <nama situs>" && git push
```

   Deploy berjalan otomatis ±2 menit setelah push (tab Actions di GitHub).

## Narasi suara (Gemini TTS)

Tombol **Dengarkan** dan tur memutar rekaman di `public/media/narasi/<id-situs>.mp3` bila terdaftar di
`src/data/narration.json`; kalau tidak ada (atau teks situs sudah berubah), aplikasi memakai suara perangkat.

Membuat / memperbarui rekaman (butuh ffmpeg dan kunci API Gemini):

```bash
# sekali saja: simpan kunci di .env.local (berkas ini TIDAK ikut ke git)
echo "GEMINI_API_KEYS=kunci1,kunci2" > .env.local

npm run narasi                      # hanya situs yang teksnya berubah
npm run narasi -- --voice Charon    # ganti suara: Aoede (bawaan), Kore, Charon, Fenrir, Puck
npm run narasi -- --only makam-leluhur --force
npm run narasi -- --dry             # lihat teks yang akan dibacakan, tanpa memanggil API
```

- **Jangan pernah meng-commit kunci API** ke repo ini (repo publik). Hanya `.env.local`.
- Setelah mengubah `description`, `name`, atau `status` sebuah situs, jalankan lagi `npm run narasi`
  supaya rekamannya cocok; lalu commit `public/media/narasi/` dan `src/data/narration.json`.
- Teks yang dibacakan disusun di `src/lib/narration-text.js` (label legenda/draf ikut dibacakan — jangan dihapus).

## Peta berkas

| Berkas | Isi |
|---|---|
| `src/data/sites.json` | Data situs + media + sumber |
| `src/data/heritage.json` | Legenda & temuan arkeologis |
| `src/data/config.js` | No. WA pengelola, alamat publik, PIN admin |
| `src/components/MediaGallery.jsx` | Tampilan foto/video/audio di detail situs |
| `src/map/MapView.jsx` | Peta MapLibre (hati-hati, banyak penangkal bug) |
| `public/media/` | Berkas media |
| `public/media/narasi/`, `src/data/narration.json` | Rekaman narasi + daftarnya (dibuat `npm run narasi`) |

## Pengujian

`npm run build` wajib lolos. Uji otomatis (opsional, butuh Chrome di Windows dan server pratinjau di port 4173):
`GPU=1 NOSW=1 node scripts/smoke-test.mjs` dan `node scripts/analysis-test.mjs`.
