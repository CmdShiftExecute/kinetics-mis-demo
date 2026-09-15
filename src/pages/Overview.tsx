import { useCallback } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup, SalesRow } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { useSort } from '../lib/sort';
import { cx, k, mil, pct, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { SortTh } from '../components/SortTh';
import { MonthlyChart } from '../components/MonthlyChart';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRowReveal, useRise, useReveal } from '../components/Reveal';

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
  const rise = useRise();
  const reveal = useReveal();

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
  const salesDefinitions = { ...definitions, orderBookSnapshot: {
    key: 'orderBookSnapshot', term: 'Order book snapshot',
    text: `AED thousand, ${meta.currentMonthLabel}: ${k(sales.total.openOrders)} open orders plus ${k(sales.total.expectedOrders)} expected orders, ${k(orderBook)} combined. Expected orders are not secured business.`,
  } };
  const asOf = meta.dataAsOfLabel;
  const largestShortfall = [...sales.rows].filter(row => row.dRevenue < 0).sort((a, b) => a.dRevenue - b.dRevenue)[0];
  const sortProps = (key: SalesKey, natural: 'asc' | 'desc') => ({ active: state.key === key, dir: state.dir, natural, onSort: () => toggle(key, natural) });

  return (
    <div className="wrap overview">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <h1 className="display page-title">Overview</h1>
          <p className="page-sub">
            {meta.periodLabel} actuals
          </p>
        </div>
        <p className="page-basis">
          Headlines AED million · Tables AED thousand
          <br />
          {meta.nearMonth.split(' ')[0]} onward forecast · FY {meta.fiscalYear}
        </p>
      </div>

      <motion.dl className="strip answers" aria-label="The four headline figures" id="answers" style={{ '--cols': 4 } as React.CSSProperties} {...rise(0.1)}>
        <div>
          <dt><Link to="#sales">YTD revenue <span aria-hidden="true">↗</span></Link></dt>
          <dd className="big">{mil(o.sales.ytdRevenue)}</dd>
          <dd className="sub"><span className={cx(o.sales.variance < 0 && 'bad')}>{signedPct(o.sales.variancePct)}</span> vs YTD budget</dd>
        </div>
        <div>
          <dt><Link to="#pipeline">FY revenue forecast <span aria-hidden="true">↗</span></Link></dt>
          <dd className="big">{mil(o.delivery.fyForecast)}</dd>
          <dd className="sub"><span className={cx(o.delivery.variance < 0 && 'bad')}>{signedPct(o.delivery.variancePct)}</span> vs FY budget</dd>
        </div>
        <div>
          <dt><Link to="#net-profit">FY net profit <span aria-hidden="true">↗</span></Link></dt>
          <dd className="big">{mil(o.profit.forecast.buNetProfit)}</dd>
          <dd className="sub"><span className={cx(o.profit.npForecastVsBudget < 0 && 'bad')}>{mil(o.profit.npForecastVsBudget, 2)}</span> vs FY budget</dd>
        </div>
        <div>
          <dt><Link to="#receivables">Past due <span aria-hidden="true">↗</span></Link></dt>
          <dd className="big">{mil(o.receivables.pastDue)}</dd>
          <dd className="sub"><span className="bad">{pct(o.receivables.pastDuePct)}</span> of outstanding</dd>
        </div>
      </motion.dl>
      <div className="support-band" aria-label="Order book and working capital">
        <div><Link to="/sales#sales-by-vertical" className="vlink">Order book <strong>{mil(orderBook)}</strong> <span aria-hidden="true">↗</span></Link><span>{mil(sales.total.openOrders)} open + {mil(sales.total.expectedOrders)} expected</span></div>
        <div><Link to="/working-capital" className="vlink">Working capital <strong>{mil(o.workingCapital.total)}</strong> <span aria-hidden="true">↗</span></Link><span>Receivables · Unbilled · Stock</span></div>
      </div>

      <motion.section className="attention" aria-labelledby="attention-title" {...reveal(0.15)}>
        <div className="attention-head"><h2 id="attention-title" className="label">Management attention</h2><span className="label">Priorities for review</span></div>
        <div className="attention-grid">
          <Link to="/receivables" className="attention-item press">
            <span className="attention-index">01 / Collections <span aria-hidden="true">↗</span></span>
            <strong>{mil(o.receivables.agedOverOneYear)} aged over a year</strong>
            <span>{pct(o.receivables.concentration.share)} of net receivables sits in {o.receivables.concentration.names.length} businesses.</span>
          </Link>
          <Link to="#sales" className="attention-item press">
            <span className="attention-index">02 / Revenue <span aria-hidden="true">↗</span></span>
            <strong>{largestShortfall ? `${mil(Math.abs(largestShortfall.dRevenue), 2)} largest YTD shortfall` : 'No YTD revenue shortfall'}</strong>
            <span>{largestShortfall ? `${largestShortfall.name} · ${signedPct(largestShortfall.dRevenuePct)} vs YTD budget.` : 'All businesses meet YTD budget.'}</span>
          </Link>
          <Link to="#net-profit" className="attention-item press">
            <span className="attention-index">03 / Profitability <span aria-hidden="true">↗</span></span>
            <strong>{o.profit.lossMakers.length} {o.profit.lossMakers.length === 1 ? 'business forecasts a loss' : 'businesses forecast a loss'}</strong>
            <span>Full year, after group charges. Review the loss-making divisions.</span>
          </Link>
        </div>
      </motion.section>

      <div className="overview-grid">
        {/* 1. Sales against plan */}
        <Section id="sales" title="Sales" note={`${meta.periodLabel} · AED thousand`} link={{ to: '/sales', label: 'Full sales report' }} source={sources['rollup.sales']} asOf={asOf} defs={['ytdRevenue', 'ytdBudget', 'variance', 'gmPct', 'openOrders', 'expectedOrders', 'orderBookSnapshot']} definitions={salesDefinitions} compact>
          <p className="section-takeaway">Gross margin <strong>{pct(o.sales.ytdGmPct)}</strong> · Budget {pct(o.sales.budgetGmPct)}</p>
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
        <Section id="pipeline" title="Pipeline" note={`FY ${meta.fiscalYear} · AED thousand`} link={{ to: '/pipeline', label: 'Full pipeline report' }} source={sources['rollup.monthly']} asOf={asOf} defs={['fyForecast', 'fyBudget', 'variance']} definitions={definitions} compact>
          <Strip
            cols={3}
            items={[
              { label: 'FY forecast', value: o.delivery.fyForecast },
              { label: 'FY budget', value: o.delivery.fyBudget },
              { label: 'Gap to budget', value: o.delivery.variance, f: signedK, bad: o.delivery.variance < 0 },
            ]}
          />
          <p className="pipeline-context">Forecast <strong>{signedPct(o.delivery.yoyPct)}</strong> vs FY {meta.fiscalYear - 1} ({mil(o.delivery.priorYear)}).</p>
          <div style={{ marginTop: 'var(--s-lg)' }}>
            <MonthlyChart points={monthly} year={meta.fiscalYear} subject="the division" id="ov" height={210} />
          </div>
        </Section>

        {/* 3. Net profit */}
        <Section id="net-profit" title="Net profit" note="Division after netting · AED thousand" link={{ to: '/net-profit', label: 'Full profit report' }} source={sources['rollup.pl']} asOf={asOf} defs={['plColumns', 'buProfitability', 'buNetProfit']} definitions={definitions} compact>
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
              Forecast net margin <strong>{pct(profitability.total.npPct)}</strong>.
              {o.profit.lossMakers.length > 0 && (
                <>
                  {' '}
                  Forecast losses after group charges:{' '}
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
            <p className="muted">YTD profit attainment is unavailable: no approved YTD profit budget. {largestVertical.name} is shown separately in the full report.</p>
          </div>
        </Section>

        {/* 4. Receivables and working capital */}
        <Section id="receivables" title="Receivables & working capital" note={`${meta.currentMonthLabel} month end · AED thousand`} link={{ to: '/receivables', label: 'Receivables report' }} source={sources['rollup.receivables']} asOf={asOf} defs={['netToCollect', 'totalOutstanding', 'pastDue', 'agedOverOneYear', 'workingCapital']} definitions={definitions} compact>
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
            Customer terms, aging, provisions and collection reasons: drill into any of the {receivables.rows.length} verticals.
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
