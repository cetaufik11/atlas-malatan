import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, mapRef, useFilteredSites } from '../store.js';
import mlcontour from 'maplibre-contour';
import { buildStyle, BASEMAPS, DEM_URL, dataGeoJSON, skyFor } from './style.js';
import { sunPosition, wibDate } from '../lib/sun.js';
import { registerOverlay } from './overlayTiles.js';
import { setArchiveCoords } from './archiveTiles.js';
import { CATEGORIES, STATUSES, CENTER } from '../data/meta.js';
import { siteIconSvg } from '../components/icons.jsx';

// Garis kontur dihitung di browser (web worker) dari ubin DEM yang sama dengan medan 3D.
const demSource = new mlcontour.DemSource({ url: DEM_URL, encoding: 'terrarium', maxzoom: 14, worker: true, cacheSize: 120, timeoutMs: 20000 });
demSource.setupMaplibre(maplibregl);
const CONTOUR_TILES = demSource.contourProtocolUrl({
  // zoom: [interval garis tipis, interval garis tebal] dalam meter
  thresholds: { 11: [200, 1000], 12: [100, 500], 13: [50, 250], 14: [25, 100], 15: [10, 50], 16: [5, 25] },
  elevationKey: 'ele',
  levelKey: 'level',
  contourLayer: 'contours',
});

