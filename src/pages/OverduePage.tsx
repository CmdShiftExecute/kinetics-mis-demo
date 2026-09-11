import { motion, useReducedMotion } from 'motion/react';
import { Link, useParams } from 'react-router';
import type { VerticalData } from '../../data/schema';
import { useJson } from '../lib/data';
import { cx, k, pct, signedK } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Num } from '../components/Num';
import { ReasonGrid } from '../components/ReasonGrid';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { EASE, useRowReveal } from '../components/Reveal';

export default function OverduePage() {
  const { slug = '' } = useParams();
  const { data, error } = useJson<VerticalData>(`verticals/${slug}.json`);
  const reduce = useReducedMotion();
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
        <TableSkeleton rows={12} />
      </div>
    );
  }

  const { meta, overdue, sources } = data;
  const asOf = meta.dataAsOfLabel;
  const tip = (extra?: string) => `${sources['vertical.overdue']?.label}.${extra ? ` ${extra}` : ''} As of ${asOf}.`;
  const t = overdue.total;
  const overOneYear = t.bucket1to2y + t.bucketOver2y;
  const rise = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.2, ease: EASE } };
  let rowIndex = 0;

  return (
    <div className="wrap">
      <Masthead meta={meta} variant="drill" />
      <div style={{ marginTop: 'var(--s-xl)' }}>
        <Link to={`/v/${slug}`} className="back press">
          {'<<<'} {data.name}
        </Link>
        <div className="kicker">
          <span className="bracket">[ Overdue collections ]</span>
          <motion.span layoutId={`vname-${slug}`} className="vname label" style={{ color: 'var(--ink)' }}>
            {data.name}
          </motion.span>
        </div>
        <motion.h1 className="display" style={{ fontSize: 'clamp(2.4rem, 6vw, 5.5rem)', margin: 'var(--s-sm) 0 0' }} {...rise}>
          Who owes us
        </motion.h1>
        <motion.dl className="strip" {...rise}>
          <div>
            <dt className="label">Overdue</dt>
            <dd className="big">{k(t.overdue)}</dd>
            <dd className="sub">AED thousands, beyond 30 days</dd>
          </div>
          <div>
            <dt className="label">Change on month</dt>
            <dd className={cx('big', t.change > 0 && 'bad')}>{signedK(t.change)}</dd>
            <dd className="sub">from {k(t.previousMonthOverdue)}</dd>
          </div>
          <div>
            <dt className="label">Older than a year</dt>
            <dd className={cx('big', overOneYear > 0 && 'bad')}>{k(overOneYear)}</dd>
            <dd className="sub">{pct(t.overdue ? (overOneYear / t.overdue) * 100 : 0, 0)} of overdue</dd>
          </div>
          <div>
            <dt className="label">Disputed</dt>
            <dd className={cx('big', t.disputed > 0 && 'bad')}>{k(t.disputed)}</dd>
            <dd className="sub">flagged by the engineer</dd>
          </div>
          <div>
            <dt className="label">Provision</dt>
            <dd className="big">{k(t.provision)}</dd>
            <dd className="sub">booked against the book</dd>
          </div>
          <div>
            <dt className="label">Net to collect</dt>
            <dd className="big">{k(t.netToCollect)}</dd>
            <dd className="sub">total outstanding less provision</dd>
          </div>
        </motion.dl>
      </div>

      <Section id="aging" title="Aging by engineer and customer" note="AED thousands, sorted by total outstanding" source={sources['vertical.overdue']} asOf={asOf} delay={0.35}>
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
                <th className="left">Previous remark</th>
                <th className="left">Current remark</th>
              </tr>
            </thead>
            {overdue.byEngineer.map((e) => (
              <tbody key={e.engineer}>
                <tr className="sub">
                  <td colSpan={2}>{e.engineer}</td>
                  <Num v={e.bucket0to30} />
                  <Num v={e.bucket31to90} />
                  <Num v={e.bucket91to365} />
                  <Num v={e.bucket1to2y} bad={e.bucket1to2y > 0} />
                  <Num v={e.bucketOver2y} bad={e.bucketOver2y > 0} />
                  <Num v={e.totalOutstanding} />
                  <Num v={e.provision} />
                  <Num v={e.netToCollect} />
                  <Num v={e.disputed} bad={e.disputed > 0} />
                  <Num v={e.previousMonthOverdue} />
                  <Num v={e.overdue} />
                  <Num v={e.change} f={signedK} bad={e.change > 0} />
                  <td colSpan={2} className="muted">
                    {e.customers} {e.customers === 1 ? 'customer' : 'customers'}
                  </td>
                </tr>
                {overdue.rows
                  .filter((r) => r.engineer === e.engineer)
                  .map((r) => {
                    const change = r.overdue - r.previousMonthOverdue;
                    const i = rowIndex++;
                    return (
                      <motion.tr key={r.customer} className="indent" {...rowReveal(i)}>
                        <td>{r.customer}</td>
                        <td className="left muted" style={{ whiteSpace: 'nowrap' }}>
                          {r.terms}
                        </td>
                        <Num v={r.bucket0to30} tip={tip()} />
                        <Num v={r.bucket31to90} tip={tip()} />
                        <Num v={r.bucket91to365} tip={tip()} />
                        <Num v={r.bucket1to2y} bad={r.bucket1to2y > 0} tip={tip()} />
                        <Num v={r.bucketOver2y} bad={r.bucketOver2y > 0} tip={tip()} />
                        <Num v={r.totalOutstanding} tip={tip()} />
                        <Num v={r.provision} tip={tip('Half of 1 to 2 years, all of over 2 years, a quarter of disputed 91 to 365 days.')} />
                        <Num v={r.netToCollect} tip={tip('Total outstanding less provision.')} />
                        <td className="num">{r.dispute ? <span className="tag hz">dispute</span> : <span className="muted">none</span>}</td>
                        <Num v={r.previousMonthOverdue} tip={tip()} />
                        <Num v={r.overdue} tip={tip()} />
                        <Num v={change} f={signedK} bad={change > 0} tip={tip('Up is worse.')} />
                        <td className="remark left">{r.previousRemark}</td>
                        <td className="remark left" style={{ color: 'var(--ink)' }}>
                          {r.currentRemark}
                        </td>
                      </motion.tr>
                    );
                  })}
              </tbody>
            ))}
            <tbody>
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
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="reasons" title="Reasons for non-collection" note={`${k(t.overdue)} overdue in ${data.name}`} source={sources['vertical.overdue']} asOf={asOf}>
        <ReasonGrid reasons={overdue.reasons} total={t.overdue} tip={tip('Each overdue balance carries one reason code.')} />
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
