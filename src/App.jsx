import { useEffect, useState } from 'react';
import { useStore, flyToSite } from './store.js';
import { db } from './lib/storage.js';
import MapView from './map/MapView.jsx';
import CompareSwipe from './map/CompareSwipe.jsx';
import MapControls from './components/MapControls.jsx';
import TimeMachine from './components/TimeMachine.jsx';
import SiteDetail from './components/SiteDetail.jsx';
import Toast from './components/Toast.jsx';
import { Icon } from './components/icons.jsx';
import SitesPanel from './panels/SitesPanel.jsx';
import ArchivePanel from './panels/ArchivePanel.jsx';
import HeritagePanel from './panels/HeritagePanel.jsx';
import ToursPanel from './panels/ToursPanel.jsx';
import LearnPanel from './panels/LearnPanel.jsx';
import ContributePanel from './panels/ContributePanel.jsx';
import ToolsPanel from './panels/ToolsPanel.jsx';
import AnalysisPanel from './panels/AnalysisPanel.jsx';
import CalibrateHud from './components/CalibrateHud.jsx';
import MeasureHud from './components/MeasureHud.jsx';
import TourHud from './components/TourHud.jsx';

import Admin from './panels/Admin.jsx';

const TABS = [
  { id: 'situs', label: 'Situs', icon: 'pin', Panel: SitesPanel },
  { id: 'arsip', label: 'Arsip', icon: 'archive', Panel: ArchivePanel },
  { id: 'cagar', label: 'Cagar Budaya', icon: 'shield', Panel: HeritagePanel },
  { id: 'analisis', label: 'Analisis', icon: 'mountain', Panel: AnalysisPanel },
  { id: 'tur', label: 'Tur', icon: 'route', Panel: ToursPanel },
  { id: 'belajar', label: 'Belajar', icon: 'school', Panel: LearnPanel },
  { id: 'kirim', label: 'Kirim Cerita', icon: 'send', Panel: ContributePanel },
  { id: 'alat', label: 'Alat', icon: 'tools', Panel: ToolsPanel },
];

export default function App() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const sheetOpen = useStore((s) => s.sheetOpen);
  const setSheetOpen = useStore((s) => s.setSheetOpen);
  const theme = useStore((s) => s.theme);
  const tm = useStore((s) => s.timeMachine);
  const selectedId = useStore((s) => s.selectedId);
  const admin = useStore((s) => s.adminOpen);
  const setAdmin = useStore((s) => s.setAdminOpen);
  const [online, setOnline] = useState(navigator.onLine);

  // Tema.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  // Muat data lokal (suntingan admin, titik lapangan, progres).
  useEffect(() => {
    (async () => {
      const st = useStore.getState();
      const overrides = await db.siteOverrides();
      if (Array.isArray(overrides) && overrides.length) st.setSites(overrides, true);
      const geo = await db.geoOverrides();
      if (geo?.boundary && geo?.archiveCoords) st.setGeo(geo, true);
      st.setTracks(await db.tracks());
      st.setImports(await db.imports());
      st.setFieldPoints(await db.fieldPoints());
      st.setProgress(await db.progress());
      // Tautan langsung ?situs=id (dipakai QR plang lapangan).
      const id = new URLSearchParams(location.search).get('situs');
      const site = useStore.getState().sites.find((s) => s.id === id);
      if (site) {
        st.select(site.id);
        setTimeout(() => flyToSite(site), 600);
      }
    })();
  }, []);

  // Simpan progres saat berubah.
  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.progress !== prev.progress) db.saveProgress(s.progress);
  }), []);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Pintasan keyboard: Esc menutup detail, angka 1–8 pindah tab.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') useStore.getState().select(null);
      const n = Number(e.key);
      if (n >= 1 && n <= TABS.length && !e.ctrlKey && !e.metaKey && !e.altKey) setTab(TABS[n - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTab]);

  const Active = TABS.find((t) => t.id === tab)?.Panel ?? SitesPanel;

  return (
    <div className={`app ${sheetOpen ? 'sheet-open' : 'sheet-closed'} ${selectedId ? 'has-detail' : ''}`}>
      <a className="skip" href="#panel">Lompat ke panel</a>
      <MapView />
      {tm.open && tm.swipe && <CompareSwipe />}

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="30" height="30"><path d="M8 48 L24 22 L33 36 L41 26 L56 48 Z" fill="currentColor" /><circle cx="44" cy="16" r="5" fill="var(--gold)" /></svg>
          </span>
          <div>
            <h1>Atlas Malatan</h1>
            <p>Dusun Malatan · Bansari · Temanggung</p>
          </div>
        </div>
        {!online && (
          <span className="chip warn" role="status">
            <Icon name="wifiOff" size={14} /> Offline
          </span>
        )}
      </header>

      <nav className="rail" aria-label="Menu utama">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={`rail-btn ${tab === t.id ? 'on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => (tab === t.id ? setSheetOpen(!sheetOpen) : setTab(t.id))}
            title={`${t.label} (${i + 1})`}
          >
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <section id="panel" className="sheet" aria-label={TABS.find((t) => t.id === tab)?.label}>
        <button type="button" className="sheet-grip" onClick={() => setSheetOpen(!sheetOpen)} aria-label={sheetOpen ? 'Ciutkan panel' : 'Buka panel'}>
          <span />
        </button>
        <div className="sheet-body">
          <Active />
        </div>
      </section>

      <SiteDetail />
      <MapControls />
      <TimeMachine />
      <MeasureHud />
      <TourHud />
      <CalibrateHud />
      <Toast />

      {admin && <Admin onClose={() => setAdmin(false)} />}
    </div>
  );
}
