/**
 * One in-view trigger per chart, on the group, with the marks driven by variants.
 *
 * Never one observer per mark. A mark whose entry state collapses it (scale 0,
 * pathLength 0) has a near-zero box, and an IntersectionObserver on that box is
 * unreliable to the point of never firing, so the mark stays invisible for ever:
 * it cannot animate because it is not visible, and it is not visible because it
 * has not animated. Measured on the live page 13 Sep 2026 — four of the ten
 * profitability bubbles sat at their initial state indefinitely while six beside
 * them had entered, and raising the threshold to zero did not clear it. The group
 * is a full-size element that is always laid out, so its trigger cannot deadlock.
 */
export const GROUP_IN_VIEW = { initial: 'hidden' as const, whileInView: 'show' as const, viewport: { once: true, amount: 'some' as const } };

/** A mark's entry, expressed as variants the group drives rather than its own trigger. */
export const mark = (from: Record<string, number>, to: Record<string, number>, delay: number, duration = 0.5) => ({
  variants: { hidden: from, show: { ...to, transition: { duration, delay, ease: 'easeOut' as const } } },
});
