import { useReducedMotion } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Props for a once-only section reveal on scroll: opacity and a 12px rise.
 * Under prefers-reduced-motion it returns nothing, so content is simply there.
 */
export function useReveal() {
  const reduce = useReducedMotion();
  return (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.12 },
          transition: { duration: 0.5, delay, ease: EASE },
        };
}

/** Row reveals use opacity only (transforms on table rows are unreliable across engines), 20 ms apart, capped at 12 rows. */
export function useRowReveal() {
  const reduce = useReducedMotion();
  return (index: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, amount: 0.2 },
          transition: { duration: 0.35, delay: Math.min(index, 12) * 0.02, ease: EASE },
        };
}

/** Load-time rise for a page title or headline strip. */
export function useRise() {
  const reduce = useReducedMotion();
  return (delay = 0) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: EASE } });
}