// Lebih banyak unduhan ubin paralel: citra, label, dan elevasi berasal dari server berbeda.
maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS = 32;

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
  const archiveCoordsRef = useRef(useStore.getState().geo.archiveCoords);

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
  const geo = useStore((s) => s.geo);
  const overlay = useStore((s) => s.overlay);
  const overlayOpacity = useStore((s) => s.overlayOpacity);
  const sun = useStore((s) => s.sun);
  const tracks = useStore((s) => s.tracks);
  const recording = useStore((s) => s.recording);
  const imports = useStore((s) => s.imports);
  const pickedPoint = useStore((s) => s.pickedPoint);
  const visible = useFilteredSites();

  // ---------- Buat peta sekali ----------
  useEffect(() => {
    const fromHash = readHash();
    const map = new maplibregl.Map({
      container: el.current,
      style: buildStyle({
        basemap,
        imagery,
        geo: useStore.getState().geo,
        contourTiles: CONTOUR_TILES,
        archiveTiles: setArchiveCoords(useStore.getState().geo.archiveCoords),
        terrain: useStore.getState().terrain ? useStore.getState().exaggeration : null,
      }),
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

    // Ubin yang gagal dimuat (sinyal putus-nyambung di lapangan) cukup jadi peringatan, bukan error.
    map.on('error', (e) => console.warn('[peta]', e?.error?.message || e?.error || e));

    // Penangkal bug MapLibre 4.x: setelah easeTo/flyTo dengan medan aktif, _elevationFreeze
    // tidak pernah dikembalikan ke false. Bila animasi selesai sebelum ubin elevasi termuat,
    // kamera terkunci di ketinggian 0 m — di lereng Sindoro (±2.000 m) itu berarti kamera
    // berada di dalam gunung (layar hitam, penanda hilang). Cairkan lagi tiap gerakan selesai.
    map.on('moveend', () => {
      if (map.terrain && !map.isMoving() && map._elevationFreeze) {
        map._elevationFreeze = false;
        map.triggerRepaint();
      }
    });

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
      if (st.tool === 'viewshed') useStore.setState({ pickedPoint: [e.lngLat.lng, e.lngLat.lat] });
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
      const wasOn = !!map.getTerrain();
      if (terrain) {
        // Hindari membuat ulang medan bila tidak ada yang berubah (mis. saat pertama siap).
        if (!wasOn || map.getTerrain().exaggeration !== exaggeration) map.setTerrain({ source: 'dem', exaggeration });
        map._elevationFreeze = false; // lihat catatan penangkal bug di atas
        if (!wasOn && map.getPitch() < 20) {
          // Jangan langsung memiringkan kamera: selama ubin elevasi belum termuat, MapLibre mengira
          // kamera berada di bawah tanah lalu mengubah zoom & kemiringan sendiri (bertabrakan
          // dengan animasi). Tunggu peta 'idle' (ubin elevasi siap), baru miringkan.
          let done = false;
          const tilt = () => {
            if (done || !map.getTerrain()) return;
            done = true;
            map._elevationFreeze = false;
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            map.easeTo({ pitch: 55, duration: reduce ? 0 : 900 });
          };
          map.once('idle', tilt);
          setTimeout(tilt, 3000); // cadangan bila sinyal lambat
        }
      } else if (wasOn) {
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
      map.setLayoutProperty('hillshade', 'visibility', v(layers.hillshade || sun.on));
      ['contours', 'contour-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.contours)));
      ['tracks-casing', 'tracks-line'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.tracks)));
      ['imports-fill', 'imports-line', 'imports-pt'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.imports)));
      map.setLayoutProperty('archive2018', 'visibility', v(layers.archive2018));
      ['field-pts', 'field-labels'].forEach((id) => map.setLayoutProperty(id, 'visibility', v(layers.fieldPoints)));
    });
  }, [layers, sun.on, isReady]);

  useEffect(() => {
    whenReady((map) => map.setPaintProperty('archive2018', 'raster-opacity', archiveOpacity));
  }, [archiveOpacity, isReady]);

  // ---------- Geometri (bisa dikalibrasi admin) ----------
  useEffect(() => {
    whenReady((map) => {
      const d = dataGeoJSON(geo);
      map.getSource('boundary')?.setData(d.boundary);
      map.getSource('roads')?.setData(d.roads);
      map.getSource('rivers')?.setData(d.rivers);
      // Setel ulang ubin peta arsip hanya bila sudutnya benar-benar berubah (setTiles membatalkan
      // permintaan yang sedang berjalan dan memuat ulang semuanya).
      if (geo.archiveCoords !== archiveCoordsRef.current) {
        archiveCoordsRef.current = geo.archiveCoords;
        map.getSource('archive2018')?.setTiles([setArchiveCoords(geo.archiveCoords)]);
      }
    });
  }, [geo, isReady]);

  // ---------- Overlay hasil analisis (lereng, viewshed, perubahan lahan) ----------
  useEffect(() => {
    whenReady((map) => {
      if (map.getLayer('analysis')) map.removeLayer('analysis');
      if (map.getSource('analysis')) map.removeSource('analysis');
      const source = registerOverlay(overlay);
      if (!source) return;
      map.addSource('analysis', source);
      map.addLayer(
        {
          id: 'analysis',
          type: 'raster',
          source: 'analysis',
          paint: { 'raster-opacity': useStore.getState().overlayOpacity, 'raster-fade-duration': 0, 'raster-resampling': overlay.smooth ? 'linear' : 'nearest' },
        },
        'labels',
      );
    });
  }, [overlay, isReady]);

  useEffect(() => {
    whenReady((map) => map.getLayer('analysis') && map.setPaintProperty('analysis', 'raster-opacity', overlayOpacity));
  }, [overlayOpacity, overlay, isReady]);

  useEffect(() => {
    whenReady((map) =>
      map.getSource('pick')?.setData(
        pickedPoint && overlay?.kind === 'viewshed'
          ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pickedPoint } }
          : { type: 'FeatureCollection', features: [] },
      ),
    );
  }, [pickedPoint, overlay, isReady]);

  // ---------- Simulasi matahari ----------
  useEffect(() => {
    whenReady((map) => {
      const rasters = [...ALL_BASEMAP_LAYERS, ...imagery.map((im) => 'wb-' + im.release)];
      if (!sun.on) {
        rasters.forEach((id) => map.setPaintProperty(id, 'raster-brightness-max', 1));
        map.setPaintProperty('hillshade', 'hillshade-illumination-direction', 335);
        map.setPaintProperty('hillshade', 'hillshade-exaggeration', 0.55);
        map.setSky(skyFor('day'));
        return;
      }
      const [lng, lat] = geo.boundary[0];
      const { altitude, azimuth } = sunPosition(wibDate(sun.date, sun.hour), lat, lng);
      const day = Math.min(1, Math.max(0, (altitude + 6) / 24));
      rasters.forEach((id) => map.setPaintProperty(id, 'raster-brightness-max', 0.2 + 0.8 * day));
      map.setPaintProperty('hillshade', 'hillshade-illumination-direction', azimuth);
      // Matahari rendah → bayangan lereng lebih tegas.
      map.setPaintProperty('hillshade', 'hillshade-exaggeration', altitude > 0 ? Math.min(0.95, Math.max(0.3, 0.95 - (altitude / 90) * 0.6)) : 0.15);
      map.setSky(skyFor(altitude < -4 ? 'night' : altitude < 12 ? 'golden' : 'day'));
    });
  }, [sun, geo, imagery, isReady]);

  // ---------- Jejak GPS ----------
  useEffect(() => {
    whenReady((map) => {
      const toLine = (pts, live) => ({ type: 'Feature', properties: { live }, geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) } });
      const features = tracks.filter((t) => t.points.length > 1).map((t) => toLine(t.points, false));
      if (recording?.points.length > 1) features.push(toLine(recording.points, true));
      map.getSource('tracks')?.setData({ type: 'FeatureCollection', features });
    });
  }, [tracks, recording, isReady]);

  // ---------- Lapisan impor (GPX/KML/GeoJSON) ----------
  useEffect(() => {
    whenReady((map) =>
      map.getSource('imports')?.setData({
        type: 'FeatureCollection',
        features: imports.filter((l) => l.visible !== false).flatMap((l) => l.data.features.map((f) => ({ ...f, properties: { ...f.properties, _color: l.color } }))),
      }),
    );
  }, [imports, isReady]);

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
      map.getCanvas().style.cursor = ['line', 'area', 'viewshed', 'quiz'].includes(tool) ? 'crosshair' : '';
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
