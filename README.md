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

Cara memperbaiki: buka situs di HP saat berada di tiap lokasi → **Alat → Mode admin** → pilih
situs → **Pakai posisi GPS saya** → ekspor `sites.json` → timpa `src/data/sites.json`.
Cek ulang dengan `node scripts/check-elev.mjs`.

## Fitur

| Bidang | Isi |
|---|---|
| Peta | MapLibre GL, medan 3D (DEM Terrarium), langit & kabut, 4 peta dasar, bayangan relief, batas/jalan/sungai |
| Mesin waktu | 11 citra satelit berbeda 2014–2026 (Esri Wayback), putar otomatis, geser-bandingkan dua tahun atau dengan Peta Arsip 2018 |
| Situs | 14 situs, label status narasi (Terverifikasi/Observasi/Tutur/Legenda/Perlu kajian/Draf) terpisah dari status koordinat, filter & cari, narasi suara, QR plang, rute, bagikan tautan `?situs=id` |
| Arsip | Katalog semua sumber & media lintas situs, galeri foto, pemutar audio + transkrip |
| Cagar budaya | Legenda Mbah Malat vs temuan arkeologis, catat titik temuan dengan GPS, draf laporan ke dinas, ekspor GeoJSON, ringkasan UU 11/2010 |
| Tur | Tur sinematik (kamera terbang + orbit + narasi), tur jalan kaki GPS (deteksi tiba ≤25 m, getar), rute terpendek otomatis (2-opt) |
| Belajar | Kuis otomatis (tebak lokasi di peta, kategori, elevasi, legenda vs fakta), lencana, lembar kerja siswa siap cetak |
| Kirim cerita | Form warga + foto (dikompres) + **rekam wawancara** di HP, simpan offline, kirim via WhatsApp/email/file paket |
| Alat | Ukur jarak + profil elevasi interaktif, ukur luas, simpan peta offline, ekspor PNG/GeoJSON/KML, cetak |
| Admin | Sunting/tambah/hapus situs, sumber & media, impor kiriman warga ke situs, ekspor `sites.json` (PIN di `src/data/config.js`) |
| Platform | PWA (bisa dipasang & offline), mode gelap/terang, keyboard (1–7 pindah tab, Esc), ramah pembaca layar, posisi kamera tersimpan di URL |

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
| `src/data/geo.json` | Batas, jalan, sungai, posisi Peta Arsip 2018 |
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
| `scripts/smoke-test.mjs` | Uji otomatis di Chrome (`GPU=1` untuk render 3D asli) |

## Sumber data & lisensi pihak ketiga

Citra: Esri World Imagery & World Imagery Wayback · Elevasi: Mapzen Terrain Tiles (AWS Open Data) ·
Peta jalan: © kontributor OpenStreetMap, OpenTopoMap (CC-BY-SA), Esri · Peta arsip: KKN Undip Teknik Geodesi 2018 ·
Tutur: Bpk. Turatman, Kepala Dusun Malatan (2026).

Tombol "Simpan untuk offline" hanya mengunduh area kecil Malatan (±1.000 ubin) agar tetap sopan
terhadap penyedia ubin. Jangan perluas ke unduhan massal.
