# Atlas Malatan — Peta Digital Dusun Malatan

Peta digital 3D, mesin waktu citra satelit, arsip sejarah, dan pemandu lapangan untuk
Dusun Malatan, Desa Bansari, Temanggung. Proker KKN UNY 2026.

Penerus dari `peta-malatan-satelit.html` (WebGIS Leaflet) dan `peta-dukuh-malatan-3d` (diorama Three.js).

## ⚠️ Periksa dulu: koordinat situs

Koordinat 14 situs diambil dari peta lama. Saat dicek ke model elevasi (DEM) dan OpenStreetMap,
titik-titiknya berada di ±1.950 mdpl di lereng hutan Sindoro (wilayah Katekan), **bukan** di
permukiman Desa Bansari (±4 km di timur, sekitar `-7.285, 110.051`). Elevasi tercatat (±1.240 mdpl)
juga berselisih ±700 m dari DEM. Kemungkinan besar seluruh titik — dan posisi Peta Arsip 2018 —
tergeser.

Cara memperbaiki (**Alat → Mode admin → Kalibrasi posisi**):

1. **Geser semua data sekaligus** — tentukan posisi sebenarnya satu situs acuan (GPS di lokasi, titik tengah
   peta, atau koordinat yang disalin dari Google Maps). Semua situs, batas, jalan, sungai, dan peta arsip ikut
   bergeser dengan selisih yang sama.
2. **Atur sudut peta arsip** — seret 4 sudut Peta Arsip 2018 sampai berimpit dengan citra satelit.
3. **Perhalus per situs** — tab Situs → pilih situs → *Pakai posisi GPS saya* saat berada di lokasinya.
4. **Batas & jalan dari jejak GPS** — rekam jejak di tab Alat sambil berjalan, lalu jadikan batas/jalan.
5. Ekspor `sites.json` dan `geo.json`, timpa berkas di `src/data/`, build ulang. Cek dengan `node scripts/check-elev.mjs`.

## Fitur

| Bidang | Isi |
|---|---|
| Peta | MapLibre GL, medan 3D (DEM Terrarium), langit & kabut, 4 peta dasar, bayangan relief, batas/jalan/sungai |
| Mesin waktu | 11 citra satelit berbeda 2014–2026 (Esri Wayback), putar otomatis, geser-bandingkan dua tahun atau dengan Peta Arsip 2018 |
| Narasi | Rekaman suara alami per situs dalam dua pilihan suara, Charon dan Kore (Gemini TTS, `npm run narasi`) untuk tombol Dengarkan dan tur; otomatis jatuh ke suara perangkat bila rekaman tidak ada atau teks berubah |
| Situs | 14 situs, label status narasi (Terverifikasi/Observasi/Tutur/Legenda/Perlu kajian/Draf) terpisah dari status koordinat, filter & cari, narasi suara, QR plang, rute, bagikan tautan `?situs=id` |
| Arsip | Katalog semua sumber & media lintas situs, galeri foto, pemutar audio + transkrip |
| Cagar budaya | Legenda Mbah Malat vs temuan arkeologis, catat titik temuan dengan GPS, draf laporan ke dinas, ekspor GeoJSON, ringkasan UU 11/2010 |
| Tur | Tur sinematik (kamera terbang + orbit + narasi), tur jalan kaki GPS (deteksi tiba ≤25 m, getar), rute terpendek otomatis (2-opt) |
| Belajar | Kuis otomatis (tebak lokasi di peta, kategori, elevasi, legenda vs fakta), lencana, lembar kerja siswa siap cetak |
| Kirim cerita | Form warga + foto (dikompres) + **rekam wawancara** di HP, simpan offline, kirim via WhatsApp/email/file paket |
| Analisis | Garis kontur (dibangkitkan dari DEM), peta kelas kemiringan lereng + statistik dalam batas dusun, keterlihatan/viewshed dari titik mana pun, simulasi matahari (tanggal & jam, terbit/terbenam), deteksi perubahan lahan antara dua tahun citra |
| Lapangan | Rekam jejak GPS (ekspor GPX/GeoJSON), impor lapisan GPX/KML/GeoJSON, cuaca setempat (Open-Meteo) |
| Kalibrasi | Geser massal semua data, georeferensi ulang peta arsip (seret sudut), batas/jalan dari jejak GPS, ekspor `geo.json` |
| Alat | Ukur jarak + profil elevasi interaktif, ukur luas, simpan peta offline, ekspor PNG/GeoJSON/KML, cetak |
| Admin | Sunting/tambah/hapus situs, sumber & media, impor kiriman warga ke situs, ekspor `sites.json` (PIN di `src/data/config.js`) |
| Platform | PWA (bisa dipasang & offline), mode gelap/terang, keyboard (1–8 pindah tab, Esc), ramah pembaca layar, posisi kamera tersimpan di URL |

