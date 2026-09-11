import { k } from '../lib/format';
import { cx } from '../lib/format';

interface Props {
  v: number;
  /** Formatter, defaults to AED thousands. */
  f?: (n: number) => string;
  /** Provenance text shown on hover. */
  tip?: string;
  /** Render in hazard red: negative variance, overdue risk, an alert. Never decoration. */
  bad?: boolean;
  className?: string;
}

/** A typeset figure in a table cell, with its source on hover. */
export function Num({ v, f = k, tip, bad, className }: Props) {
  return (
    <td className={cx('num', bad && 'bad', className)} data-tip={tip}>
      {f(v)}
    </td>
  );
}
