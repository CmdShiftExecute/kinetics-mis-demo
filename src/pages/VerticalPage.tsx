import { motion, useReducedMotion } from 'motion/react';
import { Link, useParams } from 'react-router';
import type { VerticalData, VerticalIndexEntry } from '../../data/schema';
import { useJson } from '../lib/data';
import { cx, dateLabel, k, pct, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyLine } from '../components/MonthlyLine';
import { PlLadder } from '../components/PlLadder';
import { ReasonGrid } from '../components/ReasonGrid';
import { SalesHead } from '../components/SalesHead';
import { NumericCells, ROI_TIP_TEXT, RoiCells } from '../components/SalesCells';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { EASE, useReveal, useRowReveal } from '../components/Reveal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function VerticalPage() {
  const { slug = '' } = useParams();
  const { data, error } = useJson<VerticalData>(`verticals/${slug}.json`);
  const index = useJson<VerticalIndexEntry[]>('index.json');
  const reduce = useReducedMotion();
  const reveal = useReveal();
  const rowReveal = useRowReveal();

  if (error) {
    return (
      <div className="wrap">
        <ErrorBlock message={`No vertical called "${slug}". ${error}`} />
        <Link to="/" className="drill-link press">
          Back to the front page
        </Link>
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

  const { meta, sales, pl, targets, inventory, unbilled, overdue, monthly, headline, sources } = data;
  const asOf = meta.dataAsOfLabel;
  const tip = (key: string, extra?: string) => `${sources[key]?.label ?? key}.${extra ? ` ${extra}` : ''} As of ${asOf}.`;
  const nearMonth = MONTHS[meta.monthsElapsed] ?? 'Sep';
  const trendMonths = [meta.monthsElapsed - 3, meta.monthsElapsed - 2, meta.monthsElapsed - 1].map((i) => MONTHS[i] ?? '');
  const hasShared = sales.sheetTotal.ytdRevenue !== sales.attributedTotal.ytdRevenue;
  const dRev = headline.ytdRevenue - headline.budgetRevenue;
  const dFy = headline.fyForecast - headline.fyBudget;
  const rise = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.2, ease: EASE } };
  const roiTip = tip('vertical.sales', ROI_TIP_TEXT);
  const restLabel = `${MONTHS[meta.monthsElapsed + 1]} to Dec`;

  return (
    <div className="wrap">
      <Masthead meta={meta} variant="drill" />
      <div style={{ marginTop: 'var(--s-xl)' }}>
        <Link to="/" className="back press">
          {'<<<'} Division front page
        </Link>
        <div className="kicker">
          <span className="bracket">[ Vertical ]</span>
          <motion.span layoutId={`vname-${slug}`} className="vname label" style={{ color: 'var(--ink)' }}>
            {data.name}
          </motion.span>
        </div>
        <motion.h1 className="display" style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)', margin: 'var(--s-sm) 0 0' }} {...rise}>
          {data.name}
        </motion.h1>
        {index.data && (
          <nav className="vnav" aria-label="Other verticals">
            {index.data.map((v) => (
              <Link key={v.slug} to={`/v/${v.slug}`} aria-current={v.slug === slug ? 'page' : undefined}>
                {v.name}
              </Link>
            ))}
          </nav>
        )}
        <motion.dl className="strip" {...rise}>
          <div>
            <dt className="label">YTD revenue</dt>
            <dd className="big">{k(headline.ytdRevenue)}</dd>
            <dd className="sub">AED thousands, {meta.periodLabel}</dd>
          </div>
          <div>
            <dt className="label">Against YTD budget</dt>
            <dd className={cx('big', dRev < 0 && 'bad')}>{signedK(dRev)}</dd>
            <dd className="sub">{pct((headline.ytdRevenue / headline.budgetRevenue) * 100)} of budget</dd>
          </div>
          <div>
            <dt className="label">Gross margin</dt>
            <dd className="big">{pct(headline.ytdGmPct)}</dd>
            <dd className="sub">YTD, on revenue</dd>
          </div>
          <div>
            <dt className="label">FY forecast</dt>
            <dd className="big">{k(headline.fyForecast)}</dd>
            <dd className="sub">AED thousands</dd>
          </div>
          <div>
            <dt className="label">Against FY budget</dt>
            <dd className={cx('big', dFy < 0 && 'bad')}>{signedK(dFy)}</dd>
            <dd className="sub">{signedPct((headline.fyForecast / headline.fyBudget - 1) * 100)}</dd>
          </div>
          <div>
            <dt className="label">Overdue</dt>
            <dd className={cx('big', overdue.total.change > 0 && 'bad')}>{k(headline.overdue)}</dd>
            <dd className="sub">{signedK(overdue.total.change)} on the month</dd>
          </div>
        </motion.dl>
      </div>

      {/* Block 1: sales performance by engineer with product sub-rows */}
      <Section id="engineers" title="Sales performance by sales engineer" note={`AED thousands, ${meta.periodLabel}. Product lines under each engineer; the name opens the engineer's page`} source={sources['vertical.sales']} asOf={asOf} delay={0.35}>
        <MonthlyLine points={monthly} year={meta.fiscalYear} height={220} label={`Monthly revenue for ${data.name}, actual then forecast, against budget`} />
        <div className="scroll-x">
          <table className="mis dense">
            <SalesHead firstLabel="Engineer and product" nearMonth={nearMonth} restLabel={restLabel} />
            {sales.engineers.map((e, i) => (
              <tbody key={e.slug} className="hov">
                <motion.tr className="main eng" {...rowReveal(i)}>
                  <td>
                    <Link to={`/v/${e.homeVertical}/e/${e.slug}`} className="vlink press">
                      <motion.span layoutId={`ename-${e.slug}`} className="vname">
                        {e.engineer}
                      </motion.span>
                    </Link>
                    {e.fromOtherVertical && (
                      <>
                        {' '}
                        <span className="tag">counted in {e.fromOtherVertical.replace(/-/g, ' ')}</span>
                      </>
                    )}
                  </td>
                  <NumericCells r={e} tip={tip('vertical.sales')} />
                  <RoiCells r={e} tip={roiTip} />
                </motion.tr>
                {e.products.map((p) => (
                  <tr className="prod" key={p.product}>
                    <td>
                      {p.product}
                      {p.alsoReportedOn && (
                        <>
                          {' '}
                          <span className="tag">also on {p.alsoReportedOn.replace(/-/g, ' ')}</span>
                        </>
                      )}
                    </td>
                    <NumericCells r={p} tip={tip('vertical.sales', 'Product sub-row.')} />
                    <td colSpan={4} />
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody>
              <tr className="total">
                <td className="tip-host" tabIndex={0} data-tip={hasShared ? 'Only this vertical’s own engineers. This is the figure the front page carries.' : undefined}>
                  {hasShared ? 'Attributed total' : 'Total'}
                </td>
                <NumericCells r={sales.attributedTotal} tip={tip('vertical.sales', 'Attributed total.')} />
                <RoiCells r={sales.attributedTotal} tip={roiTip} />
              </tr>
              {hasShared && (
                <tr className="sub">
                  <td className="tip-host" tabIndex={0} data-tip="Every row on this sheet, including product lines sold by other verticals’ engineers. Adding sheet totals across verticals would double count them.">
                    Sheet total
                  </td>
                  <NumericCells r={sales.sheetTotal} tip={tip('vertical.sales', 'Sheet total, includes shared rows.')} />
                  <td colSpan={4} className="muted num">
                    see attributed
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Block 2: P&L */}
      <Section id="pl" title="Profit and loss" note="AED thousands" source={sources['vertical.pl']} asOf={asOf}>
        <PlLadder groups={[{ key: 'total', label: data.name, rungs: pl }]} cols={{ ytd: 'YTD', forecast: 'FY forecast', budget: 'FY budget' }} tip={tip('vertical.pl')} />
      </Section>

      {/* Block 3: business targets */}
      <Section id="targets" title="Business targets by product line" note={`AED thousands, full year ${meta.fiscalYear}`} source={sources['vertical.targets']} asOf={asOf}>
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th>Product line</th>
                <th>Target</th>
                <th>Aspiration</th>
                <th>Achieved YTD</th>
                <th className="left" style={{ paddingLeft: 24 }}>
                  Of target
                </th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t, i) => (
                <motion.tr key={t.productLine} {...rowReveal(i)}>
                  <td>{t.productLine}</td>
                  <Num v={t.target} tip={tip('vertical.targets', 'Target equals the approved budget for the line.')} />
                  <Num v={t.aspiration} tip={tip('vertical.targets', 'Stretch figure agreed with the vertical head.')} />
                  <Num v={t.achieved} tip={tip('vertical.targets')} />
                  <td className="left num" style={{ paddingLeft: 24, minWidth: 200 }} data-tip={tip('vertical.targets', `${meta.monthsElapsed} of 12 months elapsed, so ${pct((meta.monthsElapsed / 12) * 100, 0)} is on pace.`)}>
                    <span className={cx('bar', t.achievedPct < (meta.monthsElapsed / 12) * 100 - 5 && 'hz')} style={{ width: `${Math.min(100, t.achievedPct)}px` }} aria-hidden="true" />
                    {pct(t.achievedPct)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Block 4: inventory outlook */}
      <Section id="inventory" title="Inventory outlook" note="AED thousands at cost" source={sources['vertical.inventory']} asOf={asOf}>
        <motion.dl className="inv" {...reveal(0, 0.2)}>
          <div>
            <dt className="label">Total stock</dt>
            <dd className="big">{k(inventory.totalStock)}</dd>
          </div>
          <div>
            <dt className="label">Under 1 year</dt>
            <dd className="big">{k(inventory.underOneYear)}</dd>
          </div>
          <div>
            <dt className="label">1 to 2 years</dt>
            <dd className="big">{k(inventory.overOneYear)}</dd>
          </div>
          <div>
            <dt className="label">2 to 3 years</dt>
            <dd className={cx('big', inventory.overTwoYears > 0 && 'bad')}>{k(inventory.overTwoYears)}</dd>
          </div>
          <div>
            <dt className="label">Over 3 years</dt>
            <dd className={cx('big', inventory.overThreeYears > 0 && 'bad')}>{k(inventory.overThreeYears)}</dd>
          </div>
          <div className="tip-host" data-tip="Half of stock aged 2 to 3 years plus all stock over 3 years." tabIndex={0}>
            <dt className="label">Provision</dt>
            <dd className="big">{k(inventory.provision)}</dd>
          </div>
          <div>
            <dt className="label">Mapped to purchase orders</dt>
            <dd className="big">{k(inventory.mappedToPurchaseOrders)}</dd>
          </div>
          <div>
            <dt className="label">Free stock</dt>
            <dd className="big">{k(inventory.freeStock)}</dd>
          </div>
          <div>
            <dt className="label">Free stock over 1 year</dt>
            <dd className={cx('big', inventory.freeStockOverOneYear > 0 && 'bad')}>{k(inventory.freeStockOverOneYear)}</dd>
          </div>
          <div>
            <dt className="label">In transit</dt>
            <dd className="big">{k(inventory.inTransit.reduce((a, b) => a + b.value, 0))}</dd>
          </div>
        </motion.dl>
        <table className="mis compact" style={{ marginTop: 'var(--s-lg)', maxWidth: 640 }}>
          <thead>
            <tr>
              <th>Stock in transit</th>
              <th>Value</th>
              <th>Expected arrival</th>
            </tr>
          </thead>
          <tbody>
            {inventory.inTransit.map((it, i) => (
              <tr key={i}>
                <td>{it.item}</td>
                <Num v={it.value} tip={tip('vertical.inventory')} />
                <td className="num">{dateLabel(it.expectedArrival)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Block 5: unbilled projects and month bridge */}
      <Section id="unbilled" title="Unbilled projects" note="AED thousands, delivered and not yet invoiced" source={sources['vertical.unbilled']} asOf={asOf}>
        {unbilled.projects.length === 0 ? (
          <div className="empty">
            <strong>No unbilled projects this month.</strong> Every delivery in {data.name} has been invoiced, so there is no bridge to show.
          </div>
        ) : (
          <>
            <div className="scroll-x">
              <table className="mis">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th className="left">Project</th>
                    <th className="left">Engineer</th>
                    <th className="left">Customer</th>
                    {trendMonths.map((m) => (
                      <th key={m}>{m}</th>
                    ))}
                    <th>Provision</th>
                    <th className="left">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {unbilled.projects.map((p, i) => (
                    <motion.tr key={p.ref} {...rowReveal(i)}>
                      <td className="muted">{p.ref}</td>
                      <td className="left">{p.project}</td>
                      <td className="left">{p.engineer}</td>
                      <td className="left">{p.customer}</td>
                      <Num v={p.trend[0]} tip={tip('vertical.unbilled')} />
                      <Num v={p.trend[1]} tip={tip('vertical.unbilled')} />
                      <Num v={p.trend[2]} tip={tip('vertical.unbilled')} bad={p.trend[2] > 0 && p.trend[0] > 0 && p.trend[1] > 0} />
                      <Num v={p.provision} tip={tip('vertical.unbilled')} />
                      <td className="remark left">{p.remark}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
              Month bridge, {trendMonths[1]} to {trendMonths[2]}
            </p>
            <dl className="bridge">
              <div>
                <dt className="label">Previous month</dt>
                <dd className="big">{k(unbilled.bridge.previousMonth)}</dd>
              </div>
              <div>
                <dt className="label">
                  <span className="op">plus</span> New projects
                </dt>
                <dd className="big">{k(unbilled.bridge.newProjects)}</dd>
              </div>
              <div>
                <dt className="label">
                  <span className="op">less</span> Cleared projects
                </dt>
                <dd className="big">{k(unbilled.bridge.clearedProjects)}</dd>
              </div>
              <div>
                <dt className="label">
                  <span className="op">plus or less</span> Ongoing changes
                </dt>
                <dd className="big">{signedK(unbilled.bridge.ongoingChanges)}</dd>
              </div>
              <div>
                <dt className="label">
                  <span className="op">equals</span> Current month
                </dt>
                <dd className="big">{k(unbilled.bridge.currentMonth)}</dd>
              </div>
            </dl>
          </>
        )}
      </Section>

      {/* Block 6: overdue by engineer, drill to customer */}
      <Section id="overdue" title="Overdue by engineer and customer" note="AED thousands, overdue is everything beyond 30 days" source={sources['vertical.overdue']} asOf={asOf}>
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th>Engineer</th>
                <th>Customers</th>
                <th>0 to 30 days</th>
                <th>31 to 90 days</th>
                <th>91 to 365 days</th>
                <th>1 to 2 years</th>
                <th>Over 2 years</th>
                <th>Total outstanding</th>
                <th>Provision</th>
                <th>Net to collect</th>
                <th>Overdue</th>
                <th>Change</th>
                <th>Disputed</th>
              </tr>
            </thead>
            <tbody>
              {overdue.byEngineer.map((e, i) => (
                <motion.tr key={e.engineer} {...rowReveal(i)}>
                  <td>
                    <Link to={`/v/${slug}/e/${e.slug}`} className="elink press">
                      {e.engineer}
                    </Link>
                  </td>
                  <Num v={e.customers} f={(n) => String(n)} />
                  <Num v={e.bucket0to30} tip={tip('vertical.overdue')} />
                  <Num v={e.bucket31to90} tip={tip('vertical.overdue')} />
                  <Num v={e.bucket91to365} tip={tip('vertical.overdue')} />
                  <Num v={e.bucket1to2y} bad={e.bucket1to2y > 0} tip={tip('vertical.overdue')} />
                  <Num v={e.bucketOver2y} bad={e.bucketOver2y > 0} tip={tip('vertical.overdue')} />
                  <Num v={e.totalOutstanding} tip={tip('vertical.overdue')} />
                  <Num v={e.provision} tip={tip('vertical.overdue', 'Half of 1 to 2 years, all of over 2 years, a quarter of disputed 91 to 365 days.')} />
                  <Num v={e.netToCollect} tip={tip('vertical.overdue', 'Total outstanding less provision.')} />
                  <Num v={e.overdue} tip={tip('vertical.overdue')} />
                  <Num v={e.change} f={signedK} bad={e.change > 0} tip={tip('vertical.overdue', 'Up is worse.')} />
                  <Num v={e.disputed} bad={e.disputed > 0} tip={tip('vertical.overdue')} />
                </motion.tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <Num v={overdue.total.customers} f={(n) => String(n)} />
                <Num v={overdue.total.bucket0to30} />
                <Num v={overdue.total.bucket31to90} />
                <Num v={overdue.total.bucket91to365} />
                <Num v={overdue.total.bucket1to2y} bad={overdue.total.bucket1to2y > 0} />
                <Num v={overdue.total.bucketOver2y} bad={overdue.total.bucketOver2y > 0} />
                <Num v={overdue.total.totalOutstanding} />
                <Num v={overdue.total.provision} />
                <Num v={overdue.total.netToCollect} />
                <Num v={overdue.total.overdue} />
                <Num v={overdue.total.change} f={signedK} bad={overdue.total.change > 0} />
                <Num v={overdue.total.disputed} bad={overdue.total.disputed > 0} />
              </tr>
            </tbody>
          </table>
        </div>
        <Link to={`/v/${slug}/overdue`} className="drill-link press">
          Open the customer aging table {'>>>'}
        </Link>
        <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
          Reasons for non-collection
        </p>
        <ReasonGrid reasons={overdue.reasons} total={overdue.total.overdue} tip={tip('vertical.overdue', 'Each overdue balance carries one reason code.')} />
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
