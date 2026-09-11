import { motion, useReducedMotion } from 'motion/react';
import { Link, useParams } from 'react-router';
import type { EngineerData } from '../../data/schema';
import { useJson } from '../lib/data';
import { cx, k, mult, pct, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyLine } from '../components/MonthlyLine';
import { ReasonGrid } from '../components/ReasonGrid';
import { SalesHead } from '../components/SalesHead';
import { NumericCells, ROI_TIP_TEXT, RoiCells } from '../components/SalesCells';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { EASE, useRowReveal } from '../components/Reveal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * One sales engineer: their product lines, monthly run, targets, unbilled
 * projects and the customers who owe them. No P&L: costs are booked at the
 * vertical, not the person.
 */
export default function EngineerPage() {
  const { slug = '', eng = '' } = useParams();
  const { data, error } = useJson<EngineerData>(`engineers/${eng}.json`);
  const reduce = useReducedMotion();
  const rowReveal = useRowReveal();

  if (error) {
    return (
      <div className="wrap">
        <ErrorBlock message={`No engineer called "${eng}". ${error}`} />
        <Link to={`/v/${slug}`} className="drill-link press">
          Back to the vertical
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

  const { meta, sales, monthly, targets, unbilled, overdue, headline, sources, vertical, peers } = data;
  const asOf = meta.dataAsOfLabel;
  const tip = (key: string, extra?: string) => `${sources[key]?.label ?? key}.${extra ? ` ${extra}` : ''} As of ${asOf}.`;
  const nearMonth = MONTHS[meta.monthsElapsed] ?? 'Sep';
  const restLabel = `${MONTHS[meta.monthsElapsed + 1]} to Dec`;
  const trendMonths = [meta.monthsElapsed - 3, meta.monthsElapsed - 2, meta.monthsElapsed - 1].map((i) => MONTHS[i] ?? '');
  const dRev = headline.ytdRevenue - headline.budgetRevenue;
  const dFy = headline.fyForecast - headline.fyBudget;
  const t = overdue.total;
  const rise = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.2, ease: EASE } };
  const roiTip = tip('engineer.sales', ROI_TIP_TEXT);

  return (
    <div className="wrap">
      <Masthead meta={meta} variant="drill" />
      <div style={{ marginTop: 'var(--s-xl)' }}>
        <Link to={`/v/${vertical.slug}`} className="back press">
          {'<<<'} {vertical.name}
        </Link>
        <div className="kicker">
          <span className="bracket">[ Sales engineer ]</span>
          <motion.span layoutId={`ename-${data.slug}`} className="vname label" style={{ color: 'var(--ink)' }}>
            {data.name}
          </motion.span>
          <span className="label">{vertical.name}</span>
        </div>
        <motion.h1 className="display" style={{ fontSize: 'clamp(2.2rem, 5.5vw, 5rem)', margin: 'var(--s-sm) 0 0' }} {...rise}>
          {data.name}
        </motion.h1>
        <nav className="vnav" aria-label="Other engineers in this vertical">
          <Link to={`/v/${vertical.slug}`}>All of {vertical.name}</Link>
          {peers.map((p) => (
            <Link key={p.slug} to={`/v/${vertical.slug}/e/${p.slug}`}>
              {p.name}
            </Link>
          ))}
        </nav>
        <motion.dl className="strip" {...rise}>
          <div>
            <dt className="label">YTD revenue</dt>
            <dd className="big">{k(headline.ytdRevenue)}</dd>
            <dd className="sub">AED thousands, {meta.periodLabel}</dd>
          </div>
          <div>
            <dt className="label">Against YTD budget</dt>
            <dd className={cx('big', dRev < 0 && 'bad')}>{signedK(dRev)}</dd>
            <dd className="sub">{pct(headline.budgetRevenue ? (headline.ytdRevenue / headline.budgetRevenue) * 100 : 0)} of budget</dd>
          </div>
          <div>
            <dt className="label">Gross margin</dt>
            <dd className="big">{pct(headline.ytdGmPct)}</dd>
            <dd className="sub">YTD, on revenue</dd>
          </div>
          <div>
            <dt className="label">FY forecast</dt>
            <dd className={cx('big', dFy < 0 && 'bad')}>{k(headline.fyForecast)}</dd>
            <dd className="sub">{signedPct(headline.fyBudget ? (headline.fyForecast / headline.fyBudget - 1) * 100 : 0)} against FY budget</dd>
          </div>
          <div className="tip-host" data-tip={ROI_TIP_TEXT} tabIndex={0}>
            <dt className="label">ROI year to date</dt>
            <dd className={cx('big', headline.roiYtd < headline.roiBudget * 0.85 && 'bad')}>{mult(headline.roiYtd)}</dd>
            <dd className="sub">budget {mult(headline.roiBudget)}</dd>
          </div>
          <div>
            <dt className="label">Overdue</dt>
            <dd className={cx('big', headline.overdueChange > 0 && 'bad')}>{k(headline.overdue)}</dd>
            <dd className="sub">{signedK(headline.overdueChange)} on the month</dd>
          </div>
        </motion.dl>
      </div>

      {/* Sales performance by product line */}
      <Section id="engineer-sales" title="Sales performance by product line" note={`AED thousands, ${meta.periodLabel}`} source={sources['engineer.sales']} asOf={asOf} delay={0.35}>
        <MonthlyLine points={monthly} year={meta.fiscalYear} height={220} label={`Monthly revenue for ${data.name}, actual then forecast, against budget`} />
        <div className="scroll-x">
          <table className="mis dense">
            <SalesHead firstLabel="Product line" nearMonth={nearMonth} restLabel={restLabel} />
            <tbody>
              {sales.products.map((p, i) => (
                <motion.tr key={p.product} className="prod" {...rowReveal(i)}>
                  <td>
                    {p.product}
                    {p.alsoReportedOn && (
                      <>
                        {' '}
                        <span className="tag">also on {p.alsoReportedOn.replace(/-/g, ' ')}</span>
                      </>
                    )}
                  </td>
                  <NumericCells r={p} tip={tip('engineer.sales', 'Product sub-row.')} />
                  <td colSpan={4} />
                </motion.tr>
              ))}
              <tr className="total">
                <td>Total, {data.name}</td>
                <NumericCells r={sales} tip={tip('engineer.sales')} />
                <RoiCells r={sales} tip={roiTip} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Business targets */}
      <Section id="engineer-targets" title="Business targets by product line" note={`AED thousands, full year ${meta.fiscalYear}`} source={sources['engineer.targets']} asOf={asOf}>
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
              {targets.map((row, i) => (
                <motion.tr key={row.productLine} {...rowReveal(i)}>
                  <td>{row.productLine}</td>
                  <Num v={row.target} tip={tip('engineer.targets', 'Target equals the approved budget for the line.')} />
                  <Num v={row.aspiration} tip={tip('engineer.targets', 'Stretch figure, same ratio as the vertical target.')} />
                  <Num v={row.achieved} tip={tip('engineer.targets')} />
                  <td className="left num" style={{ paddingLeft: 24, minWidth: 200 }} data-tip={tip('engineer.targets', `${meta.monthsElapsed} of 12 months elapsed, so ${pct((meta.monthsElapsed / 12) * 100, 0)} is on pace.`)}>
                    <span className={cx('bar', row.achievedPct < (meta.monthsElapsed / 12) * 100 - 5 && 'hz')} style={{ width: `${Math.min(100, row.achievedPct)}px` }} aria-hidden="true" />
                    {pct(row.achievedPct)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Unbilled */}
      <Section id="engineer-unbilled" title="Unbilled projects" note="AED thousands, delivered and not yet invoiced" source={sources['engineer.unbilled']} asOf={asOf}>
        {unbilled.projects.length === 0 ? (
          <div className="empty">
            <strong>No unbilled projects against {data.name}.</strong> Every delivery on this book has been invoiced.
          </div>
        ) : (
          <>
            <div className="scroll-x">
              <table className="mis">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th className="left">Project</th>
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
                      <td className="left">{p.customer}</td>
                      <Num v={p.trend[0]} tip={tip('engineer.unbilled')} />
                      <Num v={p.trend[1]} tip={tip('engineer.unbilled')} />
                      <Num v={p.trend[2]} tip={tip('engineer.unbilled')} bad={p.trend[2] > 0 && p.trend[0] > 0 && p.trend[1] > 0} />
                      <Num v={p.provision} tip={tip('engineer.unbilled')} />
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

      {/* Overdue by customer */}
      <Section id="engineer-overdue" title="Overdue by customer" note="AED thousands, overdue is everything beyond 30 days" source={sources['engineer.overdue']} asOf={asOf}>
        {overdue.rows.length === 0 ? (
          <div className="empty">
            <strong>Nothing overdue against {data.name}.</strong> Every customer on this book is inside terms.
          </div>
        ) : (
          <>
            <div className="scroll-x">
              <table className="mis">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="left">Terms of payment</th>
                    <th>0 to 30 days</th>
                    <th>31 to 90 days</th>
                    <th>91 to 365 days</th>
                    <th>1 to 2 years</th>
                    <th>Over 2 years</th>
                    <th>Total outstanding</th>
                    <th>Provision</th>
                    <th>Net to collect</th>
                    <th>Dispute</th>
                    <th>Previous month overdue</th>
                    <th>Current overdue</th>
                    <th>Change</th>
                    <th className="left">Current remark</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.rows.map((r, i) => {
                    const change = r.overdue - r.previousMonthOverdue;
                    return (
                      <motion.tr key={r.customer} {...rowReveal(i)}>
                        <td>{r.customer}</td>
                        <td className="left muted" style={{ whiteSpace: 'nowrap' }}>
                          {r.terms}
                        </td>
                        <Num v={r.bucket0to30} tip={tip('engineer.overdue')} />
                        <Num v={r.bucket31to90} tip={tip('engineer.overdue')} />
                        <Num v={r.bucket91to365} tip={tip('engineer.overdue')} />
                        <Num v={r.bucket1to2y} bad={r.bucket1to2y > 0} tip={tip('engineer.overdue')} />
                        <Num v={r.bucketOver2y} bad={r.bucketOver2y > 0} tip={tip('engineer.overdue')} />
                        <Num v={r.totalOutstanding} tip={tip('engineer.overdue')} />
                        <Num v={r.provision} tip={tip('engineer.overdue', 'Half of 1 to 2 years, all of over 2 years, a quarter of disputed 91 to 365 days.')} />
                        <Num v={r.netToCollect} tip={tip('engineer.overdue', 'Total outstanding less provision.')} />
                        <td className="num">{r.dispute ? <span className="tag hz">dispute</span> : <span className="muted">none</span>}</td>
                        <Num v={r.previousMonthOverdue} tip={tip('engineer.overdue')} />
                        <Num v={r.overdue} tip={tip('engineer.overdue')} />
                        <Num v={change} f={signedK} bad={change > 0} tip={tip('engineer.overdue', 'Up is worse.')} />
                        <td className="remark left" style={{ color: 'var(--ink)' }}>
                          {r.currentRemark}
                        </td>
                      </motion.tr>
                    );
                  })}
                  <tr className="total">
                    <td colSpan={2}>Total, {data.name}</td>
                    <Num v={t.bucket0to30} />
                    <Num v={t.bucket31to90} />
                    <Num v={t.bucket91to365} />
                    <Num v={t.bucket1to2y} bad={t.bucket1to2y > 0} />
                    <Num v={t.bucketOver2y} bad={t.bucketOver2y > 0} />
                    <Num v={t.totalOutstanding} />
                    <Num v={t.provision} />
                    <Num v={t.netToCollect} />
                    <Num v={t.disputed} bad={t.disputed > 0} />
                    <Num v={t.previousMonthOverdue} />
                    <Num v={t.overdue} />
                    <Num v={t.change} f={signedK} bad={t.change > 0} />
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
              Reasons for non-collection
            </p>
            <ReasonGrid reasons={overdue.reasons} total={t.overdue} tip={tip('engineer.overdue', 'Each overdue balance carries one reason code.')} />
          </>
        )}
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
