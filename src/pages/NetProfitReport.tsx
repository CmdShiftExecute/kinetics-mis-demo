import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { PlRungKey, ProfitabilityRow, Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { cx, k, pct, signedK } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { PlLadder } from '../components/PlLadder';
import { Waterfall } from '../components/Waterfall';
import { ChartSwitch } from '../components/ChartSwitch';
import { HBars } from '../components/HBars';
import { Quadrant } from '../components/Quadrant';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';

/** The division-total P&L ladder and vertical profitability on the FY forecast. */
export default function NetProfitReport() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rise = useRise();
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
        <TableSkeleton rows={12} />
      </div>
    );
  }
  const { meta, pl, profitability, definitions, sources, largestVertical } = data;
  const asOf = meta.dataAsOfLabel;
  const others = profitability.rows.filter((r) => r.slug !== largestVertical.slug);
  const largest = profitability.rows.find((r) => r.slug === largestVertical.slug)!;
  const maxShare = Math.max(...profitability.rows.map((x) => x.revenueShare));
  const divisionTotal = pl.find((g) => g.key === 'total')!;
  const npBudget = divisionTotal.rungs.find((r) => r.key === 'buNetProfit')!.budget;
  const gmRungs: PlRungKey[] = ['salaryCtc', 'warehouseCost', 'warehouseSalaries', 'commonAdmin', 'provisionsInterCo', 'corporateOverhead'];
  /** Gross margin is exactly net profit plus the six cost lines below it, so the ring is a true partition, not a proportion of convenience. */
  const gmSplit = [
    { key: 'buNetProfit', name: 'BU-level net profit', value: divisionTotal.rungs.find((r) => r.key === 'buNetProfit')!.forecast },
    ...gmRungs.map((key) => {
      const r = divisionTotal.rungs.find((x) => x.key === key)!;
      return { key, name: r.label, value: r.forecast };
    }),
  ];
  const gmTotal = divisionTotal.rungs.find((r) => r.key === 'grossMargin')!.forecast;
  const plDefs = divisionTotal.rungs.map((r) => ({ key: `pl-${r.key}`, term: r.label, text: `${r.definition} Fed by: ${r.feeds}.` }));
  const defs = { ...definitions, ...Object.fromEntries(plDefs.map((d) => [d.key, d])) };


  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            Net profit
          </motion.h1>
          <p className="page-sub">Profit and loss summary and vertical profitability, FY {meta.fiscalYear}</p>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          YTD actual, FY forecast, FY budget
        </p>
      </div>

      {/* Headline figures, added 13 Sep 2026. See the note in SalesReport: these were
          the two report pages with no headline strip and no chart. */}
      <Strip
        cols={4}
        items={[
          { label: 'FY forecast revenue', value: profitability.total.fyRevenue, f: k },
          { label: 'FY gross margin', value: profitability.total.fyGm, f: k, sub: `${pct(profitability.total.gmPct)} of revenue` },
          { label: 'FY net profit', value: profitability.total.fyNp, f: k, sub: `${signedK(profitability.total.fyNp - npBudget)} against FY budget` },
          { label: 'Net margin', value: profitability.total.npPct, f: pct, sub: 'of netted division revenue' },
        ]}
      />

      <Section id="pl" title="Profit and loss summary" note="Division total, revenue down to BU-level net profit. Hover or tab a line for its definition." source={sources['rollup.pl']} asOf={asOf} defs={['plColumns', ...plDefs.map((d) => d.key)]} definitions={defs}>
        <ChartSwitch
          id="pl-chart"
          views={[
            { key: 'bridge', label: 'Bridge to net profit', icon: 'steps', render: () => <Waterfall group={divisionTotal} id="pl-bridge" /> },
            {
              key: 'split',
              /* Seven parts, so bars rather than a ring: length carries the comparison
                 and colour carries nothing, which is the only honest way to show this
                 many parts in a two-ink system. Net profit is the residual and is drawn
                 in ink to separate it from the six costs. */
              label: 'Where the gross margin goes',
              icon: 'bars',
              render: () => (
                <HBars
                  id="pl-split"
                  ariaLabel="Full-year forecast gross margin split into net profit and each cost line below it, largest first. Exact values are in the ladder below."
                  format={k}
                  legend={[
                    { cls: 'ink', label: 'What is left, net profit' },
                    { cls: 'spot', label: 'Cost line' },
                  ]}
                  rows={gmSplit
                    .slice()
                    .sort((a, b) => b.value - a.value)
                    .map((r) => ({
                      key: r.key,
                      name: r.name,
                      segments: [{ key: 'v', value: r.value, cls: r.key === 'buNetProfit' ? ('ink' as const) : ('spot' as const) }],
                      end: k(r.value),
                      endDelta: pct((r.value / gmTotal) * 100, 0),
                      readout: `${k(r.value)}, ${pct((r.value / gmTotal) * 100)} OF THE ${k(gmTotal)} GROSS MARGIN`,
                    }))}
                />
              ),
            },
          ]}
        />
        <PlLadder groups={[divisionTotal]} cols={{ ytd: 'YTD', forecast: 'FY forecast', budget: 'FY budget' }} showVariance="all" />
        <p className="muted" style={{ marginTop: 'var(--s-md)' }}>
          Each vertical carries the same ladder on its own page.
        </p>
      </Section>

      <Section id="profitability" title="Vertical profitability" note={`Full-year ${meta.fiscalYear} forecast: revenue, gross margin, BU-level net profit and share of netted division revenue.`} source={sources['rollup.profitability']} asOf={asOf} defs={['fyForecast', 'buNetProfit', 'revenueShare']} definitions={definitions}>
        <ChartSwitch
          id="prof-chart"
          views={[
            {
              key: 'quadrant',
              label: 'Net margin against gross margin',
              icon: 'quadrant',
              render: () => (
                <Quadrant
                  id="prof-chart-quad"
                  ariaLabel="Net profit percent against gross margin percent by vertical, bubble area is full-year forecast revenue. Exact values are in the table below."
                  rows={profitability.rows.map((r) => ({ key: r.slug, name: r.name, x: r.gmPct, y: r.npPct, size: r.fyRevenue }))}
                  refX={profitability.total.gmPct}
                  refY={profitability.total.npPct}
                  xLabel="GM percent"
                  yLabel="NP percent"
                  fx={(n) => pct(n, 0)}
                  fy={(n) => pct(n, 0)}
                  readout={(p) => `${k(profitability.rows.find((r) => r.slug === p.key)!.fyRevenue)} REVENUE, GM ${pct(p.x)}, NET ${pct(p.y)}`}
                />
              ),
            },
            {
              key: 'bars',
              label: 'Revenue and gross margin',
              icon: 'bars',
              render: () => (
                <HBars
                  id="prof-chart-bars"
                  ariaLabel="Full-year forecast revenue by vertical, split into gross margin and cost of sales, largest first. Exact values are in the table below."
                  format={k}
                  legend={[
                    { cls: 'spot', label: 'Gross margin' },
                    { cls: 'spot2', label: 'Cost of sales' },
                  ]}
                  rows={profitability.rows
                    .slice()
                    .sort((a, b) => b.fyRevenue - a.fyRevenue)
                    .map((r) => ({
                      key: r.slug,
                      name: r.name,
                      segments: [
                        { key: 'gm', value: r.fyGm, cls: 'spot' as const },
                        { key: 'cos', value: r.fyRevenue - r.fyGm, cls: 'spot2' as const },
                      ],
                      end: k(r.fyRevenue),
                      endDelta: `GM ${pct(r.gmPct, 0)}`,
                      endBad: r.npPct < 0,
                      readout: `REVENUE ${k(r.fyRevenue)}, GM ${k(r.fyGm)} (${pct(r.gmPct)}), NET ${k(r.fyNp)} (${pct(r.npPct)})`,
                    }))}
                />
              ),
            },
          ]}
        />
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
              {[...others].sort((a, b) => a.fyNp - b.fyNp).map((r, i) => (
                <Row key={r.slug} r={r} largest={largestVertical.slug} maxShare={maxShare} reveal={rowReveal(i)} />
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

function Row({ r, cls, largest, maxShare, reveal }: { r: ProfitabilityRow; cls?: string; largest: string; maxShare: number; reveal?: object }) {
return (
  <motion.tr className={cls ?? 'hov'} {...reveal}>
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
  </motion.tr>
);
}
