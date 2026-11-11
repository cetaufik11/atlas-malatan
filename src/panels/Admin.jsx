// Penyunting data statis. Suntingan tersimpan di perangkat (IndexedDB) dan
// menjadi permanen setelah sites.json diekspor lalu menimpa src/data/sites.json.
import { useEffect, useState } from 'react';
import { useStore, mapRef } from '../store.js';
import baseSites from '../data/sites.json';
import { CATEGORIES, STATUSES, COORD_METHODS, SOURCE_TYPES, MEDIA_TYPES } from '../data/meta.js';
import { CONFIG } from '../data/config.js';
import { db, downloadText, readJsonFile, fileToDataUrl } from '../lib/storage.js';
import { Icon } from '../components/icons.jsx';
import { getOnePosition } from '../lib/gps.js';
import { elevationAt } from '../lib/elevation.js';
import Calibration from './Calibration.jsx';

const ICONS = ['mosque', 'church', 'hall', 'school', 'tomb', 'posko', 'spring', 'tobacco', 'bridge', 'find'];
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export default function Admin({ onClose }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorageGet('admin') === '1');
  const [pin, setPin] = useState('');
  const sites = useStore((s) => s.sites);
  const setSites = useStore((s) => s.setSites);
  const edited = useStore((s) => s.sitesEdited);
  const notify = useStore((s) => s.notify);
  const [editId, setEditId] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [view, setView] = useState('situs');

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const commit = async (next) => {
    setSites(next, true);
    await db.saveSiteOverrides(next);
  };

  if (!unlocked) {
    return (
      <div className="modal" role="dialog" aria-modal="true" aria-label="Masuk admin">
        <form
          className="modal-card narrow"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === CONFIG.adminPin) {
              sessionStorageSet('admin', '1');
              setUnlocked(true);
            } else notify('PIN salah.', 'error');
          }}
        >
          <h2>Mode Admin</h2>
          <p className="small muted">Masukkan PIN pengelola (atur di <code>src/data/config.js</code>).</p>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus aria-label="PIN" />
          <div className="row">
            <button type="submit" className="btn sm">Masuk</button>
            <button type="button" className="btn ghost sm" onClick={onClose}>Batal</button>
          </div>
        </form>
      </div>
    );
  }

  const editing = sites.find((s) => s.id === editId);

  const update = (patch) => commit(sites.map((s) => (s.id === editId ? { ...s, ...patch } : s)));

  const addSite = () => {
    const c = mapRef.current?.getCenter();
    const id = `situs-${Date.now().toString(36)}`;
    const s = {
      id, code: '', name: 'Situs baru', subtitle: '', category: 'sejarah', icon: 'find',
      lat: +(c?.lat ?? -7.28575).toFixed(6), lng: +(c?.lng ?? 110.01215).toFixed(6), elev: null,
      coord: 'perkiraan', status: 'draf', description: '', quote: null, specs: {}, sources: [], media: [], tags: [],
    };
    commit([...sites, s]);
    setEditId(id);
  };

  const removeSite = (id) => {
    if (!confirm('Hapus situs ini dari atlas? (Bisa dibatalkan dengan "Kembalikan data asli".)')) return;
    commit(sites.filter((s) => s.id !== id));
    setEditId(null);
  };

  const exportSites = () => downloadText('sites.json', JSON.stringify(sites, null, 2));

  const importSites = async (file) => {
    try {
      const data = await readJsonFile(file);
      if (!Array.isArray(data) || !data.every((s) => s.id && typeof s.lat === 'number')) throw new Error();
      await commit(data);
      notify(`${data.length} situs dimuat.`, 'success');
    } catch {
      notify('Berkas bukan sites.json yang valid.', 'error');
    }
  };

  const reset = async () => {
    if (!confirm('Buang semua suntingan di perangkat ini dan kembali ke data asli?')) return;
    await db.clearSiteOverrides();
    setSites(baseSites, false);
    setEditId(null);
  };

  const importInbox = async (files) => {
    const items = [];
    for (const f of files) {
      try {
        const d = await readJsonFile(f);
        if (d.format === 'atlas-malatan-kiriman') items.push(...d.items);
      } catch { /* lewati */ }
    }
    setInbox((x) => [...x, ...items.filter((i) => !x.find((y) => y.id === i.id))]);
    notify(`${items.length} kiriman dimuat.`);
  };

  const acceptToSite = (c, siteId) => {
    const today = new Date(c.created).toLocaleDateString('id-ID');
    const credit = c.who ? `${c.who} (${c.role})` : `Anonim (${c.role})`;
    const media = [
      ...c.photos.map((p) => ({ type: 'photo', src: p.src, caption: c.title || 'Kiriman warga', credit, date: c.period || today })),
      ...(c.audio ? [{ type: 'audio', src: c.audio.src, caption: c.title || 'Rekaman tutur', credit, date: today, transcript: c.body }] : []),
    ];
    const source = { title: `${c.basis === 'legenda' ? 'Tutur (legenda)' : 'Kiriman warga'}: ${credit}, ${today}${c.title ? ` — ${c.title}` : ''}`, type: c.basis === 'dokumen' ? 'dokumen' : 'lisan', note: c.body.slice(0, 280) };
    commit(sites.map((s) => (s.id === siteId ? { ...s, media: [...s.media, ...media], sources: [...s.sources, source] } : s)));
    setInbox((x) => x.filter((i) => i.id !== c.id));
    notify('Kiriman ditambahkan ke situs. Periksa label statusnya.', 'success');
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Mode admin">
      <div className="modal-card wide">
        <header className="modal-head">
          <div>
            <span className="eyebrow">Mode Admin {edited && '· ada suntingan belum diekspor'}</span>
            <h2>Kelola Data Atlas</h2>
          </div>
          <div className="row">
            <button type="button" className={`btn ghost sm ${view === 'situs' ? 'on' : ''}`} onClick={() => setView('situs')}>Situs</button>
            <button type="button" className={`btn ghost sm ${view === 'kalibrasi' ? 'on' : ''}`} onClick={() => setView('kalibrasi')}>Kalibrasi posisi</button>
            <button type="button" className={`btn ghost sm ${view === 'inbox' ? 'on' : ''}`} onClick={() => setView('inbox')}>Kiriman warga {inbox.length > 0 && `(${inbox.length})`}</button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup admin"><Icon name="close" /></button>
          </div>
        </header>

        {view === 'situs' && (
          <div className="admin">
            <aside className="admin-list">
              <button type="button" className="btn sm block" onClick={addSite}>+ Situs baru (di tengah peta)</button>
              <ul>
                {sites.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={editId === s.id ? 'on' : ''} onClick={() => setEditId(s.id)}>
                      <span className="dot" style={{ background: STATUSES[s.status]?.color }} /> {s.name}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="admin-io">
                <button type="button" className="btn sm block" onClick={exportSites}><Icon name="download" size={14} /> Ekspor sites.json</button>
                <label className="btn ghost sm block">
                  <Icon name="upload" size={14} /> Muat sites.json
                  <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files[0] && importSites(e.target.files[0])} />
                </label>
                <button type="button" className="btn ghost sm block" onClick={reset}>Kembalikan data asli</button>
                <p className="small muted">Agar permanen untuk semua orang: ekspor, timpa <code>src/data/sites.json</code>, lalu build & deploy ulang.</p>
              </div>
            </aside>

            <section className="admin-edit">
              {!editing && <p className="empty">Pilih situs di kiri untuk menyunting.</p>}
              {editing && <SiteEditor key={editing.id} site={editing} update={update} remove={() => removeSite(editing.id)} allIds={sites.map((s) => s.id)} />}
            </section>
          </div>
        )}

        {view === 'kalibrasi' && <Calibration onClose={onClose} />}

        {view === 'inbox' && (
          <div className="admin-inbox">
            <label className="btn sm">
              <Icon name="upload" size={14} /> Muat file paket kiriman (.json)
              <input type="file" accept=".json,application/json" multiple hidden onChange={(e) => importInbox([...e.target.files])} />
            </label>
            {inbox.length === 0 && <p className="empty">Belum ada kiriman dimuat. Minta warga menekan “File paket” lalu kirim berkasnya ke kamu.</p>}
            {inbox.map((c) => (
              <article key={c.id} className="card">
                <span className="eyebrow">{c.kind} · {c.role} · {new Date(c.created).toLocaleString('id-ID')}</span>
                <h3>{c.title || 'Tanpa judul'}</h3>
                <p>{c.body}</p>
                <p className="small muted">Pengirim: {c.who || 'Anonim'} {c.contact && `· ${c.contact}`} · Dasar: {c.basis} · Masa: {c.period || '—'}</p>
                {c.point && <p className="small mono">Lokasi usulan: {c.point.lat.toFixed(6)}, {c.point.lng.toFixed(6)} ±{c.point.acc} m</p>}
                <div className="thumbs">{c.photos.map((p, i) => <span key={i} className="thumb"><img src={p.src} alt="" /></span>)}</div>
                {c.audio && <audio controls src={c.audio.src} />}
                <div className="row">
                  <select defaultValue={c.siteId || ''} id={`to-${c.id}`} aria-label="Tambahkan ke situs">
                    <option value="" disabled>Pilih situs…</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" className="btn sm" onClick={() => {
                    const v = document.getElementById(`to-${c.id}`).value;
                    if (v) acceptToSite(c, v); else notify('Pilih situs dulu.', 'error');
                  }}>Terima ke situs</button>
                  <button type="button" className="btn ghost sm" onClick={() => setInbox((x) => x.filter((i) => i.id !== c.id))}>Abaikan</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SiteEditor({ site, update, remove, allIds }) {
  const notify = useStore((s) => s.notify);
  const [id, setId] = useState(site.id);
  const set = (k) => (e) => update({ [k]: e.target.type === 'number' ? (e.target.value === '' ? null : +e.target.value) : e.target.value });

  const fromMap = () => {
    const c = mapRef.current?.getCenter();
    if (c) update({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
  };

  // Koreksi koordinat langsung di lokasi: ambil GPS + elevasi DEM, tandai metode 'gps'.
  const fromGps = async () => {
    try {
      const p = await getOnePosition();
      const lat = +p.coords.latitude.toFixed(6), lng = +p.coords.longitude.toFixed(6);
      let elev = site.elev;
      try { elev = Math.round(await elevationAt(lng, lat)); } catch { /* biarkan */ }
      update({ lat, lng, elev, coord: 'gps' });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 18.5 });
      notify(`Koordinat diperbarui (akurasi ±${Math.round(p.coords.accuracy)} m).`, 'success');
    } catch {
      notify('Gagal mendapat posisi GPS.', 'error');
    }
  };

  const renameId = () => {
    const nid = slug(id);
    if (!nid || nid === site.id) return;
    if (allIds.includes(nid)) return notify('ID sudah dipakai.', 'error');
    useStore.getState().setSites(useStore.getState().sites.map((s) => (s.id === site.id ? { ...s, id: nid } : s)));
    db.saveSiteOverrides(useStore.getState().sites);
  };

  const setList = (k, i, patch) => update({ [k]: site[k].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const delList = (k, i) => update({ [k]: site[k].filter((_, j) => j !== i) });

  const addPhoto = async (files) => {
    const media = [];
    for (const f of files) media.push({ type: f.type.startsWith('audio') ? 'audio' : f.type.startsWith('video') ? 'video' : 'photo', src: await fileToDataUrl(f), caption: f.name.replace(/\.\w+$/, ''), credit: '', date: '' });
    update({ media: [...site.media, ...media] });
  };

  return (
    <div className="form">
      <div className="grid2">
        <label>Nama<input value={site.name} onChange={set('name')} /></label>
        <label>Kode<input value={site.code || ''} onChange={set('code')} /></label>
      </div>
      <label>Subjudul<input value={site.subtitle} onChange={set('subtitle')} /></label>
      <label>ID (dipakai di tautan & QR)
        <span className="row"><input value={id} onChange={(e) => setId(e.target.value)} onBlur={renameId} /></span>
      </label>
      <div className="grid3">
        <label>Kategori
          <select value={site.category} onChange={set('category')}>{Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
        </label>
        <label>Status narasi
          <select value={site.status} onChange={set('status')}>{Object.entries(STATUSES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
        </label>
        <label>Ikon
          <select value={site.icon} onChange={set('icon')}>{ICONS.map((i) => <option key={i}>{i}</option>)}</select>
        </label>
      </div>
      <div className="grid3">
        <label>Lintang<input type="number" step="0.000001" value={site.lat} onChange={set('lat')} /></label>
        <label>Bujur<input type="number" step="0.000001" value={site.lng} onChange={set('lng')} /></label>
        <label>Elevasi (mdpl)<input type="number" value={site.elev ?? ''} onChange={set('elev')} /></label>
      </div>
      <div className="row">
        <button type="button" className="btn sm" onClick={fromGps}><Icon name="locate" size={14} /> Pakai posisi GPS saya</button>
        <button type="button" className="btn ghost sm" onClick={fromMap}><Icon name="pin" size={14} /> Pakai titik tengah peta</button>
        <label>Metode koordinat
          <select value={site.coord} onChange={set('coord')}>{Object.entries(COORD_METHODS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select>
        </label>
      </div>
      <label>Deskripsi<textarea rows={5} value={site.description} onChange={set('description')} /></label>
      <div className="grid2">
        <label>Kutipan<input value={site.quote?.text || ''} onChange={(e) => update({ quote: e.target.value ? { text: e.target.value, cite: site.quote?.cite || '' } : null })} /></label>
        <label>Sumber kutipan<input value={site.quote?.cite || ''} onChange={(e) => update({ quote: { text: site.quote?.text || '', cite: e.target.value } })} /></label>
      </div>

      <fieldset>
        <legend>Sumber ({site.sources.length})</legend>
        {site.sources.map((s, i) => (
          <div key={i} className="list-row">
            <select value={s.type} onChange={(e) => setList('sources', i, { type: e.target.value })}>{Object.entries(SOURCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input value={s.title} onChange={(e) => setList('sources', i, { title: e.target.value })} placeholder="Judul / narasumber" />
            <input value={s.note || ''} onChange={(e) => setList('sources', i, { note: e.target.value })} placeholder="Catatan" />
            <button type="button" className="icon-btn" onClick={() => delList('sources', i)} aria-label="Hapus sumber"><Icon name="trash" size={14} /></button>
          </div>
        ))}
        <button type="button" className="btn ghost sm" onClick={() => update({ sources: [...site.sources, { type: 'lisan', title: '', note: '' }] })}>+ Sumber</button>
      </fieldset>

      <fieldset>
        <legend>Media ({site.media.length})</legend>
        {site.media.map((m, i) => (
          <div key={i} className="list-row">
            {m.type === 'photo' ? <img src={m.src} alt="" className="mini" /> : <span className="badge tiny">{MEDIA_TYPES[m.type]}</span>}
            <input value={m.caption || ''} onChange={(e) => setList('media', i, { caption: e.target.value })} placeholder="Keterangan" />
            <input value={m.credit || ''} onChange={(e) => setList('media', i, { credit: e.target.value })} placeholder="Kredit" />
            <input value={m.date || ''} onChange={(e) => setList('media', i, { date: e.target.value })} placeholder="Tahun" className="short" />
            <button type="button" className="icon-btn" onClick={() => delList('media', i)} aria-label="Hapus media"><Icon name="trash" size={14} /></button>
          </div>
        ))}
        <div className="row">
          <label className="btn ghost sm">
            + Unggah foto/audio
            <input type="file" accept="image/*,audio/*" multiple hidden onChange={(e) => addPhoto([...e.target.files])} />
          </label>
          <button type="button" className="btn ghost sm" onClick={() => {
            const src = prompt('Path atau URL media (mis. media/masjid-1975.jpg):');
            if (src) update({ media: [...site.media, { type: /\.(mp3|m4a|ogg|wav|webm)$/i.test(src) ? 'audio' : 'photo', src, caption: '', credit: '', date: '' }] });
          }}>+ Dari path/URL</button>
        </div>
        <p className="small muted">Tip: untuk foto besar, taruh file di <code>public/media/</code> lalu tambahkan lewat path agar sites.json tetap ringan.</p>
      </fieldset>

      <button type="button" className="btn ghost sm danger" onClick={remove}><Icon name="trash" size={14} /> Hapus situs</button>
    </div>
  );
}

function sessionStorageGet(k) {
  try { return sessionStorage.getItem('atlas:' + k); } catch { return null; }
}
function sessionStorageSet(k, v) {
  try { sessionStorage.setItem('atlas:' + k, v); } catch { /* abaikan */ }
}
