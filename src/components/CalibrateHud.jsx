// Georeferensi ulang Peta Arsip 2018: seret 4 sudut (atau titik tengah untuk menggeser utuh).
// Selama kalibrasi dipakai lapisan pratinjau bertipe 'image' (ringan untuk diseret) dan
// medan 3D dimatikan; setelah selesai, peta arsip kembali disajikan sebagai ubin.
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useStore, mapRef } from '../store.js';
import { db } from '../lib/storage.js';
import { ARCHIVE_IMAGE } from '../map/archiveTiles.js';
import { Icon } from './icons.jsx';

const LABELS = ['Barat laut', 'Timur laut', 'Tenggara', 'Barat daya'];
const centroid = (c) => [c.reduce((t, p) => t + p[0], 0) / 4, c.reduce((t, p) => t + p[1], 0) / 4];

export default function CalibrateHud() {
  const calibrating = useStore((s) => s.calibrating);
  const setCalibrating = useStore((s) => s.setCalibrating);
  const archiveOpacity = useStore((s) => s.archiveOpacity);
  const setArchiveOpacity = useStore((s) => s.setArchiveOpacity);
  const notify = useStore((s) => s.notify);
  const session = useRef(null); // { initial, coords, hadTerrain }

  useEffect(() => {
    const map = mapRef.current;
    if (!calibrating || !map) return;
    const st = useStore.getState();
    const s = { initial: st.geo.archiveCoords, coords: st.geo.archiveCoords.map((p) => [...p]), hadTerrain: st.terrain };
    session.current = s;
    if (st.terrain) st.setTerrain(false);
    if (st.layers.archive2018) st.toggleLayer('archive2018'); // sembunyikan versi ubin selama pratinjau

    map.addSource('archive-cal', { type: 'image', url: ARCHIVE_IMAGE, coordinates: s.coords });
    map.addLayer({ id: 'archive-cal', type: 'raster', source: 'archive-cal', paint: { 'raster-opacity': st.archiveOpacity, 'raster-fade-duration': 0 } }, 'labels');
    const apply = () => map.getSource('archive-cal')?.setCoordinates(s.coords);

    const mk = (cls, text) => {
      const node = document.createElement('div');
      node.className = `cal-handle ${cls}`;
      node.textContent = text;
      return node;
    };

    let last = centroid(s.coords);
    const center = new maplibregl.Marker({ element: mk('move', '✥'), draggable: true }).setLngLat(last).addTo(map);
    center.getElement().title = 'Geser seluruh peta';

    const corners = s.coords.map((c, i) => {
      const m = new maplibregl.Marker({ element: mk('', String(i + 1)), draggable: true }).setLngLat(c).addTo(map);
      m.getElement().title = LABELS[i];
      m.on('drag', () => {
        const p = m.getLngLat();
        s.coords[i] = [p.lng, p.lat];
        last = centroid(s.coords);
        center.setLngLat(last);
        apply();
      });
      return m;
    });

    center.on('drag', () => {
      const p = center.getLngLat();
      const dx = p.lng - last[0], dy = p.lat - last[1];
      last = [p.lng, p.lat];
      s.coords = s.coords.map(([x, y]) => [x + dx, y + dy]);
      corners.forEach((m, i) => m.setLngLat(s.coords[i]));
      apply();
    });

    const xs = s.coords.map((c) => c[0]), ys = s.coords.map((c) => c[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 90, pitch: 0, bearing: 0, duration: 800 });

    return () => {
      corners.forEach((m) => m.remove());
      center.remove();
      if (map.getLayer('archive-cal')) map.removeLayer('archive-cal');
      if (map.getSource('archive-cal')) map.removeSource('archive-cal');
      const now = useStore.getState();
      if (!now.layers.archive2018) now.toggleLayer('archive2018'); // tampilkan hasilnya
      if (s.hadTerrain) now.setTerrain(true);
    };
  }, [calibrating]);

  // Transparansi pratinjau mengikuti slider.
  useEffect(() => {
    const map = mapRef.current;
    if (calibrating && map?.getLayer('archive-cal')) map.setPaintProperty('archive-cal', 'raster-opacity', archiveOpacity);
  }, [archiveOpacity, calibrating]);

  if (!calibrating) return null;

  const finish = async (keep) => {
    const s = session.current;
    if (keep && s) {
      const geo = { ...useStore.getState().geo, archiveCoords: s.coords.map((p) => [+p[0].toFixed(7), +p[1].toFixed(7)]) };
      useStore.getState().setGeo(geo);
      await db.saveGeoOverrides(geo);
      notify('Posisi peta arsip disimpan di perangkat. Ekspor geo.json dari mode admin agar permanen.', 'success');
    }
    setCalibrating(false);
  };

  return (
    <div className="hud cal" role="region" aria-label="Kalibrasi peta arsip">
      <div className="hud-head">
        <strong>Kalibrasi Peta Arsip 2018</strong>
      </div>
      <p className="small muted">
        Seret titik <b>1–4</b> (sudut) sampai jalan, sungai, dan bangunan pada peta arsip berimpit dengan citra satelit. Titik <b>✥</b> menggeser seluruh peta. Mode 3D dimatikan sementara.
      </p>
      <label className="range">
        Transparansi
        <input type="range" min="0.15" max="1" step="0.05" value={archiveOpacity} onChange={(e) => setArchiveOpacity(+e.target.value)} />
      </label>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => finish(true)}>
          <Icon name="check" size={14} /> Simpan posisi
        </button>
        <button type="button" className="btn ghost sm" onClick={() => finish(false)}>Batalkan</button>
      </div>
    </div>
  );
}
