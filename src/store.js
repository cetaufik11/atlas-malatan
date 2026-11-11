import { useMemo } from 'react';
import { create } from 'zustand';
import baseSites from './data/sites.json';
import imagery from './data/imagery.json';
import baseGeoRaw from './data/geo.json';
import { localPref, setLocalPref } from './lib/storage.js';

/** geo.json → bentuk yang dipakai aplikasi (peta arsip disimpan sebagai 4 sudut agar bisa dikalibrasi). */
export function normalizeGeo(g) {
  const ab = g.archiveBounds;
  return {
    boundary: g.boundary,
    mainRoad: g.mainRoad,
    streets: g.streets,
    rivers: g.rivers,
    archiveCoords: g.archiveCoords || [[ab.west, ab.north], [ab.east, ab.north], [ab.east, ab.south], [ab.west, ab.south]],
  };
}
export const baseGeo = normalizeGeo(baseGeoRaw);

// Peta MapLibre disimpan di luar state agar tidak memicu render ulang.
export const mapRef = { current: null };

const initialTheme = localPref('theme', 'auto');

export const useStore = create((set, get) => ({
  // ---- Data ----
  sites: baseSites,
  sitesEdited: false,
  setSites: (sites, edited = true) => set({ sites, sitesEdited: edited }),

  // Batas, jalan, sungai, posisi peta arsip (bisa dikalibrasi admin).
  geo: baseGeo,
  geoEdited: false,
  setGeo: (geo, edited = true) => set({ geo, geoEdited: edited }),

  selectedId: null,
  select: (id) => {
    set({ selectedId: id });
    if (id) get().markVisited(id);
  },

  // ---- Tata letak ----
  tab: 'situs',
  setTab: (tab) => set({ tab, sheetOpen: true }),
  sheetOpen: true,
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),

  theme: initialTheme,
  setTheme: (theme) => {
    setLocalPref('theme', theme);
    set({ theme });
  },

  // ---- Peta ----
  basemap: localPref('basemap', 'satelit'),
  setBasemap: (basemap) => {
    setLocalPref('basemap', basemap);
    set({ basemap });
  },
  terrain: localPref('terrain', true),
  setTerrain: (terrain) => {
    setLocalPref('terrain', terrain);
    set({ terrain });
  },
  exaggeration: 1.6,
  setExaggeration: (exaggeration) => set({ exaggeration }),

  layers: {
    boundary: true,
    roads: true,
    rivers: true,
    hillshade: false,
    contours: false,
    labels: true,
    archive2018: false,
    fieldPoints: true,
    tracks: true,
    imports: true,
  },
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  archiveOpacity: 0.75,
  setArchiveOpacity: (archiveOpacity) => set({ archiveOpacity }),

  // ---- Filter situs ----
  filters: { category: 'all', status: 'all', query: '' },
  setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),

  // ---- Mesin waktu ----
  imagery,
  timeMachine: { open: false, idx: imagery.length - 1, swipe: false, compareIdx: 0, swipePos: 0.5 },
  setTimeMachine: (patch) => set((s) => ({ timeMachine: { ...s.timeMachine, ...patch } })),

  // ---- Alat ukur ----
  tool: null, // 'line' | 'area' | 'capture'
  measurePts: [],
  setTool: (tool) => set({ tool, measurePts: [] }),
  addMeasurePt: (p) => set((s) => ({ measurePts: [...s.measurePts, p] })),
  undoMeasurePt: () => set((s) => ({ measurePts: s.measurePts.slice(0, -1) })),
  clearMeasure: () => set({ measurePts: [] }),
  quizClick: null,
  pickedPoint: null, // titik yang diketuk saat tool = 'viewshed'

  // ---- Analisis ----
  overlay: null, // { kind, url, coordinates, ... } gambar hasil analisis di atas peta
  setOverlay: (overlay) => set({ overlay }),
  overlayOpacity: 0.7,
  setOverlayOpacity: (overlayOpacity) => set({ overlayOpacity }),
  sun: { on: false, date: new Date().toISOString().slice(0, 10), hour: 9 },
  setSun: (patch) => set((s) => ({ sun: { ...s.sun, ...patch } })),

  // ---- Lapangan: jejak GPS & lapisan impor ----
  tracks: [],
  setTracks: (tracks) => set({ tracks }),
  recording: null, // { started, points: [{lng,lat,ele,t,acc}] }
  setRecording: (recording) => set({ recording }),
  imports: [],
  setImports: (imports) => set({ imports }),

  // ---- Kalibrasi peta arsip (seret sudut) ----
  calibrating: false,
  setCalibrating: (calibrating) => set({ calibrating }),

  // ---- Lokasi pengguna (GPS) ----
  userPos: null, // { lng, lat, acc, heading }
  setUserPos: (userPos) => set({ userPos }),
  tracking: false,
  setTracking: (tracking) => set({ tracking }),

  // ---- Tur ----
  tour: null, // { id, step, playing, voice }
  setTour: (tour) => set({ tour }),

  // ---- Titik temuan lapangan ----
  fieldPoints: [],
  setFieldPoints: (fieldPoints) => set({ fieldPoints }),

  // ---- Progres belajar ----
  progress: { visited: [], quizBest: 0, badges: [] },
  setProgress: (progress) => set({ progress }),
  markVisited: (id) => {
    const p = get().progress;
    if (p.visited.includes(id)) return;
    set({ progress: { ...p, visited: [...p.visited, id] } });
  },

  // ---- Mode admin (penyunting data) ----
  adminOpen: typeof location !== 'undefined' && new URLSearchParams(location.search).has('admin'),
  setAdminOpen: (adminOpen) => set({ adminOpen }),

  // ---- Notifikasi singkat ----
  toast: null,
  notify: (text, kind = 'info') => {
    const id = Date.now();
    set({ toast: { text, kind, id } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3800);
  },
}));

export function filterSites(sites, { category, status, query }) {
  const q = query.trim().toLowerCase();
  return sites.filter(
    (site) =>
      (category === 'all' || site.category === category) &&
      (status === 'all' || site.status === status) &&
      (!q || `${site.name} ${site.subtitle} ${site.description} ${(site.tags || []).join(' ')}`.toLowerCase().includes(q)),
  );
}

export function useFilteredSites() {
  const sites = useStore((s) => s.sites);
  const filters = useStore((s) => s.filters);
  return useMemo(() => filterSites(sites, filters), [sites, filters]);
}

export function flyToSite(site, opts = {}) {
  const map = mapRef.current;
  if (!map || !site) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  map.flyTo({
    center: [site.lng, site.lat],
    zoom: opts.zoom ?? 18.3,
    pitch: opts.pitch ?? (useStore.getState().terrain ? 52 : 0),
    bearing: opts.bearing ?? map.getBearing(),
    duration: reduce ? 0 : opts.duration ?? 2200,
    essential: true,
    // Jangan kirim `padding: undefined`: MapLibre akan mencoba membaca padding.top lalu gagal.
    ...(opts.padding ? { padding: opts.padding } : {}),
  });
}
