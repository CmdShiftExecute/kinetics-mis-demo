import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import type { CustomerBalanceRow, VerticalData } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateVertical } from '../lib/validate';
import { count, cx, k, pct, signedK } from '../lib/format';
import { Crumbs, Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { ReasonTable } from '../components/ReasonTable';
import { REASON_LABELS } from '../lib/reasons';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise, useRowReveal } from '../components/Reveal';

/** The customer table for one vertical: terms, aging, provision, past due, dispute, month on month, both remarks. */
export default function CustomerAgingPage() {
  const { slug = '' } = useParams();
  const { data, error } = useJson<VerticalData>(`verticals/${slug}.json`, validateVertical);
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
        <TableSkeleton rows={12} />
      </div>
    );
  }

  const { meta, receivables, sources, definitions } = data;
  const asOf = meta.dataAsOfLabel;
  const t = receivables.total;
  const cur = meta.currentMonthLabel.split(' ')[0];
  const prev = meta.previousMonthLabel.split(' ')[0];
  let rowIndex = 0;

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <Crumbs items={[{ to: `/v/${slug}`, label: data.name }, { label: 'Customer table' }]} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            Receivables by customer
          </motion.h1>
          <p className="page-sub">
            {data.name}, at {meta.currentMonthLabel} month end
          </p>
        </div>
        <p className="page-basis">
          AED thousand
          <br />
          Aging is days since invoice; past due is beyond terms
        </p>
      </div>
      <Strip
        cols={6}
        items={[
          { label: 'Total outstanding', value: t.totalOutstanding, sub: `${count(t.customers)} ${t.customers === 1 ? 'customer' : 'customers'}` },
          { label: 'Provision', value: t.provision, sub: 'per the written rule' },
          { label: 'Net to collect', value: t.netToCollect, sub: `${signedK(t.change)} on ${prev}`, bad: t.change > 0 },
          { label: 'Past due, beyond terms', value: t.pastDue, sub: `${pct(t.totalOutstanding ? (t.pastDue / t.totalOutstanding) * 100 : 0, 0)} of outstanding`, bad: t.pastDue > 0 },
          { label: 'Aged over one year', value: t.agedOverOneYear, sub: `${pct(t.totalOutstanding ? (t.agedOverOneYear / t.totalOutstanding) * 100 : 0, 0)} of outstanding`, bad: t.agedOverOneYear > 0 },
          { label: 'Disputed', value: t.disputed, sub: 'flagged by the engineer', bad: t.disputed > 0 },
        ]}
      />

      <Section id="aging" title="Aging by engineer and customer" note={`Sorted by total outstanding within each engineer. Terms, days since invoice, provision, not yet due and past due against terms, dispute, net to collect ${prev} and ${cur}, both remarks.`} source={sources['vertical.receivables']} asOf={asOf} defs={['agingBuckets', 'pastDue', 'notYetDue', 'provisionReceivable', 'netToCollect', 'dispute', 'reasons', 'monthOnMonth']} definitions={definitions}>
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
                  Balances at {cur}
                </th>
                <th className="group" scope="colgroup" colSpan={3}>
                  Net to collect
                </th>
                <th className="group" scope="colgroup" colSpan={4}>
                  State and remarks
                </th>
              </tr>
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
                <th scope="col">{prev}</th>
                <th scope="col">{cur}</th>
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
            {receivables.byEngineer.map((e) => (
              <tbody key={e.slug}>
                <tr className="sub">
                  <td colSpan={2}>
                    <Link to={`/v/${slug}/e/${e.slug}`} className="elink press">
                      {e.engineer}
                    </Link>
                    <span className="muted">
                      {' '}
                      {count(e.customers)} {e.customers === 1 ? 'customer' : 'customers'}
                    </span>
                  </td>
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
                  <td colSpan={3} />
                </tr>
                {receivables.rows
                  .filter((r) => r.engineer === e.engineer)
                  .map((r) => (
                    <CustomerRow key={r.customer} r={r} reveal={rowReveal(rowIndex++)} />
                  ))}
              </tbody>
            ))}
            <tbody>
              <tr className="total">
                <td colSpan={2}>Total, {data.name}</td>
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
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="reasons" title="Reasons for non-collection" note={`${k(t.totalOutstanding)} outstanding in ${data.name}; each customer balance carries one reason.`} source={sources['vertical.receivables']} asOf={asOf} defs={['reasons']} definitions={definitions}>
        <div style={{ maxWidth: 640 }}>
          <ReasonTable reasons={receivables.reasons} total={t.totalOutstanding} />
        </div>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

function CustomerRow({ r, reveal }: { r: CustomerBalanceRow; reveal: object }) {
  return (
    <motion.tr className="indent hov" {...reveal}>
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
      <Num v={r.previousMonthNet} />
      <Num v={r.netToCollect} />
      <Num v={r.change} f={signedK} bad={r.change > 0} />
      <td className="num">{r.dispute ? <span className="tag hz">dispute</span> : <span className="muted">none</span>}</td>
      <td className={cx('left', 'nowrap', 'muted')}>{REASON_LABELS[r.reason]}</td>
      <td className="remark left">{r.previousRemark}</td>
      <td className="remark left ink">{r.currentRemark}</td>
    </motion.tr>
  );
}
