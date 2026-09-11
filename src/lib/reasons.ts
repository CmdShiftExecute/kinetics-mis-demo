import type { ReasonKey } from '../../data/schema';

export const REASON_LABELS: Record<ReasonKey, string> = {
  internalGroup: 'Internal group companies',
  followUpNoResponse: 'Follow-up, no timeline or no response',
  disputesAndNotDue: 'Disputes and not yet due',
};
