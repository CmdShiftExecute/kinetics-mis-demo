import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { ForecastRow, Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { MONTHS, k, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyChart } from '../components/MonthlyChart';
import { ChartSwitch } from '../components/ChartSwitch';
import { Donut } from '../components/Donut';
import { HBars } from '../components/HBars';
import type { BarRow } from '../components/HBars';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';

/** Revenue forecast and pipeline by vertical, with the division's monthly run. */
export default function PipelineReport() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rowReveal = useRowReveal();
  const rise = useRise();
  if (error) {
    return (
      <div className="wrap">
        <ErrorBlock message={error} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
        <TableSkeleton rows={12} />
      </div>
    );
  }
  const { meta, forecast, monthly, overview: o, definitions, sources, largestVertical } = data;
  const asOf = meta.dataAsOfLabel;
  const forecastBars: BarRow[] = forecast.rows
    .slice()
    .sort((a, b) => b.fyForecast - a.fyForecast)
    .map((r) => ({
      key: r.slug,
      name: r.name,
      segments: [
        { key: 'ytd', value: r.ytdRevenue, cls: 'ink' as const },
        { key: 'rest', value: r.nearMonthForecast + r.restOfYearForecast, cls: 'spot' as const },
      ],
      target: r.fyBudget,
      end: k(r.fyForecast),
      endDelta: signedK(r.dFy),
      endBad: r.dFy < 0,
      readout: `FORECAST ${k(r.fyForecast)} VS BUDGET ${k(r.fyBudget)}, ${signedK(r.dFy)} (${signedPct(r.fcVsBudgetPct)}); ${k(r.ytdRevenue)} ALREADY BANKED`,
    }));
  const nearMonth = MONTHS[meta.monthsElapsed] ?? 'Sep';
  const restLabel = `${MONTHS[meta.monthsElapsed + 1]} to Dec`;
  const others = forecast.rows.filter((r) => r.slug !== largestVertical.slug);
  const largest = forecast.rows.find((r) => r.slug === largestVertical.slug)!;


  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            Pipeline
          </motion.h1>
          <p className="page-sub">Revenue forecast and pipeline by vertical, full year {meta.fiscalYear}</p>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          {meta.periodLabel} actual, {meta.nearMonth} onward forecast, FY budget
        </p>
      </div>

      <Strip
        cols={4}
        items={[
          { label: 'FY revenue forecast', value: o.delivery.fyForecast },
          { label: 'FY revenue budget', value: o.delivery.fyBudget },
          { label: 'Forecast less budget', value: o.delivery.variance, f: signedK, sub: `${signedPct(o.delivery.variancePct)} of budget`, bad: o.delivery.variance < 0 },
          { label: `Year on year`, value: o.delivery.yoyPct, f: signedPct, sub: `FY ${meta.fiscalYear - 1} actual ${k(o.delivery.priorYear)}`, bad: o.delivery.yoyPct < 0 },
        ]}
      />

      <Section id="monthly" title="Monthly revenue, division" note={`Actual to ${meta.currentMonthLabel}, forecast from ${meta.nearMonth}, against the phased budget.`} source={sources['rollup.monthly']} asOf={asOf} defs={['fyForecast', 'variance']} definitions={definitions}>
        <MonthlyChart points={monthly} year={meta.fiscalYear} subject="the division" id="dl" height={260} />
      </Section>

      <Section id="forecast-by-vertical" title="Revenue forecast and pipeline by vertical" note={`Prior year, YTD actual, ${meta.nearMonth} forecast, ${meta.restOfYear} forecast, FY forecast against FY budget.`} source={sources['rollup.forecast']} asOf={asOf} defs={['priorYear', 'ytdRevenue', 'nearMonth', 'restOfYear', 'fyForecast', 'fyBudget', 'yoy']} definitions={definitions}>
        <ChartSwitch
          id="fc-chart"
          views={[
            {
              key: 'bars',
              label: 'Forecast against budget',
              icon: 'bars',
              render: () => (
                <HBars
                  id="fc-chart-bars"
                  ariaLabel="Full-year revenue forecast by vertical, split into revenue already banked and the rest of the year, against the full-year budget. Exact values are in the table below."
                  format={k}
                  shortfall
                  legend={[
                    { cls: 'ink', label: 'Banked, year to date' },
                    { cls: 'spot', label: 'Forecast, rest of year' },
                    { cls: 'tick', label: 'FY budget' },
                    { cls: 'gap', label: 'Shortfall to budget' },
                  ]}
                  rows={forecastBars}
                />
              ),
            },
            {
              key: 'share',
              label: 'Share of the forecast',
              icon: 'donut',
              render: () => <Donut id="fc-chart-donut" format={k} centreLabel="FY forecast" ariaLabel="Share of the full-year revenue forecast by vertical. Exact values are in the table below." rows={forecast.rows.map((r) => ({ key: r.slug, name: r.name, value: r.fyForecast }))} />,
            },
          ]}
        />
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">FY {meta.fiscalYear - 1} actual</th>
                <th scope="col">YTD actual</th>
                <th scope="col">{nearMonth} forecast</th>
                <th scope="col">{restLabel} forecast</th>
                <th scope="col">FY forecast</th>
                <th scope="col">FY budget</th>
                <th scope="col">Forecast less budget</th>
                <th scope="col">Forecast vs budget</th>
                <th scope="col">Year on year</th>
              </tr>
            </thead>
            <tbody>
              {others.map((r, i) => (
                <Row key={r.slug} r={r} reveal={rowReveal(i)} />
              ))}
              <Row r={forecast.subtotalExcludingLargest} cls="sub" />
              <Row r={largest} />
              <Row r={forecast.total} cls="total" />
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
          FY forecast equals YTD actual plus the two forecast columns, exactly. The monthly values of each vertical are on its own page.
        </p>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

function Row({ r, cls, reveal }: { r: ForecastRow; cls?: string; reveal?: object }) {
  const cells = (
    <>
      <td>
        {cls ? (
          r.name
        ) : (
          <Link to={`/v/${r.slug}`} className="vlink press">
            {r.name}
          </Link>
        )}
      </td>
      <Num v={r.priorYearRevenue} />
      <Num v={r.ytdRevenue} />
      <Num v={r.nearMonthForecast} />
      <Num v={r.restOfYearForecast} />
      <Num v={r.fyForecast} />
      <Num v={r.fyBudget} />
      <Num v={r.dFy} f={signedK} bad={r.dFy < 0} />
      <Num v={r.fcVsBudgetPct} f={signedPct} bad={r.fcVsBudgetPct < 0} />
      <Num v={r.yoyPct} f={signedPct} bad={r.yoyPct < 0} />
    </>
  );
  if (reveal) {
    return (
      <motion.tr className={cls ?? 'hov'} {...reveal}>
        {cells}
      </motion.tr>
    );
  }
  return <tr className={cls ?? 'hov'}>{cells}</tr>;
}
