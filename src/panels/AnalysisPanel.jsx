import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.js';
import { bboxOf, fmtArea } from '../lib/geo.js';
import { slopeMap, viewshed, SLOPE_CLASSES } from '../lib/terrain-analysis.js';
import { detectChange } from '../lib/change.js';
import { sunPosition, sunTimes, wibDate, fmtHour, compassName } from '../lib/sun.js';
import { Icon } from '../components/icons.jsx';

const pct = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
const rgb = (c) => `rgb(${c.join(',')})`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtIm = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

export default function AnalysisPanel() {
  const geo = useStore((s) => s.geo);
  const sites = useStore((s) => s.sites);
  const imagery = useStore((s) => s.imagery);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const overlay = useStore((s) => s.overlay);
  const setOverlay = useStore((s) => s.setOverlay);
  const overlayOpacity = useStore((s) => s.overlayOpacity);
  const setOverlayOpacity = useStore((s) => s.setOverlayOpacity);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const pickedPoint = useStore((s) => s.pickedPoint);
  const userPos = useStore((s) => s.userPos);
  const selectedId = useStore((s) => s.selectedId);
  const sun = useStore((s) => s.sun);
  const setSun = useStore((s) => s.setSun);
  const notify = useStore((s) => s.notify);

  const [busy, setBusy] = useState(null);
  const [eye, setEye] = useState(1.6);
  const [radius, setRadius] = useState(2500);
  const [yearA, setYearA] = useState(0);
  const [yearB, setYearB] = useState(imagery.length - 1);
  const [sens, setSens] = useState(2.5);
  const [playing, setPlaying] = useState(false);

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      // Beri kesempatan UI menggambar status "menghitung" dulu.
      await new Promise((r) => setTimeout(r, 30));
      const res = await fn();
      setOverlay({ kind, ...res });
    } catch (e) {
      notify(e.message || 'Analisis gagal.', 'error');
    }
    setBusy(null);
  };

  // ---- Lereng ----
  const runSlope = () => run('slope', () => slopeMap(bboxOf(geo.boundary, 0.006), geo.boundary));

  // ---- Viewshed ----
  const runViewshed = (pt) =>
    run('viewshed', async () => {
      const r = await viewshed(pt, { radius, eye });
      useStore.setState({ pickedPoint: pt });
      return { canvas: r.canvas, z: r.z, x0: r.x0, y0: r.y0, smooth: r.smooth, stats: r.stats, sites: sites.map((s) => ({ id: s.id, name: s.name, v: r.isVisible(s.lng, s.lat) })) };
    });

  useEffect(() => {
    if (tool === 'viewshed' && pickedPoint) {
      setTool(null);
      runViewshed(pickedPoint);
    }
  }, [pickedPoint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (useStore.getState().tool === 'viewshed') useStore.getState().setTool(null);
  }, []);

  const selected = sites.find((s) => s.id === selectedId);

  // ---- Perubahan lahan ----
  const runChange = () => {
    if (yearA === yearB) return notify('Pilih dua tahun yang berbeda.', 'error');
    const [a, b] = yearA < yearB ? [imagery[yearA], imagery[yearB]] : [imagery[yearB], imagery[yearA]];
    run('change', async () => ({ ...(await detectChange(a, b, bboxOf(geo.boundary, 0.002), sens)), from: a.date, to: b.date }));
  };

  // ---- Matahari ----
  const [lng, lat] = geo.boundary[0];
  const pos = useMemo(() => sunPosition(wibDate(sun.date, sun.hour), lat, lng), [sun.date, sun.hour, lat, lng]);
  const times = useMemo(() => sunTimes(sun.date, lat, lng), [sun.date, lat, lng]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const h = useStore.getState().sun.hour + 0.25;
      if (h >= 19.5) {
        setPlaying(false);
        return;
      }
      setSun({ hour: h });
    }, 120);
    return () => clearInterval(t);
  }, [playing, setSun]);

  const playDay = () => {
    if (!playing) setSun({ on: true, hour: 4.5 });
    setPlaying(!playing);
  };

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Laboratorium Spasial</span>
        <h2>Analisis Medan & Lahan</h2>
        <p className="muted">Semua dihitung langsung di perangkatmu dari data elevasi dan citra satelit. Hasilnya gambaran awal, bukan pengganti survei.</p>
      </header>

      {overlay && (
        <div className="overlay-bar">
          <label className="range">
            Transparansi hasil
            <input type="range" min="0.15" max="1" step="0.05" value={overlayOpacity} onChange={(e) => setOverlayOpacity(+e.target.value)} />
          </label>
          <button type="button" className="btn ghost sm" onClick={() => setOverlay(null)}>
            <Icon name="close" size={14} /> Hapus
          </button>
        </div>
      )}

      {/* ---------- Kontur ---------- */}
      <article className="card">
        <h3>Garis kontur</h3>
        <p className="small muted">Garis ketinggian yang dibangkitkan dari model elevasi. Interval menyesuaikan zoom (5 m saat sangat dekat, 25–50 m saat jauh).</p>
        <label className="check">
          <input type="checkbox" checked={layers.contours} onChange={() => toggleLayer('contours')} />
          Tampilkan kontur di peta
        </label>
      </article>

      {/* ---------- Lereng ---------- */}
      <article className="card">
        <h3>Kelas kemiringan lereng</h3>
        <p className="small muted">Memetakan lahan datar sampai sangat curam (klasifikasi persen lereng yang lazim dipakai di Indonesia). Berguna untuk membaca letak permukiman, ladang, dan area rawan.</p>
        <button type="button" className="btn sm" onClick={runSlope} disabled={!!busy}>
          <Icon name="mountain" size={14} /> {busy === 'slope' ? 'Menghitung…' : 'Hitung peta lereng'}
        </button>
        {overlay?.kind === 'slope' && (
          <div className="result">
            <div className="stack-bar" role="img" aria-label="Proporsi kelas lereng">
              {overlay.stats.shares.map((v, i) => v > 0 && <span key={i} style={{ width: `${v * 100}%`, background: rgb(SLOPE_CLASSES[i].color) }} title={`${SLOPE_CLASSES[i].label}: ${pct(v)}`} />)}
            </div>
            <ul className="legend-list">
              {SLOPE_CLASSES.map((c, i) => (
                <li key={i}>
                  <span className="sw" style={{ background: rgb(c.color) }} /> {c.label} <b>{pct(overlay.stats.shares[i])}</b>
                </li>
              ))}
            </ul>
            <p className="small">
              {overlay.stats.scoped ? 'Di dalam batas dusun' : 'Di wilayah terhitung'} ({fmtArea(overlay.stats.areaHa * 10000)}): rata-rata <b>{overlay.stats.mean.toFixed(0)}%</b>, tercuram{' '}
              <b>{overlay.stats.max.toFixed(0)}%</b>.
            </p>
          </div>
        )}
      </article>

      {/* ---------- Viewshed ---------- */}
      <article className="card">
        <h3>Keterlihatan (viewshed)</h3>
        <p className="small muted">Dari satu titik, wilayah mana yang terlihat dan mana yang terhalang punggung bukit? Cocok untuk menguji cerita seperti “dari makam leluhur seluruh dusun terlihat”.</p>
        <div className="grid2">
          <label>
            Tinggi pengamat
            <select value={eye} onChange={(e) => setEye(+e.target.value)}>
              <option value={1.6}>Orang berdiri (1,6 m)</option>
              <option value={6}>Atap / menara masjid (6 m)</option>
              <option value={15}>Menara tinggi (15 m)</option>
            </select>
          </label>
          <label>
            Jangkauan
            <select value={radius} onChange={(e) => setRadius(+e.target.value)}>
              <option value={1000}>1 km</option>
              <option value={2500}>2,5 km</option>
              <option value={4000}>4 km</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button type="button" className={`btn sm ${tool === 'viewshed' ? 'pulse' : ''}`} onClick={() => { useStore.setState({ pickedPoint: null }); setTool(tool === 'viewshed' ? null : 'viewshed'); }} disabled={!!busy}>
            <Icon name="pin" size={14} /> {tool === 'viewshed' ? 'Ketuk peta…' : busy === 'viewshed' ? 'Menghitung…' : 'Pilih titik di peta'}
          </button>
          {selected && (
            <button type="button" className="btn ghost sm" onClick={() => runViewshed([selected.lng, selected.lat])} disabled={!!busy}>
              Dari {selected.name.split(' ').slice(0, 2).join(' ')}
            </button>
          )}
          {userPos && (
            <button type="button" className="btn ghost sm" onClick={() => runViewshed([userPos.lng, userPos.lat])} disabled={!!busy}>
              Dari posisi saya
            </button>
          )}
        </div>
        {overlay?.kind === 'viewshed' && (
          <div className="result">
            <p className="small">
              <b>{pct(overlay.stats.share)}</b> wilayah dalam radius {overlay.stats.radius / 1000} km terlihat (±{fmtArea(overlay.stats.areaHa * 10000)}). Mata pengamat di ±{Math.round(overlay.stats.eyeZ)} mdpl.
            </p>
            <ul className="legend-list">
              <li><span className="sw" style={{ background: 'rgb(64,224,208)' }} /> Terlihat</li>
              <li><span className="sw" style={{ background: 'rgb(20,16,12)' }} /> Terhalang</li>
            </ul>
            <p className="small">
              Situs terlihat: {overlay.sites.filter((s) => s.v).map((s) => s.name).join(', ') || '—'}
              <br />
              <span className="muted">Terhalang: {overlay.sites.filter((s) => s.v === false).map((s) => s.name).join(', ') || '—'}</span>
            </p>
            <p className="small muted">Hanya memperhitungkan bentuk tanah (DEM ±30 m); pohon dan bangunan tidak dihitung.</p>
          </div>
        )}
      </article>

      {/* ---------- Matahari ---------- */}
      <article className="card">
        <h3>Simulasi matahari</h3>
        <p className="small muted">Lihat lereng mana yang mendapat cahaya pagi atau sore. Berguna untuk memahami arah hadap ladang tembakau dan rumah.</p>
        <label className="check">
          <input type="checkbox" checked={sun.on} onChange={(e) => { setPlaying(false); setSun({ on: e.target.checked }); }} />
          Aktifkan pencahayaan matahari
        </label>
        {sun.on && (
          <div className="result">
            <div className="grid2">
              <label>
                Tanggal
                <input type="date" value={sun.date} onChange={(e) => e.target.value && setSun({ date: e.target.value })} />
              </label>
              <div className="field">
                <span>Jam {fmtHour(sun.hour)} WIB</span>
                <button type="button" className="btn ghost sm" onClick={playDay}>
                  <Icon name={playing ? 'pause' : 'play'} size={14} /> {playing ? 'Jeda' : 'Putar sehari'}
                </button>
              </div>
            </div>
            <input type="range" min="0" max="24" step="0.25" value={sun.hour} onChange={(e) => { setPlaying(false); setSun({ hour: +e.target.value }); }} aria-label="Jam" />
            <div className="hud-stats">
              <div><span>Tinggi matahari</span><b>{pos.altitude.toFixed(0)}°</b></div>
              <div><span>Arah</span><b>{pos.altitude > -6 ? compassName(pos.azimuth) : 'malam'}</b></div>
              <div><span>Terbit / terbenam</span><b>{fmtHour(times.rise)} / {fmtHour(times.set)}</b></div>
            </div>
            <p className="small muted">Menampilkan terang-gelap lereng berdasarkan arah cahaya, bukan bayangan jatuh yang presisi.</p>
          </div>
        )}
      </article>

      {/* ---------- Perubahan lahan ---------- */}
      <article className="card">
        <h3>Deteksi perubahan lahan</h3>
        <p className="small muted">Membandingkan dua citra satelit blok demi blok (±10 m) lalu menandai blok yang kehijauannya berubah paling menonjol: lahan dibuka, bangunan baru, atau vegetasi tumbuh.</p>
        <div className="grid2">
          <label>
            Dari
            <select value={yearA} onChange={(e) => setYearA(+e.target.value)}>
              {imagery.map((im, i) => <option key={im.release} value={i}>{fmtIm(im.date)}</option>)}
            </select>
          </label>
          <label>
            Sampai
            <select value={yearB} onChange={(e) => setYearB(+e.target.value)}>
              {imagery.map((im, i) => <option key={im.release} value={i}>{fmtIm(im.date)}</option>)}
            </select>
          </label>
        </div>
        <label className="range">
          Kepekaan: {sens <= 2 ? 'peka (banyak tanda)' : sens >= 3.2 ? 'ketat (hanya perubahan besar)' : 'sedang'}
          <input type="range" min="1.5" max="4" step="0.25" value={sens} onChange={(e) => setSens(+e.target.value)} />
        </label>
        <button type="button" className="btn sm" onClick={runChange} disabled={!!busy}>
          <Icon name="swipe" size={14} /> {busy === 'change' ? 'Mengunduh & membandingkan…' : 'Bandingkan'}
        </button>
        {overlay?.kind === 'change' && (
          <div className="result">
            <p className="small">
              {fmtIm(overlay.from)} → {fmtIm(overlay.to)}: <b>{pct(overlay.stats.changed)}</b> dari {fmtArea(overlay.stats.areaHa * 10000)} terdeteksi berubah.
            </p>
            <ul className="legend-list">
              <li><span className="sw" style={{ background: 'rgb(226,60,160)' }} /> Vegetasi berkurang / lahan terbuka / terbangun <b>{pct(overlay.stats.lessGreen)}</b></li>
              <li><span className="sw" style={{ background: 'rgb(40,200,90)' }} /> Lebih hijau <b>{pct(overlay.stats.greener)}</b></li>
              <li><span className="sw" style={{ background: 'rgb(250,204,60)' }} /> Kecerahan berubah <b>{pct(overlay.stats.other)}</b></li>
            </ul>
            <p className="callout warn small">
              <Icon name="info" size={16} />
              <span>Beda musim (kemarau/hujan, masa tanam tembakau), awan, dan bayangan juga terbaca sebagai perubahan. Periksa tiap tanda dengan Mesin Waktu sebelum menyimpulkan.</span>
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
