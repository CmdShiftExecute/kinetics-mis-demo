import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { max, min } from 'd3-array';
import { animate, motion, useReducedMotion } from 'motion/react';
import type { AnimationPlaybackControls } from 'motion/react';
import type { MonthPoint } from '../../data/schema';
import { AED_COMPACT_GUIDE, cx, k, signedK } from '../lib/format';
import { GROUP_IN_VIEW, mark } from './ChartMotion';

interface Props {
  points: MonthPoint[];
  year: number;
  height?: number;
  /** Name of the series for the accessible label and the values table. */
  subject: string;
  /** Unique id prefix so several charts can sit on one page. */
  id: string;
}

interface XY {
  i: number;
  v: number;
}

/**
 * Monthly revenue as a time series: actual (solid), forecast (dashed), budget
 * (thin), with the reporting boundary marked. The revenue axis is truncated
 * and says so. Beneath it, a zero-baseline variance plot labels every month's
 * difference, and a disclosure lists the exact values for keyboard and
 * assistive-technology readers.
 */
export function MonthlyLine({ points, year, height = 230, subject, id }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  /* The forecast reveal. Motion draws a line in by writing pathLength="1" and
     stroke-dasharray as SVG ATTRIBUTES, and a stylesheet rule beats an attribute.
     The forecast is dashed by the stylesheet (.l-forecast, 3 6), so on that path
     Motion's draw-in was silently overridden: the line sat fully drawn from the
     first frame, and with pathLength forced to 1 its dashes stretched to whole
     path-lengths, so it rendered solid as well. Found by the principal on
     13 Sep 2026. The dashed line is therefore revealed through a clip whose width
     is animated as an attribute, which nothing in a stylesheet can override, and
     the wipe starts the moment the actual line finishes drawing, so the pen simply
     continues past the boundary. */
  const clipRef = useRef<SVGRectElement>(null);
  const clipAnim = useRef<AnimationPlaybackControls | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => () => clipAnim.current?.stop(), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.max(300, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = { top: 18, right: 16, bottom: 24, left: 56 };
  const x = scalePoint<number>()
    .domain(points.map((p) => p.index))
    .range([m.left, width - m.right]);
  const allVals = points.flatMap((p) => [p.actual ?? p.forecast ?? p.budget, p.budget]);
  const lo = min(allVals) ?? 0;
  const hi = max(allVals) ?? 1;
  const pad = (hi - lo) * 0.25 || hi * 0.1;
  const yMin = Math.max(0, Math.floor((lo - pad) / 500) * 500);
  const yMax = Math.ceil((hi + pad * 0.6) / 500) * 500;
  const y = scaleLinear().domain([yMin, yMax]).range([height - m.bottom, m.top]);
  const gen = d3line<XY>()
    .x((d) => x(d.i) ?? 0)
    .y((d) => y(d.v));

  const budgetPts = points.map((p) => ({ i: p.index, v: p.budget }));
  const actualPts = points.filter((p) => p.actual != null).map((p) => ({ i: p.index, v: p.actual as number }));
  const lastActual = actualPts[actualPts.length - 1];
  const firstForecast = points.find((p) => p.forecast != null);
  const fcPts = [...(lastActual ? [lastActual] : []), ...points.filter((p) => p.forecast != null).map((p) => ({ i: p.index, v: p.forecast as number }))];
  const ticks = y.ticks(4);
  const dense = width < 640;
  const boundaryX = lastActual && firstForecast ? ((x(lastActual.i) ?? 0) + (x(firstForecast.index) ?? 0)) / 2 : null;

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
  const boxW = 176;
  const boxX = hx + boxW + 12 > width ? hx - boxW - 12 : hx + 12;
  const boxY = Math.max(m.top, Math.min(y(hv) - 30, height - m.bottom - 66));
  const readout = hp ? `${hp.month} ${year}: ${hp.actual != null ? 'actual' : 'forecast'} ${k(hv)}, budget ${k(hp.budget)}, variance ${signedK(hp.variance)}` : '';

  // variance plot
  const vh = 96;
  const vm = { top: 10, bottom: 18 };
  const vmax = max(points, (p) => Math.abs(p.variance)) ?? 1;
  const vy = scaleLinear().domain([-vmax, vmax]).range([vh - vm.bottom, vm.top]);
  const barW = Math.max(6, Math.min(18, (x.step() ?? 20) * 0.45));
  const grp = reduce ? {} : GROUP_IN_VIEW;
  const draw = (delay: number, duration: number) => (reduce ? {} : mark({ pathLength: 0 }, { pathLength: 1 }, delay, duration));
  // The clip starts two units left of the last actual point so the round cap is kept,
  // and runs to the right edge of the svg so nothing to the right is ever cut.
  const clipX = (lastActual ? (x(lastActual.i) ?? m.left) : m.left) - 2;
  const clipSpan = Math.max(0, width - clipX);
  const clipId = `${id}-fc-clip`;
  const revealForecast = () => {
    const r = clipRef.current;
    if (reduce || revealed || !r) return;
    clipAnim.current?.stop();
    clipAnim.current = animate(0, clipSpan, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => r.setAttribute('width', String(v)),
      onComplete: () => setRevealed(true),
    });
  };

  return (
    <div className="chart-wrap" ref={ref}>
      <p className="chart-axis-note">
        {AED_COMPACT_GUIDE}. {yMin > 0 ? `Revenue axis starts at ${k(yMin)}, not zero.` : 'Revenue axis starts at zero.'} {lastActual ? `Actual to ${points[lastActual.i - 1]!.month}, forecast after.` : ''}
      </p>
      <svg
        className="chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Monthly revenue for ${subject}, actual then forecast, against budget. Exact values are in the table below.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onFocus={() => setHover(lastActual?.i ?? 1)}
        onBlur={() => setHover(null)}
      >
        <rect className="hit" x={0} y={0} width={width} height={height} fill="transparent" />
        {boundaryX != null && (
          <g className="fc-zone" aria-hidden="true">
            <rect x={boundaryX} y={m.top} width={width - m.right - boundaryX} height={height - m.top - m.bottom} />
            <line x1={boundaryX} x2={boundaryX} y1={m.top} y2={height - m.bottom} />
            <text x={boundaryX - 6} y={m.top + 10} textAnchor="end">
              ACTUAL
            </text>
            <text x={boundaryX + 6} y={m.top + 10}>
              FORECAST
            </text>
          </g>
        )}
        <g className="grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end">
                {k(t)}
              </text>
            </g>
          ))}
        </g>
        {points.map((p) =>
          dense && p.index % 2 === 0 ? null : (
            <text key={p.index} x={x(p.index)} y={height - 7} textAnchor="middle">
              {p.month.toUpperCase()}
            </text>
          ),
        )}
        <motion.g {...grp}>
        <motion.path className="l-budget" d={gen(budgetPts) ?? ''} {...draw(0, 1)} />
        <motion.path className="l-actual" d={gen(actualPts) ?? ''} {...draw(0.1, 1)} onAnimationComplete={revealForecast} />
        {/* Under reduced motion the clip is not applied at all: the forecast is simply there. */}
        {!reduce && (
          <clipPath id={clipId}>
            <rect ref={clipRef} x={clipX} y={0} width={revealed ? clipSpan : 0} height={height} />
          </clipPath>
        )}
        <path className="l-forecast" d={gen(fcPts) ?? ''} clipPath={reduce ? undefined : `url(#${clipId})`} />
        </motion.g>
        {hp && (
          <g aria-hidden="true">
            <line className="xh" x1={hx} x2={hx} y1={m.top} y2={height - m.bottom} />
            <line className="xh-tick" x1={hx} x2={hx} y1={height - m.bottom} y2={height - m.bottom + 6} />
            <circle className="dot" cx={hx} cy={y(hp.budget)} r={3} />
            <circle className="dot" cx={hx} cy={y(hv)} r={4} />
            <g className="readbox" transform={`translate(${boxX}, ${boxY})`}>
              <rect width={boxW} height={62} />
              <text x={9} y={15} className="ink">
                {hp.month.toUpperCase()} {year}
              </text>
              <text x={9} y={30}>
                {hp.actual != null ? 'ACTUAL' : 'FORECAST'} {k(hv)}
              </text>
              <text x={9} y={44}>
                BUDGET {k(hp.budget)}
              </text>
              <text x={9} y={58} className={hp.variance < 0 ? 'hz' : undefined}>
                VARIANCE {signedK(hp.variance)}
              </text>
            </g>
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i /> Actual
        </span>
        <span>
          <i className="fc" /> Forecast
        </span>
        <span>
          <i className="bd" /> Budget
        </span>
      </div>

      <p className="chart-axis-note" style={{ marginTop: 'var(--s-lg)' }}>
        Variance to budget by month: actual (or forecast) less budget, {AED_COMPACT_GUIDE}, zero baseline.
      </p>
      <svg
        className="chart vchart"
        width={width}
        height={vh}
        viewBox={`0 0 ${width} ${vh}`}
        role="img"
        aria-label={`Monthly variance to budget for ${subject}. Exact values are in the table below.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onFocus={() => setHover(lastActual?.i ?? 1)}
        onBlur={() => setHover(null)}
      >
        <rect className="hit" x={0} y={0} width={width} height={vh} fill="transparent" />
        <line className="zero" x1={m.left} x2={width - m.right} y1={vy(0)} y2={vy(0)} />
        {hp && <line className="xh" x1={hx} x2={hx} y1={vm.top} y2={vh - vm.bottom} />}
        <text x={m.left - 8} y={vy(0) + 4} textAnchor="end">
          0
        </text>
        <motion.g {...grp}>
        {points.map((p) => {
          const cx0 = x(p.index) ?? 0;
          const top = Math.min(vy(0), vy(p.variance));
          const h = Math.abs(vy(0) - vy(p.variance));
          const neg = p.variance < 0;
          return (
            <g key={p.index}>
              <motion.rect
                className={cx('vbar', neg && 'neg', p.forecast != null && 'fc', hover === p.index && 'on')}
                x={cx0 - barW / 2}
                y={top}
                width={barW}
                height={Math.max(1, h)}
                style={{ originY: neg ? 0 : 1 }}
                {...(reduce ? {} : mark({ scaleY: 0 }, { scaleY: 1 }, 0.03 * p.index, 0.6))}
              />
              {(!dense || p.index % 2 === 1) && (
                <text className={neg ? 'hz' : undefined} x={cx0} y={neg ? top + h + 11 : top - 4} textAnchor="middle">
                  {signedK(p.variance)}
                </text>
              )}
            </g>
          );
        })}
        </motion.g>
      </svg>

    </div>
  );
}
