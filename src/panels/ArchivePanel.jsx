// Katalog arsip: semua sumber & media dari seluruh situs dalam satu daftar.
import { useMemo, useState } from 'react';
import { useStore } from '../store.js';
import { SOURCE_TYPES, MEDIA_TYPES, STATUSES } from '../data/meta.js';
import heritage from '../data/heritage.json';
import { Icon } from '../components/icons.jsx';

export default function ArchivePanel() {
  const sites = useStore((s) => s.sites);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const archiveOn = useStore((s) => s.layers.archive2018);
  const setTM = useStore((s) => s.setTimeMachine);
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const out = [];
    for (const s of sites) {
      for (const src of s.sources || []) out.push({ kind: src.type, title: src.title, note: src.note, site: s, status: s.status });
      for (const m of s.media || []) out.push({ kind: m.type, title: m.caption || MEDIA_TYPES[m.type], note: [m.credit, m.date].filter(Boolean).join(' · '), site: s, media: m, status: s.status });
    }
    for (const l of heritage.legends) out.push({ kind: 'lisan', title: `${l.title} — ${l.source}`, note: 'Legenda', heritage: true, status: 'legenda' });
    for (const f of heritage.finds) out.push({ kind: 'lisan', title: `${f.title} — ${f.source}`, note: 'Temuan arkeologis', heritage: true, status: f.status });
    // Gabungkan sumber yang sama dari banyak situs.
    const merged = new Map();
    for (const it of out) {
      const key = it.media ? it.media.src : `${it.kind}|${it.title}`;
      const prev = merged.get(key);
      if (prev) {
        if (it.site && !prev.sites.find((x) => x.id === it.site.id)) prev.sites.push(it.site);
      } else merged.set(key, { ...it, sites: it.site ? [it.site] : [] });
    }
    return [...merged.values()];
  }, [sites]);

  const kinds = [...new Set(items.map((i) => i.kind))];
  const ql = q.trim().toLowerCase();
  const shown = items.filter((i) => (kind === 'all' || i.kind === kind) && (!ql || `${i.title} ${i.note} ${i.sites.map((s) => s.name).join(' ')}`.toLowerCase().includes(ql)));

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Inventaris</span>
        <h2>Katalog Arsip</h2>
        <p className="muted">Semua sumber lisan, dokumen, peta, dan media yang menjadi dasar atlas ini. Setiap entri tertaut ke situsnya.</p>
      </header>

      <article className="card feature">
        <img src="media/peta-arsip-2018.jpg" alt="Pratinjau Peta Wilayah Dusun Malatan, KKN Undip Teknik Geodesi 2018" loading="lazy" />
        <div>
          <span className="eyebrow">Peta Arsip</span>
          <h3>Peta Wilayah Dusun Malatan 2018</h3>
          <p className="small muted">KKN Undip Teknik Geodesi. Dipasang di atas peta sesuai koordinatnya.</p>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => toggleLayer('archive2018')} aria-pressed={archiveOn}>
              {archiveOn ? 'Sembunyikan' : 'Tampilkan di peta'}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setTM({ open: true, swipe: true, compareIdx: -1 })}>
              <Icon name="swipe" size={14} /> Bandingkan dgn citra
            </button>
          </div>
        </div>
      </article>

      <label className="search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Cari arsip…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari arsip" />
      </label>
      <div className="chips">
        <button type="button" className={`chip ${kind === 'all' ? 'on' : ''}`} onClick={() => setKind('all')}>Semua <span className="muted">{items.length}</span></button>
        {kinds.map((k) => (
          <button key={k} type="button" className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {SOURCE_TYPES[k] || MEDIA_TYPES[k] || k} <span className="muted">{items.filter((i) => i.kind === k).length}</span>
          </button>
        ))}
      </div>

      <ul className="archive-list">
        {shown.map((it, i) => (
          <li key={i} className="archive-item">
            <span className="badge tiny">{SOURCE_TYPES[it.kind] || MEDIA_TYPES[it.kind] || it.kind}</span>
            <strong>{it.title}</strong>
            {it.note && <span className="small muted">{it.note}</span>}
            <span className="small">
              {it.heritage ? (
                <button type="button" className="link" onClick={() => setTab('cagar')}>Lihat di Cagar Budaya</button>
              ) : (
                it.sites.map((s, j) => (
                  <span key={s.id}>
                    {j > 0 && ', '}
                    <button type="button" className="link" onClick={() => select(s.id)}>{s.name}</button>
                  </span>
                ))
              )}
              <span className="dot inline" style={{ background: STATUSES[it.status]?.color }} title={STATUSES[it.status]?.label} />
            </span>
          </li>
        ))}
      </ul>

      <div className="callout">
        <Icon name="camera" size={16} />
        <span>Arsip foto dan rekaman wawancara masih kosong. Dokumentasi KKN bisa ditambahkan lewat tab <button type="button" className="link" onClick={() => setTab('kirim')}>Kirim Cerita</button> atau langsung oleh admin.</span>
      </div>
    </div>
  );
}
