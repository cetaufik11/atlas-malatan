import { useEffect, useRef } from 'react';
import { useStore, mapRef } from '../store.js';
import { speak, stopSpeaking, speechSupported } from '../lib/speech.js';
import { distance, bearing, compassLabel, fmtDistance, walkMinutes } from '../lib/geo.js';
import { STATUSES } from '../data/meta.js';
import { Icon } from './icons.jsx';

const ARRIVE_M = 25;

export default function TourHud() {
  const tour = useStore((s) => s.tour);
  const setTour = useStore((s) => s.setTour);
  const sites = useStore((s) => s.sites);
  const select = useStore((s) => s.select);
  const userPos = useStore((s) => s.userPos);
  const notify = useStore((s) => s.notify);
  const timer = useRef(null);
  const orbit = useRef(null);

  const stop = tour ? sites.find((s) => s.id === tour.stops[tour.step]) : null;

  const patch = (p) => setTour({ ...useStore.getState().tour, ...p });
  const go = (d) => {
    const t = useStore.getState().tour;
    const step = Math.min(t.stops.length - 1, Math.max(0, t.step + d));
    setTour({ ...t, step, arrived: false });
  };

  // Mode sinematik: buka situs, putar kamera pelan, bacakan, lalu lanjut.
  useEffect(() => {
    if (!tour || tour.mode !== 'cinematic' || !stop) return;
    select(stop.id);
    clearTimeout(timer.current);
    cancelAnimationFrame(orbit.current);
    stopSpeaking();
    if (!tour.playing) return;

    const map = mapRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Orbit pelan setelah kamera tiba.
    const startOrbit = () => {
      if (reduce || !map) return;
      let last = performance.now();
      const spin = (now) => {
        map.setBearing(map.getBearing() + ((now - last) / 1000) * 4);
        last = now;
        orbit.current = requestAnimationFrame(spin);
      };
      orbit.current = requestAnimationFrame(spin);
    };
    const t0 = setTimeout(startOrbit, 2400);

    const next = () => {
      const t = useStore.getState().tour;
      if (!t) return;
      if (t.step >= t.stops.length - 1) {
        setTour({ ...t, playing: false });
        notify('Tur selesai. Terima kasih sudah menjelajah Malatan!');
      } else setTour({ ...t, step: t.step + 1 });
    };
    const st = STATUSES[stop.status];
    const text = `Perhentian ${tour.step + 1}. ${stop.name}. ${stop.description}${stop.status === 'legenda' || stop.status === 'draf' ? ` Catatan: status narasi ${st.label}.` : ''}`;
    if (tour.voice && speechSupported) {
      timer.current = setTimeout(() => speak(text, { onEnd: () => (timer.current = setTimeout(next, 1500)) }), 2200);
    } else {
      const ms = Math.max(9000, text.split(' ').length * 380);
      timer.current = setTimeout(next, ms);
    }
    return () => {
      clearTimeout(t0);
      clearTimeout(timer.current);
      cancelAnimationFrame(orbit.current);
      stopSpeaking();
    };
  }, [tour?.step, tour?.playing, tour?.voice, tour?.mode, stop?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hentikan orbit kalau pengguna menyentuh peta.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tour) return;
    const halt = () => cancelAnimationFrame(orbit.current);
    map.on('mousedown', halt);
    map.on('touchstart', halt);
    map.on('wheel', halt);
    return () => {
      map.off('mousedown', halt);
      map.off('touchstart', halt);
      map.off('wheel', halt);
    };
  }, [tour?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mode jalan kaki: deteksi tiba di perhentian.
  useEffect(() => {
    if (!tour || tour.mode !== 'walk' || !stop || !userPos || tour.arrived) return;
    const d = distance([userPos.lng, userPos.lat], [stop.lng, stop.lat]);
    if (d <= ARRIVE_M) {
      patch({ arrived: true });
      select(stop.id);
      navigator.vibrate?.([120, 60, 120]);
      notify(`Kamu tiba di ${stop.name}!`, 'success');
      if (tour.voice) speak(`Kamu tiba di ${stop.name}. ${stop.description}`);
    }
  }, [userPos, stop?.id, tour?.arrived]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tour || !stop) return null;

  const end = () => {
    clearTimeout(timer.current);
    cancelAnimationFrame(orbit.current);
    stopSpeaking();
    setTour(null);
  };

  let walk = null;
  if (tour.mode === 'walk' && userPos) {
    const a = [userPos.lng, userPos.lat], b = [stop.lng, stop.lat];
    const d = distance(a, b);
    walk = { d, dir: compassLabel(bearing(a, b)), min: walkMinutes(d * 1.3), acc: userPos.acc };
  }

  return (
    <div className="tour-hud" role="region" aria-label={`Tur ${tour.title}`}>
      <div className="tour-progress" aria-hidden="true">
        {tour.stops.map((id, i) => (
          <span key={id} className={i < tour.step ? 'done' : i === tour.step ? 'cur' : ''} />
        ))}
      </div>
      <div className="tour-row">
        <div className="tour-info">
          <span className="eyebrow">{tour.title} · {tour.step + 1}/{tour.stops.length}</span>
          <strong>{stop.name}</strong>
          {walk && (
            <span className="small">
              {tour.arrived ? '✓ Sudah tiba' : `${fmtDistance(walk.d)} ke ${walk.dir} · ±${walk.min} mnt`}
              {walk.acc > 30 && <span className="muted"> (akurasi GPS ±{Math.round(walk.acc)} m)</span>}
            </span>
          )}
          {tour.mode === 'walk' && !userPos && <span className="small muted">Menunggu sinyal GPS…</span>}
        </div>
        <div className="tour-btns">
          <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={tour.step === 0} aria-label="Perhentian sebelumnya">
            <Icon name="chevL" />
          </button>
          {tour.mode === 'cinematic' && (
            <button type="button" className="icon-btn" onClick={() => patch({ playing: !tour.playing })} aria-label={tour.playing ? 'Jeda' : 'Lanjut'}>
              <Icon name={tour.playing ? 'pause' : 'play'} />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => go(1)} disabled={tour.step >= tour.stops.length - 1} aria-label="Perhentian berikutnya">
            <Icon name="chevR" />
          </button>
          {speechSupported && (
            <button type="button" className={`icon-btn ${tour.voice ? 'on' : ''}`} onClick={() => { stopSpeaking(); patch({ voice: !tour.voice }); }} aria-pressed={tour.voice} aria-label="Narasi suara">
              <Icon name="volume" />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={end} aria-label="Akhiri tur">
            <Icon name="stop" />
          </button>
        </div>
      </div>
    </div>
  );
}
