import { useStore } from '../store.js';
import { TOURS, resolveStops } from '../data/tours.js';
import { pathLength, fmtDistance, walkMinutes } from '../lib/geo.js';
import { startTracking } from '../lib/gps.js';
import { speechSupported } from '../lib/speech.js';
import { Icon } from '../components/icons.jsx';

export default function ToursPanel() {
  const sites = useStore((s) => s.sites);
  const setTour = useStore((s) => s.setTour);
  const tour = useStore((s) => s.tour);
  const tracking = useStore((s) => s.tracking);

  const start = async (t, mode) => {
    const stops = resolveStops(t, sites);
    if (mode === 'walk' && !tracking) {
      const ok = await startTracking();
      if (!ok) return;
    }
    setTour({ id: t.id, title: t.title, stops, step: 0, mode, playing: true, voice: speechSupported });
  };

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Pemandu</span>
        <h2>Tur Sejarah</h2>
        <p className="muted">
          <b>Sinematik</b>: kamera terbang otomatis dengan narasi suara, cocok untuk presentasi. <b>Jalan kaki</b>: pakai GPS di lapangan; situs terbuka
          otomatis saat kamu sudah dekat.
        </p>
      </header>

      {TOURS.map((t) => {
        const stops = resolveStops(t, sites);
        const coords = stops.map((id) => sites.find((s) => s.id === id)).map((s) => [s.lng, s.lat]);
        const len = pathLength(coords);
        const active = tour?.id === t.id;
        return (
          <article key={t.id} className={`card tour ${active ? 'on' : ''}`}>
            <span className="eyebrow">{t.theme}</span>
            <h3>{t.title}</h3>
            <p>{t.blurb}</p>
            <p className="small muted">
              {stops.length} perhentian · {fmtDistance(len)} garis lurus · ±{walkMinutes(len * 1.4)} menit jalan kaki
            </p>
            <ol className="stops">
              {stops.map((id) => (
                <li key={id}>{sites.find((s) => s.id === id)?.name}</li>
              ))}
            </ol>
            <div className="row">
              <button type="button" className="btn sm" onClick={() => start(t, 'cinematic')}>
                <Icon name="play" size={14} /> Sinematik
              </button>
              <button type="button" className="btn ghost sm" onClick={() => start(t, 'walk')}>
                <Icon name="walk" size={14} /> Jalan kaki (GPS)
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
