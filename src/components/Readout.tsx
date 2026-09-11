import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type { Meta, Readout as ReadoutT, ScorecardItem } from '../../data/schema';
import { EASE } from './Reveal';
import { cx } from '../lib/format';

function CountUp({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.9, delay: 0.35, ease: EASE });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

function VerdictTag({ verdict }: { verdict: ScorecardItem['verdict'] }) {
  return <span className={cx('verdict', verdict === 'WATCH' && 'watch', verdict === 'BEHIND' && 'behind')}>{verdict}</span>;
}

/**
 * The Readout: one number, three lines of judgement, five verdicts.
 * All of it was decided at generation time by written thresholds; the
 * browser only animates it in.
 */
export function Readout({ readout, meta }: { readout: ReadoutT; meta: Meta }) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: EASE } };
  return (
    <section aria-labelledby="readout-title">
      <motion.div className="readout" {...fade(0.3)}>
        <div>
          <h2 id="readout-title" className="bracket">
            [ The readout ]
          </h2>
          <p className="label" style={{ marginTop: 'var(--s-lg)' }}>
            {readout.headline.label}
          </p>
          <p className="display numeral">
            <CountUp value={readout.headline.valueMillions} />
            <span className="unit">{meta.currency} million</span>
          </p>
          <p className="numeral-sub">{readout.headline.sub}</p>
          <div className="judgement">
            {readout.lines.map((line, i) => (
              <motion.p key={i} {...fade(0.9 + i * 0.06)}>
                {line}
              </motion.p>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Five questions, five verdicts</p>
          <div role="list">
            {readout.scorecard.map((s, i) => (
              <motion.div className="score-row" key={s.key} role="listitem" {...fade(0.9 + i * 0.06)}>
                <div>
                  <span className="bracket">{s.label}</span>
                  <p className="q">{s.question}</p>
                </div>
                <div>
                  <p className="fig">{s.figure}</p>
                  <p className="note">{s.note}</p>
                </div>
                <VerdictTag verdict={s.verdict} />
              </motion.div>
            ))}
          </div>
          <details className="thresholds">
            <summary>How the verdicts are decided</summary>
            <dl>
              {Object.entries(readout.thresholds).map(([key, rule]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <dt>{key}</dt>
                  <dd>{rule}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </motion.div>
    </section>
  );
}
