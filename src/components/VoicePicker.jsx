// Pemilih suara narasi (muncul hanya bila ada lebih dari satu suara rekaman).
import { useStore } from '../store.js';
import { VOICES, voiceLabel, activeVoice, stopNarration } from '../lib/narration.js';

export default function VoicePicker({ onChange, compact = false }) {
  // Berlangganan agar ikut berubah bila suara diganti dari tempat lain.
  useStore((s) => s.narrator);
  const setNarrator = useStore((s) => s.setNarrator);
  if (VOICES.length < 2) return null;

  return (
    <label className={`voice-picker ${compact ? 'compact' : ''}`}>
      <span>Suara narasi</span>
      <select
        value={activeVoice() ?? ''}
        onChange={(e) => {
          stopNarration(); // suara lama berhenti; pemutaran berikutnya memakai suara baru
          setNarrator(e.target.value);
          onChange?.(e.target.value);
        }}
      >
        {VOICES.map((v) => (
          <option key={v} value={v}>{voiceLabel(v)}</option>
        ))}
      </select>
    </label>
  );
}
