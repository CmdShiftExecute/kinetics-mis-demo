import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';
import type { Meta } from '../../data/schema';
import { Stamp } from './Stamp';
import { EASE } from './Reveal';

/**
 * The masthead. On the front page the wordmark is the page's one oversized
 * letterform; on drill pages it shrinks and becomes the way home.
 */
export function Masthead({ meta, variant }: { meta: Meta; variant: 'front' | 'drill' }) {
  const reduce = useReducedMotion();
  const rise = reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE } };
  const draw = reduce
    ? {}
    : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.62, delay: 0.15, ease: EASE } };
  return (
    <header>
      <motion.div className="masthead" {...rise}>
        <div>
          {variant === 'front' ? (
            <h1 className="display wordmark">Halvard</h1>
          ) : (
            <Link to="/" className="display wordmark small press" aria-label="Back to the division front page">
              Halvard
            </Link>
          )}
          <div className="mast-lines">
            <span className="label">{meta.company.replace('Halvard ', '')}</span>
            <span className="label">{meta.division}</span>
            <span className="label">Management information system</span>
          </div>
        </div>
        <Stamp meta={meta} />
      </motion.div>
      <motion.hr className="rule-draw" style={{ transformOrigin: 'left' }} {...draw} />
    </header>
  );
}
