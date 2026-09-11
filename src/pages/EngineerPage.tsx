import { motion } from 'motion/react';
import { Link, Navigate, useParams } from 'react-router';
import type { EngineerData } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateEngineer } from '../lib/validate';
import { MONTHS, count, cx, k, mult, pct, signedK, signedPct } from '../lib/format';
import { Crumbs, Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyLine } from '../components/MonthlyLine';
import { ReasonTable } from '../components/ReasonTable';
import { REASON_LABELS } from '../lib/reasons';
import { SalesHead } from '../components/SalesHead';
import { NoRoiCells, NumericCells, RoiCells } from '../components/SalesCells';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';
import { Bridge } from './VerticalPage';

/**
 * One sales engineer: product lines, monthly run, targets, unbilled projects
 * and the customers who owe them. No profit and loss: costs other than cost
 * to employ are booked at the vertical, so the page shows direct
 * contribution and names what it excludes.
 */
export default function EngineerPage() {
  const { slug = '', eng = '' } = useParams();
  const { data, error } = useJson<EngineerData>(`engineers/${eng}.json`, validateEngineer);
  const rowReveal = useRowReveal();
  const rise = useRise();

  if (error) {
    return (
      <div className="wrap">
        <ErrorBlock title="No such engineer" message={`There is no engineer called "${eng}". ${error}`} back={{ to: `/v/${slug}`, label: 'Back to the vertical' }} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
        <TableSkeleton rows={8} />
      </div>
    );
  }
  // An engineer belongs to one vertical. A URL under another vertical is redirected to the canonical route.
  if (data.vertical.slug !== slug) return <Navigate to={`/v/${data.vertical.slug}/e/${data.slug}`} replace />;

  const { meta, sales, monthly, targets, unbilled, receivables, headline, sources, definitions, vertical, peers } = data;
  const asOf = meta.dataAsOfLabel;
  const nearMonth = MONTHS[meta.monthsElapsed] ?? 'Sep';
  const restLabel = `${MONTHS[meta.monthsElapsed + 1]} to Dec`;
  const trendMonths = [meta.monthsElapsed - 3, meta.monthsElapsed - 2, meta.monthsElapsed - 1].map((i) => MONTHS[i] ?? '');
  const t = receivables.total;
  const prefix = `es-${data.slug}`;
  const cur = meta.currentMonthLabel.split(' ')[0];
  const prev = meta.previousMonthLabel.split(' ')[0];

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <Crumbs items={[{ to: `/v/${vertical.slug}`, label: vertical.name }, { label: data.name }]} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            {data.name}
          </motion.h1>
          <p className="page-sub">
            Sales engineer, {vertical.name}, {meta.periodLabel}
          </p>
          <nav className="vnav" aria-label="Other engineers in this vertical">
            <Link to={`/v/${vertical.slug}`}>All of {vertical.name}</Link>
            {peers.map((p) => (
              <Link key={p.slug} to={`/v/${vertical.slug}/e/${p.slug}`}>
                {p.name}
              </Link>
            ))}
          </nav>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          No profit and loss: costs are held at the vertical
        </p>
      </div>
      <Strip
        cols={6}
        items={[
          { label: 'YTD revenue', value: headline.ytdRevenue, sub: `budget ${k(headline.budgetRevenue)}` },
          { label: 'YTD revenue less budget', value: headline.dRevenue, f: signedK, sub: `${signedPct(headline.budgetRevenue ? (headline.dRevenue / headline.budgetRevenue) * 100 : 0)} of budget`, bad: headline.dRevenue < 0 },
          { label: 'FY forecast less budget', value: headline.dFy, f: signedK, sub: `forecast ${k(headline.fyForecast)}, budget ${k(headline.fyBudget)}`, bad: headline.dFy < 0 },
          { label: 'ROI year to date', value: headline.roiYtd, f: mult, sub: `YTD GM over YTD cost to employ ${k(headline.ctcYtd)}; budget ${mult(headline.roiBudget)}`, bad: headline.roiYtd < headline.roiBudget * 0.85 },
          { label: 'Direct contribution YTD', value: headline.directContributionYtd, f: signedK, sub: 'YTD GM less YTD cost to employ; before vertical and group costs', bad: headline.directContributionYtd < 0 },
          { label: `Net to collect, ${cur}`, value: headline.receivablesNet, sub: `${signedK(headline.receivablesChange)} on ${prev}; past due ${k(headline.pastDue)}`, bad: headline.receivablesChange > 0 },
        ]}
      />

      <Section id="engineer-sales" title="Sales performance by product line" note={`${meta.periodLabel} actual and budget; forecast for ${meta.nearMonth} and ${meta.restOfYear}; FY budget; prior year; ROI on the engineer's total.`} source={sources['engineer.sales']} asOf={asOf} defs={['openOrders', 'expectedOrders', 'ytdRevenue', 'ytdBudget', 'fyForecast', 'priorYear', 'roiYtd', 'roiBudget', 'roiForecast', 'roiPriorYear', 'directContribution']} definitions={definitions}>
        <MonthlyLine points={monthly} year={meta.fiscalYear} subject={data.name} id={`e-${data.slug}`} height={220} />
        <div className="scroll-x" style={{ marginTop: 'var(--s-lg)' }}>
          <table className="mis dense sticky">
            <SalesHead prefix={prefix} firstLabel="Product line" nearMonth={nearMonth} restLabel={restLabel} />
            <tbody>
              {sales.products.map((p, i) => (
                <motion.tr key={p.product} className="prod hov" {...rowReveal(i)}>
                  <th scope="row" headers={`${prefix}-0`}>
                    {p.product}
                    {p.alsoReportedOn && <span className="tag">also on {p.alsoReportedOn.replace(/-/g, ' ')}</span>}
                  </th>
                  <NumericCells r={p} prefix={prefix} />
                  <NoRoiCells prefix={prefix} />
                </motion.tr>
              ))}
              <tr className="total">
                <th scope="row" headers={`${prefix}-0`}>
                  Total, {data.name}
                </th>
                <NumericCells r={sales} prefix={prefix} />
                <RoiCells r={sales} prefix={prefix} />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
          Cost to employ: {k(sales.ctcAnnual)} a year, {k(sales.ctcYtd)} for the elapsed months, {k(sales.ctcPriorYear)} in the prior year. These are the ROI denominators.
        </p>
      </Section>

      <Section id="engineer-targets" title="Business targets by product line" note={`Full-year ${meta.fiscalYear} target and aspiration; achieved ${meta.periodLabel} against the target phased for the same months.`} source={sources['engineer.targets']} asOf={asOf} defs={['target', 'aspiration', 'budgetToDate']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th scope="col">Product line</th>
                <th scope="col" className="left">
                  Sector
                </th>
                <th scope="col">FY target</th>
                <th scope="col">Aspiration</th>
                <th scope="col">Achieved YTD</th>
                <th scope="col">Budget to date</th>
                <th scope="col">Achieved less budget to date</th>
                <th scope="col" className="left" style={{ paddingLeft: 24 }}>
                  Of FY target
                </th>
              </tr>
            </thead>
            <tbody>
              {targets.map((row, i) => (
                <motion.tr key={row.productLine} className="hov" {...rowReveal(i)}>
                  <td>{row.productLine}</td>
                  <td className="left muted">{row.sector}</td>
                  <Num v={row.target} />
                  <Num v={row.aspiration} />
                  <Num v={row.achieved} />
                  <Num v={row.budgetToDate} />
                  <Num v={row.achievedVsBudgetToDate} f={signedK} bad={row.achievedVsBudgetToDate < 0} />
                  <td className="left num" style={{ paddingLeft: 24, minWidth: 180 }}>
                    <span className={cx('bar', row.achievedVsBudgetToDate < 0 && 'hz')} style={{ width: `${Math.min(100, row.achievedPct)}px` }} aria-hidden="true" />
                    {pct(row.achievedPct)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="engineer-unbilled" title="Unbilled projects" note={`Delivered and not yet invoiced against ${data.name}: three-month trend, age since delivery, provision, both remarks.`} source={sources['engineer.unbilled']} asOf={asOf} defs={['unbilled', 'unbilledAging', 'bridge']} definitions={definitions}>
        {unbilled.projects.length === 0 ? (
          <div className="empty">
            <strong>No unbilled projects against {data.name}.</strong> Every delivery on this book has been invoiced.
          </div>
        ) : (
          <>
            <div className="scroll-x">
              <table className="mis sticky">
                <thead>
                  <tr>
                    <th scope="col">Ref</th>
                    <th scope="col" className="left">
                      Project
                    </th>
                    <th scope="col" className="left">
                      Customer
                    </th>
                    {trendMonths.map((mo) => (
                      <th scope="col" key={mo}>
                        {mo}
                      </th>
                    ))}
                    <th scope="col">Aged over 60 days</th>
                    <th scope="col">Provision</th>
                    <th scope="col" className="left">
                      {prev} remark
                    </th>
                    <th scope="col" className="left">
                      {cur} remark
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unbilled.projects.map((p, i) => (
                    <motion.tr key={p.ref} className="hov" {...rowReveal(i)}>
                      <td className="muted nowrap">{p.ref}</td>
                      <td className="left">
                        {p.project}
                        <span className={cx('tag', p.status === 'ongoing' && p.agedOver60 > 0 && 'hz')}>{p.status}</span>
                      </td>
                      <td className="left">{p.customer}</td>
                      <Num v={p.trend[0]} />
                      <Num v={p.trend[1]} />
                      <Num v={p.trend[2]} bad={p.status === 'ongoing' && p.agedOver60 > 0} />
                      <Num v={p.agedOver60} bad={p.agedOver60 > 0} />
                      <Num v={p.provision} />
                      <td className="remark left">{p.previousRemark}</td>
                      <td className="remark left ink">{p.currentRemark}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
              Month bridge, {trendMonths[1]} to {trendMonths[2]}
            </p>
            <Bridge b={unbilled.bridge} />
            <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
              The eight age bands for each project are on the{' '}
              <Link to={`/v/${vertical.slug}#unbilled`} className="vlink">
                vertical's unbilled table
              </Link>
              .
            </p>
          </>
        )}
      </Section>

      <Section id="engineer-receivables" title="Receivables by customer" note={`At ${meta.currentMonthLabel} month end. Past due is beyond each customer's terms; the buckets are days since invoice.`} source={sources['engineer.receivables']} asOf={asOf} defs={['agingBuckets', 'pastDue', 'notYetDue', 'provisionReceivable', 'netToCollect', 'dispute', 'reasons', 'monthOnMonth']} definitions={definitions}>
        {receivables.rows.length === 0 ? (
          <div className="empty">
            <strong>Nothing outstanding against {data.name}.</strong> Every customer on this book has paid.
          </div>
        ) : (
          <>
            <div className="scroll-x">
              <table className="mis sticky">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col" className="left">
                      Terms of payment
                    </th>
                    <th scope="col">0 to 30</th>
                    <th scope="col">31 to 90</th>
                    <th scope="col">91 to 365</th>
                    <th scope="col">1 to 2 yrs</th>
                    <th scope="col">Over 2 yrs</th>
                    <th scope="col">Total outstanding</th>
                    <th scope="col">Not yet due</th>
                    <th scope="col">Past due</th>
                    <th scope="col">Provision</th>
                    <th scope="col">Net to collect</th>
                    <th scope="col">{prev}</th>
                    <th scope="col">Change</th>
                    <th scope="col">Dispute</th>
                    <th scope="col" className="left">
                      Reason
                    </th>
                    <th scope="col" className="left">
                      {prev} remark
                    </th>
                    <th scope="col" className="left">
                      {cur} remark
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.rows.map((r, i) => (
                    <motion.tr key={r.customer} className="hov" {...rowReveal(i)}>
                      <td>{r.customer}</td>
                      <td className="left muted nowrap">{r.terms}</td>
                      <Num v={r.bucket0to30} />
                      <Num v={r.bucket31to90} />
                      <Num v={r.bucket91to365} />
                      <Num v={r.bucket1to2y} bad={r.bucket1to2y > 0} />
                      <Num v={r.bucketOver2y} bad={r.bucketOver2y > 0} />
                      <Num v={r.totalOutstanding} />
                      <Num v={r.notYetDue} />
                      <Num v={r.pastDue} bad={r.pastDue > 0} />
                      <Num v={r.provision} />
                      <Num v={r.netToCollect} />
                      <Num v={r.previousMonthNet} />
                      <Num v={r.change} f={signedK} bad={r.change > 0} />
                      <td className="num">{r.dispute ? <span className="tag hz">dispute</span> : <span className="muted">none</span>}</td>
                      <td className="left nowrap muted">{REASON_LABELS[r.reason]}</td>
                      <td className="remark left">{r.previousRemark}</td>
                      <td className="remark left ink">{r.currentRemark}</td>
                    </motion.tr>
                  ))}
                  <tr className="total">
                    <td colSpan={2}>
                      Total, {data.name}, {count(t.customers)} {t.customers === 1 ? 'customer' : 'customers'}
                    </td>
                    <Num v={t.bucket0to30} />
                    <Num v={t.bucket31to90} />
                    <Num v={t.bucket91to365} />
                    <Num v={t.bucket1to2y} />
                    <Num v={t.bucketOver2y} />
                    <Num v={t.totalOutstanding} />
                    <Num v={t.notYetDue} />
                    <Num v={t.pastDue} />
                    <Num v={t.provision} />
                    <Num v={t.netToCollect} />
                    <Num v={t.previousMonthNet} />
                    <Num v={t.change} f={signedK} bad={t.change > 0} />
                    <Num v={t.disputed} />
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
              Reasons for non-collection, share of total outstanding
            </p>
            <div style={{ maxWidth: 640 }}>
              <ReasonTable reasons={receivables.reasons} total={t.totalOutstanding} />
            </div>
          </>
        )}
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
