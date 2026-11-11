import { useStore } from '../store.js';

export default function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toast && <div key={toast.id} className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
