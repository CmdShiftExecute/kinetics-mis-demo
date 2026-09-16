import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { ReasonKey, ReceivableSummaryRow, Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { AED_COMPACT_GUIDE, k, pct, signedK } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { ReasonTable } from '../components/ReasonTable';
import { REASON_LABELS } from '../lib/reasons';
import { HBars } from '../components/HBars';
import type { BarRow } from '../components/HBars';
import { ChartSwitch } from '../components/ChartSwitch';
import { Donut } from '../components/Donut';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';

const REASON_ORDER: ReasonKey[] = ['internalGroup', 'followUpNoResponse', 'disputesAndNotDue'];

/** One legend for the age views, so the two bar readings cannot drift apart. */
const AGE_LEGEND = [
  { cls: 'spot2' as const, label: 'Not yet due' },
  { cls: 'spot' as const, label: 'Past due, under a year' },
  { cls: 'hz' as const, label: 'Aged over a year' },
];

/** Receivables by vertical: net to collect month on month, past due, aging, reasons and the largest balances. */
export default function ReceivablesReport() {
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
  const { meta, receivables, overview: o, definitions, sources, largestVertical } = data;
  const asOf = meta.dataAsOfLabel;
  const recBars: BarRow[] = receivables.rows
    .slice()
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .map((r) => ({
      key: r.slug,
      name: r.name,
      segments: [
        { key: 'due', value: r.notYetDue, cls: 'spot2' as const },
        { key: 'past', value: r.pastDue - r.agedOverOneYear, cls: 'spot' as const },
        { key: 'aged', value: r.agedOverOneYear, cls: 'hz' as const },
      ],
      end: k(r.totalOutstanding),
      endDelta: `${pct(r.pastDuePct, 0)} past due`,
      endBad: r.pastDuePct >= 50,
      readout: `${k(r.totalOutstanding)} OUTSTANDING, ${k(r.pastDue)} PAST DUE (${pct(r.pastDuePct)}), ${k(r.agedOverOneYear)} OVER A YEAR, PROVISION ${k(r.provision)}`,
    }));
  const reasonSlices = REASON_ORDER.map((key) => ({ key, name: REASON_LABELS[key], value: receivables.total.reasons[key] }));
  const prev = meta.previousMonthLabel.split(' ')[0];
  const cur = meta.currentMonthLabel.split(' ')[0];
  const others = receivables.rows.filter((r) => r.slug !== largestVertical.slug);
  const largest = receivables.rows.find((r) => r.slug === largestVertical.slug)!;


  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            Receivables
          </motion.h1>
          <p className="page-sub">
            Collections by vertical at {meta.currentMonthLabel} month end
          </p>
        </div>
        <p className="page-basis">
          {AED_COMPACT_GUIDE}
          <br />
          {cur} month end against {prev} month end
        </p>
      </div>

      <Strip
        cols={5}
        items={[
          { label: `Net to collect, ${cur}`, value: o.receivables.currentMonth, sub: `${prev} ${k(o.receivables.previousMonth)}` },
          { label: 'Change on month', value: o.receivables.change, f: signedK, sub: 'net to collect, up is worse', bad: o.receivables.change > 0 },
          { label: 'Total outstanding', value: o.receivables.totalOutstanding, sub: `provision ${k(o.receivables.totalOutstanding - o.receivables.currentMonth)}` },
          { label: 'Past due, beyond terms', value: o.receivables.pastDue, sub: `${pct(o.receivables.pastDuePct)} of outstanding`, bad: o.receivables.pastDue > 0 },
          { label: 'Aged over one year', value: o.receivables.agedOverOneYear, sub: `${pct(o.receivables.agedOverOneYearPct)} of outstanding`, bad: o.receivables.agedOverOneYear > 0 },
        ]}
      />

      <Section id="by-vertical" title="Receivables by vertical" note={`Net to collect ${prev} and ${cur}; total outstanding, provision, past due beyond terms, aged over one year and disputed at ${cur} month end. The name opens the customer table.`} source={sources['rollup.receivables']} asOf={asOf} defs={['netToCollect', 'monthOnMonth', 'totalOutstanding', 'provisionReceivable', 'pastDue', 'agedOverOneYear', 'dispute']} definitions={definitions}>
        <ChartSwitch
          id="rec-chart"
          views={[
            { key: 'bars', label: 'Outstanding by age', icon: 'bars', render: () => <HBars id="rec-chart-bars" ariaLabel={`Total outstanding by vertical at ${cur} month end, split into not yet due, past due under a year and aged over a year, largest first. Exact values are in the table below.`} format={k} legend={AGE_LEGEND} rows={recBars} /> },
            {
              key: 'share',
              label: 'Share of what is owed',
              icon: 'donut',
              render: () => <Donut id="rec-chart-donut" format={k} centreLabel="Outstanding" ariaLabel="Share of total outstanding by vertical. Exact values are in the table below." rows={receivables.rows.map((r) => ({ key: r.slug, name: r.name, value: r.totalOutstanding }))} />,
            },
            { key: 'composition', label: 'Age mix, each to 100%', icon: 'stack', render: () => <HBars id="rec-chart-share" mode="share" ariaLabel="Age mix of each vertical's outstanding balance as shares of its own total. Exact values are in the table below." format={k} legend={AGE_LEGEND} rows={recBars} /> },
          ]}
        />
        <div className="scroll-x">
          <table className="mis sticky">
            <thead>
              <tr>
                <td className="blank" />
                <th className="group" scope="colgroup" colSpan={3}>
                  Net to collect
                </th>
                <th className="group" scope="colgroup" colSpan={7}>
                  At {cur} month end
                </th>
              </tr>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">{prev}</th>
                <th scope="col">{cur}</th>
                <th scope="col">Change</th>
                <th scope="col">Total outstanding</th>
                <th scope="col">Provision</th>
                <th scope="col">Past due</th>
                <th scope="col">Past due %</th>
                <th scope="col">Over 1 year</th>
                <th scope="col">Over 1 year %</th>
                <th scope="col">Disputed</th>
              </tr>
            </thead>
            <tbody>
              {[...others].sort((a, b) => b.currentMonth - a.currentMonth).map((r, i) => (
                <Row key={r.slug} r={r} reveal={rowReveal(i)} />
              ))}
              <Row r={receivables.subtotalExcludingLargest} cls="sub" />
              <Row r={largest} />
              <Row r={receivables.total} cls="total" />
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
          Sorted by net to collect. Past due is beyond each customer's terms; the aging buckets on the customer tables are days since invoice, whatever the terms. Net to collect is outstanding less provision and is not a cash forecast.
        </p>
      </Section>

      <Section id="reasons" title="Reasons for non-collection" note={`Each customer balance carries one reason. The three buckets partition total outstanding of ${k(receivables.total.totalOutstanding)}.`} source={sources['rollup.receivables']} asOf={asOf} defs={['reasons', 'dispute', 'notYetDue']} definitions={definitions}>
        <ChartSwitch
          id="reason-chart"
          views={[
            {
              key: 'ring',
              label: 'Why it is not collected',
              icon: 'donut',
              render: () => <Donut id="reason-chart-donut" format={k} centreLabel="Outstanding" ariaLabel="Total outstanding split by reason for non-collection. Exact values are in the table below." keepOrder rows={reasonSlices} />,
            },
            {
              key: 'bars',
              label: 'Reasons, side by side',
              icon: 'bars',
              render: () => (
                <HBars
                  id="reason-chart-bars"
                  ariaLabel="Total outstanding by reason for non-collection. Exact values are in the table below."
                  format={k}
                  legend={[{ cls: 'spot', label: 'Outstanding under this reason' }]}
                  rows={reasonSlices.map((r) => ({
                    key: r.key,
                    name: r.name,
                    segments: [{ key: 'v', value: r.value, cls: 'spot' as const }],
                    end: k(r.value),
                    endDelta: pct((r.value / receivables.total.totalOutstanding) * 100, 0),
                    readout: `${k(r.value)}, ${pct((r.value / receivables.total.totalOutstanding) * 100)} OF TOTAL OUTSTANDING`,
                  }))}
                />
              ),
            },
          ]}
        />
        <div style={{ maxWidth: 640 }}>
          <ReasonTable reasons={receivables.total.reasons} total={receivables.total.totalOutstanding} />
        </div>
        {REASON_ORDER.map((key) => (
          <div key={key} style={{ marginTop: 'var(--s-xl)' }}>
            <p className="label">{REASON_LABELS[key]}: largest balances in the division</p>
            <ul className="items">
              {receivables.largestByReason[key].map((it, i) => (
                <li key={i}>
                  <span>
                    <Link to={`/v/${it.vertical}/e/${it.engineerSlug}`} className="elink">
                      {it.customer}
                    </Link>
                    <span className="muted">
                      {' '}
                      via {it.engineer}, {it.verticalName}
                    </span>
                  </span>
                  <span className="num">
                    {k(it.totalOutstanding)}
                    <span className="muted">{it.pastDue > 0 ? `${k(it.pastDue)} past due` : 'within terms'}</span>
                  </span>
                  <span className="remark">{it.remark}</span>
                </li>
              ))}
              {receivables.largestByReason[key].length === 0 && <li className="muted">No balances under this reason.</li>}
            </ul>
          </div>
        ))}
      </Section>

      <Section id="by-vertical-reasons" title="Reasons by vertical" note="Share of each vertical's total outstanding under each reason." source={sources['rollup.receivables']} asOf={asOf}>
        <div className="scroll-x">
          <table className="mis compact sticky">
            <thead>
              <tr>
                <th scope="col">Vertical</th>
                <th scope="col">Total outstanding</th>
                <th scope="col">Internal group</th>
                <th scope="col">Follow-up, no response</th>
                <th scope="col">Disputes and not due</th>
                <th scope="col">of which disputed</th>
                <th scope="col">of which within terms</th>
                <th scope="col" className="left">
                  Largest balance
                </th>
              </tr>
            </thead>
            <tbody>
              {receivables.rows.map((r, i) => (
                <motion.tr key={r.slug} className="hov" {...rowReveal(i)}>
                  <td>
                    <Link to={`/v/${r.slug}/receivables`} className="vlink press">
                      {r.name}
                    </Link>
                  </td>
                  <Num v={r.totalOutstanding} />
                  <Num v={r.reasons.internalGroup} />
                  <Num v={r.reasons.followUpNoResponse} />
                  <Num v={r.reasons.disputesAndNotDue} />
                  <Num v={r.reasons.disputed} bad={r.reasons.disputed > 0} />
                  <Num v={r.reasons.withinTerms} />
                  <td className="remark left">
                    {r.largest[0] ? (
                      <>
                        {r.largest[0].customer}, {k(r.largest[0].totalOutstanding)}: {r.largest[0].remark}
                      </>
                    ) : (
                      'None'
                    )}
                  </td>
                </motion.tr>
              ))}
              <tr className="total">
                <td>{receivables.total.name}</td>
                <Num v={receivables.total.totalOutstanding} />
                <Num v={receivables.total.reasons.internalGroup} />
                <Num v={receivables.total.reasons.followUpNoResponse} />
                <Num v={receivables.total.reasons.disputesAndNotDue} />
                <Num v={receivables.total.reasons.disputed} />
                <Num v={receivables.total.reasons.withinTerms} />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

function Row({ r, cls, reveal }: { r: ReceivableSummaryRow; cls?: string; reveal?: object }) {
  const cells = (
    <>
      <td>
        {cls ? (
          r.name
        ) : (
          <Link to={`/v/${r.slug}/receivables`} className="vlink press">
            {r.name}
          </Link>
        )}
      </td>
      <Num v={r.previousMonth} />
      <Num v={r.currentMonth} />
      <Num v={r.change} f={signedK} bad={r.change > 0} />
      <Num v={r.totalOutstanding} />
      <Num v={r.provision} />
      <Num v={r.pastDue} bad={r.pastDue > 0} />
      <Num v={r.pastDuePct} f={pct} />
      <Num v={r.agedOverOneYear} bad={r.agedOverOneYear > 0} />
      <Num v={r.agedOverOneYearPct} f={pct} />
      <Num v={r.disputed} bad={r.disputed > 0} />
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
