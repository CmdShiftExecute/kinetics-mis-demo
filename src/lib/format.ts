/** Typographic minus, never a hyphen, for negative figures. */
export const MINUS = '−';

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** AED thousands with grouping. */
export function k(n: number): string {
  const s = grouped.format(Math.abs(Math.round(n)));
  return n < 0 ? `${MINUS}${s}` : s;
}

/** Signed AED thousands, for deltas. */
export function signedK(n: number): string {
  if (n > 0) return `+${k(n)}`;
  return k(n);
}

/** Percent with a fixed number of decimals. */
export function pct(n: number, d = 1): string {
  const s = `${Math.abs(n).toFixed(d)}%`;
  return n < 0 ? `${MINUS}${s}` : s;
}

/** Signed percent, for changes. */
export function signedPct(n: number, d = 1): string {
  if (n > 0) return `+${pct(n, d)}`;
  return pct(n, d);
}

/** Percentage points, signed. */
export function pts(n: number): string {
  const s = `${Math.abs(n).toFixed(1)} pts`;
  if (n < 0) return `${MINUS}${s}`;
  if (n > 0) return `+${s}`;
  return s;
}

/** AED millions from thousands, e.g. "AED 12.3M". */
export function mil(thousands: number, d = 1): string {
  const v = Math.abs(thousands) / 1000;
  return `${thousands < 0 ? MINUS : ''}AED ${v.toFixed(d)}M`;
}

/** A multiple, e.g. "2.4x". */
export function mult(n: number): string {
  return `${n.toFixed(1)}x`;
}

/** "07 Sep 2026" from a YYYY-MM-DD string, no timezone arithmetic. */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
