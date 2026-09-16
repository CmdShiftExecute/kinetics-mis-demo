import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Reconciliation, Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateReconciliation, validateRollup } from '../lib/validate';
import { AED_COMPACT_GUIDE, count, cx, k } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { ErrorBlock, TableSkeleton } from '../components/Skeleton';
import { useRise } from '../components/Reveal';

/** Sources, definitions, the precision policy, the reconciliation result and the synthetic assumptions. */
export default function DataBasis() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rec = useJson<Reconciliation>('reconciliation.json', validateReconciliation);
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
  const { meta, definitions, sources, precisionPolicy, assumptions, sales } = data;
  const defs = Object.values(definitions);
  const failed = rec.data ? rec.data.assertions.filter((a) => !a.pass) : [];
  const shown = rec.data ? [...failed, ...rec.data.assertions.filter((a) => a.pass)] : [];

  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <div className="page-head">
        <div>
          <motion.h1 className="display page-title" {...rise()}>
            Data basis
          </motion.h1>
          <p className="page-sub">Where every figure comes from, what it means, and the machine's own check that the tables agree</p>
        </div>
        <p className="page-basis">
          Data as of {meta.dataAsOfLabel}
          <br />
          Generated {meta.generatedAt.replace('T', ' ').slice(0, 16)} GST, seed {meta.seed}
        </p>
      </div>

      {/* Headline figures, so this page carries the same entry motion as every other. */}
      {rec.data && (
        <Strip
          cols={3}
          items={[
            { label: 'Assertions checked', value: rec.data.assertions.length, f: count, sub: 'every figure tied to every other' },
            { label: 'Passing', value: rec.data.passed, f: count, sub: `checked ${rec.data.checkedAt.replace('T', ' ').slice(0, 16)} GST` },
            { label: 'Failing', value: rec.data.failed, f: count, sub: rec.data.failed === 0 ? 'the tables agree' : 'listed first below', bad: rec.data.failed > 0 },
          ]}
        />
      )}

      <Section id="reporting-basis" title="Reporting basis">
        <dl className="basis-list">
          <div>
            <dt>Company</dt>
            <dd>
              {meta.company}, {meta.division}. A fictional group; all data is synthetic.
            </dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>
              Actual for {meta.periodLabel} ({meta.monthsElapsed} of 12 months). Forecast for {meta.nearMonth} and {meta.restOfYear}. Budget for the full year {meta.fiscalYear}, phased by month for year-to-date comparisons.
            </dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{AED_COMPACT_GUIDE}. Source values remain stored in AED thousands.</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>Every timestamp is GST (Asia/Dubai). Data as of {meta.dataAsOfLabel}, revision {meta.revision}.</dd>
          </div>
        </dl>
      </Section>

      <Section id="reconciliation" title="Reconciliation" note="scripts/reconcile.ts re-reads the published JSON files and asserts that every independently shown figure ties to every other. Failures are listed first.">
        {rec.error && <p className="bad">The reconciliation file could not be loaded: {rec.error}</p>}
        {rec.data && (
          <>
            <p>
              <span className={cx('status', rec.data.failed === 0 ? 'pass' : 'fail')}>{rec.data.failed === 0 ? 'All pass' : `${rec.data.failed} failed`}</span> {rec.data.passed} of {rec.data.assertions.length} assertions pass. Checked {rec.data.checkedAt.replace('T', ' ').slice(0, 16)} GST.
            </p>
            <details className="values" open={failed.length > 0}>
              <summary>Every assertion, with both sides</summary>
              <div className="scroll-x">
                <table className="mis compact" style={{ maxWidth: 1100 }}>
                  <thead>
                    <tr>
                      <th scope="col">Result</th>
                      <th scope="col" className="left">
                        Statement
                      </th>
                      <th scope="col">Left</th>
                      <th scope="col">Right</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <span className={cx('status', a.pass ? 'pass' : 'fail')}>{a.pass ? 'pass' : 'fail'}</span>
                        </td>
                        <td className="left remark ink">{a.statement}</td>
                        <td className="num">{k(a.left)}</td>
                        <td className="num">{k(a.right)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Section>

      <Section id="precision" title="Precision and aggregation policy">
        <ol className="policy">
          {precisionPolicy.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </Section>

      <Section id="netting" title="Netting" note="The one place the reference pack disagrees with itself, and how this site resolves it.">
        <p>{sales.netting.explanation}</p>
        <p>
          Sheet totals add to {k(sales.netting.grossSumYtd)} YTD; {k(sales.netting.doubleCountedYtd)} appears on two sheets; netted YTD revenue is {k(sales.netting.nettedYtd)}. Every product line is listed on the{' '}
          <Link to="/sales#netting-items" className="vlink">
            sales report
          </Link>
          .
        </p>
      </Section>

      <Section id="definitions" title="Definitions" note="Every measure shown on the site: what is measured, for which period, against which comparator.">
        <dl className="basis-list">
          {defs.map((d) => (
            <div key={d.key}>
              <dt>{d.term}</dt>
              <dd>{d.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="sources" title="Sources" note="The table each report reads from. All are generated by scripts/generate_demo_data.ts from one seed.">
        <dl className="basis-list">
          {Object.values(sources).map((s) => (
            <div key={s.key}>
              <dt>{s.key}</dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="assumptions" title="Synthetic assumptions" note="What this demonstration assumes, so nothing is mistaken for a finance-system fact.">
        <ol className="policy">
          {assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}
