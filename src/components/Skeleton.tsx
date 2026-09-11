import { Link } from 'react-router';

/** A loading state shaped like the table it replaces. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="skel" aria-busy="true" aria-label="Loading">
      <div className="h" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ width: `${92 - (i % 4) * 6}%` }} />
      ))}
    </div>
  );
}

export function ErrorBlock({ title = 'Data not loaded', message, back }: { title?: string; message: string; back?: { to: string; label: string } }) {
  return (
    <div className="errbox" role="alert">
      <p className="display sec-title bad">{title}</p>
      <p style={{ margin: 'var(--s-sm) 0 0' }}>{message}</p>
      <p className="muted" style={{ margin: 'var(--s-sm) 0 0' }}>
        The page reads finished tables from public/data. Regenerate them with <code>bun run data</code> and check them with <code>bun run reconcile</code>.
      </p>
      <Link to={back?.to ?? '/'} className="drill-link press">
        {back?.label ?? 'Back to the overview'}
      </Link>
    </div>
  );
}
