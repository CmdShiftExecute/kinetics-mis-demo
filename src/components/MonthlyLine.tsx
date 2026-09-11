import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { max } from 'd3-array';
import { motion, useReducedMotion } from 'motion/react';
import type { MonthPoint } from '../../data/schema';
import { k, signedK } from '../lib/format';

interface Props {
  points: MonthPoint[];
  year: number;
  height?: number;
  /** Text for assistive technology. */
  label: string;
}

interface XY {
  i: number;
  v: number;
}

/**
 * Monthly revenue as a time series: actual (solid), forecast (dashed), budget (thin).
 * Hand-rolled SVG with d3-scale and d3-shape only. One axis, thin marks,
 * direct labels, a crosshair on hover with the exact value and month.
 */
export function MonthlyLine({ points, year, height = 250, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.max(320, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = { top: 20, right: 92, bottom: 26, left: 52 };
  const x = scalePoint<number>()
    .domain(points.map((p) => p.index))
    .range([m.left, width - m.right]);
  const yMax = max(points, (p) => Math.max(p.actual ?? 0, p.forecast ?? 0, p.budget)) ?? 1;
  const y = scaleLinear()
    .domain([0, yMax * 1.12])
    .range([height - m.bottom, m.top]);
  const gen = d3line<XY>()
    .x((d) => x(d.i) ?? 0)
    .y((d) => y(d.v));

  const budgetPts = points.map((p) => ({ i: p.index, v: p.budget }));
  const actualPts = points.filter((p) => p.actual != null).map((p) => ({ i: p.index, v: p.actual as number }));
  const lastActual = actualPts[actualPts.length - 1];
  const fcPts = [...(lastActual ? [lastActual] : []), ...points.filter((p) => p.forecast != null).map((p) => ({ i: p.index, v: p.forecast as number }))];
  const ticks = y.ticks(4).filter((t) => t > 0);
  const tickStep = ticks.length > 1 ? (ticks[1] ?? 0) - (ticks[0] ?? 0) : 1000;
  const fmtTick = (t: number) => (tickStep < 1000 ? `${(t / 1000).toFixed(1)}M` : `${(t / 1000).toFixed(0)}M`);

  const nearest = (px: number) => {
    let best = points[0]!.index;
    let dist = Infinity;
    for (const p of points) {
      const d = Math.abs((x(p.index) ?? 0) - px);
      if (d < dist) {
        dist = d;
        best = p.index;
      }
    }
    return best;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(nearest(e.clientX - rect.left));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = hover ?? (lastActual?.i ?? 1);
      setHover(Math.min(12, Math.max(1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
    }
    if (e.key === 'Escape') setHover(null);
  };

  const hp = hover != null ? points.find((p) => p.index === hover) : undefined;
  const hx = hp ? (x(hp.index) ?? 0) : 0;
  const hv = hp ? (hp.actual ?? hp.forecast ?? hp.budget) : 0;
  const delta = hp ? hv - hp.budget : 0;
  const boxW = 168;
  const boxX = hx + boxW + 12 > width ? hx - boxW - 12 : hx + 12;
  const boxY = Math.max(m.top, Math.min(y(hv) - 30, height - m.bottom - 70));

  const draw = reduce ? {} : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true, amount: 0.4 } };
  const endLabelY = (v: number, dy: number) => Math.min(height - m.bottom - 4, Math.max(m.top + 8, y(v) + dy));
  const fcEnd = fcPts[fcPts.length - 1];
  const bdEnd = budgetPts[budgetPts.length - 1]!;
  let fcLabelY = fcEnd ? endLabelY(fcEnd.v, 4) : 0;
  let bdLabelY = endLabelY(bdEnd.v, 4);
  if (fcEnd && Math.abs(fcLabelY - bdLabelY) < 13) {
    if (fcEnd.v >= bdEnd.v) {
      fcLabelY -= 7;
      bdLabelY += 7;
    } else {
      fcLabelY += 7;
      bdLabelY -= 7;
    }
  }

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        className="chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onFocus={() => setHover(lastActual?.i ?? 1)}
        onBlur={() => setHover(null)}
      >
        <g className="grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end">
                {fmtTick(t)}
              </text>
            </g>
          ))}
          <line x1={m.left} x2={width - m.right} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--ink)' }} />
        </g>
        {points.map((p) => (
          <text key={p.index} x={x(p.index)} y={height - 8} textAnchor="middle">
            {p.month.toUpperCase()}
          </text>
        ))}
        <motion.path className="l-budget" d={gen(budgetPts) ?? ''} {...draw} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <motion.path className="l-actual" d={gen(actualPts) ?? ''} {...draw} transition={{ duration: 1.1, delay: 0.1, ease: 'easeOut' }} />
        <motion.path className="l-forecast" d={gen(fcPts) ?? ''} {...draw} transition={{ duration: 0.9, delay: 0.9, ease: 'easeOut' }} />
        {lastActual && (
          <text className="ink" x={(x(lastActual.i) ?? 0) + 8} y={endLabelY(lastActual.v, -8)}>
            ACTUAL
          </text>
        )}
        {fcEnd && (
          <text className="ink" x={(x(fcEnd.i) ?? 0) + 8} y={fcLabelY}>
            FORECAST
          </text>
        )}
        <text x={(x(bdEnd.i) ?? 0) + 8} y={bdLabelY}>
          BUDGET
        </text>
        {hp && (
          <g aria-hidden="true">
            <line className="xh" x1={hx} x2={hx} y1={m.top} y2={height - m.bottom} />
            <circle className="dot" cx={hx} cy={y(hp.budget)} r={3} />
            <circle className="dot" cx={hx} cy={y(hv)} r={4} />
            <g className="readbox" transform={`translate(${boxX}, ${boxY})`}>
              <rect width={boxW} height={delta === 0 ? 52 : 64} />
              <text x={9} y={15} className="ink">
                {hp.month.toUpperCase()} {year}
              </text>
              <text x={9} y={30}>
                {hp.actual != null ? 'ACTUAL' : 'FORECAST'} {k(hv)}
              </text>
              <text x={9} y={44}>
                BUDGET {k(hp.budget)}
              </text>
              {delta !== 0 && (
                <text x={9} y={58} className={delta < 0 ? 'hz' : undefined}>
                  VS BUDGET {signedK(delta)}
                </text>
              )}
            </g>
          </g>
        )}
      </svg>
      <ul className="chart-legend" aria-hidden="true">
        <li>
          <i /> Actual
        </li>
        <li>
          <i className="fc" /> Forecast
        </li>
        <li>
          <i className="bd" /> Budget
        </li>
      </ul>
    </div>
  );
}
