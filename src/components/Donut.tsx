import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cx, pct } from '../lib/format';
import { GROUP_IN_VIEW, mark } from './ChartMotion';
import { useWidth } from './useWidth';

export interface Slice {
  key: string;
  name: string;
  value: number;
  /** Marks a slice that is a bad condition in itself, e.g. stock over a year old. */
  bad?: boolean;
}

interface Props {
  id: string;
  rows: Slice[];
  /** Formats a value for the legend, the centre and the readout. */
  format: (n: number) => string;
  ariaLabel: string;
  /** Printed under the total in the middle of the ring. */
  centreLabel: string;
  /**
   * Slices beyond this many are gathered into one "Other" slice, largest kept.
   * Five is the honest ceiling for a two-ink print system: there are exactly five
   * fills that clear the 3:1 non-text floor on paper, and the fifth is shared
   * between the last real slice and Other, which never appear together. A
   * composition with more parts than this is drawn as bars, where length carries
   * the meaning and colour carries none.
   */
  maxSlices?: number;
  /** Keeps the given order instead of sorting largest first, for a fixed sequence like age bands. */
  keepOrder?: boolean;
}

/**
 * A composition ring: one arc per share of a whole, with the figures beside it as
 * a real list rather than colour alone. Arcs sweep in clockwise. Pointing at an
 * arc or a legend row, or walking with the arrow keys, lifts that slice and puts
 * its figures in the middle. Exact values are in the table the chart sits above.
 */
export function Donut({ id, rows, format, ariaLabel, centreLabel, maxSlices = 5, keepOrder }: Props) {
  const { ref, width } = useWidth(760, 260);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const clean = rows.filter((r) => r.value > 0);
  const ordered = keepOrder ? clean : clean.slice().sort((a, b) => b.value - a.value);
  const slices: Slice[] =
    ordered.length > maxSlices
      ? [...ordered.slice(0, maxSlices - 1), { key: '__other', name: `Other, ${ordered.length - maxSlices + 1} more`, value: ordered.slice(maxSlices - 1).reduce((a, s) => a + s.value, 0) }]
      : ordered;
  const total = slices.reduce((a, s) => a + s.value, 0);

  const narrow = width < 700;
  const size = Math.max(200, Math.min(narrow ? width : width * 0.42, 300));
  const cx0 = size / 2;
  const r = size * 0.38;
  const thickness = size * 0.19;
  const share = (v: number) => (total ? (v / total) * 100 : 0);

  type Arc = Slice & { i: number; frac: number; start: number; cls: string };
  const arcs = slices.reduce<Arc[]>((out, s, i) => {
    const frac = total ? s.value / total : 0;
    const prev = out[out.length - 1];
    out.push({ ...s, i, frac, start: prev ? prev.start + prev.frac : 0, cls: s.key === '__other' ? 'other' : s.bad ? 'hz' : `sl-${i % 5}` });
    return out;
  }, []);

  const step = (d: number) => setHover(Math.min(arcs.length - 1, Math.max(0, (hover ?? 0) + d)));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    }
    if (e.key === 'Escape') setHover(null);
  };
  const ha = hover != null ? arcs[hover] : undefined;
  const readout = ha ? `${ha.name}: ${format(ha.value)}, ${pct(share(ha.value))} of the total` : '';

  return (
    <div className={cx('chart-wrap', 'donut-wrap', narrow && 'narrow')} ref={ref}>
      <svg
        className="chart donut"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => setHover(0)}
        onBlur={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
        id={id}
      >
        <motion.g transform={`rotate(-90 ${cx0} ${cx0})`} {...(reduce ? {} : GROUP_IN_VIEW)}>
          {arcs.map((a) => (
            <motion.circle
              key={a.key}
              className={cx('arc', a.cls, hover === a.i && 'mk-on')}
              cx={cx0}
              cy={cx0}
              r={r}
              fill="none"
              strokeWidth={thickness + (hover === a.i ? 6 : 0)}
              onPointerEnter={() => setHover(a.i)}
              /* pathOffset has to travel as a motion value. Passed through `style` it
                 never reaches Motion's SVG path builder, the dash offset stays 0 and
                 every arc starts at twelve o'clock on top of the last one. Measured
                 on the live page 13 Sep 2026: every arc read stroke-dashoffset 0. */
              {...(reduce ? { initial: { pathLength: a.frac, pathOffset: a.start } } : mark({ pathLength: 0, pathOffset: a.start }, { pathLength: a.frac, pathOffset: a.start }, 0.5 * a.start, 0.55))}
            />
          ))}
        </motion.g>
        <text className="d-centre ink" x={cx0} y={cx0 - 2} textAnchor="middle">
          {format(ha ? ha.value : total)}
        </text>
        <text className="d-sub" x={cx0} y={cx0 + 14} textAnchor="middle">
          {ha ? pct(share(ha.value)) : centreLabel.toUpperCase()}
        </text>
        {ha && (
          <text className="d-sub" x={cx0} y={cx0 + 28} textAnchor="middle">
            {(ha.name.length > 22 ? ha.name.slice(0, 21) + '.' : ha.name).toUpperCase()}
          </text>
        )}
      </svg>
      <motion.ul className="d-legend" {...(reduce ? {} : GROUP_IN_VIEW)}>
        {arcs.map((a) => (
          <motion.li
            key={a.key}
            className={cx(hover === a.i && 'on')}
            onPointerEnter={() => setHover(a.i)}
            onPointerLeave={() => setHover(null)}
            {...(reduce ? {} : mark({ opacity: 0, x: -4 }, { opacity: 1, x: 0 }, 0.06 * a.i + 0.1, 0.3))}
          >
            <i className={cx('sw', a.cls)} />
            <span className="d-name">{a.name}</span>
            <span className="d-val num">{format(a.value)}</span>
            <span className="d-share num">{pct(share(a.value))}</span>
          </motion.li>
        ))}
      </motion.ul>
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}
