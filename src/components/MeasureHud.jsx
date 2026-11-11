import { useStore } from '../store.js';
import { pathLength, polygonArea, fmtDistance, fmtArea, walkMinutes } from '../lib/geo.js';
import { Icon } from './icons.jsx';
import ElevationProfile from './ElevationProfile.jsx';

export default function MeasureHud() {
  const tool = useStore((s) => s.tool);
  const pts = useStore((s) => s.measurePts);
  const setTool = useStore((s) => s.setTool);
  const undo = useStore((s) => s.undoMeasurePt);
  const clear = useStore((s) => s.clearMeasure);

  if (tool !== 'line' && tool !== 'area') return null;
  const len = pathLength(tool === 'area' && pts.length > 2 ? [...pts, pts[0]] : pts);

  return (
    <div className="hud" role="region" aria-label="Alat ukur">
      <div className="hud-head">
        <strong>{tool === 'line' ? 'Ukur jarak & profil' : 'Ukur luas'}</strong>
        <button type="button" className="icon-btn" onClick={() => setTool(null)} aria-label="Selesai mengukur">
          <Icon name="close" size={16} />
        </button>
      </div>
      {pts.length === 0 && <p className="small muted">Ketuk peta untuk menaruh titik.</p>}
      {pts.length > 0 && (
        <div className="hud-stats">
          <div><span>{tool === 'area' ? 'Keliling' : 'Jarak'}</span><b>{fmtDistance(len)}</b></div>
          {tool === 'line' && <div><span>Jalan kaki</span><b>±{walkMinutes(len)} mnt</b></div>}
          {tool === 'area' && <div><span>Luas</span><b>{pts.length > 2 ? fmtArea(polygonArea(pts)) : '—'}</b></div>}
          <div><span>Titik</span><b>{pts.length}</b></div>
        </div>
      )}
      {tool === 'line' && <ElevationProfile points={pts} />}
      <div className="row">
        <button type="button" className="btn ghost sm" onClick={undo} disabled={!pts.length}>Urungkan</button>
        <button type="button" className="btn ghost sm" onClick={clear} disabled={!pts.length}>Hapus</button>
      </div>
    </div>
  );
}
