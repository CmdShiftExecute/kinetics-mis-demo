/**
 * One in-view trigger per chart, taken from the chart's HTML wrapper, with the
 * marks driven by variants.
 *
 * Never an IntersectionObserver on an SVG element, and never one per mark.
 * WebKit's IntersectionObserver reports an SVG target once and then never again
 * (w3c/IntersectionObserver#376), so a `whileInView` on a <g>, <rect>, <circle>
 * or <path> leaves every arc and bar at its collapsed entry state for ever on an
 * iPhone. Measured on his phone, 16 Sep 2026: the Overview donut drew its centre
 * figure and legend and no ring, and the allocation chart drew its labels and
 * percentages and no bars. A mark with a collapsed entry state also has a
 * near-zero box, which is unreliable even where the observer works (measured on
 * the profitability bubbles, 13 Sep 2026). The wrapper div is an HTML element that
 * is always laid out at full size, so its trigger cannot deadlock in any engine.
 *
 * `scripts/interactions.ts` refuses a build that puts `whileInView` on anything
 * but an HTML element, so this cannot come back one chart at a time.
 */
import { useInView } from 'motion/react';
import type { RefObject } from 'react';

/** The group's entry: hidden until the chart's wrapper has been seen, then `show`, once. Spread on the group. */
export function useChartEntry(ref: RefObject<Element | null>, reduce: boolean | null) {
  const inView = useInView(ref, { once: true, amount: 'some' });
  return reduce ? {} : { initial: 'hidden' as const, animate: inView ? ('show' as const) : ('hidden' as const) };
}

/** A mark's entry, expressed as variants the group drives rather than its own trigger. */
export const mark = (from: Record<string, number>, to: Record<string, number>, delay: number, duration = 0.5) => ({
  variants: { hidden: from, show: { ...to, transition: { duration, delay, ease: 'easeOut' as const } } },
});
