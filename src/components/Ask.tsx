import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import type { Meta } from '../../data/schema';
import { ASK_CLIENT_TIMEOUT_MS, ASK_SUGGESTIONS } from '../lib/askSuggestions';
import { askStore, useAsk } from '../lib/askStore';
import type { AskPage, Derivation, Turn } from '../lib/askStore';

/*
 * Ask the MIS: a right-hand panel that sends one question at a time to
 * /api/ask and shows the answer with the report page it came from. The
 * transcript and the open state live in askStore, so a source link or a
 * change of report keeps the conversation on screen; "New chat" starts over.
 */

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Requests in flight. "New chat" aborts them; closing the panel does not, so an answer can still land in the transcript. */
const inFlight = new Set<AbortController>();
let nextId = Date.now();

export function AskLauncher({ meta }: { meta: Meta }) {
  const { open } = useAsk();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // The shortcut opens the panel; it never closes it, so typed text is not thrown away. Escape and Close do that.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        askStore.open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => {
    askStore.close();
    requestAnimationFrame(() => button.current?.focus());
  };

  return (
    <>
      <button ref={button} type="button" className="ask-launch press" aria-haspopup="dialog" aria-expanded={open} onClick={() => askStore.open()}>
        Ask the MIS <kbd aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {open && createPortal(<AskPanel meta={meta} onClose={close} />, document.body)}
    </>
  );
}

function AskPanel({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  const { turns, openedAt } = useAsk();
  const titleId = useId();
  const inputId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const working = turns.some((t) => t.state === 'working');
  // Animate the entrance only when the reader has just opened the panel, not when a page change remounts it.
  const [fresh] = useState(() => Date.now() - openedAt < 600);

  useEffect(() => {
    input.current?.focus();
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

  const newChat = () => {
    for (const c of inFlight) c.abort();
    inFlight.clear();
    askStore.clear();
    setText('');
    input.current?.focus();
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || working) return;
    const id = nextId++;
    askStore.setTurns((t) => [...t, { id, question: q, state: 'working', startedAt: Date.now() }]);
    setText('');
    const controller = new AbortController();
    inFlight.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ASK_CLIENT_TIMEOUT_MS);
    const finish = (patch: Partial<Turn>) => askStore.setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch, elapsedMs: Date.now() - x.startedAt } : x)));
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as { answer?: string; page?: AskPage; refused?: boolean; derived?: Derivation[]; error?: string } | null;
      if (!res.ok) {
        finish({ state: 'error', error: body?.error ?? (res.status === 429 ? 'Too many questions at once. Try again in a few seconds.' : 'The answer service is not available right now.') });
      } else if (!body || typeof body.answer !== 'string' || !body.answer.trim()) {
        finish({ state: 'error', error: 'The answer service returned an empty answer. Ask again.' });
      } else {
        finish({ state: 'done', answer: body.answer, page: body.page, refused: body.refused === true, derived: Array.isArray(body.derived) ? body.derived : [] });
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      if (aborted && !timedOut) return; // discarded by New chat; the turn is already gone
      finish({ state: 'error', error: aborted ? `No answer arrived within ${Math.round(ASK_CLIENT_TIMEOUT_MS / 1000)} seconds. Ask again.` : 'The answer service is not available right now.' });
    } finally {
      clearTimeout(timer);
      inFlight.delete(controller);
    }
  };

  return (
    <div className={fresh ? 'ask ask-fresh' : 'ask'} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} onKeyDown={onKeyDown} data-testid="ask-panel">
      <header className="ask-head">
        <div>
          <h2 className="display ask-title" id={titleId}>
            Ask the MIS
          </h2>
          <p className="ask-sub">Every answer is quoted from this MIS and linked to its page.</p>
        </div>
        <div className="ask-actions">
          <button type="button" className="ask-tool press" onClick={newChat} disabled={turns.length === 0} data-testid="ask-new">
            New chat
          </button>
          <button type="button" className="ask-tool press" onClick={onClose} aria-label="Close Ask the MIS">
            Close
          </button>
        </div>
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
                {t.derived && t.derived.length > 0 && (
                  <p className="ask-work">
                    <span className="label">Working</span>
                    {t.derived.map((d) => (
                      <span key={d.result + d.expression} className="ask-work-line">
                        {d.result} = {d.expression.replace(/\*/g, '\u00d7')}
                      </span>
                    ))}
                  </p>
                )}
                {t.page && (
                  <p className="ask-src">
                    <span className="label">Source</span>
                    <Link to={t.page.to} className="sec-link press">
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
          <button type="submit" className="ask-send" disabled={working || !text.trim()}>
            <span>Ask</span>
          </button>
        </div>
      </form>

      <p className="ask-foot">
        Figures are quoted from revision {meta.revision}, data as of {meta.dataAsOfLabel}, and checked against it before they are shown. A derived figure shows its working.
      </p>
    </div>
  );
}
