import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { max } from 'd3-array';
import { motion, useReducedMotion } from 'motion/react';
import type { MonthPoint } from '../../data/schema';
import { cx, k, signedK } from '../lib/format';
import { GROUP_IN_VIEW, mark } from './ChartMotion';
import { useWidth } from './useWidth';

interface Props {
  points: MonthPoint[];
  year: number;
  subject: string;
  id: string;
  /** `columns` is a month-by-month read, `cumulative` is the year to date against plan. */
  mode: 'columns' | 'cumulative';
  height?: number;
}

interface Cume {
  index: number;
  month: string;
  run: number;
  runBudget: number;
  actual: boolean;
}

/**
 * The same twelve months read two other ways. Columns compare each month with its
 * own budget on an axis that starts at zero, because a truncated column lies about
 * its own length. Cumulative tracks the year against plan, the gap between the two
 * lines shaded, which is the figure a monthly line cannot show. Both share the
 * chart's crosshair, keyboard walk and live readout; exact values are in the table
 * below the chart.
 */
export function MonthlyBars({ points, year, subject, id, mode, height = 250 }: Props) {
  const { ref, width } = useWidth(900);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const m = { top: 20, right: 16, bottom: 26, left: 58 };
  /* Half of the first column used to hang left of the axis and cover the last digit
     of every tick label, measured on the live page 13 Sep 2026. The scale is inset by
     half a column, computed from the plot width rather than from the scale's own step,
     which would be circular. */
  const barW = Math.max(6, Math.min(26, ((width - m.left - m.right) / Math.max(1, points.length)) * 0.5));
  const x = scalePoint<number>()
    .domain(points.map((p) => p.index))
    .range([m.left + barW / 2 + 2, width - m.right - barW / 2]);
  const dense = width < 640;

  const cume = points.reduce<Cume[]>((out, p) => {
    const prev = out[out.length - 1];
    out.push({ index: p.index, month: p.month, run: (prev?.run ?? 0) + (p.actual ?? p.forecast ?? 0), runBudget: (prev?.runBudget ?? 0) + p.budget, actual: p.actual != null });
    return out;
  }, []);

  const top = mode === 'columns' ? (max(points, (p) => Math.max(p.actual ?? p.forecast ?? 0, p.budget)) ?? 1) : (max(cume, (c) => Math.max(c.run, c.runBudget)) ?? 1);
  const y = scaleLinear()
    .domain([0, top * 1.08])
    .range([height - m.bottom, m.top])
    .nice();
  const ticks = y.ticks(4);
  const lastActual = points.filter((p) => p.actual != null).length;
  const boundaryX = lastActual > 0 && lastActual < points.length ? ((x(lastActual) ?? 0) + (x(lastActual + 1) ?? 0)) / 2 : null;

  const gen = d3line<Cume>()
    .x((d) => x(d.index) ?? 0)
    .y((d) => y(d.run));
  const genB = d3line<Cume>()
    .x((d) => x(d.index) ?? 0)
    .y((d) => y(d.runBudget));

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
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX - e.currentTarget.getBoundingClientRect().left));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover(Math.min(12, Math.max(1, (hover ?? (lastActual || 1)) + (e.key === 'ArrowRight' ? 1 : -1))));
    }
    if (e.key === 'Escape') setHover(null);
  };
  const hp = hover != null ? points.find((p) => p.index === hover) : undefined;
  const hc = hover != null ? cume.find((c) => c.index === hover) : undefined;
  const hx = hp ? (x(hp.index) ?? 0) : 0;
  const boxW = mode === 'columns' ? 186 : 214;
  const boxX = hx + boxW + 12 > width ? hx - boxW - 12 : hx + 12;
  const hv = hp ? (hp.actual ?? hp.forecast ?? 0) : 0;
  const boxTop = mode === 'columns' ? y(hv) : y(Math.max(hc?.run ?? 0, hc?.runBudget ?? 0));
  const boxY = Math.max(m.top, Math.min(boxTop - 30, height - m.bottom - 66));
  const readout = hp && hc ? (mode === 'columns' ? `${hp.month} ${year}: ${hp.actual != null ? 'actual' : 'forecast'} ${k(hv)}, budget ${k(hp.budget)}, variance ${signedK(hp.variance)}` : `${hp.month} ${year}: ${k(hc.run)} to date against plan ${k(hc.runBudget)}, ${signedK(hc.run - hc.runBudget)}`) : '';
  const grp = reduce ? {} : GROUP_IN_VIEW;
  const draw = (delay: number, duration = 0.9) => (reduce ? {} : mark({ pathLength: 0 }, { pathLength: 1 }, delay, duration));
  /* The running gap, drawn under the cumulative lines. On this division the two
     lines sit within one percent of each other all year, so the band between them
     is invisible at the chart's own scale and the view said nothing. The gap gets
     its own zero baseline and its own scale, which is the figure a reader of a
     cumulative chart actually wants. */
  const gaps = cume.map((c) => ({ ...c, gap: c.run - c.runBudget }));
  const gh = 92;
  const gm = { top: 12, bottom: 20 };
  const gmax = Math.max(...gaps.map((g) => Math.abs(g.gap)), 1) * 1.2;
  const gy = scaleLinear().domain([-gmax, gmax]).range([gh - gm.bottom, gm.top]);
  const gArea = d3area<(typeof gaps)[number]>()
    .x((d) => x(d.index) ?? 0)
    .y0(() => gy(0))
    .y1((d) => gy(d.gap));
  const gLine = d3line<(typeof gaps)[number]>()
    .x((d) => x(d.index) ?? 0)
    .y((d) => gy(d.gap));
  const endGap = gaps[gaps.length - 1]!;
  const grow = (delay: number) => (reduce ? {} : mark({ scaleY: 0 }, { scaleY: 1 }, delay));
  const fade = (delay: number) => (reduce ? {} : mark({ opacity: 0 }, { opacity: 1 }, delay, 0.4));

  return (
    <div className="chart-wrap" ref={ref}>
      <p className="chart-axis-note">
        AED thousand. {mode === 'columns' ? 'Each month against its own phased budget; the axis starts at zero.' : `Running total from January, actual to ${points[lastActual - 1]?.month ?? 'date'} then forecast, against the phased budget run to the same month.`}
      </p>
      <svg className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode === 'columns' ? 'Monthly revenue against budget' : 'Cumulative revenue against plan'} for ${subject}. Exact values are in the table below.`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onFocus={() => setHover(lastActual || 1)} onBlur={() => setHover(null)} id={id}>
        <rect className="capture" x={0} y={0} width={width} height={height} fill="transparent" />
        {boundaryX != null && (
          <g className="fc-zone" aria-hidden="true">
            <rect x={boundaryX} y={m.top} width={width - m.right - boundaryX} height={height - m.top - m.bottom} />
            <line x1={boundaryX} x2={boundaryX} y1={m.top} y2={height - m.bottom} />
            <text x={boundaryX + 6} y={m.top + 10}>
              FORECAST
            </text>
          </g>
        )}
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
        {points.map((p) =>
          dense && p.index % 2 === 0 ? null : (
            <text key={p.index} x={x(p.index)} y={height - 8} textAnchor="middle">
              {p.month.toUpperCase()}
            </text>
          ),
        )}
        <motion.g {...grp}>
        {mode === 'columns' ? (
          <>
            {points.map((p) => {
              const v = p.actual ?? p.forecast ?? 0;
              const cx0 = (x(p.index) ?? 0) - barW / 2;
              return (
                <g key={p.index}>
                  <motion.rect className={cx('seg', p.actual != null ? 'c-ink' : 'c-spot', hover === p.index && 'mk-on')} x={cx0} y={y(v)} width={barW} height={Math.max(1, y(0) - y(v))} style={{ originY: 1 }} {...grow(0.035 * p.index)} />
                  <motion.line className="tick" x1={cx0 - 3} x2={cx0 + barW + 3} y1={y(p.budget)} y2={y(p.budget)} {...fade(0.035 * p.index + 0.3)} />
                </g>
              );
            })}
          </>
        ) : (
          <>
            <motion.path className="l-budget" d={genB(cume) ?? ''} {...draw(0)} />
            <motion.path className="l-actual" d={gen(cume) ?? ''} {...draw(0.12)} />
            {cume.map((c) => (
              <motion.circle key={c.index} className={cx('dot', hover === c.index && 'mk-on')} cx={x(c.index)} cy={y(c.run)} r={hover === c.index ? 5 : 2.5} {...fade(0.6 + 0.02 * c.index)} />
            ))}
          </>
        )}
        </motion.g>
        {hp && hc && (
          <g aria-hidden="true">
            <line className="xh" x1={hx} x2={hx} y1={m.top} y2={height - m.bottom} />
            <g className="readbox" transform={`translate(${boxX}, ${boxY})`}>
              <rect width={boxW} height={mode === 'columns' ? 62 : 62} />
              <text x={9} y={15} className="ink">
                {hp.month.toUpperCase()} {year}
              </text>
              {mode === 'columns' ? (
                <>
                  <text x={9} y={30}>
                    {hp.actual != null ? 'ACTUAL' : 'FORECAST'} {k(hv)}
                  </text>
                  <text x={9} y={44}>
                    BUDGET {k(hp.budget)}
                  </text>
                  <text x={9} y={58} className={hp.variance < 0 ? 'hz' : undefined}>
                    VARIANCE {signedK(hp.variance)}
                  </text>
                </>
              ) : (
                <>
                  <text x={9} y={30}>
                    TO DATE {k(hc.run)}
                  </text>
                  <text x={9} y={44}>
                    PLAN TO DATE {k(hc.runBudget)}
                  </text>
                  <text x={9} y={58} className={hc.run < hc.runBudget ? 'hz' : undefined}>
                    GAP {signedK(hc.run - hc.runBudget)}
                  </text>
                </>
              )}
            </g>
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
      {mode === 'cumulative' && (
        <>
          <p className="chart-axis-note" style={{ marginTop: 'var(--s-md)' }}>
            Revenue to date less plan to date, AED thousand, zero baseline. The year ends {endGap.gap < 0 ? 'behind plan' : 'ahead of plan'} at {signedK(endGap.gap)}.
          </p>
          <svg className="chart vchart" width={width} height={gh} viewBox={`0 0 ${width} ${gh}`} role="img" aria-label={`Cumulative gap to plan for ${subject}. Exact values are in the table below.`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onFocus={() => setHover(lastActual || 1)} onBlur={() => setHover(null)}>
            <rect className="capture" x={0} y={0} width={width} height={gh} fill="transparent" />
            <motion.g {...grp}>
            <motion.path className={cx('band', endGap.gap < 0 && 'behind')} d={gArea(gaps) ?? ''} {...fade(0.35)} />
            <line className="zero" x1={m.left} x2={width - m.right} y1={gy(0)} y2={gy(0)} />
            <text x={m.left - 8} y={gy(0) + 4} textAnchor="end">
              0
            </text>
            <motion.path className="l-gap" d={gLine(gaps) ?? ''} {...draw(0.2)} />
            {hp && <line className="xh" x1={hx} x2={hx} y1={gm.top} y2={gh - gm.bottom} />}
            {gaps.map((g) => (
              <circle key={g.index} className={cx('dot', hover === g.index && 'mk-on')} cx={x(g.index)} cy={gy(g.gap)} r={hover === g.index ? 4.5 : 2} />
            ))}
            </motion.g>
            <text className={cx(endGap.gap < 0 && 'hz')} x={(x(endGap.index) ?? 0) - 4} y={gy(endGap.gap) + (endGap.gap < 0 ? 14 : -8)} textAnchor="end">
              {signedK(endGap.gap)}
            </text>
          </svg>
        </>
      )}
      <div className="chart-legend" aria-hidden="true">
        {mode === 'columns' ? (
          <>
            <span>
              <i className="sw c-ink" /> Actual
            </span>
            <span>
              <i className="sw c-spot" /> Forecast
            </span>
            <span>
              <i className="sw c-tick" /> Budget
            </span>
          </>
        ) : (
          <>
            <span>
              <i /> Revenue to date
            </span>
            <span>
              <i className="bd" /> Plan to date
            </span>
            <span>
              <i className="sw c-band" /> Gap to plan, panel below
            </span>
          </>
        )}
      </div>
    </div>
  );
}
