import { useSyncExternalStore } from 'react';

/*
 * The Ask the MIS transcript and the panel's open state live here, outside
 * any page, so following a source link or navigating between reports keeps
 * the conversation on screen. The store is mirrored to sessionStorage: it
 * survives a reload of the same tab and ends when the tab closes. Nothing is
 * sent anywhere; the server never sees a transcript.
 */

export interface AskPage {
  label: string;
  to: string;
}

export interface Turn {
  id: number;
  question: string;
  state: 'working' | 'done' | 'error';
  answer?: string;
  page?: AskPage;
  refused?: boolean;
  error?: string;
  startedAt: number;
  elapsedMs?: number;
}

export interface AskState {
  open: boolean;
  /** When the panel was last opened by the reader, so the entrance animates once, not on every navigation. */
  openedAt: number;
  turns: Turn[];
}

const KEY = 'halvard-ask-mis';
const EMPTY: AskState = { open: false, openedAt: 0, turns: [] };

function load(): AskState {
  if (typeof sessionStorage === 'undefined') return EMPTY;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<AskState>;
    const turns = (Array.isArray(p.turns) ? p.turns : []).map((t) =>
      // A question that was still working when the tab reloaded cannot finish; say so rather than spin.
      t.state === 'working' ? { ...t, state: 'error' as const, error: 'The page reloaded before the answer arrived. Ask again.' } : t,
    );
    return { open: p.open === true, openedAt: typeof p.openedAt === 'number' ? p.openedAt : 0, turns };
  } catch {
    return EMPTY;
  }
}

let state: AskState = load();
const listeners = new Set<() => void>();

function commit(next: AskState) {
  state = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable: the in-memory copy still serves this page view */
  }
  for (const l of listeners) l();
}

export const askStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  open() {
    if (!state.open) commit({ ...state, open: true, openedAt: Date.now() });
  },
  close() {
    if (state.open) commit({ ...state, open: false });
  },
  setTurns(f: (t: Turn[]) => Turn[]) {
    commit({ ...state, turns: f(state.turns) });
  },
  /** Starts a fresh conversation: the transcript is discarded and any answer still in flight is dropped. */
  clear() {
    commit({ ...state, turns: [] });
  },
};

export function useAsk(): AskState {
  return useSyncExternalStore(askStore.subscribe, askStore.get, () => EMPTY);
}
