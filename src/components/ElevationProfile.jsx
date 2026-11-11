import { useEffect, useState, useId } from 'react';
import { samplePath, fmtDistance } from '../lib/geo.js';
import { elevationProfile } from '../lib/elevation.js';

export default function ElevationProfile({ points }) {
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);
  const gid = useId();
  const key = JSON.stringify(points);

  useEffect(() => {
    let alive = true;
    setData(null);
    if (points.length < 2) return;
    elevationProfile(samplePath(points, 60)).then((d) => alive && setData(d.filter((x) => x.e != null)));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (points.length < 2) return null;
  if (!data) return <p className="small muted">Menghitung profil elevasi…</p>;
  if (data.length < 2) return <p className="small muted">Data elevasi tidak tersedia (offline?).</p>;

  const W = 320, H = 110, P = { l: 38, r: 8, t: 10, b: 20 };
  const es = data.map((d) => d.e);
  const min = Math.floor(Math.min(...es) - 2), max = Math.ceil(Math.max(...es) + 2);
  const total = data[data.length - 1].d || 1;
  const x = (d) => P.l + (d / total) * (W - P.l - P.r);
  const y = (e) => P.t + (1 - (e - min) / (max - min || 1)) * (H - P.t - P.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.d).toFixed(1)},${y(d.e).toFixed(1)}`).join(' ');
  const area = `${path} L${x(total)},${H - P.b} L${P.l},${H - P.b} Z`;

  let gain = 0, loss = 0;
  for (let i = 1; i < es.length; i++) {
    const d = es[i] - es[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  const maxSlope = Math.max(...data.slice(1).map((d, i) => Math.abs(d.e - data[i].e) / Math.max(1, d.d - data[i].d))) * 100;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const d = ((px - P.l) / (W - P.l - P.r)) * total;
    let best = data[0];
    for (const p of data) if (Math.abs(p.d - d) < Math.abs(best.d - d)) best = p;
    setHover(best);
  };

  return (
    <figure className="profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Profil elevasi: terendah ${Math.round(Math.min(...es))} m, tertinggi ${Math.round(Math.max(...es))} m`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[min, Math.round((min + max) / 2), max].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={P.l - 4} y={y(v) + 3} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <text x={P.l} y={H - 5} className="axis">0</text>
        <text x={W - P.r} y={H - 5} textAnchor="end" className="axis">{fmtDistance(total)}</text>
        {hover && (
          <g>
            <line x1={x(hover.d)} x2={x(hover.d)} y1={P.t} y2={H - P.b} className="cursor" />
            <circle cx={x(hover.d)} cy={y(hover.e)} r="3.5" fill="var(--accent)" />
            <text x={Math.min(W - 60, x(hover.d) + 5)} y={P.t + 10} className="axis strong">{Math.round(hover.e)} m · {fmtDistance(hover.d)}</text>
          </g>
        )}
      </svg>
      <figcaption className="small muted">
        Naik {Math.round(gain)} m · turun {Math.round(loss)} m · kemiringan maks ±{Math.round(maxSlope)}% · DEM ±30 m, gunakan sebagai gambaran.
      </figcaption>
    </figure>
  );
}
