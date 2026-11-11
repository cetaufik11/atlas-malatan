import { useEffect, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useStore, mapRef } from '../store.js';
import { CATEGORIES, STATUSES, CENTER } from '../data/meta.js';
import { distance, fmtDistance } from '../lib/geo.js';
import { Icon } from '../components/icons.jsx';

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Soal konsep historiografi (tetap).
const CONCEPT = [
  {
    q: 'Warga bercerita bahwa Mbah Malat adalah pendiri dusun, tetapi tidak ada catatan tertulis sezaman. Label yang paling tepat adalah…',
    options: ['Legenda / tutur tinular', 'Fakta terverifikasi', 'Fiksi karangan', 'Data statistik'],
    answer: 0,
    why: 'Cerita turun-temurun tanpa bukti sezaman disebut legenda. Ia tetap berharga sebagai memori kolektif, tetapi tidak disajikan sebagai fakta.',
  },
  {
    q: 'Lumpang dan umpak batu ditemukan di pinggir sungai. Langkah yang benar menurut UU Cagar Budaya adalah…',
    options: ['Melaporkan ke instansi kebudayaan', 'Membawanya pulang agar aman', 'Menjualnya ke kolektor', 'Membiarkan tanpa dicatat'],
    answer: 0,
    why: 'UU No. 11/2010 meminta temuan diduga cagar budaya dilaporkan ke instansi berwenang agar dapat dikaji ahli.',
  },
  {
    q: 'Sumber mana yang paling kuat untuk memastikan tahun berdirinya sebuah bangunan?',
    options: ['Dokumen sezaman, misalnya prasasti atau akta', 'Ingatan satu orang', 'Unggahan media sosial', 'Perkiraan dari bentuk atap'],
    answer: 0,
    why: 'Sumber primer sezaman paling kuat; ingatan lisan perlu dibandingkan (kritik sumber) dengan sumber lain.',
  },
  {
    q: 'Mengapa citra satelit 2014 dan 2026 berguna bagi sejarawan desa?',
    options: ['Memperlihatkan perubahan ruang secara nyata', 'Menunjukkan isi hati warga', 'Membuktikan legenda', 'Menggantikan wawancara'],
    answer: 0,
    why: 'Citra adalah sumber visual yang merekam perubahan lahan, jalan, dan permukiman, tetapi tidak menggantikan sumber lisan.',
  },
];

function buildQuiz(sites) {
  const qs = [];
  const pick = shuffle(sites).slice(0, 4);
  for (const s of pick.slice(0, 2)) qs.push({ type: 'locate', site: s, q: `Ketuk peta di lokasi: ${s.name}` });
  for (const s of pick.slice(2, 4)) {
    const correct = CATEGORIES[s.category]?.label;
    const opts = shuffle(Object.values(CATEGORIES).map((c) => c.label));
    qs.push({ type: 'mc', q: `${s.name} termasuk kategori…`, options: opts, answer: opts.indexOf(correct), why: s.subtitle });
  }
  const withElev = sites.filter((s) => s.elev);
  if (withElev.length >= 2) {
    const [a, b] = shuffle(withElev);
    if (a.elev !== b.elev) {
      const hi = a.elev > b.elev ? a : b;
      qs.push({ type: 'mc', q: 'Mana yang letaknya lebih tinggi di lereng Sindoro?', options: [a.name, b.name], answer: hi === a ? 0 : 1, why: `${a.name} ±${a.elev} mdpl, ${b.name} ±${b.elev} mdpl.` });
    }
  }
  const leg = sites.find((s) => s.status === 'legenda');
  if (leg) {
    const opts = shuffle(['legenda', 'terverifikasi', 'observasi', 'draf']);
    qs.push({ type: 'mc', q: `Apa status narasi “${leg.name}” di atlas ini?`, options: opts.map((k) => STATUSES[k].label), answer: opts.indexOf('legenda'), why: STATUSES.legenda.hint });
  }
  qs.push(...shuffle(CONCEPT).slice(0, 2).map((c) => ({ type: 'mc', ...c })));
  return qs;
}

