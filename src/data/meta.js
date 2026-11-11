// Kamus label & warna. Ubah di sini bila kategori/status bertambah.

export const CATEGORIES = {
  ibadah: { label: 'Ibadah & Bina Damai', color: '#3f9b78' },
  budaya: { label: 'Budaya & Pendidikan', color: '#c9a45c' },
  sejarah: { label: 'Sejarah & Adat', color: '#c8673f' },
  agraris: { label: 'Agraris & Jembatan', color: '#4f8fbf' },
};

// Status NARASI (seberapa kuat dasar ceritanya).
export const STATUSES = {
  terverifikasi: {
    label: 'Terverifikasi',
    short: 'Terverifikasi',
    color: '#2f8f5b',
    hint: 'Dicocokkan dengan sumber tertulis atau bukti fisik yang dapat diperiksa ulang.',
  },
  observasi: {
    label: 'Observasi Lapangan',
    short: 'Observasi',
    color: '#3b7dd8',
    hint: 'Keberadaan tempat sudah dilihat langsung; detail sejarahnya belum tentu teruji.',
  },
  tutur: {
    label: 'Tutur Lisan',
    short: 'Tutur',
    color: '#9a6bd1',
    hint: 'Bersumber dari wawancara/penuturan warga. Perlu dibandingkan dengan sumber lain.',
  },
  legenda: {
    label: 'Legenda',
    short: 'Legenda',
    color: '#c8673f',
    hint: 'Cerita tutur tinular. Dihormati sebagai kepercayaan lokal, bukan fakta sejarah.',
  },
  'perlu-kajian': {
    label: 'Perlu Kajian Ahli',
    short: 'Perlu kajian',
    color: '#d19a1c',
    hint: 'Temuan fisik yang harus diperiksa ahli cagar budaya sebelum disimpulkan.',
  },
  draf: {
    label: 'Draf — Belum Diverifikasi',
    short: 'Draf',
    color: '#8a8580',
    hint: 'Teks awal yang belum dicek ke narasumber. Jangan dikutip sebagai fakta.',
  },
};

// Status KOORDINAT (seberapa tepat titiknya).
export const COORD_METHODS = {
  gps: { label: 'GPS lapangan', hint: 'Diambil langsung di lokasi.' },
  'peta-2018': { label: 'Kalibrasi Peta 2018', hint: 'Diturunkan dari Peta Desa Bansari 2018 (KKN Undip); bisa meleset beberapa meter.' },
  perkiraan: { label: 'Perkiraan', hint: 'Lokasi kira-kira, belum disurvei.' },
};

export const SOURCE_TYPES = {
  lisan: 'Sumber lisan',
  dokumen: 'Dokumen',
  observasi: 'Observasi',
  peta: 'Peta',
  foto: 'Foto',
};

export const MEDIA_TYPES = { photo: 'Foto', audio: 'Audio', video: 'Video', doc: 'Dokumen' };

export const CENTER = [110.01215, -7.28575];
