import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup, SalesRow } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { k, pct, pts, signedK, signedPct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { HBars } from '../components/HBars';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';

/** Sales performance by vertical, the engineer split, and the netting note with every shared line. */
export default function SalesReport() {
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
  const { meta, sales, engineerSplit, definitions, sources, largestVertical } = data;
  const asOf = meta.dataAsOfLabel;
  const others = sales.rows.filter((r) => r.slug !== largestVertical.slug);
  const largest = sales.rows.find((r) => r.slug === largestVertical.slug)!;
  const nameOf = (slug: string) => sales.rows.find((r) => r.slug === slug)?.name ?? slug;
  let rowIndex = 0;

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            Sales
          </motion.h1>
          <p className="page-sub">Sales performance by vertical, {meta.periodLabel}</p>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          YTD actual against YTD budget, same months
        </p>
      </div>

      {/* Headline figures. Sales and Net profit were the only two report pages with
          neither a headline strip nor a chart, which is why they read as dead next to
          the overview: the row reveal alone is imperceptible. Measured 13 Sep 2026. */}
      <Strip
        cols={4}
        items={[
          { label: 'YTD revenue', value: sales.total.ytdRevenue, f: k },
          { label: 'YTD budget', value: sales.total.budgetRevenue, f: k },
          { label: 'Actual less budget', value: sales.total.dRevenue, f: signedK, sub: `${signedPct(sales.total.dRevenuePct)} of budget`, bad: sales.total.dRevenue < 0 },
          { label: 'YTD gross margin', value: sales.total.ytdGm, f: k, sub: `${pct(sales.total.ytdGmPct)} of revenue` },
        ]}
      />

      <Section id="sales-by-vertical" title="Sales performance by vertical" note={`Open and expected orders at ${meta.currentMonthLabel}; revenue and gross margin for ${meta.periodLabel}; budget phased for the same months.`} source={sources['rollup.sales']} asOf={asOf} defs={['openOrders', 'expectedOrders', 'ytdRevenue', 'ytdBudget', 'variance', 'gmPct', 'attributedTotal']} definitions={definitions}>
        <HBars
          id="sales-chart"
          ariaLabel="YTD revenue by vertical against YTD budget, largest first. Exact values are in the table below."
          format={k}
          shortfall
          legend={[
            { cls: 'spot', label: 'YTD revenue' },
            { cls: 'tick', label: 'YTD budget' },
            { cls: 'gap', label: 'Shortfall to budget' },
          ]}
          rows={sales.rows
            .slice()
            .sort((a, b) => b.ytdRevenue - a.ytdRevenue)
            .map((r) => ({
              key: r.slug,
              name: r.name,
              segments: [{ key: 'rev', value: r.ytdRevenue, cls: 'spot' as const }],
              target: r.budgetRevenue,
              end: k(r.ytdRevenue),
              endDelta: signedK(r.dRevenue),
              endBad: r.dRevenue < 0,
              readout: `${k(r.ytdRevenue)} VS BUDGET ${k(r.budgetRevenue)}, ${signedK(r.dRevenue)} (${signedPct(r.dRevenuePct)}), GM ${pct(r.ytdGmPct)}`,
            }))}
        />
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <td className="blank" />
                <th className="group" scope="colgroup" colSpan={2}>
                  Orders
                </th>
                <th className="group" scope="colgroup" colSpan={3}>
                  YTD actual
                </th>
                <th className="group" scope="colgroup" colSpan={3}>
                  YTD budget
                </th>
                <th className="group" scope="colgroup" colSpan={4}>
                  Actual less budget
                </th>
              </tr>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">Open</th>
                <th scope="col">Expected</th>
                <th scope="col">Revenue</th>
                <th scope="col">GM</th>
                <th scope="col">GM %</th>
                <th scope="col">Revenue</th>
                <th scope="col">GM</th>
                <th scope="col">GM %</th>
                <th scope="col">Revenue</th>
                <th scope="col">Revenue %</th>
                <th scope="col">GM</th>
                <th scope="col">GM pts</th>
              </tr>
            </thead>
            <tbody>
              {others.map((r, i) => (
                <Row key={r.slug} r={r} reveal={rowReveal(i)} />
              ))}
              <Row r={sales.subtotalExcludingLargest} cls="sub" />
              <Row r={largest} />
              <Row r={sales.total} cls="total" />
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
          {largestVertical.name} is the largest vertical, so a subtotal without it is shown, as the reference pack does. Open and expected orders are not revenue.
        </p>
      </Section>

      <Section id="engineers" title="Sales by engineer" note={`Every sales engineer, YTD actual against YTD budget, ${meta.periodLabel}. The name opens the engineer's page.`} source={sources['vertical.sales']} asOf={asOf} defs={['ytdRevenue', 'ytdBudget', 'variance', 'fyForecast']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis compact sticky">
            <thead>
              <tr>
                <th scope="col">Vertical and engineer</th>
                <th scope="col">YTD revenue</th>
                <th scope="col">YTD budget</th>
                <th scope="col">Variance</th>
                <th scope="col">GM %</th>
                <th scope="col">FY forecast</th>
                <th scope="col">FY budget</th>
              </tr>
            </thead>
            {sales.rows.map((v) => (
              <tbody key={v.slug}>
                <tr className="sub">
                  <td>
                    <Link to={`/v/${v.slug}`} className="vlink press">
                      {v.name}
                    </Link>
                  </td>
                  <Num v={v.ytdRevenue} />
                  <Num v={v.budgetRevenue} />
                  <Num v={v.dRevenue} f={signedK} bad={v.dRevenue < 0} />
                  <Num v={v.ytdGmPct} f={pct} />
                  <td className="num" colSpan={2} />
                </tr>
                {(engineerSplit[v.slug] ?? []).map((e) => (
                  <motion.tr key={e.slug} className="indent hov" {...rowReveal(rowIndex++)}>
                    <td>
                      <Link to={`/v/${v.slug}/e/${e.slug}`} className="elink press">
                        {e.name}
                      </Link>
                    </td>
                    <Num v={e.ytdRevenue} />
                    <Num v={e.budgetRevenue} />
                    <Num v={e.dRevenue} f={signedK} bad={e.dRevenue < 0} />
                    <Num v={e.ytdGmPct} f={pct} />
                    <Num v={e.fyForecast} />
                    <Num v={e.fyBudget} />
                  </motion.tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Section>

      <Section id="netting-items" title="Netting" note="Product lines reported on two sheets, counted once in their home vertical." source={sources['rollup.sales']} asOf={asOf} defs={['netting', 'attributedTotal', 'sheetTotal']} definitions={{ ...definitions, netting: { key: 'netting', term: 'Netting', text: sales.netting.explanation } }}>
        <p>
          Sheet totals add to <strong>{k(sales.netting.grossSumYtd)}</strong> YTD; <strong>{k(sales.netting.doubleCountedYtd)}</strong> appears on two sheets; netted YTD revenue is <strong>{k(sales.netting.nettedYtd)}</strong>. Full year: gross {k(sales.netting.grossSumFy)}, double counted {k(sales.netting.doubleCountedFy)}, netted {k(sales.netting.nettedFy)}.
        </p>
        <div className="scroll-x">
          <table className="mis compact" style={{ maxWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col">Product line</th>
                <th scope="col" className="left">
                  Engineer
                </th>
                <th scope="col" className="left">
                  Counted in
                </th>
                <th scope="col" className="left">
                  Also shown on
                </th>
                <th scope="col">YTD revenue</th>
                <th scope="col">FY forecast</th>
              </tr>
            </thead>
            <tbody>
              {sales.netting.items.map((it, i) => (
                <motion.tr key={i} {...rowReveal(i)}>
                  <td>{it.product}</td>
                  <td className="left">
                    <Link to={`/v/${it.homeVertical}/e/${it.engineer.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="elink">
                      {it.engineer}
                    </Link>
                  </td>
                  <td className="left">{nameOf(it.homeVertical)}</td>
                  <td className="left">{nameOf(it.categoryVertical)}</td>
                  <Num v={it.ytdRevenue} />
                  <Num v={it.fyForecastRevenue} />
                </motion.tr>
              ))}
              <tr className="total">
                <td colSpan={4}>Double counted if sheets were added</td>
                <Num v={sales.netting.doubleCountedYtd} />
                <Num v={sales.netting.doubleCountedFy} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

function Row({ r, cls, reveal }: { r: SalesRow; cls?: string; reveal?: object }) {
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
      <Num v={r.openOrders} />
      <Num v={r.expectedOrders} />
      <Num v={r.ytdRevenue} />
      <Num v={r.ytdGm} />
      <Num v={r.ytdGmPct} f={pct} />
      <Num v={r.budgetRevenue} />
      <Num v={r.budgetGm} />
      <Num v={r.budgetGmPct} f={pct} />
      <Num v={r.dRevenue} f={signedK} bad={r.dRevenue < 0} />
      <Num v={r.dRevenuePct} f={signedPct} bad={r.dRevenuePct < 0} />
      <Num v={r.dGm} f={signedK} bad={r.dGm < 0} />
      <Num v={r.dGmPts} f={pts} bad={r.dGmPts < 0} />
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
