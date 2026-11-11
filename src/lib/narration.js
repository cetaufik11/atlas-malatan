// Narasi situs: putar rekaman (Gemini TTS, dibuat oleh scripts/generate-narration.mjs)
// bila tersedia dan masih cocok dengan teks situs; jika tidak, pakai suara perangkat.
import manifest from '../data/narration.json';
import { narrationText, textHash } from './narration-text.js';
import { speak, stopSpeaking, speechSupported } from './speech.js';

let audio = null;

/** Entri rekaman yang masih berlaku untuk situs ini, atau null. */
export function recordingFor(site) {
  const item = manifest.items?.[site.id];
  if (!item) return null;
  // Teks disunting (mis. lewat mode admin) → rekaman lama tidak lagi sesuai.
  return item.hash === textHash(narrationText(site)) ? item : null;
}

export const hasAnyRecording = Object.keys(manifest.items || {}).length > 0;
export const narrationSupported = speechSupported || hasAnyRecording;
export const recordingFiles = () => Object.values(manifest.items || {}).map((i) => i.file);

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
  a.addEventListener('ended', finish);
  a.addEventListener('error', () => {
    // Berkas tak termuat (offline & belum tersimpan): jatuh ke suara perangkat.
    if (settled || audio !== a) return;
    settled = true;
    audio = null;
    fallback();
  });
  a.play().catch(() => {
    if (settled || audio !== a) return;
    settled = true;
    audio = null;
    fallback();
  });
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
