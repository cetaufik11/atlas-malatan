import { useStore, useFilteredSites } from '../store.js';
import { CATEGORIES, STATUSES } from '../data/meta.js';
import { distance, fmtDistance } from '../lib/geo.js';
import { Icon, SiteIcon } from '../components/icons.jsx';
import { StatusBadge } from '../components/Badges.jsx';

export default function SitesPanel() {
  const sites = useStore((s) => s.sites);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const select = useStore((s) => s.select);
  const selectedId = useStore((s) => s.selectedId);
  const userPos = useStore((s) => s.userPos);
  const visited = useStore((s) => s.progress.visited);
  let list = useFilteredSites();

  if (userPos) {
    list = [...list].sort((a, b) => distance([userPos.lng, userPos.lat], [a.lng, a.lat]) - distance([userPos.lng, userPos.lat], [b.lng, b.lat]));
  }

  const counts = Object.fromEntries(Object.keys(STATUSES).map((k) => [k, sites.filter((s) => s.status === k).length]));

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Atlas Spasial</span>
        <h2>Situs Dusun Malatan</h2>
        <p className="muted">
          {sites.length} situs terpetakan · {visited.length} sudah kamu buka. Setiap situs punya label status supaya legenda, tutur, dan fakta
          terverifikasi tidak tercampur.
        </p>
      </header>

      <label className="search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Cari situs, cerita, sumber…" value={filters.query} onChange={(e) => setFilter('query', e.target.value)} aria-label="Cari situs" />
      </label>

      <div className="chips" role="group" aria-label="Filter kategori">
        <button type="button" className={`chip ${filters.category === 'all' ? 'on' : ''}`} onClick={() => setFilter('category', 'all')}>Semua</button>
        {Object.entries(CATEGORIES).map(([k, c]) => (
          <button key={k} type="button" className={`chip ${filters.category === k ? 'on' : ''}`} style={{ '--c': c.color }} onClick={() => setFilter('category', k)} aria-pressed={filters.category === k}>
            <span className="dot" style={{ background: c.color }} /> {c.label}
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Filter status narasi">
        <button type="button" className={`chip ${filters.status === 'all' ? 'on' : ''}`} onClick={() => setFilter('status', 'all')}>Semua status</button>
        {Object.entries(STATUSES)
          .filter(([k]) => counts[k])
          .map(([k, s]) => (
            <button key={k} type="button" className={`chip ${filters.status === k ? 'on' : ''}`} onClick={() => setFilter('status', k)} title={s.hint} aria-pressed={filters.status === k}>
              <span className="dot" style={{ background: s.color }} /> {s.short} <span className="muted">{counts[k]}</span>
            </button>
          ))}
      </div>

      {list.length === 0 && <p className="empty">Tidak ada situs yang cocok dengan filter.</p>}

      <ul className="site-list">
        {list.map((s) => {
          const cat = CATEGORIES[s.category] || { color: '#888' };
          return (
            <li key={s.id}>
              <button type="button" className={`site-row ${selectedId === s.id ? 'on' : ''}`} onClick={() => select(s.id)}>
                <span className="site-ico" style={{ '--c': cat.color }}>
                  <SiteIcon type={s.icon} />
                </span>
                <span className="site-txt">
                  <strong>{s.name}</strong>
                  <span className="small muted">{s.subtitle}</span>
                  <span className="row-meta">
                    <StatusBadge status={s.status} short />
                    {userPos && <span className="small mono">{fmtDistance(distance([userPos.lng, userPos.lat], [s.lng, s.lat]))}</span>}
                    {visited.includes(s.id) && <span className="small muted" title="Sudah dibuka">✓</span>}
                    {s.media?.length > 0 && <span className="small muted"><Icon name="camera" size={12} /> {s.media.length}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <details className="legend-box">
        <summary>Arti label status</summary>
        <dl>
          {Object.entries(STATUSES).map(([k, s]) => (
            <div key={k}>
              <dt><StatusBadge status={k} /></dt>
              <dd className="small">{s.hint}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
