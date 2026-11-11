// Narasi situs: putar rekaman (Gemini TTS, dibuat oleh scripts/generate-narration.mjs)
// bila tersedia dan masih cocok dengan teks situs; jika tidak, pakai suara perangkat.
// Rekaman bisa tersedia dalam beberapa suara; pengunjung memilih lewat VoicePicker.
import manifest from '../data/narration.json';
import { narrationText, textHash } from './narration-text.js';
import { speak, stopSpeaking, speechSupported } from './speech.js';
import { useStore } from '../store.js';

// Keterangan singkat tiap suara untuk pemilih di antarmuka.
const VOICE_INFO = {
  Charon: 'Pria · berat & berwibawa',
  Kore: 'Wanita · jernih & tegas',
  Aoede: 'Wanita · hangat',
  Fenrir: 'Pria · sinematik',
  Puck: 'Pria · lugas & bersahabat',
};

/** Suara yang punya rekaman, urut sesuai manifest (yang pertama = pilihan awal). */
export const VOICES = (manifest.voices || Object.keys(manifest.items || {})).filter((v) => Object.keys(manifest.items?.[v] || {}).length > 0);
export const voiceLabel = (v) => (VOICE_INFO[v] ? `${v} — ${VOICE_INFO[v]}` : v);

export const hasAnyRecording = VOICES.length > 0;
export const narrationSupported = speechSupported || hasAnyRecording;

/** Suara aktif: pilihan pengunjung bila masih tersedia, kalau tidak suara pertama. */
export function activeVoice() {
  const v = useStore.getState().narrator;
  return VOICES.includes(v) ? v : VOICES[0] ?? null;
}

/** Entri rekaman yang masih berlaku untuk situs ini pada suara aktif, atau null. */
export function recordingFor(site, voice = activeVoice()) {
  const item = voice ? manifest.items?.[voice]?.[site.id] : null;
  if (!item) return null;
  // Teks disunting (mis. lewat mode admin) → rekaman lama tidak lagi sesuai.
  return item.hash === textHash(narrationText(site)) ? item : null;
}

/** Semua berkas rekaman (semua suara), untuk disimpan offline. */
export const recordingFiles = () => VOICES.flatMap((v) => Object.values(manifest.items[v]).map((i) => i.file));

let audio = null;

/**
 * Bacakan narasi situs.
 * @param opts.intro  kalimat pembuka (hanya dipakai suara perangkat; rekaman langsung ke isi)
 * @param opts.onEnd  dipanggil saat selesai (atau gagal total)
 * @returns 'recording' | 'device' | 'none'
 */
export function narrate(site, { intro = '', onEnd } = {}) {
  stopNarration();
  const fallback = () => {
    if (!speechSupported) {
      onEnd?.();
      return 'none';
    }
    speak(`${intro ? intro + ' ' : ''}${narrationText(site)}`, { onEnd });
    return 'device';
  };

  const rec = recordingFor(site);
  if (!rec) return fallback();

  const a = new Audio(rec.file);
  audio = a;
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    if (audio === a) audio = null;
    onEnd?.();
  };
  const useFallback = () => {
    // Berkas tak termuat (offline & belum tersimpan): jatuh ke suara perangkat.
    if (settled || audio !== a) return;
    settled = true;
    audio = null;
    fallback();
  };
  a.addEventListener('ended', finish);
  a.addEventListener('error', useFallback);
  a.play().catch(useFallback);
  return 'recording';
}

export function stopNarration() {
  if (audio) {
    const a = audio;
    audio = null; // tandai dulu agar handler error/ended tidak memicu cadangan
    a.pause();
    a.removeAttribute('src');
  }
  stopSpeaking();
}
