import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { cx, k } from '../lib/format';
import { EASE, useRise } from './Reveal';

export interface StripItem {
  label: string;
  /** The figure, unformatted, so it can count up on entry. */
  value: number;
  /** Formatter, defaults to AED thousands. */
  f?: (n: number) => string;
  sub?: string;
  bad?: boolean;
}

function CountUp({ value, f, delay }: { value: number; f: (n: number) => string; delay: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : value * 0.6);
  const text = useTransform(mv, (v) => f(v));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.7, delay, ease: EASE });
    return () => c.stop();
  }, [value, reduce, mv, delay]);
  return <motion.span>{text}</motion.span>;
}

/** A row of headline figures, each with its label above and its comparator below. Figures count up on entry. */
export function Strip({ items, cols }: { items: StripItem[]; cols?: number }) {
  const rise = useRise();
  return (
    <motion.dl className="strip" style={cols ? ({ '--cols': cols } as React.CSSProperties) : undefined} {...rise(0.1)}>
      {items.map((it, i) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd className={cx('big', it.bad && 'bad')}>
            <CountUp value={it.value} f={it.f ?? k} delay={0.15 + i * 0.05} />
          </dd>
          {it.sub && <dd className="sub">{it.sub}</dd>}
        </div>
      ))}
    </motion.dl>
  );
}
