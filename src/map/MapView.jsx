import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, mapRef, useFilteredSites } from '../store.js';
import { buildStyle, BASEMAPS } from './style.js';
import { CATEGORIES, STATUSES, CENTER } from '../data/meta.js';
import { siteIconSvg } from '../components/icons.jsx';

const ALL_BASEMAP_LAYERS = Object.values(BASEMAPS).flatMap((b) => b.layers);

function readHash() {
  const m = location.hash.match(/^#@(-?[\d.]+),(-?[\d.]+),([\d.]+)z(?:,([\d.]+)p)?(?:,(-?[\d.]+)b)?/);
  if (!m) return null;
  return { center: [+m[2], +m[1]], zoom: +m[3], pitch: +(m[4] || 0), bearing: +(m[5] || 0) };
}

export default function MapView() {
  const el = useRef(null);
  const markers = useRef({});
  const userMarker = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const basemap = useStore((s) => s.basemap);
  const terrain = useStore((s) => s.terrain);
  const exaggeration = useStore((s) => s.exaggeration);
  const layers = useStore((s) => s.layers);
  const archiveOpacity = useStore((s) => s.archiveOpacity);
  const timeMachine = useStore((s) => s.timeMachine);
  const imagery = useStore((s) => s.imagery);
  const selectedId = useStore((s) => s.selectedId);
  const tool = useStore((s) => s.tool);
  const measurePts = useStore((s) => s.measurePts);
  const userPos = useStore((s) => s.userPos);
  const fieldPoints = useStore((s) => s.fieldPoints);
  const tour = useStore((s) => s.tour);
  const sites = useStore((s) => s.sites);
  const visible = useFilteredSites();

  // ---------- Buat peta sekali ----------
  useEffect(() => {
    const fromHash = readHash();
    const map = new maplibregl.Map({
      container: el.current,
      style: buildStyle({ basemap, imagery }),
      center: fromHash?.center ?? CENTER,
      zoom: fromHash?.zoom ?? 16.6,
      pitch: fromHash?.pitch ?? (terrain ? 55 : 0),
      bearing: fromHash?.bearing ?? -12,
      maxPitch: 80,
      minZoom: 11,
      maxZoom: 20.5,
      attributionControl: { compact: true },
      preserveDrawingBuffer: true, // untuk ekspor gambar/cetak
      locale: {
        'NavigationControl.ZoomIn': 'Perbesar',
        'NavigationControl.ZoomOut': 'Perkecil',
        'NavigationControl.ResetBearing': 'Kembalikan arah utara',
        'ScaleControl.Meters': 'm',
        'ScaleControl.Kilometers': 'km',
      },
    });
    mapRef.current = map;
    window.__atlasMap = map; // untuk debugging di konsol browser
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');

    // 'style.load' muncul begitu gaya terbaca, tanpa menunggu semua ubin ('load').
    // Semua efek di bawah bergantung pada isReady agar berjalan ulang dengan nilai terbaru.
    map.on('style.load', () => setIsReady(true));

    // Simpan posisi kamera di URL (bisa dibagikan).
    let t;
    map.on('moveend', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const c = map.getCenter();
        const h = `#@${c.lat.toFixed(6)},${c.lng.toFixed(6)},${map.getZoom().toFixed(2)}z,${map.getPitch().toFixed(0)}p,${map.getBearing().toFixed(0)}b`;
        history.replaceState(null, '', location.pathname + location.search + h);
      }, 400);
    });

    map.on('click', (e) => {
      const st = useStore.getState();
      if (st.tool === 'line' || st.tool === 'area') st.addMeasurePt([e.lngLat.lng, e.lngLat.lat]);
      if (st.tool === 'quiz') useStore.setState({ quizClick: [e.lngLat.lng, e.lngLat.lat] });
    });
    map.on('dblclick', (e) => {
      if (useStore.getState().tool) e.preventDefault();
    });

    return () => {
      setIsReady(false);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whenReady = (fn) => {
    const map = mapRef.current;
    if (map && isReady) fn(map);
  };

  // ---------- Peta dasar ----------
  useEffect(() => {
    whenReady((map) => {
      for (const id of ALL_BASEMAP_LAYERS) map.setLayoutProperty(id, 'visibility', BASEMAPS[basemap].layers.includes(id) ? 'visible' : 'none');
      map.setLayoutProperty('labels', 'visibility', basemap === 'satelit' && layers.labels && !timeMachine.open ? 'visible' : 'none');
    });
  }, [basemap, layers.labels, timeMachine.open, isReady]);

  // ---------- Medan 3D ----------
  useEffect(() => {
    whenReady((map) => {
      if (terrain) {
        map.setTerrain({ source: 'dem', exaggeration });
        if (map.getPitch() < 20) map.easeTo({ pitch: 55, duration: 900 });
      } else {
        map.setTerrain(null);
        map.easeTo({ pitch: 0, duration: 700 });
      }
    });
  }, [terrain, exaggeration, isReady]);

  // ---------- Lapisan tematik ----------
  useEffect(() => {
    whenReady((map) => {
      const v = (on) => (on ? 'visible' : 'none');
      ['boundary-fill', 'boundary-glow', 'boundary-line'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.boundary)));
      ['roads', 'roads-casing'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.roads)));
      map.setLayoutProperty('rivers', 'visibility', v(layers.rivers));
      map.setLayoutProperty('hillshade', 'visibility', v(layers.hillshade));
      map.setLayoutProperty('archive2018', 'visibility', v(layers.archive2018));
      ['field-pts', 'field-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.fieldPoints)));
    });
  }, [layers, isReady]);

  useEffect(() => {
    whenReady((map) => map.setPaintProperty('archive2018', 'raster-opacity', archiveOpacity));
  }, [archiveOpacity, isReady]);

  // ---------- Mesin waktu (citra historis) ----------
  useEffect(() => {
    whenReady((map) => {
      imagery.forEach((im, i) =>
        map.setLayoutProperty(`wb-${im.release}`, 'visibility', timeMachine.open && i === timeMachine.idx ? 'visible' : 'none'),
      );
    });
  }, [timeMachine.open, timeMachine.idx, imagery, isReady]);

  // ---------- Penanda situs (HTML, bisa difokus keyboard) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = markers.current;
    const seen = new Set();
    for (const site of sites) {
      seen.add(site.id);
      let m = current[site.id];
      const cat = CATEGORIES[site.category] || { color: '#888', label: site.category };
      const st = STATUSES[site.status] || STATUSES.draf;
      const html = `
        <span class="pin-dot" style="--c:${cat.color}">${siteIconSvg(site.icon)}</span>
        <span class="pin-label">${escapeHtml(site.name)}</span>
        <span class="pin-status" style="--s:${st.color}" title="${st.label}"></span>`;
      if (!m) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'pin';
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          if (useStore.getState().tool) return;
          useStore.getState().select(node.dataset.id);
        });
        // Di lereng, MapLibre sering salah menganggap penanda "tertutup medan" lalu memudarkannya.
        m = new maplibregl.Marker({ element: node, anchor: 'bottom', opacity: '1', opacityWhenCovered: '1' }).setLngLat([site.lng, site.lat]).addTo(map);
        current[site.id] = m;
      } else {
        m.setLngLat([site.lng, site.lat]);
      }
      const node = m.getElement();
      node.dataset.id = site.id;
      node.setAttribute('aria-label', `${site.name} — ${st.label}`);
      node.innerHTML = html;
    }
    for (const id of Object.keys(current)) {
      if (!seen.has(id)) {
        current[id].remove();
        delete current[id];
      }
    }
  }, [sites]);

  // Filter & pilihan.
  useEffect(() => {
    const ids = new Set(visible.map((s) => s.id));
    for (const [id, m] of Object.entries(markers.current)) {
      const node = m.getElement();
      node.classList.toggle('is-hidden', !ids.has(id));
      node.classList.toggle('is-active', id === selectedId);
      node.style.zIndex = id === selectedId ? 5 : '';
    }
  }, [visible, selectedId]);

  // Label penanda mengikuti zoom.
  useEffect(() => {
    whenReady((map) => {
      const upd = () => el.current?.classList.toggle('show-pin-labels', map.getZoom() >= 17.2);
      upd();
      map.on('zoom', upd);
    });
  }, [isReady]);

  // ---------- Pengukuran ----------
  useEffect(() => {
    whenReady((map) => {
      const pts = measurePts;
      const features = pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
      if (tool === 'area' && pts.length >= 3) {
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } });
      } else if (pts.length >= 2) {
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
      }
      map.getSource('measure')?.setData({ type: 'FeatureCollection', features });
      map.getCanvas().style.cursor = tool === 'line' || tool === 'area' ? 'crosshair' : '';
    });
  }, [measurePts, tool, isReady]);

  // ---------- Titik temuan lapangan ----------
  useEffect(() => {
    whenReady((map) =>
      map.getSource('fieldPoints')?.setData({
        type: 'FeatureCollection',
        features: fieldPoints.map((p) => ({
          type: 'Feature',
          properties: { label: p.label },
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
      }),
    );
  }, [fieldPoints, isReady]);

  // ---------- Jalur tur ----------
  useEffect(() => {
    whenReady((map) => {
      let data = { type: 'FeatureCollection', features: [] };
      if (tour?.stops) {
        const coords = tour.stops.map((id) => sites.find((s) => s.id === id)).filter(Boolean).map((s) => [s.lng, s.lat]);
        if (coords.length > 1) data = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
      }
      map.getSource('tourPath')?.setData(data);
    });
  }, [tour?.stops, sites, isReady]);

  // ---------- Posisi pengguna ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userPos) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      const node = document.createElement('div');
      node.className = 'me';
      node.innerHTML = '<span class="me-cone"></span><span class="me-dot"></span>';
      userMarker.current = new maplibregl.Marker({ element: node, rotationAlignment: 'map', opacityWhenCovered: '1' }).setLngLat([userPos.lng, userPos.lat]).addTo(map);
    }
    userMarker.current.setLngLat([userPos.lng, userPos.lat]);
    const cone = userMarker.current.getElement().querySelector('.me-cone');
    if (userPos.heading != null && !Number.isNaN(userPos.heading)) {
      cone.style.display = 'block';
      cone.style.transform = `rotate(${userPos.heading}deg)`;
    } else cone.style.display = 'none';
  }, [userPos]);

  return <div ref={el} className="map" role="application" aria-label="Peta interaktif Dusun Malatan" />;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