## Menjalankan

Butuh Node.js 18+. Di Windows cukup klik dua kali `MULAI-WEBSITE.bat`, atau:

```bash
npm install
npm run dev        # pengembangan, http://localhost:5173
npm run build      # hasil di dist/
npm run preview    # uji hasil build
```

## Mengubah isi

| File | Isi |
|---|---|
| `src/data/sites.json` | Situs (atau sunting lewat Mode Admin lalu ekspor) |
| `src/data/heritage.json` | Legenda, temuan arkeologis, info hukum |
| `src/data/tours.js` | Rute tur |
| `src/data/meta.js` | Kategori, status, warna |
| `src/data/config.js` | No. WA pengelola, email, alamat publik (QR), PIN admin |
| `src/data/geo.json` | Batas, jalan, sungai, posisi Peta Arsip 2018 (atau lewat Mode Admin → Kalibrasi lalu ekspor) |
| `public/media/` | Foto/audio besar (rujuk sebagai `media/nama.jpg`) |

Media per situs: `{ "type": "photo|audio|video|doc", "src": "media/x.jpg", "caption": "", "credit": "", "date": "", "transcript": "" }`.

## Deploy (gratis)

Folder `dist/` bisa diunggah ke GitHub Pages, Cloudflare Pages, atau Netlify (base path relatif, jalan di subfolder mana pun).
Setelah tahu alamat publiknya, isi `publicUrl` di `src/data/config.js` agar QR plang mengarah ke sana.

## Skrip

| Skrip | Fungsi |
|---|---|
| `scripts/extract-legacy.mjs`, `build-data.mjs` | Migrasi data dari peta lama (sudah dijalankan) |
| `scripts/wayback-distinct.mjs`, `wayback-maxzoom.mjs` | Cari ulang citra historis yang berbeda (jalankan tiap tahun untuk citra baru) |
| `scripts/check-elev.mjs` | Bandingkan elevasi tercatat vs DEM per situs |
| `scripts/generate-narration.mjs` | Buat rekaman narasi dengan Gemini TTS (lihat AGENTS.md) |
| `scripts/smoke-test.mjs` | Uji otomatis alur utama di Chrome (`GPU=1` untuk render 3D asli) |
| `scripts/analysis-test.mjs` | Uji otomatis fitur analisis, alat lapangan, dan kalibrasi (Chrome dengan GPU) |

## Catatan teknis

- **Hasil analisis & peta arsip disajikan sebagai ubin raster** lewat protokol khusus (`src/map/overlayTiles.js`, `archiveTiles.js`). Sumber bertipe `image` di MapLibre terpotong di batas ubin saat medan 3D aktif.
- **Penangkal bug MapLibre 4.7** di `MapView.jsx`: setelah `easeTo/flyTo` dengan medan aktif, `_elevationFreeze` tidak dikembalikan, sehingga kamera bisa terkunci di ketinggian 0 m (di lereng ±2.000 m = kamera di dalam gunung). Periksa ulang bila meng-upgrade MapLibre.
- Analisis memakai DEM ±30 m: cukup untuk gambaran lereng & keterlihatan, bukan untuk perencanaan teknis.
- Deteksi perubahan menandai blok yang selisih kehijauannya paling menonjol (median ± k·MAD); beda musim dan awan bisa ikut tertandai.

## Sumber data & lisensi pihak ketiga

Citra: Esri World Imagery & World Imagery Wayback · Elevasi: Mapzen Terrain Tiles (AWS Open Data) ·
Peta jalan: © kontributor OpenStreetMap, OpenTopoMap (CC-BY-SA), Esri · Cuaca: Open-Meteo · Kontur: maplibre-contour · Peta arsip: KKN Undip Teknik Geodesi 2018 ·
Tutur: Bpk. Turatman, Kepala Dusun Malatan (2026).

Tombol "Simpan untuk offline" hanya mengunduh area kecil Malatan (±1.000 ubin) agar tetap sopan
terhadap penyedia ubin. Jangan perluas ke unduhan massal.
