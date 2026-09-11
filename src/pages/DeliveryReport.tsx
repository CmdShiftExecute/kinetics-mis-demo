import { Link } from 'react-router';
import type { ForecastRow, Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { MONTHS, k, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyLine } from '../components/MonthlyLine';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';

/** Revenue forecast and pipeline by vertical, with the division's monthly run. */
export default function DeliveryReport() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
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
  const nearMonth = MONTHS[meta.monthsElapsed] ?? 'Sep';
  const restLabel = `${MONTHS[meta.monthsElapsed + 1]} to Dec`;
  const others = forecast.rows.filter((r) => r.slug !== largestVertical.slug);
  const largest = forecast.rows.find((r) => r.slug === largestVertical.slug)!;


  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <h1 className="display page-title">Delivery</h1>
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
        <MonthlyLine points={monthly} year={meta.fiscalYear} subject="the division" id="dl" height={260} />
      </Section>

      <Section id="forecast-by-vertical" title="Revenue forecast and pipeline by vertical" note={`Prior year, YTD actual, ${meta.nearMonth} forecast, ${meta.restOfYear} forecast, FY forecast against FY budget.`} source={sources['rollup.forecast']} asOf={asOf} defs={['priorYear', 'ytdRevenue', 'nearMonth', 'restOfYear', 'fyForecast', 'fyBudget', 'yoy']} definitions={definitions}>
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
              {others.map((r) => (
                <Row key={r.slug} r={r} />
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

function Row({ r, cls }: { r: ForecastRow; cls?: string }) {
return (
  <tr className={cls ?? 'hov'}>
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
  </tr>
);
}
