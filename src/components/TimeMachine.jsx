import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { Icon } from './icons.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmt = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

export default function TimeMachine() {
  const tm = useStore((s) => s.timeMachine);
  const setTM = useStore((s) => s.setTimeMachine);
  const imagery = useStore((s) => s.imagery);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      const { idx } = useStore.getState().timeMachine;
      if (idx >= imagery.length - 1) {
        setPlaying(false);
        return;
      }
      setTM({ idx: idx + 1 });
    }, 2200);
    return () => clearInterval(timer.current);
  }, [playing, imagery.length, setTM]);

  if (!tm.open) return null;
  const cur = imagery[tm.idx];

  const play = () => {
    if (!playing && tm.idx >= imagery.length - 1) setTM({ idx: 0 });
    setPlaying(!playing);
  };

  return (
    <div className="tm" role="region" aria-label="Mesin waktu citra satelit">
      <div className="tm-head">
        <div>
          <span className="eyebrow">Mesin Waktu</span>
          <strong className="tm-date">{fmt(cur.date)}</strong>
        </div>
        <div className="tm-actions">
          <button type="button" className="btn ghost sm" onClick={play} aria-pressed={playing}>
            <Icon name={playing ? 'pause' : 'play'} size={14} /> {playing ? 'Jeda' : 'Putar'}
          </button>
          <button type="button" className={`btn ghost sm ${tm.swipe ? 'on' : ''}`} onClick={() => setTM({ swipe: !tm.swipe })} aria-pressed={tm.swipe}>
            <Icon name="swipe" size={14} /> Bandingkan
          </button>
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); setTM({ open: false, swipe: false }); }} aria-label="Tutup mesin waktu">
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      <input
        type="range"
        className="tm-range"
        min="0"
        max={imagery.length - 1}
        step="1"
        value={tm.idx}
        onChange={(e) => { setPlaying(false); setTM({ idx: +e.target.value }); }}
        aria-label="Pilih tanggal citra"
        aria-valuetext={fmt(cur.date)}
      />
      <div className="tm-ticks" aria-hidden="true">
        {imagery.map((im, i) => (
          <button key={im.release} type="button" tabIndex={-1} className={i === tm.idx ? 'on' : ''} style={{ left: `${(i / (imagery.length - 1)) * 100}%` }} onClick={() => setTM({ idx: i })}>
            {im.date.slice(2, 4)}
          </button>
        ))}
      </div>

      {tm.swipe && (
        <label className="tm-compare">
          Sisi kiri:
          <select value={tm.compareIdx} onChange={(e) => setTM({ compareIdx: +e.target.value })}>
            <option value={-1}>Peta Arsip Desa 2018 (KKN Undip)</option>
            {imagery.map((im, i) => (
              <option key={im.release} value={i}>Citra {fmt(im.date)}</option>
            ))}
          </select>
        </label>
      )}

      <p className="tm-note">
        Tanggal = tanggal rilis arsip Esri World Imagery Wayback, bukan tanggal pemotretan persis. Hanya citra yang berbeda di atas Malatan yang
        ditampilkan ({imagery.length} dari ±200 rilis).
      </p>
    </div>
  );
}
