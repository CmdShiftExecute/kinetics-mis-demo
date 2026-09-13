import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../lib/format';
import { GROUP_IN_VIEW, mark } from './ChartMotion';
import { useWidth } from './useWidth';

/** The five fills a segment may take. `hollow` is drawn beside the stack and never added to it. */
export type SegmentClass = 'spot' | 'spot2' | 'ink' | 'hz' | 'hollow';

export interface BarSegment {
  key: string;
  value: number;
  cls: SegmentClass;
}

export interface BarRow {
  key: string;
  name: string;
  segments: BarSegment[];
  /** Drawn as a heavy ink tick, e.g. the budget. */
  target?: number;
  /** Printed at the end of the bar, in ink. */
  end: string;
  /** Printed after `end`; hazard when `endBad`. */
  endDelta?: string;
  endBad?: boolean;
  /** One line of figures, upper case, for the readout and the live region. */
  readout: string;
}

interface Props {
  id: string;
  rows: BarRow[];
  ariaLabel: string;
  legend: { cls: SegmentClass | 'tick' | 'gap'; label: string }[];
  format: (n: number) => string;
  /** Marks the gap between the bar and its target in hazard when the bar falls short. */
  shortfall?: boolean;
  /** `share` normalises every row to its own hundred percent, so composition is compared rather than size. */
  mode?: 'value' | 'share';
}

const solidSum = (r: BarRow) => r.segments.filter((s) => s.cls !== 'hollow').reduce((a, s) => a + s.value, 0);
const fullSum = (r: BarRow) => r.segments.reduce((a, s) => a + s.value, 0);

/**
 * Horizontal bars, one row per vertical: stacked segments, an optional target tick,
 * an optional shortfall mark, the figure printed at the end. Pointing at a row, or
 * walking the rows with the arrow keys, bands it and reads its figures out. Bars grow
 * in from the left in sequence; under reduced motion they are simply there. Exact
 * values are always in the table the chart sits above.
 */
