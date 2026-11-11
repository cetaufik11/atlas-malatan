// Kalibrasi posisi: geser seluruh data, atur peta arsip, pakai jejak GPS sebagai batas/jalan.
import { useState } from 'react';
import { useStore, mapRef, baseGeo, normalizeGeo } from '../store.js';
import { db, downloadText, readJsonFile } from '../lib/storage.js';
import { getOnePosition } from '../lib/gps.js';
import { distance, bearing, compassLabel, fmtDistance } from '../lib/geo.js';
import { trackLength } from '../lib/track.js';
import { Icon } from '../components/icons.jsx';

export default function Calibration({ onClose }) {
  const sites = useStore((s) => s.sites);
  const setSites = useStore((s) => s.setSites);
  const geo = useStore((s) => s.geo);
  const setGeo = useStore((s) => s.setGeo);
  const geoEdited = useStore((s) => s.geoEdited);
  const tracks = useStore((s) => s.tracks);
  const setCalibrating = useStore((s) => s.setCalibrating);
  const notify = useStore((s) => s.notify);
  const [refId, setRefId] = useState(sites[0]?.id || '');
  const [target, setTarget] = useState(null); // { lat, lng, how }
  const [manual, setManual] = useState('');

  const ref = sites.find((s) => s.id === refId);
  const offset = ref && target ? { dLat: target.lat - ref.lat, dLng: target.lng - ref.lng, m: distance([ref.lng, ref.lat], [target.lng, target.lat]), dir: compassLabel(bearing([ref.lng, ref.lat], [target.lng, target.lat])) } : null;

  const saveGeo = async (g) => {
    setGeo(g, true);
    await db.saveGeoOverrides(g);
  };

  const fromCenter = () => {
    const c = mapRef.current?.getCenter();
    if (c) setTarget({ lat: c.lat, lng: c.lng, how: 'titik tengah peta' });
  };
  const fromGps = async () => {
    try {
      const p = await getOnePosition();
      setTarget({ lat: p.coords.latitude, lng: p.coords.longitude, how: `GPS (±${Math.round(p.coords.accuracy)} m)`, gps: true });
    } catch {
      notify('Gagal mendapat posisi GPS.', 'error');
    }
  };
  const fromManual = () => {
    const m = manual.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
    if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return notify('Format: lintang, bujur — mis. -7.2850, 110.0507', 'error');
    setTarget({ lat: +m[1], lng: +m[2], how: 'koordinat ketikan' });
  };

  const applyShift = async () => {
    if (!offset) return;
    if (!confirm(`Geser SEMUA situs, batas, jalan, sungai, dan peta arsip sejauh ${fmtDistance(offset.m)} ke ${offset.dir}?`)) return;
    const sh = ([x, y]) => [+(x + offset.dLng).toFixed(7), +(y + offset.dLat).toFixed(7)];
    const nextSites = sites.map((s) => ({
      ...s,
      lat: +(s.lat + offset.dLat).toFixed(6),
      lng: +(s.lng + offset.dLng).toFixed(6),
      // Hanya situs acuan yang posisinya benar-benar diketahui; sisanya ikut bergeser = perkiraan.
      coord: s.id === refId ? (target.gps ? 'gps' : s.coord) : 'perkiraan',
    }));
    setSites(nextSites, true);
    await db.saveSiteOverrides(nextSites);
    await saveGeo({
      boundary: geo.boundary.map(sh),
      mainRoad: geo.mainRoad.map(sh),
      streets: geo.streets.map((l) => l.map(sh)),
      rivers: geo.rivers.map((l) => l.map(sh)),
      archiveCoords: geo.archiveCoords.map(sh),
    });
    setTarget(null);
    mapRef.current?.flyTo({ center: [target.lng, target.lat], zoom: 16.5 });
    notify('Semua data digeser. Elevasi tercatat belum diperbarui; perbaiki per situs dengan GPS.', 'success');
  };

  const applyTrack = async (t, as) => {
    const line = t.points.map((p) => [+p.lng.toFixed(7), +p.lat.toFixed(7)]);
    const g = { ...geo };
    if (as === 'boundary') {
      if (line.length < 3) return notify('Jejak terlalu pendek untuk jadi batas.', 'error');
      g.boundary = line;
    } else if (as === 'mainRoad') g.mainRoad = line;
    else if (as === 'street') g.streets = [...geo.streets, line];
    else if (as === 'river') g.rivers = [...geo.rivers, line];
    await saveGeo(g);
    notify('Geometri diperbarui dari jejak GPS.', 'success');
  };

  const exportGeo = () => downloadText('geo.json', JSON.stringify(geo, null, 2));
  const importGeo = async (file) => {
    try {
      const g = normalizeGeo(await readJsonFile(file));
      if (!Array.isArray(g.boundary) || g.archiveCoords.length !== 4) throw new Error();
      await saveGeo(g);
      notify('geo.json dimuat.', 'success');
    } catch {
      notify('Berkas bukan geo.json yang valid.', 'error');
    }
  };
  const reset = async () => {
    if (!confirm('Kembalikan batas, jalan, sungai, dan posisi peta arsip ke data asli? (Koordinat situs tidak ikut.)')) return;
    await db.clearGeoOverrides();
    setGeo(baseGeo, false);
  };

  return (
    <div className="admin-inbox calib">
      <article className="card">
        <span className="eyebrow">Langkah 1</span>
        <h3>Geser semua data sekaligus</h3>
        <p className="small muted">
          Bila seluruh peta tergeser, cukup tentukan posisi sebenarnya dari <b>satu</b> situs acuan. Situs lain, batas, jalan, sungai, dan peta arsip ikut bergeser dengan selisih yang
          sama. Setelah itu perhalus tiap situs dengan GPS.
        </p>
        <div className="grid2">
          <label>
            Situs acuan
            <select value={refId} onChange={(e) => { setRefId(e.target.value); }}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            Ketik koordinat sebenarnya (mis. salin dari Google Maps)
            <span className="row nowrap">
              <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="-7.2850, 110.0507" />
              <button type="button" className="btn ghost sm" onClick={fromManual}>Pakai</button>
            </span>
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={fromGps}><Icon name="locate" size={14} /> Saya sedang di situs ini (GPS)</button>
          <button type="button" className="btn ghost sm" onClick={fromCenter}><Icon name="pin" size={14} /> Titik tengah peta saat ini</button>
        </div>
        {ref && <p className="small mono">Sekarang: {ref.lat.toFixed(6)}, {ref.lng.toFixed(6)}</p>}
        {offset && (
          <div className="callout warn">
            <Icon name="info" size={16} />
            <span>
              Target dari {target.how}: <span className="mono">{target.lat.toFixed(6)}, {target.lng.toFixed(6)}</span>. Selisih <b>{fmtDistance(offset.m)}</b> ke {offset.dir}.{' '}
              <button type="button" className="btn sm" onClick={applyShift}>Geser semua data</button>
            </span>
          </div>
        )}
      </article>

      <article className="card">
        <span className="eyebrow">Langkah 2</span>
        <h3>Posisi Peta Arsip 2018</h3>
        <p className="small muted">Cocokkan peta arsip dengan citra satelit dengan menyeret keempat sudutnya langsung di peta.</p>
        <button type="button" className="btn sm" onClick={() => { setCalibrating(true); onClose(); }}>
          <Icon name="edit" size={14} /> Atur sudut di peta
        </button>
      </article>

      <article className="card">
        <span className="eyebrow">Langkah 3</span>
        <h3>Batas & jalan dari jejak GPS</h3>
        <p className="small muted">Rekam jejak di tab Alat sambil berjalan, lalu jadikan batas dusun, jalan, atau sungai di sini.</p>
        {tracks.length === 0 && <p className="small">Belum ada jejak tersimpan di perangkat ini.</p>}
        <ul className="mini-list">
          {tracks.map((t) => (
            <li key={t.id}>
              <span><b>{t.name}</b> <span className="small muted">{fmtDistance(trackLength(t.points))}</span></span>
              <span className="row">
                <button type="button" className="btn ghost sm" onClick={() => applyTrack(t, 'boundary')}>Jadikan batas dusun</button>
                <button type="button" className="btn ghost sm" onClick={() => applyTrack(t, 'mainRoad')}>Jadikan jalan utama</button>
                <button type="button" className="btn ghost sm" onClick={() => applyTrack(t, 'street')}>+ Jalan dusun</button>
                <button type="button" className="btn ghost sm" onClick={() => applyTrack(t, 'river')}>+ Sungai</button>
              </span>
            </li>
          ))}
        </ul>
      </article>

      <article className="card">
        <h3>Simpan permanen {geoEdited && <span className="badge tiny">ada perubahan</span>}</h3>
        <div className="row">
          <button type="button" className="btn sm" onClick={exportGeo}><Icon name="download" size={14} /> Ekspor geo.json</button>
          <label className="btn ghost sm">
            <Icon name="upload" size={14} /> Muat geo.json
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files[0] && importGeo(e.target.files[0])} />
          </label>
          <button type="button" className="btn ghost sm" onClick={reset}>Kembalikan geometri asli</button>
        </div>
        <p className="small muted">Timpa <code>src/data/geo.json</code> dengan hasil ekspor (dan <code>sites.json</code> dari tab Situs), lalu build & deploy ulang.</p>
      </article>
    </div>
  );
}
