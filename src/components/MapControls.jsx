import { useState, useRef, useEffect } from 'react';
import { useStore, mapRef } from '../store.js';
import { BASEMAPS } from '../map/style.js';
import { CENTER } from '../data/meta.js';
import { startTracking, stopTracking } from '../lib/gps.js';
import { Icon } from './icons.jsx';

const LAYER_LABELS = {
  boundary: 'Batas dusun',
  roads: 'Jalan',
  rivers: 'Sungai',
  hillshade: 'Bayangan relief',
  labels: 'Nama tempat (satelit)',
  fieldPoints: 'Titik temuan lapangan',
};

export default function MapControls() {
  const [open, setOpen] = useState(false);
  const pop = useRef(null);
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const terrain = useStore((s) => s.terrain);
  const setTerrain = useStore((s) => s.setTerrain);
  const exaggeration = useStore((s) => s.exaggeration);
  const setExaggeration = useStore((s) => s.setExaggeration);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const archiveOpacity = useStore((s) => s.archiveOpacity);
  const setArchiveOpacity = useStore((s) => s.setArchiveOpacity);
  const tm = useStore((s) => s.timeMachine);
  const setTM = useStore((s) => s.setTimeMachine);
  const tracking = useStore((s) => s.tracking);
  const userPos = useStore((s) => s.userPos);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!pop.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const locate = async () => {
    if (tracking) {
      if (userPos) mapRef.current?.flyTo({ center: [userPos.lng, userPos.lat], zoom: 18 });
      return;
    }
    const ok = await startTracking();
    const p = useStore.getState().userPos;
    if (ok && p) mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 18 });
  };

  const resetView = () =>
    mapRef.current?.flyTo({ center: CENTER, zoom: 16.6, pitch: terrain ? 55 : 0, bearing: -12, duration: 1500 });

  const nextTheme = { auto: 'dark', dark: 'light', light: 'auto' }[theme];

  return (
    <div className="ctrls" ref={pop}>
      <button type="button" className={`fab ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} title="Lapisan peta">
        <Icon name="layers" />
        <span className="sr">Lapisan peta</span>
      </button>
      <button type="button" className={`fab ${terrain ? 'on' : ''}`} onClick={() => setTerrain(!terrain)} aria-pressed={terrain} title="Medan 3D">
        <b className="fab-txt">3D</b>
      </button>
      <button type="button" className={`fab ${tm.open ? 'on' : ''}`} onClick={() => setTM({ open: !tm.open })} aria-pressed={tm.open} title="Mesin waktu citra satelit">
        <Icon name="clock" />
        <span className="sr">Mesin waktu</span>
      </button>
      <button type="button" className={`fab ${tracking ? 'on' : ''}`} onClick={locate} title="Lokasi saya" aria-pressed={tracking}>
        <Icon name="locate" />
        <span className="sr">Lokasi saya</span>
      </button>
      {tracking && (
        <button type="button" className="fab small" onClick={stopTracking} title="Matikan GPS">
          <Icon name="close" size={14} />
          <span className="sr">Matikan GPS</span>
        </button>
      )}
      <button type="button" className="fab" onClick={resetView} title="Kembali ke Malatan">
        <Icon name="compass" />
        <span className="sr">Kembali ke tampilan awal</span>
      </button>
      <button type="button" className="fab" onClick={() => setTheme(nextTheme)} title={`Tema: ${theme}`}>
        <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'star'} />
        <span className="sr">Ganti tema (sekarang {theme})</span>
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="Pengaturan peta">
          <h3>Peta dasar</h3>
          <div className="seg">
            {Object.entries(BASEMAPS).map(([k, b]) => (
              <button key={k} type="button" className={basemap === k ? 'on' : ''} onClick={() => setBasemap(k)} aria-pressed={basemap === k}>
                {b.label}
              </button>
            ))}
          </div>

          <h3>Lapisan</h3>
          {Object.entries(LAYER_LABELS).map(([k, label]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />
              {label}
            </label>
          ))}

          <label className="check">
            <input type="checkbox" checked={layers.archive2018} onChange={() => toggleLayer('archive2018')} />
            Peta Arsip 2018 (KKN Undip)
          </label>
          {layers.archive2018 && (
            <label className="range">
              Transparansi arsip
              <input type="range" min="0" max="1" step="0.05" value={archiveOpacity} onChange={(e) => setArchiveOpacity(+e.target.value)} />
            </label>
          )}

          {terrain && (
            <>
              <h3>Medan 3D</h3>
              <label className="range">
                Tinggi relief ×{exaggeration.toFixed(1)}
                <input type="range" min="1" max="3" step="0.1" value={exaggeration} onChange={(e) => setExaggeration(+e.target.value)} />
              </label>
              <p className="muted small">Klik kanan + seret (atau dua jari) untuk memiringkan & memutar peta.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
