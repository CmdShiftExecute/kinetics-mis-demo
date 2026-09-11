import type { MouseEvent } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import type { Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { cx, k, mil, pct, pts, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Readout } from '../components/Readout';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { MonthlyLine } from '../components/MonthlyLine';
import { PlLadder } from '../components/PlLadder';
import { ReasonGrid } from '../components/ReasonGrid';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRowReveal } from '../components/Reveal';

export default function FrontPage() {
  const { data, error } = useJson<Rollup>('rollup.json');
  const navigate = useNavigate();
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

  const { meta, readout, sales, forecast, pl, profitability, overdue, monthly, engineerSplit, sources, largestVertical } = data;
  const asOf = meta.dataAsOfLabel;
  const tip = (key: string, extra?: string) => `${sources[key]?.label ?? key}.${extra ? ` ${extra}` : ''} As of ${asOf}.`;
  const { netting } = sales;
  const nettingTip = `${netting.explanation} Sheet totals add to ${k(netting.grossSumYtd)}; ${k(netting.doubleCountedYtd)} appears twice; netted ${k(netting.nettedYtd)}.`;
  const fabTip = (slug: string) =>
    slug === 'fabrication'
      ? `Own team only. A further ${k(netting.doubleCountedYtd)} sold by ${[...new Set(netting.items.map((i) => i.homeVertical))].map((s) => sales.rows.find((r) => r.slug === s)?.name).join(' and ')} engineers is on the Fabrication sheet and counted in their home verticals.`
      : undefined;
  const go = (path: string) => (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a')) return;
    navigate(path);
  };
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const nearMonth = months[meta.monthsElapsed] ?? 'Sep';

  return (
    <div className="wrap">
      <Masthead meta={meta} variant="front" />
      <Readout readout={readout} meta={meta} />

      {/* 1. How are we selling */}
      <Section
        id="sales"
        title="Sales performance by vertical"
        note={`AED thousands, ${meta.periodLabel}`}
        source={sources['rollup.sales']}
        asOf={asOf}
        delay={1.2}
      >
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th>Vertical</th>
                <th>Open orders</th>
                <th>Expected orders</th>
                <th>YTD revenue</th>
                <th>YTD GM</th>
                <th>GM %</th>
                <th>Budget revenue</th>
                <th>Budget GM</th>
                <th>Budget GM %</th>
                <th>Revenue vs budget</th>
                <th>GM vs budget</th>
                <th>GM % vs budget</th>
              </tr>
            </thead>
            {sales.rows.map((r, i) => (
              <tbody key={r.slug} className="hov">
                <motion.tr className="main clickable" onClick={go(`/v/${r.slug}`)} {...rowReveal(i)}>
                  <td data-tip={fabTip(r.slug)}>
                    <Link to={`/v/${r.slug}`} className="vlink press">
                      <motion.span layoutId={`vname-${r.slug}`} className="vname">
                        {r.name}
                      </motion.span>
                    </Link>
                  </td>
                  <Num v={r.openOrders} tip={tip('rollup.sales', 'Open orders: confirmed orders not yet invoiced.')} />
                  <Num v={r.expectedOrders} tip={tip('rollup.sales', 'Expected orders: above 90 percent probability, plus letters of intent.')} />
                  <Num v={r.ytdRevenue} tip={tip('rollup.sales')} />
                  <Num v={r.ytdGm} tip={tip('rollup.sales')} />
                  <Num v={r.ytdGmPct} f={pct} tip={tip('rollup.sales')} />
                  <Num v={r.budgetRevenue} tip={tip('rollup.sales', 'Budget for the same months.')} />
                  <Num v={r.budgetGm} tip={tip('rollup.sales', 'Budget for the same months.')} />
                  <Num v={r.budgetGmPct} f={pct} tip={tip('rollup.sales')} />
                  <Num v={r.dRevenue} f={signedK} bad={r.dRevenue < 0} tip={tip('rollup.sales', 'YTD revenue less YTD budget.')} />
                  <Num v={r.dGm} f={signedK} bad={r.dGm < 0} tip={tip('rollup.sales', 'YTD gross margin less YTD budget.')} />
                  <Num v={r.dGmPts} f={pts} bad={r.dGmPts < 0} tip={tip('rollup.sales', 'Percentage points.')} />
                </motion.tr>
                <tr className="xrow">
                  <td colSpan={12}>
                    <div className="expand">
                      <div>
                        <div className="expand-inner">
                          <p className="label">Engineer split, {meta.periodLabel}</p>
                          <table className="mis compact">
                            <thead>
                              <tr>
                                <th>Sales engineer</th>
                                <th>YTD revenue</th>
                                <th>Budget</th>
                                <th>vs budget</th>
                                <th>GM %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(engineerSplit[r.slug] ?? []).map((e) => (
                                <tr key={e.name}>
                                  <td>{e.name}</td>
                                  <Num v={e.ytdRevenue} />
                                  <Num v={e.budgetRevenue} />
                                  <Num v={e.dRevenue} f={signedK} bad={e.dRevenue < 0} />
                                  <Num v={e.ytdGmPct} f={pct} />
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            ))}
            <tbody>
              <tr className="total">
                <td data-tip={nettingTip} className="tip-host" tabIndex={0}>
                  {sales.total.name}
                </td>
                <Num v={sales.total.openOrders} tip={nettingTip} />
                <Num v={sales.total.expectedOrders} tip={nettingTip} />
                <Num v={sales.total.ytdRevenue} tip={nettingTip} />
                <Num v={sales.total.ytdGm} tip={nettingTip} />
                <Num v={sales.total.ytdGmPct} f={pct} tip={nettingTip} />
                <Num v={sales.total.budgetRevenue} tip={nettingTip} />
                <Num v={sales.total.budgetGm} tip={nettingTip} />
                <Num v={sales.total.budgetGmPct} f={pct} tip={nettingTip} />
                <Num v={sales.total.dRevenue} f={signedK} bad={sales.total.dRevenue < 0} tip={nettingTip} />
                <Num v={sales.total.dGm} f={signedK} bad={sales.total.dGm < 0} tip={nettingTip} />
                <Num v={sales.total.dGmPts} f={pts} bad={sales.total.dGmPts < 0} tip={nettingTip} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 2. What will we deliver this year */}
      <Section
        id="forecast"
        title="Revenue forecast and pipeline by vertical"
        note={`AED thousands, full year ${meta.fiscalYear}`}
        source={sources['rollup.forecast']}
        asOf={asOf}
        delay={1.3}
      >
        <MonthlyLine points={monthly} year={meta.fiscalYear} label={`Monthly revenue for the division, actual to ${meta.periodLabel.split(' to ')[1]}, forecast after, against budget`} />
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th>Vertical</th>
                <th>Prior year actual</th>
                <th>YTD actual</th>
                <th>{nearMonth} forecast</th>
                <th>{months[meta.monthsElapsed + 1]} to Dec forecast</th>
                <th>FY forecast</th>
                <th>FY budget</th>
                <th>Forecast vs budget</th>
                <th>Year on year</th>
              </tr>
            </thead>
            {forecast.rows.map((r, i) => (
              <tbody key={r.slug} className="hov">
                <motion.tr className="main clickable" onClick={go(`/v/${r.slug}`)} {...rowReveal(i)}>
                  <td>
                    <Link to={`/v/${r.slug}`} className="vlink press">
                      {r.name}
                    </Link>
                  </td>
                  <Num v={r.priorYearRevenue} tip={tip('rollup.forecast', `Full year ${meta.fiscalYear - 1} actual.`)} />
                  <Num v={r.ytdRevenue} tip={tip('rollup.forecast')} />
                  <Num v={r.nearMonthForecast} tip={tip('rollup.forecast', `Forecast for ${meta.nearMonth}.`)} />
                  <Num v={r.restOfYearForecast} tip={tip('rollup.forecast', `Forecast for ${meta.restOfYear}.`)} />
                  <Num v={r.fyForecast} tip={tip('rollup.forecast', 'YTD actual plus the forecast months.')} />
                  <Num v={r.fyBudget} tip={tip('rollup.forecast')} />
                  <Num v={r.fcVsBudgetPct} f={signedPct} bad={r.fcVsBudgetPct < 0} tip={tip('rollup.forecast')} />
                  <Num v={r.yoyPct} f={signedPct} bad={r.yoyPct < 0} tip={tip('rollup.forecast', 'FY forecast against prior year actual.')} />
                </motion.tr>
              </tbody>
            ))}
            <tbody>
              <tr className="total">
                <td>{forecast.total.name}</td>
                <Num v={forecast.total.priorYearRevenue} tip={nettingTip} />
                <Num v={forecast.total.ytdRevenue} tip={nettingTip} />
                <Num v={forecast.total.nearMonthForecast} tip={nettingTip} />
                <Num v={forecast.total.restOfYearForecast} tip={nettingTip} />
                <Num v={forecast.total.fyForecast} tip={nettingTip} />
                <Num v={forecast.total.fyBudget} tip={nettingTip} />
                <Num v={forecast.total.fcVsBudgetPct} f={signedPct} bad={forecast.total.fcVsBudgetPct < 0} tip={nettingTip} />
                <Num v={forecast.total.yoyPct} f={signedPct} bad={forecast.total.yoyPct < 0} tip={nettingTip} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3. What do we keep */}
      <Section
        id="pl"
        title="Profit and loss summary"
        note="AED thousands, three column groups"
        intro={`${largestVertical.name} is ${pct(profitability.rows.find((r) => r.slug === largestVertical.slug)?.revenueShare ?? 0, 0)} of forecast revenue, so the ladder is shown without it, for it alone, and in total.`}
        source={sources['rollup.pl']}
        asOf={asOf}
      >
        <PlLadder groups={pl} cols={{ ytd: 'YTD', forecast: 'FY forecast', budget: 'FY budget' }} tip={tip('rollup.pl')} />
      </Section>

      {/* 4. Which vertical earns it */}
      <Section id="profitability" title="Vertical profitability" note={`AED thousands, full year ${meta.fiscalYear} forecast`} source={sources['rollup.profitability']} asOf={asOf}>
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th>Vertical</th>
                <th>Forecast revenue</th>
                <th>Gross margin</th>
                <th>Net profit</th>
                <th>GM %</th>
                <th>NP %</th>
                <th className="left" style={{ paddingLeft: 24 }}>
                  Revenue share
                </th>
              </tr>
            </thead>
            {profitability.rows.map((r, i) => {
              const maxShare = Math.max(...profitability.rows.map((x) => x.revenueShare));
              return (
                <tbody key={r.slug} className="hov">
                  <motion.tr className="main clickable" onClick={go(`/v/${r.slug}`)} {...rowReveal(i)}>
                    <td data-tip={fabTip(r.slug)}>
                      <Link to={`/v/${r.slug}`} className="vlink press">
                        {r.name}
                      </Link>
                    </td>
                    <Num v={r.fyRevenue} tip={tip('rollup.profitability')} />
                    <Num v={r.fyGm} tip={tip('rollup.profitability')} />
                    <Num v={r.fyNp} bad={r.fyNp < 0} tip={tip('rollup.profitability', 'BU-level net profit, after group charges.')} />
                    <Num v={r.gmPct} f={pct} tip={tip('rollup.profitability')} />
                    <Num v={r.npPct} f={pct} bad={r.npPct < 0} tip={tip('rollup.profitability')} />
                    <td className="left num" style={{ paddingLeft: 24, minWidth: 180 }} data-tip={tip('rollup.profitability', 'Share of netted division revenue. Bar length is relative to the largest vertical.')}>
                      <span className={cx('bar', r.slug === largestVertical.slug && 'soft')} style={{ width: `${(r.revenueShare / maxShare) * 90}px` }} aria-hidden="true" />
                      {pct(r.revenueShare)}
                    </td>
                  </motion.tr>
                </tbody>
              );
            })}
            <tbody>
              <tr className="total">
                <td data-tip={nettingTip} className="tip-host" tabIndex={0}>
                  {profitability.total.name}
                </td>
                <Num v={profitability.total.fyRevenue} tip={nettingTip} />
                <Num v={profitability.total.fyGm} tip={nettingTip} />
                <Num v={profitability.total.fyNp} bad={profitability.total.fyNp < 0} tip={nettingTip} />
                <Num v={profitability.total.gmPct} f={pct} tip={nettingTip} />
                <Num v={profitability.total.npPct} f={pct} bad={profitability.total.npPct < 0} tip={nettingTip} />
                <td className="left num" style={{ paddingLeft: 24 }}>
                  {pct(profitability.total.revenueShare, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Where is the cash stuck */}
      <Section
        id="overdue"
        title="Overdue collections by vertical"
        note="AED thousands, overdue is everything beyond 30 days"
        source={sources['rollup.overdue']}
        asOf={asOf}
      >
        <div className="scroll-x">
          <table className="mis">
            <thead>
              <tr>
                <th>Vertical</th>
                <th>Previous month</th>
                <th>Current month</th>
                <th>Change</th>
                <th>Over one year</th>
              </tr>
            </thead>
            {overdue.rows.map((r, i) => {
              const total = r.currentMonth || 1;
              return (
                <tbody key={r.slug} className="hov">
                  <motion.tr className="main clickable" onClick={go(`/v/${r.slug}/overdue`)} {...rowReveal(i)}>
                    <td>
                      <Link to={`/v/${r.slug}/overdue`} className="vlink press">
                        {r.name}
                      </Link>
                    </td>
                    <Num v={r.previousMonth} tip={tip('rollup.overdue')} />
                    <Num v={r.currentMonth} tip={tip('rollup.overdue')} />
                    <Num v={r.change} f={signedK} bad={r.change > 0} tip={tip('rollup.overdue', 'Up is worse.')} />
                    <Num v={r.overOneYear} bad={r.agingFlag} tip={tip('rollup.overdue', `Buckets 1 to 2 years and over 2 years, ${pct(r.overOneYearPct, 0)} of this vertical's overdue. Red beyond the readout's aging line.`)} />
                  </motion.tr>
                  <tr className="xrow">
                    <td colSpan={5}>
                      <div className="expand">
                        <div>
                          <div className="expand-inner">
                            <p className="label">Why it is not collected</p>
                            <table className="mis compact">
                              <tbody>
                                <tr>
                                  <td>Internal group companies</td>
                                  <Num v={r.reasons.internalGroup} />
                                  <Num v={(r.reasons.internalGroup / total) * 100} f={(n) => pct(n, 0)} />
                                </tr>
                                <tr>
                                  <td>No timeline or no response</td>
                                  <Num v={r.reasons.noTimelineOrResponse} />
                                  <Num v={(r.reasons.noTimelineOrResponse / total) * 100} f={(n) => pct(n, 0)} />
                                </tr>
                                <tr>
                                  <td>Disputes and not yet due</td>
                                  <Num v={r.reasons.disputesAndNotDue} />
                                  <Num v={(r.reasons.disputesAndNotDue / total) * 100} f={(n) => pct(n, 0)} />
                                </tr>
                              </tbody>
                            </table>
                            <p className="muted" style={{ margin: 'var(--s-sm) 0 0' }}>
                              Largest balance: {r.topRemark}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              );
            })}
            <tbody>
              <tr className="total">
                <td>{overdue.total.name}</td>
                <Num v={overdue.total.previousMonth} tip={tip('rollup.overdue')} />
                <Num v={overdue.total.currentMonth} tip={tip('rollup.overdue')} />
                <Num v={overdue.total.change} f={signedK} bad={overdue.total.change > 0} tip={tip('rollup.overdue')} />
                <Num v={overdue.total.overOneYear} bad={overdue.total.agingFlag} tip={tip('rollup.overdue', `${pct(overdue.total.overOneYearPct, 0)} of division overdue is older than a year.`)} />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="label" style={{ marginTop: 'var(--s-xl)' }}>
          Reasons for non-collection, {mil(overdue.total.currentMonth)} overdue across the division
        </p>
        <ReasonGrid reasons={overdue.total.reasons} total={overdue.total.currentMonth} tip={tip('rollup.overdue', 'Each overdue balance carries one reason code.')} />
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
