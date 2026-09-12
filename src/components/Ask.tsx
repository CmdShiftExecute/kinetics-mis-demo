import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import type { Meta } from '../../data/schema';
import { ASK_CLIENT_TIMEOUT_MS, ASK_SUGGESTIONS } from '../lib/askSuggestions';

/*
 * Ask the MIS: a right-hand panel that sends one question at a time to
 * /api/ask and shows the answer with the report page it came from. The
 * transcript lives in the launcher for this page view only; navigating away
 * remounts the masthead and clears it. Nothing is stored anywhere.
 */

export interface AskPage {
  label: string;
  to: string;
}

interface Turn {
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

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function AskLauncher({ meta }: { meta: Meta }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // The shortcut opens the panel; it never closes it, so typed text is not thrown away. Escape and Close do that.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }, []);

  return (
    <>
      <button ref={button} type="button" className="ask-launch press" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        Ask the MIS <kbd aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {open && createPortal(<AskPanel meta={meta} turns={turns} setTurns={setTurns} onClose={close} />, document.body)}
    </>
  );
}

let nextId = 1;

function AskPanel({ meta, turns, setTurns, onClose }: { meta: Meta; turns: Turn[]; setTurns: (f: (t: Turn[]) => Turn[]) => void; onClose: () => void }) {
  const titleId = useId();
  const inputId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const working = turns.some((t) => t.state === 'working');
  /** Requests in flight, aborted when the panel closes so a billed call does not outlive its reader. */
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    input.current?.focus();
    const live = controllers.current;
    return () => {
      for (const c of live) c.abort();
      live.clear();
    };
  }, []);

  useEffect(() => {
    if (!working) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [working]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const focusables = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || working) return;
    const id = nextId++;
    setTurns((t) => [...t, { id, question: q, state: 'working', startedAt: Date.now() }]);
    setText('');
    const controller = new AbortController();
    controllers.current.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ASK_CLIENT_TIMEOUT_MS);
    const finish = (patch: Partial<Turn>) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch, elapsedMs: Date.now() - x.startedAt } : x)));
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as { answer?: string; page?: AskPage; refused?: boolean; error?: string } | null;
      if (!res.ok) {
        finish({ state: 'error', error: body?.error ?? (res.status === 429 ? 'Too many questions at once. Try again in a few seconds.' : 'The answer service is not available right now.') });
      } else if (!body || typeof body.answer !== 'string' || !body.answer.trim()) {
        finish({ state: 'error', error: 'The answer service returned an empty answer. Ask again.' });
      } else {
        finish({ state: 'done', answer: body.answer, page: body.page, refused: body.refused === true });
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      finish({ state: 'error', error: aborted ? (timedOut ? `No answer arrived within ${Math.round(ASK_CLIENT_TIMEOUT_MS / 1000)} seconds. Ask again.` : 'The panel was closed before the answer arrived.') : 'The answer service is not available right now.' });
    } finally {
      clearTimeout(timer);
      controllers.current.delete(controller);
    }
  };

  return (
    <div className="ask" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} onKeyDown={onKeyDown} data-testid="ask-panel">
      <header className="ask-head">
        <div>
          <h2 className="display ask-title" id={titleId}>
            Ask the MIS
          </h2>
          <p className="ask-sub">{meta.division}. One question at a time, answered from the published tables.</p>
        </div>
        <button type="button" className="ask-close press" onClick={onClose} aria-label="Close Ask the MIS">
          Close
        </button>
      </header>

      <div className="ask-log" ref={log} aria-live="polite" aria-relevant="additions text">
        {turns.length === 0 && (
          <div className="ask-suggest">
            <p className="label">Try one of these</p>
            {ASK_SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ask-sugg" onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t) => (
          <article key={t.id} className="ask-turn" data-state={t.state}>
            <p className="ask-q">{t.question}</p>
            {t.state === 'working' && (
              <p className="ask-working" role="status">
                Working, {Math.max(0, Math.round((now - t.startedAt) / 1000))} s
              </p>
            )}
            {t.state === 'error' && (
              <p className="ask-err" role="alert">
                {t.error}
              </p>
            )}
            {t.state === 'done' && (
              <>
                <p className={t.refused ? 'ask-a muted' : 'ask-a'}>{t.answer}</p>
                {t.page && (
                  <p className="ask-src">
                    <span className="label">Source</span>
                    <Link to={t.page.to} className="sec-link press" onClick={onClose}>
                      {t.page.label} {'>>>'}
                    </Link>
                  </p>
                )}
              </>
            )}
          </article>
        ))}
      </div>

      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <label htmlFor={inputId} className="label">
          Your question
        </label>
        <div className="ask-row">
          <input id={inputId} ref={input} type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} autoComplete="off" spellCheck={false} readOnly={working} aria-busy={working} />
          <button type="submit" className="drill-link press ask-send" disabled={working || !text.trim()}>
            Ask
          </button>
        </div>
      </form>

      <p className="ask-foot">
        Answers quote the published data, revision {meta.revision}, data as of {meta.dataAsOfLabel}. Nothing is computed.
      </p>
    </div>
  );
}