export default function LearnPanel() {
  const sites = useStore((s) => s.sites);
  const progress = useStore((s) => s.progress);
  const setProgress = useStore((s) => s.setProgress);
  const setTool = useStore((s) => s.setTool);
  const quizClick = useStore((s) => s.quizClick);
  const [quiz, setQuiz] = useState(null); // { qs, i, score, picked, result }

  const q = quiz?.qs[quiz.i];

  // Mode ketuk peta untuk soal lokasi.
  useEffect(() => {
    if (q?.type === 'locate' && quiz.picked == null) {
      setTool('quiz');
      useStore.setState({ quizClick: null });
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mapRef.current?.flyTo({ center: CENTER, zoom: 16.8, pitch: 0, bearing: 0, duration: reduce ? 0 : 1200 });
      document.querySelector('.map')?.classList.add('quiz-hide-pins');
    } else {
      if (useStore.getState().tool === 'quiz') setTool(null);
      document.querySelector('.map')?.classList.remove('quiz-hide-pins');
    }
  }, [quiz?.i, quiz?.picked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (useStore.getState().tool === 'quiz') useStore.getState().setTool(null);
    document.querySelector('.map')?.classList.remove('quiz-hide-pins');
  }, []);

  useEffect(() => {
    if (!quizClick || q?.type !== 'locate' || quiz.picked != null) return;
    const d = distance(quizClick, [q.site.lng, q.site.lat]);
    const pts = d <= 40 ? 2 : d <= 120 ? 1 : 0;
    const map = mapRef.current;
    const mk = [];
    if (map) {
      const a = document.createElement('div');
      a.className = 'quiz-mark you';
      const b = document.createElement('div');
      b.className = 'quiz-mark truth';
      mk.push(new maplibregl.Marker({ element: a, opacityWhenCovered: '1' }).setLngLat(quizClick).addTo(map));
      mk.push(new maplibregl.Marker({ element: b, opacityWhenCovered: '1' }).setLngLat([q.site.lng, q.site.lat]).addTo(map));
      setTimeout(() => mk.forEach((m) => m.remove()), 4500);
    }
    setQuiz({ ...quiz, picked: d, score: quiz.score + pts, last: pts });
  }, [quizClick]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxScore = useMemo(() => quiz?.qs.reduce((t, x) => t + (x.type === 'locate' ? 2 : 1), 0) ?? 0, [quiz?.qs]);

  const start = () => setQuiz({ qs: buildQuiz(sites), i: 0, score: 0, picked: null });
  const answer = (k) => {
    if (quiz.picked != null) return;
    const ok = k === q.answer;
    setQuiz({ ...quiz, picked: k, score: quiz.score + (ok ? 1 : 0), last: ok ? 1 : 0 });
  };
  const next = () => {
    if (quiz.i < quiz.qs.length - 1) setQuiz({ ...quiz, i: quiz.i + 1, picked: null });
    else {
      const pct = Math.round((quiz.score / maxScore) * 100);
      const badges = new Set(progress.badges);
      if (pct >= 80) badges.add('sejarawan-muda');
      setProgress({ ...progress, quizBest: Math.max(progress.quizBest, pct), badges: [...badges] });
      setQuiz({ ...quiz, done: true, pct });
    }
  };

  const explorer = progress.visited.length >= sites.length;
  const badges = [
    { id: 'penjelajah', label: 'Penjelajah Malatan', desc: `Membuka semua ${sites.length} situs`, got: explorer, prog: `${progress.visited.length}/${sites.length}` },
    { id: 'sejarawan-muda', label: 'Sejarawan Muda', desc: 'Skor kuis ≥ 80%', got: progress.badges.includes('sejarawan-muda'), prog: `terbaik ${progress.quizBest}%` },
  ];

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Ruang Belajar</span>
        <h2>Belajar Sejarah Lokal</h2>
        <p className="muted">Kuis dibuat otomatis dari data atlas, termasuk latihan membedakan legenda dan fakta. Cocok untuk siswa SD–SMA.</p>
      </header>

      <div className="badges-grid">
        {badges.map((b) => (
          <div key={b.id} className={`badge-card ${b.got ? 'got' : ''}`}>
            <Icon name="star" size={22} />
            <strong>{b.label}</strong>
            <span className="small muted">{b.desc}</span>
            <span className="small mono">{b.got ? 'Diraih ✓' : b.prog}</span>
          </div>
        ))}
      </div>

      {!quiz && (
        <button type="button" className="btn block" onClick={start}>
          <Icon name="play" size={14} /> Mulai kuis ({buildQuiz(sites).length} soal)
        </button>
      )}

      {quiz && !quiz.done && q && (
        <article className="card quiz" aria-live="polite">
          <span className="eyebrow">Soal {quiz.i + 1}/{quiz.qs.length} · skor {quiz.score}</span>
          <h3>{q.q}</h3>
          {q.type === 'locate' && quiz.picked == null && <p className="small muted">Penanda situs disembunyikan sementara. Ketuk lokasi di peta.</p>}
          {q.type === 'locate' && quiz.picked != null && (
            <p className={quiz.last ? 'ok' : 'bad'}>
              Meleset {fmtDistance(quiz.picked)}. {quiz.last === 2 ? 'Tepat sekali! +2' : quiz.last === 1 ? 'Cukup dekat, +1' : 'Masih jauh. Titik hijau adalah lokasi sebenarnya.'}
            </p>
          )}
          {q.type === 'mc' && (
            <div className="options">
              {q.options.map((o, k) => (
                <button
                  key={k}
                  type="button"
                  className={`opt ${quiz.picked != null && k === q.answer ? 'right' : ''} ${quiz.picked === k && k !== q.answer ? 'wrong' : ''}`}
                  onClick={() => answer(k)}
                  disabled={quiz.picked != null}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          {q.type === 'mc' && quiz.picked != null && q.why && <p className="small why">{q.why}</p>}
          {quiz.picked != null && (
            <button type="button" className="btn sm" onClick={next}>
              {quiz.i < quiz.qs.length - 1 ? 'Soal berikutnya' : 'Lihat hasil'}
            </button>
          )}
        </article>
      )}

      {quiz?.done && (
        <article className="card quiz">
          <span className="eyebrow">Hasil</span>
          <h3>Skor {quiz.score}/{maxScore} ({quiz.pct}%)</h3>
          <p>{quiz.pct >= 80 ? 'Luar biasa, kamu meraih lencana Sejarawan Muda!' : 'Bagus! Jelajahi lagi situs-situsnya lalu coba sekali lagi.'}</p>
          <button type="button" className="btn sm" onClick={start}>Ulangi kuis</button>
        </article>
      )}

      <article className="card">
        <h3>Lembar Kerja Siswa</h3>
        <p className="small muted">Cetak lembar observasi lapangan berisi daftar situs, kolom pengamatan, dan pertanyaan kritik sumber.</p>
        <button type="button" className="btn ghost sm" onClick={() => printWorksheet(sites)}>
          <Icon name="printer" size={14} /> Cetak lembar kerja
        </button>
      </article>
    </div>
  );
}

function printWorksheet(sites) {
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const rows = sites
    .map((s, i) => `<tr><td>${i + 1}</td><td><b>${esc(s.name)}</b><br><small>${esc(STATUSES[s.status]?.label || '')}</small></td><td></td><td></td><td></td></tr>`)
    .join('');
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Lembar Kerja — Atlas Malatan</title>
  <style>body{font:13px/1.45 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}
  td,th{border:1px solid #444;padding:6px;vertical-align:top}th{background:#eee;text-align:left}td:nth-child(n+3){height:46px}ol li{margin:8px 0 26px}</style></head><body>
  <h1>Lembar Observasi Sejarah Lokal — Dusun Malatan</h1>
  <p>Nama: ______________________ Kelas: ________ Tanggal: ____________</p>
  <table><thead><tr><th>#</th><th>Situs</th><th>Apa yang kamu lihat?</th><th>Siapa narasumbernya?</th><th>Legenda / fakta? Mengapa?</th></tr></thead><tbody>${rows}</tbody></table>
  <h2 style="font-size:15px;margin-top:20px">Pertanyaan kritik sumber</h2>
  <ol><li>Pilih satu cerita yang kamu dengar. Siapa yang menceritakannya, dan dari mana ia tahu?</li>
  <li>Adakah bukti fisik (bangunan, makam, batu, dokumen) yang mendukung cerita itu?</li>
  <li>Bandingkan citra satelit tahun 2014 dan 2026 di Atlas Malatan. Apa yang berubah?</li></ol>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
