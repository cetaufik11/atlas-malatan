// Pengaturan yang perlu diisi pengelola sebelum publikasi.
export const CONFIG = {
  // Nomor WA pengelola (format internasional tanpa +, mis. '6281234567890').
  // Kosongkan agar warga memilih sendiri kontak tujuan di WhatsApp.
  whatsapp: '',
  // Email pengelola untuk kiriman via email (opsional).
  email: '',
  // Alamat publik situs (dipakai di QR). Kosongkan = pakai alamat saat ini.
  publicUrl: 'https://cetaufik11.github.io/atlas-malatan/',
  // PIN sederhana mode admin. Hanya pencegah iseng, BUKAN keamanan sungguhan:
  // situs statis tidak bisa menyimpan rahasia. Data asli tetap aman karena
  // suntingan admin hanya tersimpan di perangkat sampai diekspor.
  adminPin: 'malatan',
};
