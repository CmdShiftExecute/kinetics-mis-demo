import { useReducedMotion } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Returns a function that produces the props for a once-only scroll reveal.
 * Under prefers-reduced-motion it returns nothing, so content is simply there.
 */
export function useReveal() {
  const reduce = useReducedMotion();
  return (delay = 0, amount = 0.3, y = 12) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount },
          transition: { duration: 0.55, delay, ease: EASE },
        };
}

/** Row reveals use opacity only; transforms on table rows are unreliable across engines. */
export function useRowReveal() {
  const reduce = useReducedMotion();
  return (index: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0 },
          whileInView: { opacity: 1 },
          viewport: { once: true, amount: 0.3 },
          transition: { duration: 0.4, delay: Math.min(index, 12) * 0.02, ease: EASE },
        };
}
