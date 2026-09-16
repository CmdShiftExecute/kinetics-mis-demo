import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../lib/format';
import { mark, useChartEntry } from './ChartMotion';
import { useWidth } from './useWidth';

export interface Point {
  key: string;
  name: string;
  x: number;
  y: number;
  /** Sets the bubble's area, e.g. the figure the other two are drawn from. */
  size: number;
}

interface Props {
  id: string;
  rows: Point[];
  /** The division's own value on each axis, drawn as the crosshair the quadrants are read against. */
  refX: number;
  refY: number;
  /** Names the crosshair, e.g. DIVISION or STORE. */
  refLabel?: string;
  xLabel: string;
  yLabel: string;
  fx: (n: number) => string;
  fy: (n: number) => string;
  /** Reads out the bubble's own figures, upper case. */
  readout: (p: Point) => string;
  ariaLabel: string;
  height?: number;
}

/**
 * Two measures against each other, one bubble per vertical, sized by a third.
 * The crosshair is the division's own position, so each bubble's quadrant is its
 * verdict: above the line on both is the top right. Bubbles below the division
 * margin are drawn in the spot ink, a negative value in hazard. Pointing at one,
 * or walking with the arrow keys, reads its figures out. Exact values are in the
 * table the chart sits above.
 */
export function Quadrant({ id, rows, refX, refY, refLabel = 'Division', xLabel, yLabel, fx, fy, readout, ariaLabel, height = 300 }: Props) {
  const { ref, width } = useWidth(880, 300);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const m = { top: 26, right: 22, bottom: 40, left: 58 };
  const xs = rows.map((p) => p.x);
  const ys = rows.map((p) => p.y);
  const padX = (Math.max(...xs) - Math.min(...xs)) * 0.12 || 1;
  const padY = (Math.max(...ys) - Math.min(...ys)) * 0.16 || 1;
  const x = scaleLinear()
    .domain([Math.min(0, Math.min(...xs) - padX), Math.max(...xs) + padX])
    .range([m.left, width - m.right])
    .nice();
  const y = scaleLinear()
    .domain([Math.min(...ys, refY) - padY, Math.max(...ys, refY) + padY])
    .range([height - m.bottom, m.top])
    .nice();
  const rsc = scaleSqrt()
    .domain([0, Math.max(...rows.map((p) => p.size))])
    .range([0, width < 640 ? 18 : 26]);
  const near = (px: number, py: number) => {
    let best = -1;
    let d2 = Infinity;
    rows.forEach((p, i) => {
      const dx = x(p.x) - px;
      const dy = y(p.y) - py;
      const d = dx * dx + dy * dy;
      if (d < d2) {
        d2 = d;
        best = i;
      }
    });
    return d2 < 90 * 90 ? best : null;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setHover(near(e.clientX - b.left, e.clientY - b.top));
  };
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
  const hp = hover != null ? rows[hover] : undefined;
  const CH = 6.8;
  const hName = hp ? hp.name.toUpperCase() : '';
  const hFigs = hp ? readout(hp) : '';
  const boxW = hp ? Math.min(width, 20 + (hName.length + hFigs.length + 3) * CH) : 0;
  const boxX = hp ? Math.max(0, Math.min(width - boxW, x(hp.x) - boxW / 2)) : 0;
  const boxY = hp ? Math.max(2, y(hp.y) - rsc(hp.size) - 28) : 0;
  /* The biggest carry their name on the chart and the rest are read by pointer or
     keys, but a name is dropped when it would land on one already placed: two of the
     three collided on the live page, 13 Sep 2026. */
  const placed: { x: number; y: number }[] = [];
  const named = new Set(
    rows
      .slice()
      .sort((a, b) => b.size - a.size)
      .filter((p) => {
        if (placed.length >= 3) return false;
        const px = x(p.x);
        const py = y(p.y);
        if (placed.some((q) => Math.abs(q.x - px) < 90 && Math.abs(q.y - py) < 18)) return false;
        // and never over another bubble: the name sits just above this one, so any
        // circle whose body reaches that band would be written across.
        const ty = py - Math.max(4, rsc(p.size)) - 5;
        if (rows.some((o) => o.key !== p.key && Math.abs(x(o.x) - px) < 60 && Math.abs(y(o.y) - ty) < Math.max(4, rsc(o.size)) + 6)) return false;
        placed.push({ x: px, y: py });
        return true;
      })
      .map((p) => p.key),
  );
  const grp = useChartEntry(ref, reduce);
  const pop = (delay: number) => (reduce ? {} : mark({ scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1 }, delay, 0.45));
  const fade = (delay: number) => (reduce ? {} : mark({ opacity: 0 }, { opacity: 1 }, delay, 0.3));

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className="chart quad" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onFocus={() => setHover(0)} onBlur={() => setHover(null)} id={id}>
        <rect className="capture" x={m.left} y={m.top} width={Math.max(0, width - m.left - m.right)} height={Math.max(0, height - m.top - m.bottom)} fill="transparent" />
        <g className="grid">
          {y.ticks(4).map((t) => (
            <g key={`y${t}`}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end">
                {fy(t)}
              </text>
            </g>
          ))}
          {x.ticks(width < 640 ? 3 : 5).map((t) => (
            <text key={`x${t}`} x={x(t)} y={height - m.bottom + 14} textAnchor="middle">
              {fx(t)}
            </text>
          ))}
        </g>
        <motion.g {...grp}>
        <motion.line className="ref" x1={m.left} x2={width - m.right} y1={y(refY)} y2={y(refY)} {...fade(0.15)} />
        <motion.line className="ref" x1={x(refX)} x2={x(refX)} y1={m.top} y2={height - m.bottom} {...fade(0.15)} />
        <motion.text className="ref-t" x={width - m.right} y={y(refY) - 5} textAnchor="end" {...fade(0.3)}>
          {refLabel.toUpperCase()} {fy(refY)}
        </motion.text>
        <text className="ax" x={width - m.right} y={height - 6} textAnchor="end">
          {xLabel.toUpperCase()}
        </text>
        <text className="ax" x={2} y={11} textAnchor="start">
          {yLabel.toUpperCase()}
        </text>
        {rows.map((p, i) => (
          <g key={p.key} className={cx('bub', hover === i && 'on')}>
            <motion.circle className={cx('dot', p.y < 0 ? 'neg' : p.y >= refY ? 'up' : 'down', hover === i && 'mk-on')} cx={x(p.x)} cy={y(p.y)} r={Math.max(4, rsc(p.size))} style={{ originX: `${x(p.x)}px`, originY: `${y(p.y)}px` }} {...pop(0.04 * i)} />
            {named.has(p.key) && (
              <motion.text className="bub-t" x={x(p.x)} y={y(p.y) - Math.max(4, rsc(p.size)) - 5 < m.top + 10 ? y(p.y) + Math.max(4, rsc(p.size)) + 13 : y(p.y) - Math.max(4, rsc(p.size)) - 5} textAnchor="middle" {...fade(0.35 + 0.04 * i)}>
                {p.name.length > 18 ? p.name.slice(0, 17) + '.' : p.name}
              </motion.text>
            )}
          </g>
        ))}
        </motion.g>
        {hp && (
          <g className="readbox" aria-hidden="true" transform={`translate(${boxX}, ${boxY})`}>
            <rect width={boxW} height={22} />
            <text x={10} y={15} className="ink">
              {hName}
            </text>
            <text x={10 + (hName.length + 2) * CH} y={15} className={hp.y < 0 ? 'hz' : undefined}>
              {hFigs}
            </text>
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {hp ? `${hp.name}: ${hFigs.toLowerCase()}` : ''}
      </p>
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="sw c-ink" /> At or above the {refLabel.toLowerCase()}
        </span>
        <span>
          <i className="sw c-spot" /> Below the {refLabel.toLowerCase()}
        </span>
        <span>
          <i className="sw c-hz" /> Negative
        </span>
        <span className="muted">Bubble area is the figure the two axes are drawn from</span>
      </div>
    </div>
  );
}
