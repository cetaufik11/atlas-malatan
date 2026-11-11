// Alat lapangan: rekam jejak GPS, impor lapisan GPX/KML/GeoJSON, cuaca setempat.
import { useEffect, useState } from 'react';
import { useStore, mapRef } from '../store.js';
import { db, downloadText } from '../lib/storage.js';
import { startRecording, stopRecording, trackLength } from '../lib/track.js';
import { parseGeoFile, bboxOfFeatures, toGPX } from '../lib/formats.js';
import { fmtDistance } from '../lib/geo.js';
import { Icon } from './icons.jsx';

const COLORS = ['#ff7a59', '#7c5cff', '#00b8a9', '#f6c945', '#e84393', '#3ba55d'];

// Kode cuaca WMO → teks singkat.
const WMO = (c) =>
  c === 0 ? 'Cerah' : c <= 2 ? 'Cerah berawan' : c === 3 ? 'Berawan' : c <= 48 ? 'Berkabut' : c <= 57 ? 'Gerimis' : c <= 67 ? 'Hujan' : c <= 77 ? 'Hujan es' : c <= 82 ? 'Hujan deras' : 'Badai petir';

export function Weather() {
  const geo = useStore((s) => s.geo);
  const [w, setW] = useState(null);
  const [err, setErr] = useState(false);
  const [lng, lat] = geo.boundary[0];

  const load = async () => {
    setErr(false);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FJakarta`;
      const j = await (await fetch(url)).json();
      const hourNow = new Date().getHours();
      const next = (j.hourly?.precipitation_probability || []).slice(hourNow, hourNow + 6);
      setW({ ...j.current, rainNext: next.length ? Math.max(...next) : null });
    } catch {
      setErr(true);
    }
  };

  return (
    <article className="card">
      <h3>Cuaca lapangan</h3>
      {!w && !err && (
        <button type="button" className="btn ghost sm" onClick={load}>
          <Icon name="sun" size={14} /> Cek cuaca sekarang
        </button>
      )}
      {err && <p className="small muted">Cuaca tidak bisa dimuat (offline?). <button type="button" className="link" onClick={load}>Coba lagi</button></p>}
      {w && (
        <>
          <div className="hud-stats">
            <div><span>{WMO(w.weather_code)}</span><b>{Math.round(w.temperature_2m)}°C</b></div>
            <div><span>Peluang hujan 6 jam</span><b>{w.rainNext != null ? `${w.rainNext}%` : '—'}</b></div>
            <div><span>Angin · lembap</span><b>{Math.round(w.wind_speed_10m)} km/j · {w.relative_humidity_2m}%</b></div>
          </div>
          <p className="small muted">Prakiraan model Open-Meteo untuk titik dusun; cuaca gunung cepat berubah.</p>
        </>
      )}
    </article>
  );
}

export function TrackRecorder() {
  const recording = useStore((s) => s.recording);
  const tracks = useStore((s) => s.tracks);
  const setTracks = useStore((s) => s.setTracks);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const remove = async (id) => {
    const next = tracks.filter((t) => t.id !== id);
    setTracks(next);
    await db.saveTracks(next);
  };

  const zoomTo = (t) => {
    const xs = t.points.map((p) => p.lng), ys = t.points.map((p) => p.lat);
    mapRef.current?.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, maxZoom: 18.5 });
  };

  const exportGeoJSON = (t) =>
    downloadText(
      `${t.id}.geojson`,
      JSON.stringify({ type: 'Feature', properties: { name: t.name, created: t.created }, geometry: { type: 'LineString', coordinates: t.points.map((p) => [p.lng, p.lat]) } }, null, 2),
      'application/geo+json',
    );

  const secs = recording ? Math.round((Date.now() - recording.started) / 1000) : 0;

  return (
    <article className="card">
      <h3>Rekam jejak GPS</h3>
      <p className="small muted">Berjalanlah menyusuri batas dusun, jalan, atau sungai sambil merekam. Jejaknya bisa diekspor (GPX/GeoJSON) atau dijadikan batas/jalan lewat mode admin.</p>
      {!recording ? (
        <button type="button" className="btn sm" onClick={startRecording}>
          <Icon name="walk" size={14} /> Mulai merekam
        </button>
      ) : (
        <>
          <div className="hud-stats">
            <div><span>Jarak</span><b>{fmtDistance(trackLength(recording.points))}</b></div>
            <div><span>Waktu</span><b>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</b></div>
            <div><span>Titik</span><b>{recording.points.length}</b></div>
          </div>
          <button type="button" className="btn sm rec" onClick={() => stopRecording()}>
            <span className="rec-dot" /> Berhenti & simpan
          </button>
        </>
      )}
      {tracks.length > 0 && (
        <ul className="mini-list">
          {tracks.map((t) => (
            <li key={t.id}>
              <button type="button" className="link" onClick={() => zoomTo(t)}>{t.name}</button>
              <span className="small muted">{fmtDistance(trackLength(t.points))} · {t.points.length} titik</span>
              <span className="row">
                <button type="button" className="btn ghost sm" onClick={() => downloadText(`${t.id}.gpx`, toGPX(t), 'application/gpx+xml')}>GPX</button>
                <button type="button" className="btn ghost sm" onClick={() => exportGeoJSON(t)}>GeoJSON</button>
                <button type="button" className="icon-btn sm" onClick={() => remove(t.id)} aria-label="Hapus jejak"><Icon name="trash" size={14} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function LayerImport() {
  const imports = useStore((s) => s.imports);
  const setImports = useStore((s) => s.setImports);
  const notify = useStore((s) => s.notify);

  const save = async (next) => {
    setImports(next);
    await db.saveImports(next);
  };

  const add = async (files) => {
    let next = [...imports];
    for (const file of files) {
      try {
        const data = await parseGeoFile(file);
        const layer = { id: `lap-${Date.now().toString(36)}-${next.length}`, name: file.name, color: COLORS[next.length % COLORS.length], data, visible: true };
        next = [...next, layer];
        const [w, s, e, n] = bboxOfFeatures(data);
        mapRef.current?.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 18 });
        notify(`${file.name}: ${data.features.length} objek dimuat.`, 'success');
      } catch (err) {
        notify(`${file.name}: ${err.message}`, 'error');
      }
    }
    save(next);
  };

  return (
    <article className="card">
      <h3>Impor lapisan</h3>
      <p className="small muted">Tumpuk data dari Google Earth (KML), aplikasi GPS (GPX), atau QGIS (GeoJSON), misalnya peta RT, persil, atau jalur dari dinas.</p>
      <label className="btn ghost sm">
        <Icon name="upload" size={14} /> Pilih berkas .gpx / .kml / .geojson
        <input type="file" accept=".gpx,.kml,.geojson,.json" multiple hidden onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
      </label>
      {imports.length > 0 && (
        <ul className="mini-list">
          {imports.map((l) => (
            <li key={l.id}>
              <label className="check">
                <input type="checkbox" checked={l.visible !== false} onChange={() => save(imports.map((x) => (x.id === l.id ? { ...x, visible: x.visible === false } : x)))} />
                <span className="sw" style={{ background: l.color }} /> {l.name}
              </label>
              <span className="row">
                <span className="small muted">{l.data.features.length} objek</span>
                <button type="button" className="icon-btn sm" onClick={() => save(imports.filter((x) => x.id !== l.id))} aria-label="Hapus lapisan"><Icon name="trash" size={14} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
