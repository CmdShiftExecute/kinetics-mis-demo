import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import type { VerticalData, VerticalIndexEntry } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateIndex, validateVertical } from '../lib/validate';
import { AED_COMPACT_GUIDE, MONTHS, count, cx, dateLabel, k, pct, pts, signedK, signedPct } from '../lib/format';
import { Crumbs, Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyChart } from '../components/MonthlyChart';
import { PlLadder } from '../components/PlLadder';
import { ReasonTable } from '../components/ReasonTable';
import { SalesHead } from '../components/SalesHead';
import { NoRoiCells, NumericCells, RoiCells } from '../components/SalesCells';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';

/** One vertical, the six blocks of its sheet, plus production for a factory vertical. */
export default function VerticalPage() {
  const { slug = '' } = useParams();
  const { data, error } = useJson<VerticalData>(`verticals/${slug}.json`, validateVertical);
  const index = useJson<VerticalIndexEntry[]>('index.json', validateIndex);
  const rowReveal = useRowReveal();
  const rise = useRise();

  if (error) {
    return (
      <div className="wrap">
        <ErrorBlock title="No such vertical" message={`There is no vertical called "${slug}". ${error}`} />
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

  const { meta, sales, pl, targets, inventory, unbilled, receivables, monthly, headline, sources, definitions, production } = data;
  const asOf = meta.dataAsOfLabel;
  const nearMonth = MONTHS[meta.monthsElapsed] ?? 'Sep';
  const restLabel = `${MONTHS[meta.monthsElapsed + 1]} to Dec`;
  const trendMonths = [meta.monthsElapsed - 3, meta.monthsElapsed - 2, meta.monthsElapsed - 1].map((i) => MONTHS[i] ?? '');
  const hasShared = sales.sheetTotal.ytdRevenue !== sales.attributedTotal.ytdRevenue;
  const prefix = `vs-${slug}`;
  const nameOf = (s: string) => index.data?.find((v) => v.slug === s)?.name ?? s.replace(/-/g, ' ');
  const t = receivables.total;
  const cur = meta.currentMonthLabel.split(' ')[0];
  const prev = meta.previousMonthLabel.split(' ')[0];

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <Crumbs items={[{ label: data.name }]} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            {data.name}
          </motion.h1>
          <p className="page-sub">Vertical report, {meta.periodLabel}</p>
          {index.data && (
            <nav className="vnav" aria-label="Other verticals">
              {index.data.map((v) => (
                <Link key={v.slug} to={`/v/${v.slug}`} aria-current={v.slug === slug ? 'page' : undefined}>
                  {v.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <p className="page-basis">
          {AED_COMPACT_GUIDE}
          <br />
          {data.isLargest ? 'The largest vertical' : 'Attributed basis'}
        </p>
      </div>
      <Strip
        cols={6}
        items={[
          { label: 'YTD revenue', value: headline.ytdRevenue, sub: `budget ${k(headline.budgetRevenue)}` },
          { label: 'YTD revenue less budget', value: headline.dRevenue, f: signedK, sub: `${signedPct(headline.budgetRevenue ? (headline.dRevenue / headline.budgetRevenue) * 100 : 0)} of budget`, bad: headline.dRevenue < 0 },
          { label: 'YTD gross margin', value: headline.ytdGmPct, f: pct, sub: `budget ${pct(headline.budgetGmPct)}, ${pts(headline.ytdGmPct - headline.budgetGmPct)}` },
          { label: 'FY forecast less budget', value: headline.dFy, f: signedK, sub: `forecast ${k(headline.fyForecast)}, budget ${k(headline.fyBudget)}`, bad: headline.dFy < 0 },
          { label: 'BU-level net profit, FY forecast', value: headline.buNetProfitForecast, sub: `YTD ${k(headline.buNetProfitYtd)}, FY budget ${k(headline.buNetProfitBudget)}`, bad: headline.buNetProfitForecast < 0 },
          { label: `Net to collect, ${cur}`, value: headline.receivablesNet, sub: `${signedK(headline.receivablesChange)} on ${prev}; past due ${k(headline.pastDue)}`, bad: headline.receivablesChange > 0 },
        ]}
      />

      {/* Block 1: sales performance by engineer with product sub-rows */}
      <Section id="engineers" title="Sales performance by sales engineer" note={`${meta.periodLabel} actual and budget; forecast for ${meta.nearMonth} and ${meta.restOfYear}; FY budget; prior year; ROI. Product lines sit under each engineer; the name opens the engineer's page.`} source={sources['vertical.sales']} asOf={asOf} defs={['openOrders', 'expectedOrders', 'ytdRevenue', 'ytdBudget', 'fyForecast', 'priorYear', 'roiYtd', 'roiBudget', 'roiForecast', 'roiPriorYear', 'attributedTotal', 'sheetTotal']} definitions={definitions}>
        <MonthlyChart points={monthly} year={meta.fiscalYear} subject={data.name} id={`v-${slug}`} height={220} />
        <div className="scroll-x" style={{ marginTop: 'var(--s-lg)' }}>
          <table className="mis dense sticky">
            <SalesHead prefix={prefix} firstLabel="Engineer and product line" nearMonth={nearMonth} restLabel={restLabel} />
            {sales.engineers.map((e, i) => (
              <tbody key={e.slug} className="hov">
                <motion.tr className="eng" {...rowReveal(i)}>
                  <th scope="row" headers={`${prefix}-0`}>
                    <Link to={`/v/${e.homeVertical}/e/${e.slug}`} className="vlink press">
                      {e.engineer}
                    </Link>
                    {e.fromOtherVertical && <span className="tag">counted in {nameOf(e.fromOtherVertical)}</span>}
                  </th>
                  <NumericCells r={e} prefix={prefix} />
                  <RoiCells r={e} prefix={prefix} />
                </motion.tr>
                {e.products.map((p) => (
                  <tr className="prod" key={p.product}>
                    <th scope="row" headers={`${prefix}-0`}>
                      {p.product}
                      {p.alsoReportedOn && <span className="tag">also on {nameOf(p.alsoReportedOn)}</span>}
                    </th>
                    <NumericCells r={p} prefix={prefix} />
                    <NoRoiCells prefix={prefix} />
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody>
              <tr className="total">
                <th scope="row" headers={`${prefix}-0`}>
                  {hasShared ? 'Attributed total' : 'Total'}
                </th>
                <NumericCells r={sales.attributedTotal} prefix={prefix} />
                <RoiCells r={sales.attributedTotal} prefix={prefix} />
              </tr>
              {hasShared && (
                <tr className="sub">
                  <th scope="row" headers={`${prefix}-0`}>
                    Sheet total
                  </th>
                  <NumericCells r={sales.sheetTotal} prefix={prefix} />
                  <td colSpan={4} className="muted num" headers={`${prefix}-17 ${prefix}-18 ${prefix}-19 ${prefix}-20`}>
                    see attributed
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasShared && (
          <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
            The attributed total counts only this vertical's own engineers and is the figure the summary tables carry. The sheet total adds product lines sold by other verticals' engineers that this sheet also reports.
          </p>
        )}
        <details className="values" style={{ marginTop: 'var(--s-lg)' }}>
          <summary>Sub-totals by product line, every row on this sheet</summary>
          <div className="scroll-x">
            <table className="mis dense sticky" style={{ marginTop: 'var(--s-sm)' }}>
              <SalesHead prefix={`${prefix}-bp`} firstLabel="Product line" nearMonth={nearMonth} restLabel={restLabel} />
              <tbody>
                {sales.byProduct.map((p) => (
                  <tr key={p.product} className="hov">
                    <th scope="row" headers={`${prefix}-bp-0`}>
                      {p.product}
                      {p.alsoReportedOn && <span className="tag">also on {nameOf(p.alsoReportedOn)}</span>}
                    </th>
                    <NumericCells r={p} prefix={`${prefix}-bp`} />
                    <NoRoiCells prefix={`${prefix}-bp`} />
                  </tr>
                ))}
                <tr className="total">
                  <th scope="row" headers={`${prefix}-bp-0`}>
                    Sheet total
                  </th>
                  <NumericCells r={sales.sheetTotal} prefix={`${prefix}-bp`} />
                  <RoiCells r={sales.sheetTotal} prefix={`${prefix}-bp`} />
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </Section>

      {/* Block 2: P&L */}
      <Section id="pl" title="Profit and loss" note={`YTD ${meta.periodLabel} actual; FY forecast with costs annualised; FY budget.`} source={sources['vertical.pl']} asOf={asOf} defs={['plColumns', 'buProfitability', 'buNetProfit']} definitions={definitions}>
        <PlLadder groups={[{ key: 'total', label: data.name, rungs: pl }]} cols={{ ytd: 'YTD', forecast: 'FY forecast', budget: 'FY budget' }} showVariance="all" />
      </Section>

      {/* Block 3: business targets */}
      <Section id="targets" title="Business targets by product line" note={`Full-year ${meta.fiscalYear} target and aspiration; achieved ${meta.periodLabel} against the target phased for the same months.`} source={sources['vertical.targets']} asOf={asOf} defs={['target', 'aspiration', 'budgetToDate']} definitions={definitions}>
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
        <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
          Achieved is judged against budget to date, the target phased for the elapsed months. The last column shows progress against the full-year target for reference; {meta.monthsElapsed} of 12 months have elapsed.
        </p>
      </Section>

      {/* Block 4: inventory outlook */}
      <Section id="inventory" title="Inventory outlook" note="Stock at cost by product line and age since receipt; provision; stock mapped to purchase orders; free stock. Goods in transit below." source={sources['vertical.inventory']} asOf={asOf} defs={['inventoryBands', 'inventoryProvision', 'nonMoving', 'mappedLpo', 'freeStockOverOneYear', 'inTransit']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <td className="blank" />
                <th className="group" scope="colgroup" colSpan={5}>
                  Stock by age
                </th>
                <th className="group" scope="colgroup" colSpan={2}>
                  Risk
                </th>
                <th className="group" scope="colgroup" colSpan={4}>
                  Allocation
                </th>
              </tr>
              <tr>
                <th scope="col">Product line</th>
                <th scope="col">Total</th>
                <th scope="col">Under 1 yr</th>
                <th scope="col">1 to 2 yrs</th>
                <th scope="col">2 to 3 yrs</th>
                <th scope="col">Over 3 yrs</th>
                <th scope="col">Non-moving</th>
                <th scope="col">Provision</th>
                <th scope="col">Mapped to POs</th>
                <th scope="col">Mapped over 1 yr</th>
                <th scope="col">Free stock</th>
                <th scope="col">Free over 1 yr</th>
              </tr>
            </thead>
            <tbody>
              {inventory.lines.map((l, i) => (
                <motion.tr key={l.product} className="hov" {...rowReveal(i)}>
                  <td>{l.product}</td>
                  <Num v={l.totalStock} />
                  <Num v={l.underOneYear} />
                  <Num v={l.oneToTwoYears} />
                  <Num v={l.twoToThreeYears} bad={l.twoToThreeYears > 0} />
                  <Num v={l.overThreeYears} bad={l.overThreeYears > 0} />
                  <Num v={l.nonMovingObsolete} bad={l.nonMovingObsolete > 0} />
                  <Num v={l.provision} />
                  <Num v={l.mappedToPurchaseOrders} />
                  <Num v={l.mappedOverOneYear} />
                  <Num v={l.freeStock} />
                  <Num v={l.freeStockOverOneYear} bad={l.freeStockOverOneYear > 0} />
                </motion.tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <Num v={inventory.total.totalStock} />
                <Num v={inventory.total.underOneYear} />
                <Num v={inventory.total.oneToTwoYears} />
                <Num v={inventory.total.twoToThreeYears} />
                <Num v={inventory.total.overThreeYears} />
                <Num v={inventory.total.nonMovingObsolete} />
                <Num v={inventory.total.provision} />
                <Num v={inventory.total.mappedToPurchaseOrders} />
                <Num v={inventory.total.mappedOverOneYear} />
                <Num v={inventory.total.freeStock} />
                <Num v={inventory.total.freeStockOverOneYear} />
              </tr>
            </tbody>
          </table>
        </div>
        <table className="mis compact" style={{ marginTop: 'var(--s-lg)', maxWidth: 640 }}>
          <thead>
            <tr>
              <th scope="col">Stock in transit</th>
              <th scope="col">Value</th>
              <th scope="col">Expected arrival</th>
            </tr>
          </thead>
          <tbody>
            {inventory.inTransit.map((it, i) => (
              <tr key={i}>
                <td>{it.item}</td>
                <Num v={it.value} />
                <td className="num">{dateLabel(it.expectedArrival)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total in transit, not included in stock</td>
              <Num v={inventory.inTransit.reduce((a, b) => a + b.value, 0)} />
              <td />
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Block 5: unbilled projects and month bridge */}
      <Section id="unbilled" title="Unbilled projects" note={`Delivered and not yet invoiced: three-month trend, age since delivery, provision, ${prev} and ${cur} remarks.`} source={sources['vertical.unbilled']} asOf={asOf} defs={['unbilled', 'unbilledAging', 'bridge']} definitions={definitions}>
        {unbilled.projects.length === 0 ? (
          <div className="empty">
            <strong>No unbilled projects this month.</strong> Every delivery in {data.name} has been invoiced, so there is no bridge to show.
          </div>
        ) : (
          <>
            <div className="scroll-x">
              <table className="mis sticky">
                <thead>
                  <tr>
                    <td className="blank" />
                    <th className="group" scope="colgroup" colSpan={3}>
                      Project
                    </th>
                    <th className="group" scope="colgroup" colSpan={3}>
                      Unbilled balance
                    </th>
                    <th className="group" scope="colgroup" colSpan={8}>
                      Age since delivery, days, at {cur}
                    </th>
                    <th className="group" scope="colgroup" colSpan={3}>
                      Status and remarks
                    </th>
                  </tr>
                  <tr>
                    <th scope="col">Ref</th>
                    <th scope="col" className="left">
                      Project
                    </th>
                    <th scope="col" className="left">
                      Engineer
                    </th>
                    <th scope="col" className="left">
                      Customer
                    </th>
                    {trendMonths.map((mo) => (
                      <th scope="col" key={mo}>
                        {mo}
                      </th>
                    ))}
                    <th scope="col">0 to 60</th>
                    <th scope="col">61 to 90</th>
                    <th scope="col">91 to 120</th>
                    <th scope="col">121 to 180</th>
                    <th scope="col">181 to 365</th>
                    <th scope="col">366 to 545</th>
                    <th scope="col">546 to 730</th>
                    <th scope="col">Over 730</th>
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
                      <td className="left">
                        <Link to={`/v/${slug}/e/${p.engineerSlug}`} className="elink">
                          {p.engineer}
                        </Link>
                      </td>
                      <td className="left">{p.customer}</td>
                      <Num v={p.trend[0]} />
                      <Num v={p.trend[1]} />
                      <Num v={p.trend[2]} bad={p.status === 'ongoing' && p.agedOver60 > 0} />
                      <Num v={p.aging.le60} />
                      <Num v={p.aging.d61to90} />
                      <Num v={p.aging.d91to120} bad={p.aging.d91to120 > 0} />
                      <Num v={p.aging.d121to180} bad={p.aging.d121to180 > 0} />
                      <Num v={p.aging.d181to365} bad={p.aging.d181to365 > 0} />
                      <Num v={p.aging.d366to545} bad={p.aging.d366to545 > 0} />
                      <Num v={p.aging.d546to730} bad={p.aging.d546to730 > 0} />
                      <Num v={p.aging.over730} bad={p.aging.over730 > 0} />
                      <Num v={p.provision} />
                      <td className="remark left">{p.previousRemark}</td>
                      <td className="remark left ink">{p.currentRemark}</td>
                    </motion.tr>
                  ))}
                  <tr className="total">
                    <td colSpan={4}>Total, {data.name}</td>
                    <Num v={unbilled.projects.reduce((a, p) => a + p.trend[0], 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.trend[1], 0)} />
                    <Num v={unbilled.bridge.currentMonth} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.le60, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.d61to90, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.d91to120, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.d121to180, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.d181to365, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.d366to545, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.d546to730, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.aging.over730, 0)} />
                    <Num v={unbilled.projects.reduce((a, p) => a + p.provision, 0)} />
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
              Month bridge, {trendMonths[1]} to {trendMonths[2]}
            </p>
            <Bridge b={unbilled.bridge} />
          </>
        )}
      </Section>

      {/* Block 6a: production, factory verticals only */}
      {production && (
        <Section id="production" title="Production" note={`Factory output by month, ${meta.periodLabel}: quantity delivered in ${production.qtyUnit}, invoiced value, material and labour cost booked.`} source={sources['vertical.production']} asOf={asOf} defs={['production']} definitions={definitions}>
          <div className="scroll-x">
            <table className="mis" style={{ maxWidth: 760 }}>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Delivered, {production.qtyUnit}</th>
                  <th scope="col">Value</th>
                  <th scope="col">Material cost booked</th>
                  <th scope="col">Labour cost booked</th>
                  <th scope="col">Margin</th>
                </tr>
              </thead>
              <tbody>
                {production.rows.map((r, i) => (
                  <motion.tr key={r.month} className="hov" {...rowReveal(i)}>
                    <td>
                      {r.month} {meta.fiscalYear}
                    </td>
                    <Num v={r.deliveredQty} f={count} />
                    <Num v={r.value} />
                    <Num v={r.materialCost} />
                    <Num v={r.labourCost} />
                    <Num v={r.value - r.materialCost - r.labourCost} bad={r.value - r.materialCost - r.labourCost < 0} />
                  </motion.tr>
                ))}
                <tr className="total">
                  <td>Total</td>
                  <Num v={production.total.deliveredQty} f={count} />
                  <Num v={production.total.value} />
                  <Num v={production.total.materialCost} />
                  <Num v={production.total.labourCost} />
                  <Num v={production.total.value - production.total.materialCost - production.total.labourCost} />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
            Production value ties to the vertical's monthly revenue above.
          </p>
        </Section>
      )}

      {/* Block 6: receivables by engineer, drill to customer */}
      <Section id="receivables" title="Receivables by engineer" note={`At ${meta.currentMonthLabel} month end. Past due is beyond each customer's terms; the buckets are days since invoice. The name opens the engineer's page; the customer table is below.`} link={{ to: `/v/${slug}/receivables`, label: 'Customer table' }} source={sources['vertical.receivables']} asOf={asOf} defs={['totalOutstanding', 'provisionReceivable', 'netToCollect', 'pastDue', 'notYetDue', 'agingBuckets', 'agedOverOneYear', 'dispute', 'monthOnMonth']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <td className="blank" />
                <td className="blank" />
                <th className="group" scope="colgroup" colSpan={5}>
                  Days since invoice
                </th>
                <th className="group" scope="colgroup" colSpan={4}>
                  Balances
                </th>
                <th className="group" scope="colgroup" colSpan={3}>
                  Net to collect
                </th>
                <td className="blank" />
              </tr>
              <tr>
                <th scope="col">Engineer</th>
                <th scope="col">Customers</th>
                <th scope="col">0 to 30</th>
                <th scope="col">31 to 90</th>
                <th scope="col">91 to 365</th>
                <th scope="col">1 to 2 yrs</th>
                <th scope="col">Over 2 yrs</th>
                <th scope="col">Total outstanding</th>
                <th scope="col">Not yet due</th>
                <th scope="col">Past due</th>
                <th scope="col">Provision</th>
                <th scope="col">{prev}</th>
                <th scope="col">{cur}</th>
                <th scope="col">Change</th>
                <th scope="col">Disputed</th>
              </tr>
            </thead>
            <tbody>
              {receivables.byEngineer.map((e, i) => (
                <motion.tr key={e.slug} className="hov" {...rowReveal(i)}>
                  <td>
                    <Link to={`/v/${slug}/e/${e.slug}`} className="elink press">
                      {e.engineer}
                    </Link>
                  </td>
                  <Num v={e.customers} f={count} />
                  <Num v={e.bucket0to30} />
                  <Num v={e.bucket31to90} />
                  <Num v={e.bucket91to365} />
                  <Num v={e.bucket1to2y} bad={e.bucket1to2y > 0} />
                  <Num v={e.bucketOver2y} bad={e.bucketOver2y > 0} />
                  <Num v={e.totalOutstanding} />
                  <Num v={e.notYetDue} />
                  <Num v={e.pastDue} bad={e.pastDue > 0} />
                  <Num v={e.provision} />
                  <Num v={e.previousMonthNet} />
                  <Num v={e.netToCollect} />
                  <Num v={e.change} f={signedK} bad={e.change > 0} />
                  <Num v={e.disputed} bad={e.disputed > 0} />
                </motion.tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <Num v={t.customers} f={count} />
                <Num v={t.bucket0to30} />
                <Num v={t.bucket31to90} />
                <Num v={t.bucket91to365} />
                <Num v={t.bucket1to2y} />
                <Num v={t.bucketOver2y} />
                <Num v={t.totalOutstanding} />
                <Num v={t.notYetDue} />
                <Num v={t.pastDue} />
                <Num v={t.provision} />
                <Num v={t.previousMonthNet} />
                <Num v={t.netToCollect} />
                <Num v={t.change} f={signedK} bad={t.change > 0} />
                <Num v={t.disputed} />
              </tr>
            </tbody>
          </table>
        </div>
        <Link to={`/v/${slug}/receivables`} className="drill-link press">
          Open the customer table, with terms and remarks {'>>>'}
        </Link>
        <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
          Reasons for non-collection, share of total outstanding
        </p>
        <div style={{ maxWidth: 640 }}>
          <ReasonTable reasons={receivables.reasons} total={t.totalOutstanding} />
        </div>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

export function Bridge({ b }: { b: VerticalData['unbilled']['bridge'] }) {
  return (
    <dl className="bridge">
      <div>
        <dt>Previous month</dt>
        <dd className="big">{k(b.previousMonth)}</dd>
      </div>
      <div>
        <dt>
          <span className="op">plus</span> New projects
        </dt>
        <dd className="big">{k(b.newProjects)}</dd>
      </div>
      <div>
        <dt>
          <span className="op">less</span> Cleared projects
        </dt>
        <dd className="big">{k(b.clearedProjects)}</dd>
      </div>
      <div>
        <dt>
          <span className="op">plus or less</span> Ongoing changes
        </dt>
        <dd className="big">{signedK(b.ongoingChanges)}</dd>
      </div>
      <div>
        <dt>
          <span className="op">equals</span> Current month
        </dt>
        <dd className="big">{k(b.currentMonth)}</dd>
      </div>
    </dl>
  );
}
