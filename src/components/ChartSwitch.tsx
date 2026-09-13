import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChartIcon } from './ChartIcons';
import type { IconKey } from './ChartIcons';
import { EASE } from './Reveal';

export interface ChartView {
  key: string;
  /** Named in the bar beside the icons, so the glyph never has to carry the meaning alone. */
  label: string;
  icon: IconKey;
  render: () => ReactNode;
}

/**
 * One chart, several ways to read it. The switch is a print-style segmented
 * control at the top right: the active view is named on the left, each glyph is
 * a real button carrying its own label for assistive technology, and the choice
 * survives navigation within the tab.
 *
 * There is deliberately NO AnimatePresence here. `initial={false}` on a presence
 * boundary suppresses the entry animation of every motion component beneath it,
 * which is what left both apps looking static on 13 Sep 2026. Keying the wrapper
 * remounts the chart instead, so each view replays its own entrance on switch.
 */
export function ChartSwitch({ id, views, defaultKey }: { id: string; views: ChartView[]; defaultKey?: string }) {
  const reduce = useReducedMotion();
  const fallback = defaultKey ?? views[0]!.key;
  const [key, setKey] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`chart-view:${id}`);
      return stored && views.some((v) => v.key === stored) ? stored : fallback;
    } catch {
      // Private-mode storage throws on read; the default view is the right answer then.
      return fallback;
    }
  });
  const active = views.find((v) => v.key === key) ?? views[0]!;
  const choose = (next: string) => {
    setKey(next);
    try {
      sessionStorage.setItem(`chart-view:${id}`, next);
    } catch {
      /* nothing to do: the view still switches, it just will not be remembered */
    }
  };
  return (
    <div className="chart-views" data-testid={`${id}-switch`}>
      <div className="cv-bar">
        <span className="cv-name">{active.label}</span>
        <div className="cv-btns" role="group" aria-label="Chart view">
          {views.map((v) => (
            <button key={v.key} type="button" aria-pressed={v.key === active.key} aria-label={`Show as ${v.label.toLowerCase()}`} title={v.label} data-view={v.key} onClick={() => choose(v.key)}>
              <ChartIcon name={v.icon} />
            </button>
          ))}
        </div>
      </div>
      <motion.div key={active.key} {...(reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, ease: EASE } })}>
        {active.render()}
      </motion.div>
      <p className="sr-only" aria-live="polite">
        {`Chart shown as ${active.label.toLowerCase()}`}
      </p>
    </div>
  );
}
