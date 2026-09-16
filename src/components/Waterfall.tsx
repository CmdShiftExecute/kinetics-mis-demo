import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { motion, useReducedMotion } from 'motion/react';
import type { PlGroup, PlRungKey } from '../../data/schema';
import { AED_COMPACT_GUIDE, cx, k, signedK } from '../lib/format';
import { GROUP_IN_VIEW, mark } from './ChartMotion';
import { useWidth } from './useWidth';

interface Step {
  key: PlRungKey;
  label: string;
  short: string;
  value: number;
  budget: number;
  kind: 'total' | 'drop';
  definition: string;
}

/** The rungs drawn, gross margin down to net profit, and the short label each column carries. */
const STEPS: { key: PlRungKey; short: string; kind: Step['kind'] }[] = [
  { key: 'grossMargin', short: 'Gross margin', kind: 'total' },
  { key: 'salaryCtc', short: 'Salaries', kind: 'drop' },
  { key: 'warehouseCost', short: 'Warehouse', kind: 'drop' },
  { key: 'warehouseSalaries', short: 'Warehouse staff', kind: 'drop' },
  { key: 'commonAdmin', short: 'Admin, selling', kind: 'drop' },
  { key: 'buProfitability', short: 'BU profit', kind: 'total' },
  { key: 'provisionsInterCo', short: 'Provisions', kind: 'drop' },
  { key: 'corporateOverhead', short: 'Corporate', kind: 'drop' },
  { key: 'buNetProfit', short: 'Net profit', kind: 'total' },
];

/**
 * The P&L as a bridge: gross margin, each cost stepping the level down, the two
 * subtotals as full columns with the budget as a tick across them. Full-year
 * forecast. Pointing at a column, or walking with the arrow keys, reads its figures
 * out and prints the rung's definition under the chart. Columns rise and costs hang
 * in sequence; under reduced motion they are simply there. The exact ladder is the
 * table below.
 */
