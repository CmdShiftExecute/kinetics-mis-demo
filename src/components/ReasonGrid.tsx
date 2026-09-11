import type { ReasonBuckets } from '../../data/schema';
import { k, pct } from '../lib/format';

export const REASON_LABELS: Record<keyof ReasonBuckets, string> = {
  internalGroup: 'Internal group companies',
  noTimelineOrResponse: 'No timeline or no response',
  disputesAndNotDue: 'Disputes and not yet due',
};

const ORDER: (keyof ReasonBuckets)[] = ['internalGroup', 'noTimelineOrResponse', 'disputesAndNotDue'];

/** Reasons for non-collection, three buckets that sum to the overdue figure. */
export function ReasonGrid({ reasons, total, tip }: { reasons: ReasonBuckets; total: number; tip: string }) {
  const maxV = Math.max(...ORDER.map((key) => reasons[key]), 1);
  return (
    <div className="reasons" role="list" aria-label="Reasons for non-collection">
      {ORDER.map((key) => {
        const v = reasons[key];
        const share = total ? (v / total) * 100 : 0;
        return (
          <div key={key} role="listitem" className="tip-host" data-tip={tip} tabIndex={0}>
            <p className="label">{REASON_LABELS[key]}</p>
            <p className="big">{k(v)}</p>
            <p className="share">
              <span className={key === 'noTimelineOrResponse' && share >= 50 ? 'bar hz' : 'bar'} style={{ width: `${(v / maxV) * 100}%`, maxWidth: '70%' }} aria-hidden="true" />
              {pct(share, 0)} of overdue
            </p>
          </div>
        );
      })}
    </div>
  );
}
