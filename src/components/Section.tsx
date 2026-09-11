import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Source } from '../../data/schema';
import { useReveal } from './Reveal';

interface Props {
  id: string;
  title: string;
  note?: string;
  intro?: string;
  source?: Source;
  asOf: string;
  /** Load-time stagger for sections above the fold; scroll reveal otherwise. */
  delay?: number;
  children: ReactNode;
}

/** A section of the pack: a heavy rule, a bracket label, a unit note, the content, and its source line. */
export function Section({ id, title, note, intro, source, asOf, delay = 0, children }: Props) {
  const reveal = useReveal();
  return (
    <section className="sec" id={id} aria-labelledby={`${id}-title`}>
      <motion.header className="sec-head" {...reveal(delay)}>
        <h2 className="bracket" id={`${id}-title`}>
          [ {title} ]
        </h2>
        {note && <p className="sec-note">{note}</p>}
      </motion.header>
      {intro && <p className="sec-intro">{intro}</p>}
      {children}
      {source && (
        <p className="sec-src">
          Source: {source.label}. Data as of {asOf}.
        </p>
      )}
    </section>
  );
}
