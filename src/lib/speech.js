// Narasi suara (Web Speech API) untuk tur. Diam-diam nonaktif bila tak didukung.
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voice = null;
function pickVoice() {
  if (!speechSupported) return null;
  const voices = window.speechSynthesis.getVoices();
  voice = voices.find((v) => v.lang?.toLowerCase().startsWith('id')) || voices.find((v) => v.lang?.toLowerCase().startsWith('ms')) || null;
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