export function Waterfall({ group, id, height = 250 }: { group: PlGroup; id: string; height?: number }) {
  const { ref, width } = useWidth(900);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const steps: Step[] = STEPS.map((s) => {
    const r = group.rungs.find((x) => x.key === s.key)!;
    return { key: s.key, short: s.short, kind: s.kind, label: r.label, value: r.forecast, budget: r.budget, definition: r.definition };
  });
  // Nine columns do not fit their names in a phone's width: there, only the three
  // subtotals carry a name and a figure, and the costs are read by pointer or keys.
  const narrow = width < 700;
  const m = { top: 26, right: 12, bottom: narrow ? 34 : 24, left: 56 };
  const n = steps.length;
  const colW = (width - m.left - m.right) / n;
  const barW = Math.min(64, colW * 0.62);
  // Each column's top and bottom in value space, carrying the running level forward.
  type Col = Step & { from: number; to: number; after: number };
  const cols = steps.reduce<Col[]>((acc, s) => {
    const level = acc.length ? acc[acc.length - 1]!.after : 0;
    if (s.kind === 'total') acc.push({ ...s, from: Math.min(0, s.value), to: Math.max(0, s.value), after: s.value });
    else acc.push({ ...s, from: level - s.value, to: level, after: level - s.value });
    return acc;
  }, []);
  const lo = Math.min(0, ...cols.map((c) => c.from));
  const hi = Math.max(...cols.map((c) => Math.max(c.to, c.budget))) * 1.1;
  const y = scaleLinear().domain([lo, hi]).range([height - m.bottom, m.top]);
  const cx0 = (i: number) => m.left + colW * i + colW / 2;
  const ticks = y.ticks(4);
  const nearest = (px: number) => {
    const i = Math.floor((px - m.left) / colW);
    return i >= 0 && i < n ? i : null;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left));
  const stepTo = (d: number) => setHover(Math.min(n - 1, Math.max(0, (hover ?? 0) + d)));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepTo(1);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      stepTo(-1);
    }
    if (e.key === 'Escape') setHover(null);
  };
  const hc = hover != null ? cols[hover] : undefined;
  const figures = (c: Col) => (c.kind === 'total' ? `${k(c.value)}, BUDGET ${k(c.budget)}, ${signedK(c.value - c.budget)}` : `${signedK(-c.value)}, BUDGET ${k(c.budget)}, ${signedK(c.budget - c.value)} VS BUDGET`);
  const CH = 6.8;
  const hcName = hc ? hc.label.toUpperCase() : '';
  const hcFigs = hc ? figures(hc) : '';
  const boxW = hc ? Math.min(width, 20 + (hcName.length + hcFigs.length + 3) * CH) : 0;
  const boxX = hc ? Math.max(0, Math.min(width - boxW, cx0(hover!) - boxW / 2)) : 0;
  const grp = reduce ? {} : GROUP_IN_VIEW;
  const grow = (delay: number, originY: 0 | 1) => (reduce ? {} : { ...mark({ scaleY: 0 }, { scaleY: 1 }, delay), style: { originY } });
  const fade = (delay: number) => (reduce ? {} : mark({ opacity: 0 }, { opacity: 1 }, delay, 0.3));

  return (
    <div className="chart-wrap" ref={ref}>
      <p className="chart-axis-note">{AED_COMPACT_GUIDE}, full-year forecast. Costs step the level down from gross margin; the tick across each subtotal is its budget.</p>
      <svg className="chart wfall" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Profit and loss bridge from gross margin to BU-level net profit, full-year forecast, with budget marks. The exact ladder is in the table below." tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onFocus={() => setHover(0)} onBlur={() => setHover(null)} id={id}>
        <rect className="capture" x={m.left} y={m.top - 10} width={Math.max(0, width - m.left - m.right)} height={Math.max(0, height - m.top - m.bottom + 10)} fill="transparent" />
        {hover != null && <rect className="rowhi" x={m.left + colW * hover} y={m.top - 10} width={colW} height={height - m.top - m.bottom + 10} aria-hidden="true" />}
        <g className="grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'zero' : undefined} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end">
                {k(t)}
              </text>
            </g>
          ))}
        </g>
        <motion.g {...grp}>
        {cols.map((c, i) => {
          const x0 = cx0(i) - barW / 2;
          const top = y(Math.max(c.from, c.to));
          const h = Math.max(1, Math.abs(y(c.from) - y(c.to)));
          const neg = c.kind === 'total' && c.value < 0;
          const next = cols[i + 1];
          const delay = 0.07 * i;
          return (
            <g key={c.key} className={cx('wcol', hover === i && 'on')}>
              <motion.rect className={cx('seg', c.kind === 'total' ? (neg ? 'c-hz' : 'c-ink') : 'c-spot', hover === i && 'mk-on')} x={x0} y={top} width={barW} height={h} {...grow(delay, c.kind === 'total' && !neg ? 1 : 0)} />
              {c.kind === 'total' && <motion.line className="tick spot" x1={x0 - 6} x2={x0 + barW + 6} y1={y(c.budget)} y2={y(c.budget)} {...fade(delay + 0.3)} />}
              {next && <motion.line className="wf-link" x1={x0 + barW} x2={cx0(i + 1) - barW / 2} y1={y(c.after)} y2={y(c.after)} {...fade(delay + 0.35)} />}
              {(!narrow || c.kind === 'total') && (
                <motion.text x={cx0(i)} y={(c.kind === 'total' ? Math.min(top, y(c.budget)) : top) - 6} textAnchor="middle" className={c.kind === 'total' ? (neg ? 'hz' : 'ink') : undefined} {...fade(delay + 0.3)}>
                  {c.kind === 'total' ? k(c.value) : signedK(-c.value)}
                </motion.text>
              )}
              {(!narrow || c.kind === 'total') && (
              <text x={cx0(i)} y={height - m.bottom + 13} textAnchor="middle" className={c.kind === 'total' ? 'ink' : undefined}>
                {narrow && c.short.includes(' ') ? (
                  <>
                    <tspan x={cx0(i)}>{c.short.split(' ')[0]!.toUpperCase().replace(',', '')}</tspan>
                    <tspan x={cx0(i)} dy={11}>
                      {c.short.split(' ').slice(1).join(' ').toUpperCase()}
                    </tspan>
                  </>
                ) : (
                  c.short.toUpperCase()
                )}
              </text>
              )}
            </g>
          );
        })}
        </motion.g>
        {hc && (
          <g className="readbox" aria-hidden="true" transform={`translate(${boxX}, 2)`}>
            <rect width={boxW} height={22} />
            <text x={10} y={15} className="ink">
              {hcName}
            </text>
            <text x={10 + (hcName.length + 2) * CH} y={15} className={hc.kind === 'total' && hc.value < hc.budget ? 'hz' : undefined}>
              {hcFigs}
            </text>
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {hc ? `${hc.label}: ${hcFigs.toLowerCase()}. ${hc.definition}` : ''}
      </p>
      <p className="wf-def" data-testid={`${id}-def`}>
        {hc ? hc.definition : 'Point at a step, or walk the steps with the arrow keys, for its definition.'}
      </p>
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="sw c-ink" /> Subtotal
        </span>
        <span>
          <i className="sw c-spot" /> Cost
        </span>
        <span>
          <i className="sw c-tick-spot" /> Budget
        </span>
        {cols.some((c) => c.kind === 'total' && c.value < 0) && (
          <span>
            <i className="sw c-hz" /> Loss
          </span>
        )}
      </div>
    </div>
  );
}
