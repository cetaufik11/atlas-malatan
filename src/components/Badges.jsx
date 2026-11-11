import { STATUSES } from '../data/meta.js';

export function StatusBadge({ status, short = false }) {
  const st = STATUSES[status] || STATUSES.draf;
  return (
    <span className="badge" style={{ '--s': st.color }} title={st.hint}>
      <span className="dot" aria-hidden="true" />
      {short ? st.short : st.label}
    </span>
  );
}
