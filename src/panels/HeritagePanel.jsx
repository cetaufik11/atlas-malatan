import { useState } from 'react';
import { useStore, mapRef } from '../store.js';
import heritage from '../data/heritage.json';
import { db, downloadText } from '../lib/storage.js';
import { getOnePosition } from '../lib/gps.js';
import { fmtCoord } from '../lib/geo.js';
import { StatusBadge } from '../components/Badges.jsx';
import { Icon } from '../components/icons.jsx';

export default function HeritagePanel() {
  const select = useStore((s) => s.select);
  const fieldPoints = useStore((s) => s.fieldPoints);
  const setFieldPoints = useStore((s) => s.setFieldPoints);
  const notify = useStore((s) => s.notify);
  const [busy, setBusy] = useState(null);

  const capture = async (find) => {
    setBusy(find.id);
    try {
      const p = await getOnePosition();
      const pt = {
        id: `${find.id}-${Date.now()}`,
        findId: find.id,
        label: find.title,
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        acc: Math.round(p.coords.accuracy),
        alt: p.coords.altitude,
        time: new Date().toISOString(),
      };
      const next = [...fieldPoints, pt];
      setFieldPoints(next);
      await db.saveFieldPoints(next);
      mapRef.current?.flyTo({ center: [pt.lng, pt.lat], zoom: 19 });
      notify(`Titik tercatat (akurasi ±${pt.acc} m). Ekspor & kirim ke admin.`, 'success');
    } catch (e) {
      notify(e.code === 1 ? 'Izin lokasi ditolak.' : 'Gagal mendapat posisi GPS. Coba di tempat terbuka.', 'error');
    }
    setBusy(null);
  };

  const removePoint = async (id) => {
    const next = fieldPoints.filter((p) => p.id !== id);
    setFieldPoints(next);
    await db.saveFieldPoints(next);
  };

  const exportPoints = () => {
    const fc = {
      type: 'FeatureCollection',
      features: fieldPoints.map((p) => ({
        type: 'Feature',
        properties: { label: p.label, findId: p.findId, accuracy_m: p.acc, time: p.time },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat, p.alt ?? undefined].filter((v) => v != null) },
      })),
    };
    downloadText('titik-temuan-malatan.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
  };

  const report = (find) => {
    const pts = fieldPoints.filter((p) => p.findId === find.id);
    const loc = pts.length ? pts.map((p) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)} (±${p.acc} m) — ${fmtCoord(p.lat, p.lng)}`).join('\n') : 'Belum disurvei (pinggir sungai, Dusun Malatan)';
    return [
      'LAPORAN DUGAAN CAGAR BUDAYA',
      '',
      `Objek     : ${find.title}`,
      `Lokasi    : Dusun Malatan, Desa Bansari, Kec. Bansari, Kab. Temanggung, Jawa Tengah`,
      `Koordinat : ${loc}`,
      `Kondisi   : ${find.condition}`,
      `Uraian    : ${find.summary}`,
      `Sumber    : ${find.source}`,
      '',
      'Pelapor   : ____________________',
      'Kontak    : ____________________',
      `Tanggal   : ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`,
      '',
      'Dibuat dengan Atlas Malatan.',
    ].join('\n');
  };

  const copyReport = async (find) => {
    try {
      await navigator.clipboard.writeText(report(find));
      notify('Draf laporan disalin. Tempel ke surat/WA untuk dinas.', 'success');
    } catch {
      downloadText(`laporan-${find.id}.txt`, report(find), 'text/plain');
    }
  };

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Risalah Lisan & Survei Lapangan</span>
        <h2>Legenda & Cagar Budaya</h2>
        <p className="muted">{heritage.intro}</p>
      </header>

      <h3 className="section-title">Legenda Asal-Usul</h3>
      {heritage.legends.map((l) => (
        <article key={l.id} className="card legend">
          <StatusBadge status={l.status} />
          <h3>{l.title}</h3>
          <p>{l.summary}</p>
          <p className="small"><b>Jejak yang dikaitkan:</b> {l.traces}</p>
          <p className="small muted">— {l.source}</p>
          {l.siteId && (
            <button type="button" className="btn ghost sm" onClick={() => select(l.siteId)}>
              <Icon name="pin" size={14} /> Lihat makam di peta
            </button>
          )}
        </article>
      ))}

      <h3 className="section-title">Temuan Arkeologis</h3>
      {heritage.finds.map((f) => {
        const pts = fieldPoints.filter((p) => p.findId === f.id);
        return (
          <article key={f.id} className="card find">
            <StatusBadge status={f.status} />
            <h3>{f.title}</h3>
            <p className="small"><b>Kondisi:</b> {f.condition}</p>
            <p>{f.summary}</p>
            <p className="small muted">— {f.source}</p>
            <p className="small"><b>Lokasi:</b> {pts.length ? `${pts.length} titik GPS tercatat di perangkat ini` : f.locationNote}</p>
            {pts.map((p) => (
              <div key={p.id} className="field-pt">
                <button type="button" className="link mono small" onClick={() => mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 19 })}>
                  {p.lat.toFixed(6)}, {p.lng.toFixed(6)} ±{p.acc} m
                </button>
                <button type="button" className="icon-btn sm" onClick={() => removePoint(p.id)} aria-label="Hapus titik">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
            <div className="row">
              <button type="button" className="btn sm" onClick={() => capture(f)} disabled={busy === f.id}>
                <Icon name="locate" size={14} /> {busy === f.id ? 'Mencari GPS…' : 'Catat titik temuan'}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => copyReport(f)}>
                <Icon name="edit" size={14} /> Draf laporan
              </button>
            </div>
          </article>
        );
      })}

      {fieldPoints.length > 0 && (
        <button type="button" className="btn ghost sm block" onClick={exportPoints}>
          <Icon name="download" size={14} /> Ekspor semua titik (GeoJSON)
        </button>
      )}

      <article className="card law">
        <h3>{heritage.law.title}</h3>
        <ul>
          {heritage.law.points.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <p className="small muted">{heritage.law.disclaimer}</p>
      </article>
    </div>
  );
}
