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

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="errbox" role="alert">
      <p className="bracket bad">[ Data not loaded ]</p>
      <p style={{ margin: 'var(--s-sm) 0 0' }}>{message}</p>
      <p className="muted" style={{ margin: 'var(--s-sm) 0 0' }}>
        The page reads finished tables from public/data. Regenerate them with <code>bun run data</code>.
      </p>
    </div>
  );
}
