// Narasi suara (Web Speech API) untuk tur. Diam-diam nonaktif bila tak didukung.
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voice = null;
function pickVoice() {
  if (!speechSupported) return null;
  const voices = window.speechSynthesis.getVoices();
  const id = voices.filter((v) => v.lang?.toLowerCase().startsWith('id'));
  // Suara 'Natural'/'Online' (Edge) dan 'Google' biasanya jauh lebih enak didengar daripada suara bawaan lama.
  voice =
    id.find((v) => /natural|online/i.test(v.name)) ||
    id.find((v) => /google/i.test(v.name)) ||
    id[0] ||
    voices.find((v) => v.lang?.toLowerCase().startsWith('ms')) ||
    null;
  return voice;
}
if (speechSupported) window.speechSynthesis.onvoiceschanged = pickVoice;

export function hasIndonesianVoice() {
  return !!(voice || pickVoice());
}

export function speak(text, { onEnd, rate = 1 } = {}) {
  if (!speechSupported) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  u.rate = rate;
  const v = voice || pickVoice();
  if (v) u.voice = v;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSupported) window.speechSynthesis.cancel();
}
