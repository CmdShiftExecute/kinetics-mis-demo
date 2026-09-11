import { Link } from 'react-router';
import type { ProfitabilityRow, Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { cx, pct, signedK } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { PlLadder } from '../components/PlLadder';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';

/** The P&L ladder in three column groups and vertical profitability on the FY forecast. */
export default function NetProfitReport() {
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
  const { meta, pl, profitability, definitions, sources, largestVertical } = data;
  const asOf = meta.dataAsOfLabel;
  const others = profitability.rows.filter((r) => r.slug !== largestVertical.slug);
  const largest = profitability.rows.find((r) => r.slug === largestVertical.slug)!;
  const maxShare = Math.max(...profitability.rows.map((x) => x.revenueShare));
  const plDefs = pl[0]!.rungs.map((r) => ({ key: `pl-${r.key}`, term: r.label, text: `${r.definition} Fed by: ${r.feeds}.` }));
  const defs = { ...definitions, ...Object.fromEntries(plDefs.map((d) => [d.key, d])) };


  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <h1 className="display page-title">Net profit</h1>
          <p className="page-sub">Profit and loss summary and vertical profitability, FY {meta.fiscalYear}</p>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          YTD actual, FY forecast, FY budget
        </p>
      </div>

      <Section id="pl" title="Profit and loss summary" note={`${largestVertical.name} is ${pct(largest.revenueShare, 0)} of forecast revenue, so the ladder is shown without it, for it alone, and in total. Hover or tab a line for its definition.`} source={sources['rollup.pl']} asOf={asOf} defs={['plColumns', ...plDefs.map((d) => d.key)]} definitions={defs}>
        <PlLadder groups={pl} cols={{ ytd: 'YTD', forecast: 'FY forecast', budget: 'FY budget' }} showVariance="last" />
        <p className="muted" style={{ marginTop: 'var(--s-md)' }}>
          Excluding {largestVertical.name} plus {largestVertical.name} equals the division total on every line, checked on the Data basis page.
        </p>
      </Section>

      <Section id="profitability" title="Vertical profitability" note={`Full-year ${meta.fiscalYear} forecast: revenue, gross margin, BU-level net profit and share of netted division revenue.`} source={sources['rollup.profitability']} asOf={asOf} defs={['fyForecast', 'buNetProfit', 'revenueShare']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">FY forecast revenue</th>
                <th scope="col">FY forecast GM</th>
                <th scope="col">FY forecast net profit</th>
                <th scope="col">GM %</th>
                <th scope="col">NP %</th>
                <th scope="col" className="left" style={{ paddingLeft: 24 }}>
                  Revenue share
                </th>
              </tr>
            </thead>
            <tbody>
              {[...others].sort((a, b) => a.fyNp - b.fyNp).map((r) => (
                <Row key={r.slug} r={r} largest={largestVertical.slug} maxShare={maxShare} />
              ))}
              <Row r={profitability.subtotalExcludingLargest} cls="sub" largest={largestVertical.slug} maxShare={maxShare} />
              <Row r={largest} largest={largestVertical.slug} maxShare={maxShare} />
              <Row r={profitability.total} cls="total" largest={largestVertical.slug} maxShare={maxShare} />
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
          Sorted with the lowest net profit first. A negative net profit is red. Net profit is after provisions and corporate overhead allocated by revenue share: see each vertical's ladder for the lines.{' '}
          {profitability.rows.filter((r) => r.fyNp < 0).length > 0 && (
            <>
              Forecasting a loss: {profitability.rows.filter((r) => r.fyNp < 0).map((r) => `${r.name} (${signedK(r.fyNp)})`).join(', ')}.
            </>
          )}
        </p>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

function Row({ r, cls, largest, maxShare }: { r: ProfitabilityRow; cls?: string; largest: string; maxShare: number }) {
return (
  <tr className={cls ?? 'hov'}>
    <td>
      {cls ? (
        r.name
      ) : (
        <Link to={`/v/${r.slug}#pl`} className="vlink press">
          {r.name}
        </Link>
      )}
    </td>
    <Num v={r.fyRevenue} />
    <Num v={r.fyGm} />
    <Num v={r.fyNp} bad={r.fyNp < 0} />
    <Num v={r.gmPct} f={pct} />
    <Num v={r.npPct} f={pct} bad={r.npPct < 0} />
    <td className="left num" style={{ paddingLeft: 24, minWidth: 160 }}>
      {!cls && <span className={cx('bar', r.slug === largest && 'soft')} style={{ width: `${(r.revenueShare / maxShare) * 90}px` }} aria-hidden="true" />}
      {pct(r.revenueShare)}
    </td>
  </tr>
);
}
