// Teks narasi situs. Dipakai bersama oleh aplikasi (suara perangkat) dan
// scripts/generate-narration.mjs (rekaman Gemini TTS), jadi JANGAN impor apa pun
// yang hanya ada di browser ke berkas ini.

const CAVEAT = {
  legenda: 'Catatan: kisah ini adalah legenda atau tutur tinular warga, bukan fakta sejarah yang terverifikasi.',
  draf: 'Catatan: narasi ini masih draf dan belum diverifikasi ke narasumber.',
  'perlu-kajian': 'Catatan: temuan ini masih perlu dikaji oleh ahli cagar budaya.',
};

/** Ubah simbol tulisan menjadi kata supaya enak didengar. */
export function speechClean(text) {
  return text
    .replace(/\s*&\s*/g, ' dan ')
    .replace(/(\p{L})\s*\/\s*(\p{L})/gu, '$1 atau $2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/±\s*/g, 'sekitar ')
    .replace(/\bmdpl\b/gi, 'meter di atas permukaan laut')
    .replace(/[()]/g, ', ')
    .replace(/['‘’]([^'‘’]{1,40})['‘’]/g, '$1') // kutip tunggal pengapit kata
    .replace(/\s+,/g, ',')
    .replace(/,\s*([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Teks yang dibacakan untuk satu situs. Label kehati-hatian ikut dibacakan. */
export function narrationText(site) {
  const parts = [`${site.name}.`, (site.description || '').trim()];
  if (CAVEAT[site.status]) parts.push(CAVEAT[site.status]);
  return speechClean(parts.filter(Boolean).join(' '));
}

/** Sidik jari teks (djb2). Rekaman dianggap usang bila teks situs berubah. */
export function textHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
