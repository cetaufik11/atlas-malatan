import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { db, fileToDataUrl, downloadText } from '../lib/storage.js';
import { getOnePosition } from '../lib/gps.js';
import { CONFIG } from '../data/config.js';
import { Icon } from '../components/icons.jsx';

const KINDS = {
  cerita: 'Cerita / kesaksian',
  koreksi: 'Koreksi data',
  foto: 'Foto / dokumen lama',
  lokasi: 'Usulan situs baru',
};

const BASIS = {
  alami: 'Saya alami / lihat sendiri',
  dengar: 'Saya dengar dari orang lain',
  dokumen: 'Dari dokumen / foto',
  legenda: 'Cerita turun-temurun (legenda)',
};

const empty = { kind: 'cerita', siteId: '', title: '', body: '', period: '', basis: 'alami', who: '', role: 'warga', contact: '', consent: false, photos: [], audio: null, point: null };

export default function ContributePanel() {
  const sites = useStore((s) => s.sites);
  const selectedId = useStore((s) => s.selectedId);
  const notify = useStore((s) => s.notify);
  const [f, setF] = useState({ ...empty, siteId: selectedId || '' });
  const [list, setList] = useState([]);
  const [rec, setRec] = useState(null); // { recorder, chunks, start }
  const [elapsed, setElapsed] = useState(0);
  const fileInput = useRef(null);

  useEffect(() => {
    db.contributions().then(setList);
  }, []);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - rec.start) / 1000)), 500);
    return () => clearInterval(t);
  }, [rec]);

  const up = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const addPhotos = async (files) => {
    const imgs = [];
    for (const file of [...files].slice(0, 6)) {
      try {
        imgs.push({ name: file.name, src: await fileToDataUrl(file) });
      } catch { /* lewati */ }
    }
    setF((x) => ({ ...x, photos: [...x.photos, ...imgs].slice(0, 6) }));
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const r = new FileReader();
        r.onload = () => up('audio', { src: r.result, seconds: Math.round((Date.now() - start) / 1000) });
        r.readAsDataURL(blob);
      };
      const start = Date.now();
      recorder.start();
      setElapsed(0);
      setRec({ recorder, start });
    } catch {
      notify('Mikrofon tidak bisa diakses.', 'error');
    }
  };
  const stopRec = () => {
    rec?.recorder.stop();
    setRec(null);
  };

  const usePosition = async () => {
    try {
      const p = await getOnePosition();
      up('point', { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) });
    } catch {
      notify('Gagal mendapat posisi GPS.', 'error');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.body.trim() && !f.photos.length && !f.audio) {
      notify('Isi cerita, foto, atau rekaman terlebih dahulu.', 'error');
      return;
    }
    if (!f.consent) {
      notify('Centang persetujuan terlebih dahulu.', 'error');
      return;
    }
    const item = { ...f, id: `k-${Date.now()}`, created: new Date().toISOString(), sent: false };
    const next = [item, ...list];
    const ok = await db.saveContributions(next);
    setList(next);
    setF({ ...empty, siteId: f.siteId });
    notify(ok ? 'Tersimpan di perangkat. Sekarang kirim ke pengelola.' : 'Tersimpan sementara (penyimpanan perangkat diblokir).', 'success');
  };

  const textOf = (c) => {
    const site = sites.find((s) => s.id === c.siteId);
    return [
      `*Kiriman Atlas Malatan* — ${KINDS[c.kind]}`,
      site ? `Situs: ${site.name}` : c.point ? `Lokasi: ${c.point.lat.toFixed(6)}, ${c.point.lng.toFixed(6)} (±${c.point.acc} m)` : '',
      c.title && `Judul: ${c.title}`,
      c.period && `Masa/tahun: ${c.period}`,
      `Dasar: ${BASIS[c.basis]}`,
      '',
      c.body,
      '',
      `Pengirim: ${c.who || 'Anonim'} (${c.role})${c.contact ? ' · ' + c.contact : ''}`,
      c.photos.length || c.audio ? `Lampiran: ${c.photos.length} foto${c.audio ? ', 1 rekaman' : ''} (dikirim terpisah / lewat file paket)` : '',
    ].filter((x) => x !== '' && x != null && x !== false).join('\n');
  };

  const markSent = async (id) => {
    const next = list.map((c) => (c.id === id ? { ...c, sent: true } : c));
    setList(next);
    await db.saveContributions(next);
  };

  const sendWA = (c) => {
    const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(textOf(c))}`;
    window.open(url, '_blank', 'noopener');
    markSent(c.id);
  };

  const sendFile = async (c) => {
    const json = JSON.stringify({ format: 'atlas-malatan-kiriman', version: 1, items: [c] }, null, 1);
    const file = new File([json], `kiriman-${c.id}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Kiriman Atlas Malatan', text: textOf(c) });
        markSent(c.id);
        return;
      }
    } catch { /* lanjut unduh */ }
    downloadText(file.name, json);
    markSent(c.id);
  };

  const remove = async (id) => {
    const next = list.filter((c) => c.id !== id);
    setList(next);
    await db.saveContributions(next);
  };

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Arsip Warga</span>
        <h2>Kirim Cerita & Dokumentasi</h2>
        <p className="muted">Sejarah Malatan ada di ingatan warganya. Kirim cerita, koreksi, foto lama, atau rekam wawancara dengan sesepuh. Pengelola akan memeriksa dan memberi label status sebelum dipublikasikan.</p>
      </header>

      <form className="form" onSubmit={save}>
        <label>
          Jenis kiriman
          <select value={f.kind} onChange={(e) => up('kind', e.target.value)}>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        {f.kind !== 'lokasi' ? (
          <label>
            Tentang situs
            <select value={f.siteId} onChange={(e) => up('siteId', e.target.value)}>
              <option value="">Umum / tidak spesifik</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="field">
            <span>Lokasi situs baru</span>
            <button type="button" className="btn ghost sm" onClick={usePosition}>
              <Icon name="locate" size={14} /> Pakai posisi saya sekarang
            </button>
            {f.point && <span className="small mono">{f.point.lat.toFixed(6)}, {f.point.lng.toFixed(6)} ±{f.point.acc} m</span>}
          </div>
        )}

        <label>
          Judul singkat
          <input value={f.title} onChange={(e) => up('title', e.target.value)} placeholder="mis. Kerja bakti membangun jembatan" maxLength={120} />
        </label>
        <label>
          Cerita / keterangan
          <textarea rows={5} value={f.body} onChange={(e) => up('body', e.target.value)} placeholder="Ceritakan apa, kapan, siapa, dan di mana…" />
        </label>
        <div className="grid2">
          <label>
            Kira-kira masa / tahun
            <input value={f.period} onChange={(e) => up('period', e.target.value)} placeholder="mis. 1980-an" />
          </label>
          <label>
            Dasar cerita
            <select value={f.basis} onChange={(e) => up('basis', e.target.value)}>
              {Object.entries(BASIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <div className="field">
          <span>Foto (maks. 6, otomatis dikecilkan)</span>
          <input ref={fileInput} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => addPhotos(e.target.files)} />
          <button type="button" className="btn ghost sm" onClick={() => fileInput.current.click()}>
            <Icon name="camera" size={14} /> Tambah foto
          </button>
          {f.photos.length > 0 && (
            <div className="thumbs">
              {f.photos.map((p, i) => (
                <span key={i} className="thumb">
                  <img src={p.src} alt={`Foto ${i + 1}`} />
                  <button type="button" onClick={() => up('photos', f.photos.filter((_, j) => j !== i))} aria-label="Hapus foto">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {'MediaRecorder' in window && (
          <div className="field">
            <span>Rekam wawancara / cerita lisan</span>
            {!rec && !f.audio && (
              <button type="button" className="btn ghost sm" onClick={startRec}>
                <Icon name="mic" size={14} /> Mulai rekam
              </button>
            )}
            {rec && (
              <button type="button" className="btn sm rec" onClick={stopRec}>
                <span className="rec-dot" /> Berhenti · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
              </button>
            )}
            {f.audio && (
              <div className="row">
                <audio controls src={f.audio.src} />
                <button type="button" className="icon-btn" onClick={() => up('audio', null)} aria-label="Hapus rekaman"><Icon name="trash" size={14} /></button>
              </div>
            )}
            <span className="small muted">Mintalah izin narasumber sebelum merekam, lalu sebutkan nama dan tanggal di awal rekaman.</span>
          </div>
        )}

        <div className="grid2">
          <label>
            Nama (opsional)
            <input value={f.who} onChange={(e) => up('who', e.target.value)} autoComplete="name" />
          </label>
          <label>
            Sebagai
            <select value={f.role} onChange={(e) => up('role', e.target.value)}>
              <option value="warga">Warga Malatan</option>
              <option value="sesepuh">Sesepuh / tokoh</option>
              <option value="pelajar">Pelajar</option>
              <option value="kkn">Mahasiswa KKN</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </label>
        </div>
        <label>
          Kontak (opsional, tidak dipublikasikan)
          <input value={f.contact} onChange={(e) => up('contact', e.target.value)} placeholder="No. HP / email" />
        </label>

        <label className="check">
          <input type="checkbox" checked={f.consent} onChange={(e) => up('consent', e.target.checked)} />
          <span>Saya mengizinkan kiriman ini dipakai untuk arsip Atlas Malatan, dan narasumber yang saya rekam/foto sudah memberi izin.</span>
        </label>

        <button type="submit" className="btn block">Simpan kiriman</button>
      </form>

      {list.length > 0 && (
        <>
          <h3 className="section-title">Kiriman di perangkat ini ({list.length})</h3>
          <ul className="contrib-list">
            {list.map((c) => (
              <li key={c.id} className="card">
                <span className="eyebrow">{KINDS[c.kind]} · {new Date(c.created).toLocaleDateString('id-ID')}</span>
                <strong>{c.title || (c.body || '').slice(0, 60) || 'Tanpa judul'}</strong>
                <span className="small muted">
                  {c.photos.length} foto{c.audio ? ' · 1 rekaman' : ''} · {c.sent ? '✓ sudah dikirim' : 'belum dikirim'}
                </span>
                <div className="row">
                  <button type="button" className="btn sm" onClick={() => sendWA(c)}>WhatsApp</button>
                  <button type="button" className="btn ghost sm" onClick={() => sendFile(c)} title="Paket lengkap dengan foto & rekaman, untuk diimpor admin">
                    <Icon name="download" size={14} /> File paket
                  </button>
                  {CONFIG.email && (
                    <a className="btn ghost sm" href={`mailto:${CONFIG.email}?subject=${encodeURIComponent('Kiriman Atlas Malatan')}&body=${encodeURIComponent(textOf(c))}`} onClick={() => markSent(c.id)}>Email</a>
                  )}
                  <button type="button" className="icon-btn" onClick={() => remove(c.id)} aria-label="Hapus kiriman"><Icon name="trash" size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