export function HBars({ id, rows, ariaLabel, legend, format, shortfall, mode = 'value' }: Props) {
  const { ref, width } = useWidth(900);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = width < 560 ? 112 : 190;
  const m = { left: labelW, right: width < 560 ? 88 : 132, top: 22, bottom: 6 };
  const rowH = 26;
  /** Mono at 11px runs about 6.6px a character; the column keeps 10px of air beside the bar. */
  const maxLabelChars = Math.max(8, Math.floor((labelW - 14) / 6.6));
  const barH = 12;
  const height = m.top + rows.length * rowH + m.bottom;
  const shareMode = mode === 'share';
  const domainMax = shareMode ? 100 : Math.max(1, ...rows.map((r) => Math.max(fullSum(r), r.target ?? 0)));
  const x = shareMode ? scaleLinear().domain([0, 100]).range([m.left, width - m.right]) : scaleLinear().domain([0, domainMax]).range([m.left, width - m.right]).nice();
  const ticks = shareMode ? [0, 25, 50, 75, 100] : x.ticks(width < 560 ? 3 : 5);
  /** In share mode every row is drawn against its own total, so the segments fill the width. */
  const scaleOf = (r: BarRow) => (shareMode ? 100 / (solidSum(r) || 1) : 1);
  const nearest = (py: number) => {
    const i = Math.floor((py - m.top) / rowH);
    return i >= 0 && i < rows.length ? i : null;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientY - e.currentTarget.getBoundingClientRect().top));
  const step = (d: number) => setHover(Math.min(rows.length - 1, Math.max(0, (hover ?? 0) + d)));
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
  const hr = hover != null ? rows[hover] : undefined;
  const CH = 6.8;
  const hrName = hr ? (width < 560 && hr.name.length > 16 ? hr.name.slice(0, 15) + '.' : hr.name).toUpperCase() : '';
  const boxW = hr ? Math.min(width, 20 + (hrName.length + hr.readout.length + 3) * CH) : 0;
  const boxX = Math.max(0, Math.min(width - boxW, m.left + 10));
  const grp = reduce ? {} : GROUP_IN_VIEW;
  const grow = (delay: number) => (reduce ? {} : mark({ scaleX: 0 }, { scaleX: 1 }, delay, 0.55));
  const fade = (delay: number) => (reduce ? {} : mark({ opacity: 0 }, { opacity: 1 }, delay, 0.35));

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        className="chart vchart hbars"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onFocus={() => setHover(0)}
        onBlur={() => setHover(null)}
        id={id}
      >
        <rect className="capture" x={0} y={m.top} width={width} height={rows.length * rowH} fill="transparent" />
        {hover != null && <rect className="rowhi" x={0} y={m.top + hover * rowH} width={width} height={rowH} aria-hidden="true" />}
        <g className="grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.top - 4} y2={height - m.bottom} />
              <text x={x(t)} y={m.top - 8} textAnchor="middle">
                {shareMode ? `${t}%` : format(t)}
              </text>
            </g>
          ))}
        </g>
        <motion.g {...grp}>
        {rows.map((r, i) => {
          const y = m.top + i * rowH + (rowH - barH) / 2;
          const sc = scaleOf(r);
          const solid = solidSum(r) * sc;
          const full = shareMode ? solid : fullSum(r);
          const short = !shareMode && shortfall && r.target != null && r.target > solid;
          const endX = x(Math.max(full, shareMode ? 0 : (r.target ?? 0))) + 7;
          // The label column holds a fixed number of mono characters, so the name is cut
          // to fit at every width rather than only on a phone. A cut name was running off
          // the left edge of the P&L split on a full-width desktop, measured 13 Sep 2026.
          const label = r.name.length > maxLabelChars ? r.name.slice(0, maxLabelChars - 1) + '.' : r.name;
          const showDelta = width >= 560;
          let acc = 0;
          const rowDelay = 0.05 * i;
          return (
            <g key={r.key} className={cx('brow', hover === i && 'on')}>
              <text x={m.left - 10} y={y + 10} textAnchor="end" className="ink">
                {label}
              </text>
              {r.segments.map((s, si) => {
                if (shareMode && s.cls === 'hollow') return null;
                const x0 = x(acc);
                const w = x(acc + s.value * sc) - x0;
                acc += s.value * sc;
                if (w <= 0) return null;
                // A real value narrower than a pixel still gets a hairline: a segment that
                // rounds away is indistinguishable from one that is not there at all.
                const wDrawn = Math.max(0.75, w);
                return <motion.rect key={s.key} className={cx('seg', `c-${s.cls}`, hover === i && 'mk-on')} x={x0} y={y} width={wDrawn} height={barH} style={{ originX: 0 }} {...grow(rowDelay + 0.08 * si)} />;
              })}
              {short && <motion.rect className="seg gap" x={x(solid)} y={y + 2} width={Math.max(1, x(r.target!) - x(solid))} height={barH - 4} style={{ originX: 0 }} {...grow(rowDelay + 0.08 * r.segments.length)} />}
              {r.target != null && !shareMode && <motion.line className="tick" x1={x(r.target)} x2={x(r.target)} y1={y - 4} y2={y + barH + 4} {...fade(rowDelay + 0.3)} />}
              <motion.text x={endX} y={y + 10} className="end" {...fade(rowDelay + 0.4)}>
                <tspan className="ink">{r.end}</tspan>
                {r.endDelta && showDelta && (
                  <tspan className={r.endBad ? 'hz' : 'muted'} dx={6}>
                    {r.endDelta}
                  </tspan>
                )}
              </motion.text>
            </g>
          );
        })}
        </motion.g>
        {hr && (
          <g className="readbox" aria-hidden="true" transform={`translate(${boxX}, ${m.top + (hover ?? 0) * rowH + 2})`}>
            <rect width={boxW} height={22} />
            <text x={10} y={15} className="ink">
              {hrName}
            </text>
            <text x={10 + (hrName.length + 2) * CH} y={15} className={hr.endBad ? 'hz' : undefined}>
              {hr.readout}
            </text>
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {hr ? `${hr.name}: ${hr.readout.toLowerCase()}` : ''}
      </p>
      <div className="chart-legend" aria-hidden="true">
        {legend.map((l) => (
          <span key={l.label}>
            <i className={`sw c-${l.cls}`} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
