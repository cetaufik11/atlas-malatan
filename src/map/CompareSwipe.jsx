// Peta kedua yang ditumpuk di atas peta utama dan dipotong oleh garis geser.
// Kiri = citra pembanding (biasanya lebih lama), kanan = peta utama.
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useStore, mapRef } from '../store.js';
import { waybackUrl, DEM_URL } from './style.js';
import geo from '../data/geo.json';

export const ARCHIVE_2018 = 'archive2018';

function styleFor(source, terrain) {
  const ab = geo.archiveBounds;
  const isArchive = source === ARCHIVE_2018;
  return {
    version: 8,
    sources: {
      img: isArchive
        ? { type: 'image', url: 'media/peta-arsip-2018.jpg', coordinates: [[ab.west, ab.north], [ab.east, ab.north], [ab.east, ab.south], [ab.west, ab.south]] }
        : { type: 'raster', tiles: [waybackUrl(source.release)], tileSize: 256, maxzoom: source.maxzoom ?? 17 },
      dem: { type: 'raster-dem', tiles: [DEM_URL], tileSize: 256, maxzoom: 15, encoding: 'terrarium' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': isArchive ? '#efe6d4' : '#c9d3cf' } },
      { id: 'img', type: 'raster', source: 'img' },
    ],
    terrain: terrain ? { source: 'dem', exaggeration: useStore.getState().exaggeration } : undefined,
  };
}

export default function CompareSwipe() {
  const wrap = useRef(null);
  const el = useRef(null);
  const map2 = useRef(null);
  const tm = useStore((s) => s.timeMachine);
  const setTM = useStore((s) => s.setTimeMachine);
  const imagery = useStore((s) => s.imagery);
  const terrain = useStore((s) => s.terrain);

  const source = tm.compareIdx === -1 ? ARCHIVE_2018 : imagery[tm.compareIdx];

  useEffect(() => {
    const main = mapRef.current;
    if (!main) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: styleFor(source, terrain),
      center: main.getCenter(),
      zoom: main.getZoom(),
      pitch: main.getPitch(),
      bearing: main.getBearing(),
      interactive: false,
      attributionControl: false,
      maxPitch: 80,
    });
    map2.current = m;
    const sync = () => m.jumpTo({ center: main.getCenter(), zoom: main.getZoom(), pitch: main.getPitch(), bearing: main.getBearing() });
    main.on('move', sync);
    return () => {
      main.off('move', sync);
      m.remove();
      map2.current = null;
    };
    // Dibuat ulang bila sumber/medan berubah (murah: hanya satu lapisan).
  }, [source, terrain]);

  // Geser garis pembatas.
  const startDrag = (e) => {
    e.preventDefault();
    const rect = wrap.current.getBoundingClientRect();
    const move = (ev) => {
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      setTM({ swipePos: Math.min(0.97, Math.max(0.03, x / rect.width)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') setTM({ swipePos: Math.max(0.03, tm.swipePos - 0.05) });
    if (e.key === 'ArrowRight') setTM({ swipePos: Math.min(0.97, tm.swipePos + 0.05) });
  };

  const pct = `${(tm.swipePos * 100).toFixed(2)}%`;
  const leftLabel = tm.compareIdx === -1 ? 'Peta Arsip 2018' : imagery[tm.compareIdx]?.date.slice(0, 7);
  const rightLabel = imagery[tm.idx]?.date.slice(0, 7);

  return (
    <div ref={wrap} className="swipe">
      <div ref={el} className="swipe-map" style={{ clipPath: `inset(0 calc(100% - ${pct}) 0 0)` }} />
      <div className="swipe-bar" style={{ left: pct }}>
        <button
          type="button"
          className="swipe-handle"
          onPointerDown={startDrag}
          onKeyDown={onKey}
          role="slider"
          aria-label="Garis pembanding citra"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(tm.swipePos * 100)}
        >
          ⟷
        </button>
      </div>
      <span className="swipe-tag left">{leftLabel}</span>
      <span className="swipe-tag right">{rightLabel}</span>
    </div>
  );
}
