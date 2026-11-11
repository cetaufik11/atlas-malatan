import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useStore, flyToSite } from '../store.js';
import { CATEGORIES, STATUSES, COORD_METHODS, SOURCE_TYPES } from '../data/meta.js';
import { distance, bearing, compassLabel, fmtDistance, walkMinutes, fmtCoord } from '../lib/geo.js';
import { elevationAt } from '../lib/elevation.js';
import { speak, stopSpeaking, speechSupported } from '../lib/speech.js';
import { Icon, SiteIcon } from './icons.jsx';
import { StatusBadge } from './Badges.jsx';
import MediaGallery from './MediaGallery.jsx';
import { CONFIG } from '../data/config.js';

export function siteUrl(id) {
  const u = new URL(CONFIG.publicUrl || location.href);
  u.hash = '';
  u.search = '';
  u.searchParams.set('situs', id);
  return u.toString();
}

export default function SiteDetail() {
  const selectedId = useStore((s) => s.selectedId);
  const sites = useStore((s) => s.sites);
  const select = useStore((s) => s.select);
  const userPos = useStore((s) => s.userPos);
  const setTab = useStore((s) => s.setTab);
  const notify = useStore((s) => s.notify);
  const [qr, setQr] = useState(null);
  const [demElev, setDemElev] = useState(null);
  const [reading, setReading] = useState(false);
  const ref = useRef(null);

  const idx = sites.findIndex((s) => s.id === selectedId);
  const site = sites[idx];

  useEffect(() => {
    setQr(null);
    setDemElev(null);
    stopSpeaking();
    setReading(false);
    if (!site) return;
    flyToSite(site, { padding: window.innerWidth > 900 ? { right: 420 } : { bottom: window.innerHeight * 0.45 } });
    elevationAt(site.lng, site.lat).then((e) => setDemElev(Math.round(e))).catch(() => {});
    ref.current?.focus();
  }, [site?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useMemo(() => {
    if (!site || !userPos) return null;
    const a = [userPos.lng, userPos.lat], b = [site.lng, site.lat];
    const d = distance(a, b);
    return { d, dir: compassLabel(bearing(a, b)), min: walkMinutes(d) };
  }, [site, userPos]);

  if (!site) return null;
  const cat = CATEGORIES[site.category] || { label: site.category, color: '#888' };
  const coord = COORD_METHODS[site.coord] || COORD_METHODS.perkiraan;

  const go = (dir) => select(sites[(idx + dir + sites.length) % sites.length].id);

  const share = async () => {
    const url = siteUrl(site.id);
    try {
      if (navigator.share) await navigator.share({ title: site.name, text: site.subtitle, url });
      else {
        await navigator.clipboard.writeText(url);
        notify('Tautan situs disalin.');
      }
    } catch { /* dibatalkan */ }
  };

  const makeQr = async () => {
    setQr(await QRCode.toDataURL(siteUrl(site.id), { margin: 1, width: 360, color: { dark: '#1d1a16', light: '#ffffff' } }));
  };

  const read = () => {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    const st = STATUSES[site.status];
    speak(`${site.name}. ${site.description} Status narasi: ${st?.label ?? ''}.`, { onEnd: () => setReading(false) });
  };

  return (
    <aside className="detail" aria-label={`Detail ${site.name}`} tabIndex={-1} ref={ref}>
      <div className="detail-top" style={{ '--c': cat.color }}>
        <div className="detail-nav">
          <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Situs sebelumnya">
            <Icon name="chevL" />
          </button>
          <span className="mono small">{site.code || `${idx + 1}/${sites.length}`}</span>
          <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Situs berikutnya">
            <Icon name="chevR" />
          </button>
          <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Tutup detail">
            <Icon name="close" />
          </button>
        </div>
        <span className="detail-icon"><SiteIcon type={site.icon} size={26} /></span>
        <span className="eyebrow">{cat.label}</span>
        <h2>{site.name}</h2>
        <p className="detail-sub">{site.subtitle}</p>
        <div className="badges">
          <StatusBadge status={site.status} />
          <span className="badge outline" title={coord.hint}>
            <Icon name="pin" size={12} /> {coord.label}
          </span>
        </div>
      </div>

      <div className="detail-body">
        {site.status === 'draf' && (
          <p className="callout warn">
            <Icon name="info" size={16} />
            <span>Teks ini masih <b>draf</b> dan belum dicek ke narasumber. Jangan dikutip sebagai fakta. Punya info yang benar? <button type="button" className="link" onClick={() => setTab('kirim')}>Kirim koreksi</button>.</span>
          </p>
        )}
        {site.status === 'legenda' && (
          <p className="callout legend">
            <Icon name="info" size={16} />
            <span>Bagian ini memuat <b>legenda/tutur tinular</b>. Dihormati sebagai kepercayaan warga, bukan fakta sejarah yang terverifikasi.</span>
          </p>
        )}

        <div className="actions">
          {speechSupported && (
            <button type="button" className="btn ghost sm" onClick={read} aria-pressed={reading}>
              <Icon name={reading ? 'stop' : 'volume'} size={14} /> {reading ? 'Berhenti' : 'Dengarkan'}
            </button>
          )}
          <button type="button" className="btn ghost sm" onClick={share}>
            <Icon name="share" size={14} /> Bagikan
          </button>
          <button type="button" className="btn ghost sm" onClick={makeQr}>
            <Icon name="qr" size={14} /> QR plang
          </button>
          <a className="btn ghost sm" href={`https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}&travelmode=walking`} target="_blank" rel="noreferrer">
            <Icon name="walk" size={14} /> Rute
          </a>
        </div>

        {nav && (
          <p className="nav-hint">
            <Icon name="compass" size={16} /> {fmtDistance(nav.d)} ke arah {nav.dir} · ±{nav.min} menit jalan kaki
          </p>
        )}

        <p className="lead">{site.description}</p>

        {site.quote?.text && (
          <blockquote>
            “{site.quote.text}”
            <cite>— {site.quote.cite}</cite>
          </blockquote>
        )}

        <MediaGallery media={site.media} siteName={site.name} onContribute={() => setTab('kirim')} />

        <h3>Data spasial</h3>
        <dl className="specs">
          <div><dt>Koordinat</dt><dd className="mono">{site.lat.toFixed(6)}, {site.lng.toFixed(6)}</dd></div>
          <div><dt>DMS</dt><dd className="mono">{fmtCoord(site.lat, site.lng)}</dd></div>
          <div><dt>Elevasi (catatan)</dt><dd>± {site.elev?.toLocaleString('id-ID')} mdpl</dd></div>
          <div><dt>Elevasi (model DEM)</dt><dd>{demElev != null ? `± ${demElev.toLocaleString('id-ID')} mdpl` : '…'}</dd></div>
          {Object.entries(site.specs || {})
            .filter(([k]) => !/koordinat|elevasi/i.test(k))
            .map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
        </dl>

        <h3>Sumber</h3>
        <ul className="sources">
          {site.sources.map((s, i) => (
            <li key={i}>
              <span className="badge tiny">{SOURCE_TYPES[s.type] || s.type}</span> {s.title}
              {s.note && <span className="muted"> — {s.note}</span>}
            </li>
          ))}
        </ul>

        {qr && (
          <div className="qr-card">
            <img src={qr} alt={`Kode QR menuju ${site.name}`} width="180" height="180" />
            <div>
              <strong>{site.name}</strong>
              <p className="small muted">Pindai untuk membuka situs ini di Atlas Malatan. Cetak & pasang pada plang lokasi.</p>
              <a className="btn sm" href={qr} download={`qr-${site.id}.png`}>
                <Icon name="download" size={14} /> Unduh PNG
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
