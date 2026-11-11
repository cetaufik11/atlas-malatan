import { useEffect, useState } from 'react';
import { MEDIA_TYPES } from '../data/meta.js';
import { Icon } from './icons.jsx';

// Media per situs: { type: 'photo'|'audio'|'video'|'doc', src, caption, credit, date, transcript? }
export default function MediaGallery({ media = [], siteName, onContribute }) {
  const [open, setOpen] = useState(null);
  const photos = media.filter((m) => m.type === 'photo');
  const others = media.filter((m) => m.type !== 'photo');

  useEffect(() => {
    if (open == null) return;
    const k = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, photos.length]);

  if (!media.length) {
    return (
      <div className="media-empty">
        <Icon name="camera" size={22} />
        <div>
          <strong>Belum ada foto atau rekaman</strong>
          <p className="small muted">Punya foto lama, foto terkini, atau rekaman cerita tentang {siteName}?</p>
          <button type="button" className="btn sm" onClick={onContribute}>Sumbangkan dokumentasi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="media">
      <h3>Dokumentasi</h3>
      {photos.length > 0 && (
        <div className="media-grid">
          {photos.map((m, i) => (
            <button key={i} type="button" className="media-thumb" onClick={() => setOpen(i)}>
              <img src={m.src} alt={m.caption || `Foto ${siteName}`} loading="lazy" />
              {m.date && <span>{m.date}</span>}
            </button>
          ))}
        </div>
      )}
      {others.map((m, i) => (
        <figure key={i} className="media-item">
          {m.type === 'audio' && <audio controls preload="none" src={m.src} />}
          {m.type === 'video' && <video controls preload="none" src={m.src} />}
          {m.type === 'doc' && (
            <a className="btn ghost sm" href={m.src} target="_blank" rel="noreferrer">
              <Icon name="archive" size={14} /> Buka dokumen
            </a>
          )}
          <figcaption>
            <span className="badge tiny">{MEDIA_TYPES[m.type]}</span> {m.caption}
            {m.credit && <span className="muted"> · {m.credit}</span>}
            {m.date && <span className="muted"> · {m.date}</span>}
          </figcaption>
          {m.transcript && (
            <details>
              <summary>Transkrip</summary>
              <p className="transcript">{m.transcript}</p>
            </details>
          )}
        </figure>
      ))}

      {open != null && photos[open] && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Penampil foto" onClick={() => setOpen(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={photos[open].src} alt={photos[open].caption || ''} />
            <figcaption>
              {photos[open].caption}
              {photos[open].credit && <span className="muted"> · {photos[open].credit}</span>}
              {photos[open].date && <span className="muted"> · {photos[open].date}</span>}
            </figcaption>
          </figure>
          <button type="button" className="icon-btn lb-close" onClick={() => setOpen(null)} aria-label="Tutup">
            <Icon name="close" />
          </button>
        </div>
      )}
    </div>
  );
}
