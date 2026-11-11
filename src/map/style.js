// Gaya peta MapLibre: semua peta dasar dimuat sekaligus, lalu ditampilkan/disembunyikan
// lewat visibilitas. Dengan begitu lapisan data tidak hilang saat ganti peta dasar.
import geo from '../data/geo.json';

export const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const waybackUrl = (release) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`;

export const BASEMAPS = {
  satelit: { label: 'Satelit', layers: ['bm-sat'] },
  topo: { label: 'Topografi', layers: ['bm-topo'] },
  terang: { label: 'Jalan', layers: ['bm-light'] },
  gelap: { label: 'Malam', layers: ['bm-dark'] },
};

const line = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });

export function dataGeoJSON() {
  const ring = [...geo.boundary, geo.boundary[0]];
  return {
    boundary: { type: 'Feature', properties: { name: 'Dusun Malatan' }, geometry: { type: 'Polygon', coordinates: [ring] } },
    roads: {
      type: 'FeatureCollection',
      features: [
        { ...line(geo.mainRoad), properties: { kind: 'utama' } },
        ...geo.streets.map((s) => ({ ...line(s), properties: { kind: 'dusun' } })),
      ],
    },
    rivers: { type: 'FeatureCollection', features: geo.rivers.map(line) },
  };
}

const empty = { type: 'FeatureCollection', features: [] };

export function buildStyle({ basemap, imagery }) {
  const d = dataGeoJSON();
  const ab = geo.archiveBounds;
  const vis = (id) => (BASEMAPS[basemap]?.layers.includes(id) ? 'visible' : 'none');
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    // Langit & kabut atmosfer untuk tampilan 3D miring.
    sky: {
      'sky-color': '#9cc3e4',
      'horizon-color': '#f1e3c8',
      'fog-color': '#e8dcc6',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.85,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 0.6],
    },
    sources: {
      // Esri hanya punya z≤18 di Malatan; di atasnya MapLibre memperbesar z18.
      sat: { type: 'raster', tiles: [SAT_URL], tileSize: 256, maxzoom: 18, attribution: 'Citra © Esri, Maxar, Earthstar Geographics' },
      topo: {
        type: 'raster',
        tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
        tileSize: 256,
        maxzoom: 17,
        attribution: '© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)',
      },
      light: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">Kontributor OpenStreetMap</a>',
      },
      dark: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 16,
        attribution: 'Peta dasar © Esri, HERE, Garmin, © OpenStreetMap',
      },
      labels: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
      },
      ...Object.fromEntries(
        imagery.map((im) => [
          `wb-${im.release}`,
          { type: 'raster', tiles: [waybackUrl(im.release)], tileSize: 256, maxzoom: im.maxzoom ?? 17, attribution: 'Arsip citra: Esri World Imagery Wayback' },
        ]),
      ),
      dem: { type: 'raster-dem', tiles: [DEM_URL], tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: 'Elevasi: Mapzen Terrain Tiles (AWS Open Data)' },
      hillshadeDem: { type: 'raster-dem', tiles: [DEM_URL], tileSize: 256, maxzoom: 15, encoding: 'terrarium' },
      archive2018: {
        type: 'image',
        url: 'media/peta-arsip-2018.jpg',
        coordinates: [[ab.west, ab.north], [ab.east, ab.north], [ab.east, ab.south], [ab.west, ab.south]],
      },
      boundary: { type: 'geojson', data: d.boundary },
      roads: { type: 'geojson', data: d.roads },
      rivers: { type: 'geojson', data: d.rivers },
      measure: { type: 'geojson', data: empty },
      tourPath: { type: 'geojson', data: empty },
      fieldPoints: { type: 'geojson', data: empty },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#c9d3cf' } },
      { id: 'bm-sat', type: 'raster', source: 'sat', layout: { visibility: vis('bm-sat') } },
      { id: 'bm-topo', type: 'raster', source: 'topo', layout: { visibility: vis('bm-topo') } },
      { id: 'bm-light', type: 'raster', source: 'light', layout: { visibility: vis('bm-light') } },
      { id: 'bm-dark', type: 'raster', source: 'dark', layout: { visibility: vis('bm-dark') } },
      ...imagery.map((im) => ({
        id: `wb-${im.release}`,
        type: 'raster',
        source: `wb-${im.release}`,
        layout: { visibility: 'none' },
        paint: { 'raster-fade-duration': 150 },
      })),
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshadeDem',
        layout: { visibility: 'none' },
        paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#2b2016', 'hillshade-highlight-color': '#fff7e6' },
      },
      { id: 'archive2018', type: 'raster', source: 'archive2018', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.75 } },
      { id: 'labels', type: 'raster', source: 'labels', layout: { visibility: basemap === 'satelit' ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.85 } },
      { id: 'boundary-fill', type: 'fill', source: 'boundary', paint: { 'fill-color': '#c8673f', 'fill-opacity': 0.07 } },
      { id: 'boundary-glow', type: 'line', source: 'boundary', paint: { 'line-color': '#1d1a16', 'line-width': 6, 'line-opacity': 0.35, 'line-blur': 3 } },
      { id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#f2b48f', 'line-width': 2.2, 'line-dasharray': [3, 2] } },
      { id: 'rivers', type: 'line', source: 'rivers', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#6ec3f4', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2, 19, 6], 'line-opacity': 0.9 } },
      {
        id: 'roads-casing',
        type: 'line',
        source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1d1a16', 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3, 19, ['match', ['get', 'kind'], 'utama', 11, 7]] },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'kind'], 'utama', '#f6d27a', '#efe6d4'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.5, 19, ['match', ['get', 'kind'], 'utama', 7, 4]],
        },
      },
      { id: 'tour-path', type: 'line', source: 'tourPath', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffb347', 'line-width': 4, 'line-dasharray': [1, 1.5] } },
      { id: 'measure-fill', type: 'fill', source: 'measure', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#ffb347', 'fill-opacity': 0.2 } },
      { id: 'measure-line', type: 'line', source: 'measure', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#ffb347', 'line-width': 3 } },
      { id: 'measure-pts', type: 'circle', source: 'measure', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#1d1a16', 'circle-stroke-color': '#ffb347', 'circle-stroke-width': 2.5 } },
      { id: 'field-pts', type: 'circle', source: 'fieldPoints', paint: { 'circle-radius': 7, 'circle-color': '#d19a1c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
      {
        id: 'field-labels',
        type: 'symbol',
        source: 'fieldPoints',
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
        paint: { 'text-color': '#fff', 'text-halo-color': '#1d1a16', 'text-halo-width': 1.5 },
      },
    ],
  };
}
