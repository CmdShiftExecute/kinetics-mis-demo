/** Typographic minus, never a hyphen, for negative figures. */
export const MINUS = '−';
export const AED_COMPACT_GUIDE = 'AED · k = thousand · m = million · bn = billion';

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const scaled = (n: number, d = 1) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: d }).format(n);

/** Compact AED amount from a value stored in thousands. */
export function k(n: number): string {
  const absolute = Math.abs(n);
  const s = absolute >= 1_000_000
    ? `${scaled(absolute / 1_000_000)}bn`
    : absolute >= 1_000
      ? `${scaled(absolute / 1_000)}m`
      : `${grouped.format(Math.round(absolute))}k`;
  return n < 0 ? `${MINUS}${s}` : s;
}

/** Signed compact AED amount, for variances. */
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

/** AED-prefixed compact amount for headline figures. */
export function mil(thousands: number, d = 1): string {
  const absolute = Math.abs(thousands);
  const amount = absolute >= 1_000_000
    ? `${scaled(absolute / 1_000_000, d)}bn`
    : absolute >= 1_000
      ? `${scaled(absolute / 1_000, d)}m`
      : `${grouped.format(Math.round(absolute))}k`;
  return `${thousands < 0 ? MINUS : ''}AED ${amount}`;
}

/** A multiple, e.g. "2.4x". */
export function mult(n: number): string {
  return `${n.toFixed(1)}x`;
}

/** A plain count. */
export function count(n: number): string {
  return String(n);
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

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
