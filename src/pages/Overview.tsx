import { useCallback } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup, SalesRow } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { useSort } from '../lib/sort';
import { cx, k, mil, pct, pts, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { SortTh } from '../components/SortTh';
import { MonthlyLine } from '../components/MonthlyLine';
import { CountUp, Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRowReveal } from '../components/Reveal';

type SalesKey = 'name' | 'ytdRevenue' | 'budgetRevenue' | 'dRevenue' | 'dRevenuePct' | 'ytdGmPct';
const getSales = (r: SalesRow, key: SalesKey) => r[key];

/**
 * The overview answers five questions in order: how are sales performing
 * against plan, what revenue will be delivered this year, what profit is
 * expected after costs, which verticals explain the gaps, and where working
 * capital is tied up. Every figure names its measure, period and comparator.
 */
export default function Overview() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rows = data?.sales.rows ?? [];
  const { sorted, state, toggle } = useSort<SalesRow, SalesKey>(rows, useCallback((r: SalesRow, key: SalesKey) => getSales(r, key), []), { key: 'dRevenue', dir: 'asc' });
  const rowReveal = useRowReveal();

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
        <TableSkeleton rows={10} />
      </div>
    );
  }

  const { meta, overview: o, sales, monthly, definitions, sources, receivables, largestVertical, profitability } = data;
  const orderBook = sales.total.openOrders + sales.total.expectedOrders;
  const asOf = meta.dataAsOfLabel;
  const sortProps = (key: SalesKey, natural: 'asc' | 'desc') => ({ active: state.key === key, dir: state.dir, natural, onSort: () => toggle(key, natural) });

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <h1 className="display page-title">Overview</h1>
          <p className="page-sub">
            {meta.division}, {meta.periodLabel}
          </p>
        </div>
        <p className="page-basis">
          All amounts AED thousand
          <br />
          {meta.periodLabel} actual. {meta.nearMonth} onward forecast. FY {meta.fiscalYear} budget.
        </p>
      </div>

      {/* The six figures a division head reads first: what we sold, what we will land,
          what is committed ahead, what we keep, what is owed beyond terms, and what is
          tied up. Each opens the section that carries its detail. Every figure is
          published in rollup.json; none is derived here. */}
      <dl className="strip answers" aria-label="The six headline figures" id="answers" style={{ '--cols': 6 } as React.CSSProperties}>
        <div>
          <dt>YTD revenue</dt>
          <dd className="big"><CountUp value={o.sales.ytdRevenue} f={mil} delay={0.15} /></dd>
          <dd className="sub">
            <Link to="#sales" className="vlink">
              <span className={cx(o.sales.variance < 0 && 'bad')}>{signedK(o.sales.variance)}</span> on {k(o.sales.ytdBudget)} budget ({signedPct(o.sales.variancePct)})
            </Link>
          </dd>
        </div>
        <div>
          <dt>FY revenue forecast</dt>
          <dd className="big"><CountUp value={o.delivery.fyForecast} f={mil} delay={0.2} /></dd>
          <dd className="sub">
            <Link to="#pipeline" className="vlink">
              <span className={cx(o.delivery.variance < 0 && 'bad')}>{signedPct(o.delivery.variancePct)}</span> on budget, {signedPct(o.delivery.yoyPct)} on FY {meta.fiscalYear - 1}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Order book</dt>
          <dd className="big"><CountUp value={orderBook} f={mil} delay={0.25} /></dd>
          <dd className="sub">
            <Link to="#sales" className="vlink">
              {k(sales.total.openOrders)} open, {k(sales.total.expectedOrders)} expected
            </Link>
          </dd>
        </div>
        <div>
          <dt>FY net profit</dt>
          <dd className="big"><CountUp value={o.profit.forecast.buNetProfit} f={mil} delay={0.3} /></dd>
          <dd className="sub">
            <Link to="#net-profit" className="vlink">
              <span className={cx(o.profit.npForecastVsBudget < 0 && 'bad')}>{signedK(o.profit.npForecastVsBudget)}</span> on budget, {pct(profitability.total.npPct)} of revenue
            </Link>
          </dd>
        </div>
        <div>
          <dt>Past due</dt>
          <dd className="big bad"><CountUp value={o.receivables.pastDue} f={mil} delay={0.35} /></dd>
          <dd className="sub">
            <Link to="#receivables" className="vlink">
              {pct(o.receivables.pastDuePct)} of {k(o.receivables.totalOutstanding)} outstanding, {k(o.receivables.agedOverOneYear)} over a year
            </Link>
          </dd>
        </div>
        <div>
          <dt>Working capital</dt>
          <dd className="big"><CountUp value={o.workingCapital.total} f={mil} delay={0.4} /></dd>
          <dd className="sub">
            <Link to="#receivables" className="vlink">
              {k(o.workingCapital.receivablesNet)} receivables, {k(o.workingCapital.unbilled)} unbilled, {k(o.workingCapital.inventoryStock)} stock
            </Link>
          </dd>
        </div>
      </dl>

      <div className="overview-grid">
        {/* 1. Sales against plan */}
        <Section id="sales" title="Sales" note={`YTD revenue against YTD budget, ${meta.periodLabel}. Variance is actual less budget.`} link={{ to: '/sales', label: 'Full sales report' }} source={sources['rollup.sales']} asOf={asOf} defs={['ytdRevenue', 'ytdBudget', 'variance', 'gmPct']} definitions={definitions} compact>
          <div className="sec-intro">
            <p>
              YTD revenue <strong>{k(o.sales.ytdRevenue)}</strong> against <strong>{k(o.sales.ytdBudget)}</strong> budget: <strong className={cx(o.sales.variance < 0 && 'bad')}>{signedK(o.sales.variance)}</strong> ({signedPct(o.sales.variancePct)}). YTD gross margin {pct(o.sales.ytdGmPct)} against {pct(o.sales.budgetGmPct)} budget ({pts(o.sales.gmPts)}).
            </p>
          </div>
          <div className="scroll-x">
            <table className="mis compact">
              <thead>
                <tr>
                  <SortTh label="Vertical" {...sortProps('name', 'asc')} />
                  <SortTh label="YTD revenue" {...sortProps('ytdRevenue', 'desc')} />
                  <SortTh label="YTD budget" {...sortProps('budgetRevenue', 'desc')} />
                  <SortTh label="Variance" {...sortProps('dRevenue', 'asc')} title="Actual less budget; sorted with the largest shortfall first" />
                  <SortTh label="Var %" {...sortProps('dRevenuePct', 'asc')} />
                  <SortTh label="GM %" {...sortProps('ytdGmPct', 'desc')} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <motion.tr key={r.slug} className="hov" layout="position" {...rowReveal(i)}>
                    <td>
                      <Link to={`/v/${r.slug}`} className="vlink press">
                        {r.name}
                      </Link>
                    </td>
                    <Num v={r.ytdRevenue} />
                    <Num v={r.budgetRevenue} />
                    <Num v={r.dRevenue} f={signedK} bad={r.dRevenue < 0} />
                    <Num v={r.dRevenuePct} f={signedPct} bad={r.dRevenuePct < 0} />
                    <Num v={r.ytdGmPct} f={pct} />
                  </motion.tr>
                ))}
                <tr className="total">
                  <td>{sales.total.name}</td>
                  <Num v={sales.total.ytdRevenue} />
                  <Num v={sales.total.budgetRevenue} />
                  <Num v={sales.total.dRevenue} f={signedK} bad={sales.total.dRevenue < 0} />
                  <Num v={sales.total.dRevenuePct} f={signedPct} bad={sales.total.dRevenuePct < 0} />
                  <Num v={sales.total.ytdGmPct} f={pct} />
                </tr>
              </tbody>
            </table>
          </div>
          <details className="netting" id="netting">
            <summary>Netting calculation</summary>
            <div className="netting-box">
              <p>{sales.netting.explanation}</p>
              <p>
                Sheet totals add to <strong>{k(sales.netting.grossSumYtd)}</strong>. <strong>{k(sales.netting.doubleCountedYtd)}</strong> appears on two sheets. Netted YTD revenue is <strong>{k(sales.netting.nettedYtd)}</strong>, the figure every table on this site carries. Full year: gross {k(sales.netting.grossSumFy)}, double counted {k(sales.netting.doubleCountedFy)}, netted {k(sales.netting.nettedFy)}.
              </p>
              <Link to="/sales#netting-items">The shared product lines, one by one {'>>>'}</Link>
            </div>
          </details>
        </Section>

        {/* 2. Pipeline */}
        <Section id="pipeline" title="Pipeline" note={`Full-year ${meta.fiscalYear} forecast against full-year budget. Forecast is YTD actual plus engineer forecasts for ${meta.nearMonth} onward.`} link={{ to: '/pipeline', label: 'Full pipeline report' }} source={sources['rollup.monthly']} asOf={asOf} defs={['fyForecast', 'fyBudget', 'variance']} definitions={definitions} compact>
          <Strip
            cols={3}
            items={[
              { label: 'FY revenue forecast', value: o.delivery.fyForecast, sub: `${mil(o.delivery.fyForecast)}` },
              { label: 'FY revenue budget', value: o.delivery.fyBudget, sub: `${mil(o.delivery.fyBudget)}` },
              { label: 'Forecast less budget', value: o.delivery.variance, f: signedK, sub: `${signedPct(o.delivery.variancePct)} of budget`, bad: o.delivery.variance < 0 },
            ]}
          />
          <div style={{ marginTop: 'var(--s-lg)' }}>
            <MonthlyLine points={monthly} year={meta.fiscalYear} subject="the division" id="ov" height={210} />
          </div>
        </Section>

        {/* 3. Net profit */}
        <Section id="net-profit" title="Net profit" note={`YTD actual, full-year forecast and full-year budget, division total after inter-vertical netting.`} link={{ to: '/net-profit', label: 'Full P&L and vertical profitability' }} source={sources['rollup.pl']} asOf={asOf} defs={['plColumns', 'buProfitability', 'buNetProfit']} definitions={definitions} compact>
          <div className="scroll-x">
            <table className="mis compact">
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">YTD actual</th>
                  <th scope="col">FY forecast</th>
                  <th scope="col">FY budget</th>
                  <th scope="col">Forecast vs budget</th>
                </tr>
              </thead>
              <tbody>
                <ProfitRow label="Gross margin" ytd={o.profit.ytd.grossMargin} fc={o.profit.forecast.grossMargin} bd={o.profit.budget.grossMargin} />
                <ProfitRow label="BU profitability" ytd={o.profit.ytd.buProfitability} fc={o.profit.forecast.buProfitability} bd={o.profit.budget.buProfitability} />
                <ProfitRow label="BU-level net profit" ytd={o.profit.ytd.buNetProfit} fc={o.profit.forecast.buNetProfit} bd={o.profit.budget.buNetProfit} total />
              </tbody>
            </table>
          </div>
          <div className="sec-intro" style={{ marginTop: 'var(--s-md)' }}>
            <p>
              FY net profit forecast is <strong className={cx(o.profit.npForecastVsBudget < 0 && 'bad')}>{signedK(o.profit.npForecastVsBudget)}</strong> against the FY budget of {k(o.profit.budget.buNetProfit)}.
              {o.profit.lossMakers.length > 0 && (
                <>
                  {' '}
                  Verticals forecasting a loss after group charges:{' '}
                  {o.profit.lossMakers.map((l, i) => (
                    <span key={l.slug}>
                      <Link to={`/v/${l.slug}#pl`} className="vlink">
                        {l.name}
                      </Link>{' '}
                      ({signedK(l.fyNp)}){i < o.profit.lossMakers.length - 1 ? ', ' : '.'}
                    </span>
                  ))}
                </>
              )}
            </p>
            <p className="muted">No approved profit budget exists for the elapsed months, so no year-to-date profit attainment is shown. {largestVertical.name} is shown separately in the full report.</p>
          </div>
        </Section>

        {/* 4. Receivables and working capital */}
        <Section id="receivables" title="Receivables and working capital" note={`Net to collect at ${meta.currentMonthLabel} month end against ${meta.previousMonthLabel}. Past due is beyond each customer's terms.`} link={{ to: '/receivables', label: 'Receivables report' }} source={sources['rollup.receivables']} asOf={asOf} defs={['netToCollect', 'totalOutstanding', 'pastDue', 'agedOverOneYear', 'workingCapital']} definitions={definitions} compact>
          <div className="scroll-x">
            <table className="mis compact">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">{meta.previousMonthLabel.split(' ')[0]}</th>
                  <th scope="col">{meta.currentMonthLabel.split(' ')[0]}</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="total">
                  <td>Net to collect, all verticals</td>
                  <Num v={o.receivables.previousMonth} />
                  <Num v={o.receivables.currentMonth} />
                  <Num v={o.receivables.change} f={signedK} bad={o.receivables.change > 0} />
                </tr>
              </tbody>
            </table>
          </div>
          <Strip
            cols={3}
            items={[
              { label: `Total outstanding, ${meta.currentMonthLabel.split(' ')[0]}`, value: o.receivables.totalOutstanding, sub: `less provision ${k(o.receivables.totalOutstanding - o.receivables.currentMonth)}` },
              { label: 'Past due, beyond terms', value: o.receivables.pastDue, sub: `${pct(o.receivables.pastDuePct)} of outstanding`, bad: o.receivables.pastDue > 0 },
              { label: 'Aged over one year', value: o.receivables.agedOverOneYear, sub: `${pct(o.receivables.agedOverOneYearPct)} of outstanding`, bad: o.receivables.agedOverOneYear > 0 },
            ]}
          />
          <div className="sec-intro" style={{ marginTop: 'var(--s-md)' }}>
            <p>
              {o.receivables.concentration.names.map((n, i) => (
                <span key={n}>
                  <Link to={`/v/${o.receivables.concentration.slugs[i]}/receivables`} className="vlink">
                    {n}
                  </Link>
                  {i < o.receivables.concentration.names.length - 1 ? ', ' : ' '}
                </span>
              ))}
              hold {pct(o.receivables.concentration.share)} of net to collect. Largest balances by reason are in the{' '}
              <Link to="/receivables#reasons" className="vlink">
                receivables report
              </Link>
              .
            </p>
          </div>
          <p className="label" style={{ marginTop: 'var(--s-lg)' }}>
            Working capital tied up, {meta.currentMonthLabel}
          </p>
          <Strip
            cols={4}
            items={[
              { label: 'Net receivables', value: o.workingCapital.receivablesNet },
              { label: 'Unbilled', value: o.workingCapital.unbilled },
              { label: 'Stock at cost', value: o.workingCapital.inventoryStock, sub: `free over 1 year ${k(o.workingCapital.freeStockOverOneYear)}` },
              { label: 'Total tied up', value: o.workingCapital.total },
            ]}
          />
          <Link to="/working-capital" className="sec-link press" style={{ display: 'inline-block', marginTop: 'var(--s-md)' }}>
            Working capital by vertical {'>>>'}
          </Link>
          <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
            Receivables held by {receivables.rows.length} verticals; customer terms, aging, provisions, reasons and remarks are on each vertical's customer table.
          </p>
        </Section>
      </div>

      <Footer meta={meta} />
    </div>
  );
}

function ProfitRow({ label, ytd, fc, bd, total }: { label: string; ytd: number; fc: number; bd: number; total?: boolean }) {
  const d = fc - bd;
  return (
    <tr className={total ? 'total' : undefined}>
      <td>{label}</td>
      <Num v={ytd} bad={ytd < 0} />
      <Num v={fc} bad={fc < 0} />
      <Num v={bd} bad={bd < 0} />
      <Num v={d} f={signedK} bad={d < 0} />
    </tr>
  );
}
