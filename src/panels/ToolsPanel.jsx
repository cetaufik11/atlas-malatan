import { useEffect, useRef, useState } from 'react';
import { useStore, mapRef } from '../store.js';
import { tileUrlsForArea, cacheTiles, cachedTileCount, clearTileCache } from '../lib/offline.js';
import { downloadText } from '../lib/storage.js';
import { bboxOf, fmtArea, polygonArea } from '../lib/geo.js';
import { SAT_URL, DEM_URL, dataGeoJSON } from '../map/style.js';
import { STATUSES, CATEGORIES } from '../data/meta.js';
import geo from '../data/geo.json';
import { Icon } from '../components/icons.jsx';

export default function ToolsPanel() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const sites = useStore((s) => s.sites);
  const notify = useStore((s) => s.notify);
  const setAdminOpen = useStore((s) => s.setAdminOpen);
  const [dl, setDl] = useState(null); // { done, total, failed }
  const [cached, setCached] = useState(0);
  const abort = useRef(null);

  useEffect(() => {
    cachedTileCount().then(setCached);
  }, [dl?.finished]);

  const bbox = bboxOf(geo.boundary, 0.004);

  const downloadOffline = async () => {
    const urls = [
      ...tileUrlsForArea(bbox, [SAT_URL], 14, 18),
      ...tileUrlsForArea(bbox, [DEM_URL], 11, 15),
    ];
    abort.current = new AbortController();
    setDl({ done: 0, total: urls.length, failed: 0 });
    try {
      const r = await cacheTiles(urls, (done, total, failed) => setDl({ done, total, failed }), abort.current.signal);
      setDl({ ...r, total: urls.length, finished: true });
      notify(r.failed ? `Selesai, ${r.failed} ubin gagal. Coba ulangi saat sinyal bagus.` : 'Peta Malatan siap dipakai offline.', r.failed ? 'info' : 'success');
    } catch (e) {
      notify(e.message, 'error');
      setDl(null);
    }
  };

  const exportGeoJSON = () => {
    const d = dataGeoJSON();
    const fc = {
      type: 'FeatureCollection',
      features: [
        { ...d.boundary, properties: { layer: 'batas', name: 'Dusun Malatan' } },
        ...d.roads.features.map((f) => ({ ...f, properties: { layer: 'jalan', ...f.properties } })),
        ...d.rivers.features.map((f) => ({ ...f, properties: { layer: 'sungai' } })),
        ...sites.map((s) => ({
          type: 'Feature',
          properties: {
            layer: 'situs', id: s.id, name: s.name, category: CATEGORIES[s.category]?.label, status: STATUSES[s.status]?.label,
            coord_method: s.coord, elevation_m: s.elev, description: s.description,
          },
          geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        })),
      ],
    };
    downloadText('atlas-malatan.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
  };

  const exportKML = () => {
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    const pms = sites.map((s) => `<Placemark><name>${esc(s.name)}</name><description>${esc(`[${STATUSES[s.status]?.label}] ${s.description}`)}</description><Point><coordinates>${s.lng},${s.lat},0</coordinates></Point></Placemark>`).join('');
    const ring = [...geo.boundary, geo.boundary[0]].map((p) => p.join(',')).join(' ');
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Atlas Malatan</name>${pms}<Placemark><name>Batas Dusun Malatan</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
    downloadText('atlas-malatan.kml', kml, 'application/vnd.google-earth.kml+xml');
  };

  const exportImage = () => {
    const map = mapRef.current;
    if (!map) return;
    map.once('render', () => {
      try {
        const src = map.getCanvas();
        const c = document.createElement('canvas');
        c.width = src.width;
        c.height = src.height + 70;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#1d1a16';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(src, 0, 0);
        ctx.fillStyle = '#f3e9d8';
        ctx.font = '600 26px system-ui, sans-serif';
        ctx.fillText('Atlas Malatan — Dusun Malatan, Bansari, Temanggung', 20, src.height + 32);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillStyle = '#c9bfae';
        ctx.fillText(`Dicetak ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })} · Citra © Esri · Data © OpenStreetMap kontributor`, 20, src.height + 58);
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png');
        a.download = 'peta-malatan.png';
        a.click();
      } catch {
        notify('Gagal membuat gambar (izin lintas domain ubin).', 'error');
      }
    });
    map.triggerRepaint();
  };

  const area = polygonArea(geo.boundary);

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Perkakas GIS</span>
        <h2>Alat Peta</h2>
        <p className="muted">Luas wilayah dalam batas digital: <b>{fmtArea(area)}</b> (perkiraan dari batas Peta 2018).</p>
      </header>

      <h3 className="section-title">Ukur</h3>
      <div className="tool-grid">
        <button type="button" className={`tool ${tool === 'line' ? 'on' : ''}`} onClick={() => setTool(tool === 'line' ? null : 'line')}>
          <Icon name="ruler" size={22} />
          <strong>Jarak & profil elevasi</strong>
          <span className="small muted">Jarak, waktu jalan, naik-turun lereng</span>
        </button>
        <button type="button" className={`tool ${tool === 'area' ? 'on' : ''}`} onClick={() => setTool(tool === 'area' ? null : 'area')}>
          <Icon name="area" size={22} />
          <strong>Luas lahan</strong>
          <span className="small muted">Sawah, ladang tembakau, pekarangan</span>
        </button>
      </div>

      <h3 className="section-title">Pakai di lapangan tanpa sinyal</h3>
      <article className="card">
        <p className="small">Unduh citra satelit (zoom 14–18) dan data elevasi wilayah Malatan ke perangkat ini. Lakukan saat ada Wi-Fi, lalu peta, situs, dan GPS tetap jalan di lapangan.</p>
        {dl && !dl.finished && (
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={dl.total} aria-valuenow={dl.done}>
            <span style={{ width: `${(dl.done / dl.total) * 100}%` }} />
            <em>{dl.done}/{dl.total} ubin</em>
          </div>
        )}
        <div className="row">
          {(!dl || dl.finished) && (
            <button type="button" className="btn sm" onClick={downloadOffline}>
              <Icon name="download" size={14} /> Simpan peta untuk offline
            </button>
          )}
          {dl && !dl.finished && (
            <button type="button" className="btn ghost sm" onClick={() => { abort.current?.abort(); setDl(null); }}>Batal</button>
          )}
          {cached > 0 && (
            <button type="button" className="btn ghost sm" onClick={async () => { await clearTileCache(); setCached(0); notify('Cache peta dihapus.'); }}>
              Hapus cache ({cached} ubin)
            </button>
          )}
        </div>
        <p className="small muted">Pasang juga sebagai aplikasi: menu browser → “Tambahkan ke layar utama”.</p>
      </article>

      <h3 className="section-title">Ekspor & cetak</h3>
      <div className="tool-grid">
        <button type="button" className="tool" onClick={exportImage}>
          <Icon name="camera" size={22} />
          <strong>Gambar peta (PNG)</strong>
          <span className="small muted">Tampilan saat ini + keterangan</span>
        </button>
        <button type="button" className="tool" onClick={() => window.print()}>
          <Icon name="printer" size={22} />
          <strong>Cetak</strong>
          <span className="small muted">Peta + legenda ke kertas/PDF</span>
        </button>
        <button type="button" className="tool" onClick={exportGeoJSON}>
          <Icon name="download" size={22} />
          <strong>GeoJSON</strong>
          <span className="small muted">Untuk QGIS / ArcGIS</span>
        </button>
        <button type="button" className="tool" onClick={exportKML}>
          <Icon name="download" size={22} />
          <strong>KML</strong>
          <span className="small muted">Untuk Google Earth</span>
        </button>
      </div>

      <h3 className="section-title">Pengelola</h3>
      <button type="button" className="btn ghost sm block" onClick={() => setAdminOpen(true)}>
        <Icon name="edit" size={14} /> Mode admin: sunting situs & impor kiriman
      </button>

      <p className="small muted credits">
        Citra: Esri World Imagery & Wayback · Elevasi: Mapzen Terrain Tiles (AWS Open Data) · Peta jalan: © OpenStreetMap, OpenTopoMap · Peta arsip: KKN Undip Teknik Geodesi 2018 · Disusun dalam Proker KKN UNY 2026.
      </p>
    </div>
  );
}
