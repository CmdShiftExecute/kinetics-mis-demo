/**
 * The glyphs on the chart-view switch. Drawn on a 14 by 14 grid in currentColor
 * so a pressed button inverts them with the button, with square ends and no
 * curves beyond the ring, which keeps them inside the print system.
 */
export type IconKey = 'bars' | 'columns' | 'donut' | 'line' | 'area' | 'steps' | 'quadrant' | 'stack';

const P: Record<IconKey, React.ReactNode> = {
  bars: (
    <>
      <rect x="1" y="2.5" width="12" height="2" />
      <rect x="1" y="6" width="8" height="2" />
      <rect x="1" y="9.5" width="4.5" height="2" />
    </>
  ),
  columns: (
    <>
      <rect x="1.5" y="6" width="2.6" height="7" />
      <rect x="5.7" y="2" width="2.6" height="11" />
      <rect x="9.9" y="8" width="2.6" height="5" />
    </>
  ),
  donut: (
    <>
      <path d="M7 1a6 6 0 1 0 6 6h-2.6A3.4 3.4 0 1 1 7 3.6Z" />
      <path d="M8.2 1.12A6 6 0 0 1 12.9 5.8l-2.55.62A3.4 3.4 0 0 0 7.6 3.68Z" opacity="0.55" />
    </>
  ),
  line: (
    <>
      <path d="M1 11.2 4.4 7l2.6 2.2L12.9 2.4l1.1 1.3-7.2 8.2-2.6-2.2-2.1 2.6Z" />
    </>
  ),
  area: (
    <>
      <path d="M1 12.5V8.2l3.6-3.1 2.7 2.2 5.7-4.6v9.8Z" opacity="0.45" />
      <path d="M1 8.2 4.6 5.1l2.7 2.2L13 2.7l.9 1.2-6.6 5.3-2.7-2.2-2.7 2.3Z" />
    </>
  ),
  steps: (
    <>
      <rect x="1" y="3" width="2.4" height="10" />
      <rect x="4.6" y="4.6" width="2.4" height="3.2" />
      <rect x="8.2" y="7" width="2.4" height="3.2" />
      <rect x="11.8" y="9" width="2.2" height="4" />
    </>
  ),
  quadrant: (
    <>
      <rect x="0.8" y="6.4" width="12.6" height="1.1" opacity="0.5" />
      <rect x="6.4" y="0.8" width="1.1" height="12.6" opacity="0.5" />
      <circle cx="3.4" cy="9.9" r="1.7" />
      <circle cx="9.9" cy="3.7" r="2.2" />
      <circle cx="10.3" cy="10.1" r="1.2" />
    </>
  ),
  stack: (
    <>
      <rect x="1" y="2.5" width="5" height="2.2" />
      <rect x="6.6" y="2.5" width="3.4" height="2.2" opacity="0.55" />
      <rect x="10.6" y="2.5" width="2.4" height="2.2" opacity="0.3" />
      <rect x="1" y="5.9" width="7.6" height="2.2" />
      <rect x="9.2" y="5.9" width="3.8" height="2.2" opacity="0.55" />
      <rect x="1" y="9.3" width="3.2" height="2.2" />
      <rect x="4.8" y="9.3" width="5.2" height="2.2" opacity="0.55" />
      <rect x="10.6" y="9.3" width="2.4" height="2.2" opacity="0.3" />
    </>
  ),
};

export function ChartIcon({ name }: { name: IconKey }) {
  return (
    <svg className="cv-icon" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
