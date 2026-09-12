/**
 * Ask the MIS: the answer service.
 *
 * Listens on a Unix socket (never a TCP port), accepts POST /ask with a JSON
 * body { question }, selects the context, asks Claude through the configured
 * provider, checks the reply, and returns the answer with a page link.
 * nginx proxies /api/ask on the demo site to this socket.
 *
 * Three checks stand between the model and the reader, in server/grounding.ts:
 * a draft that revises itself is never shown; every figure must carry a Cite
 * line that resolves to its exact value in the context, in a sentence that
 * names its row, as an extreme of its table when the question asks for one,
 * and with a direction word that agrees with its sign; and every number must
 * exist in the published files. One retry, then the answer is withheld.
 *
 * Caps: ASK_MAX_INFLIGHT questions at once, ASK_PER_MINUTE model calls in any
 * sixty-second window (a retry counts), ASK_TIMEOUT_MS per model call. A
 * request the browser abandons kills its model call. Every call is logged to
 * run/ask.log.jsonl with a GST stamp, the question's length (never its text),
 * tokens, latency, provider and outcome. Nothing else is stored.
 *
 * Run:  bun server/ask.ts   (the systemd user unit deploy/kinetics-ask.service does this)
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VerticalIndexEntry } from '../data/schema';
import { gstStamp } from '../data/gst';
import { REFUSAL, SYSTEM_PROMPT, buildSystemPrompt, buildUserPrompt, checkCitations, estimateTokens, finish, fitContext, minify, numbersIn, select } from './grounding';
import type { ContextFiles } from './grounding';
import { ClientGone, ProviderTimeout, askApi, askSubscription } from './provider';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const runDir = join(repo, 'run');
const dataDir = join(repo, 'public', 'data');

const CONFIG = {
  provider: (process.env.ASK_PROVIDER ?? 'subscription') as 'subscription' | 'api',
  model: process.env.ASK_MODEL ?? 'sonnet',
  effort: process.env.ASK_EFFORT ?? 'medium',
  apiModel: process.env.ASK_API_MODEL ?? 'claude-sonnet-5',
  socket: process.env.ASK_SOCKET ?? join(runDir, 'ask.sock'),
  log: process.env.ASK_LOG ?? join(runDir, 'ask.log.jsonl'),
  timeoutMs: Number(process.env.ASK_TIMEOUT_MS ?? 40_000),
  maxInFlight: Number(process.env.ASK_MAX_INFLIGHT ?? 3),
  perMinute: Number(process.env.ASK_PER_MINUTE ?? 12),
  /** A retry starts only when the first attempt finished inside this budget, so two attempts stay near the browser's patience. */
  retryWithinMs: Number(process.env.ASK_RETRY_WITHIN_MS ?? 15_000),
  maxQuestionChars: 400,
  maxBodyBytes: 8_192,
};
if (CONFIG.provider !== 'subscription' && CONFIG.provider !== 'api') {
  console.error(`ASK_PROVIDER must be subscription or api, got "${CONFIG.provider}"`);
  process.exit(2);
}
if (CONFIG.provider === 'api' && !process.env.ANTHROPIC_API_KEY) {
  console.error('ASK_PROVIDER=api needs ANTHROPIC_API_KEY in the environment');
  process.exit(2);
}
const modelName = CONFIG.provider === 'api' ? CONFIG.apiModel : CONFIG.model;

/* ---------- data, read once at start; a regenerate needs a restart ---------- */

const index = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')) as VerticalIndexEntry[];
const rollupText = minify(readFileSync(join(dataDir, 'rollup.json'), 'utf8'));
const rollupNumbers = numbersIn(rollupText);
const rollupJson = JSON.parse(rollupText) as unknown;
const fieldGuide = readFileSync(join(repo, 'data', 'schema.ts'), 'utf8');
const baseTokens = estimateTokens(SYSTEM_PROMPT) + estimateTokens(fieldGuide);
const fileCache = new Map<string, { text: string; numbers: Set<string>; json: unknown }>();
function file(rel: string) {
  let hit = fileCache.get(rel);
  if (!hit) {
    const text = minify(readFileSync(join(dataDir, rel), 'utf8'));
    hit = { text, numbers: numbersIn(text), json: JSON.parse(text) as unknown };
    fileCache.set(rel, hit);
  }
  return hit;
}

/* ---------- caps ---------- */

let inFlight = 0;
/** One entry per model call, so a retry spends a slot too. */
const minute: number[] = [];
function minuteCount(now: number) {
  while (minute.length && minute[0]! <= now - 60_000) minute.shift();
  return minute.length;
}

/* ---------- log ---------- */

type Outcome = 'ok' | 'refused' | 'blocked' | 'retried' | 'timeout' | 'abandoned' | 'error' | 'ratelimited' | 'busy' | 'bad_request';
function log(entry: Record<string, unknown>) {
  try {
    appendFileSync(CONFIG.log, JSON.stringify({ ts: gstStamp(), ...entry }) + '\n');
  } catch {
    /* the log is telemetry; never fail a request over it */
  }
}

/* ---------- handling ---------- */

function send(res: ServerResponse, status: number, body: unknown) {
  if (res.writableEnded || res.destroyed) return;
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data), 'cache-control': 'no-store' });
  res.end(data);
}

/** Reads the body up to the limit. An oversized body is drained and flagged, never torn, so the reader gets a 413 rather than a gateway error. */
function readBody(req: IncomingMessage, limit: number): Promise<{ body: string; tooLarge: boolean }> {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', (c: Buffer) => {
      if (tooLarge) return;
      body += c.toString();
      if (body.length > limit) {
        tooLarge = true;
        body = '';
      }
    });
    req.on('end', () => resolve({ body, tooLarge }));
    req.on('error', reject);
  });
}

interface Attempt {
  text: string;
  costUsd: number;
  tokens: Record<string, number | undefined>;
}

async function answer(question: string, signal: AbortSignal, onCall: () => boolean) {
  const sel = select(question, index);
  const files: ContextFiles = { rollup: rollupText };
  if (sel.vertical) files.vertical = { entry: sel.vertical, text: file(sel.vertical.file).text };
  if (sel.engineer) files.engineer = { entry: sel.engineer.entry, vertical: sel.engineer.vertical, text: file(`engineers/${sel.engineer.entry.slug}.json`).text };
  const ctx = fitContext(files, baseTokens);
  const notes = [ctx.note, sel.otherVerticals.length && sel.vertical ? `This answer covers ${sel.vertical.name} only; ask about ${sel.otherVerticals.map((v) => v.name).join(' and ')} separately.` : null].filter((n): n is string => Boolean(n));
  const published = new Set(rollupNumbers);
  if (ctx.files.vertical) for (const n of file(ctx.files.vertical.entry.file).numbers) published.add(n);
  if (ctx.files.engineer) for (const n of file(`engineers/${ctx.files.engineer.entry.slug}.json`).numbers) published.add(n);
  const jsonFiles = {
    rollup: rollupJson,
    vertical: ctx.files.vertical ? file(ctx.files.vertical.entry.file).json : undefined,
    engineer: ctx.files.engineer ? file(`engineers/${ctx.files.engineer.entry.slug}.json`).json : undefined,
  };
  const req = { system: buildSystemPrompt(ctx, fieldGuide), prompt: buildUserPrompt(question), model: modelName, effort: CONFIG.effort, timeoutMs: CONFIG.timeoutMs, signal };
  const attempts: Attempt[] = [];
  const attempt = async () => {
    const reply = CONFIG.provider === 'api' ? await askApi(req, process.env.ANTHROPIC_API_KEY!) : await askSubscription(req);
    attempts.push({ text: reply.text, costUsd: reply.costUsd ?? 0, tokens: reply.tokens });
    const finished = finish(reply.text, index, published, notes.length ? notes.join(' ') : null);
    // A refusal quotes nothing, so it needs no citations; every other answer must trace every figure.
    const cites = finished.refused ? { ok: true, problems: [] } : checkCitations(finished.answer, finished.citations, jsonFiles, index, question);
    return { finished, cites };
  };
  const t0 = Date.now();
  let a = await attempt();
  let retried = false;
  if ((a.finished.selfCorrected || !a.cites.ok) && Date.now() - t0 < CONFIG.retryWithinMs && onCall()) {
    // A draft that changed its mind, or whose figures do not trace, is never shown. One more try on the same cached context, then withhold.
    retried = true;
    a = await attempt();
  }
  const costUsd = attempts.reduce((s, x) => s + x.costUsd, 0);
  const tokens = attempts.reduce<Record<string, number>>((s, x) => {
    for (const [k, v] of Object.entries(x.tokens)) if (typeof v === 'number') s[k] = (s[k] ?? 0) + v;
    return s;
  }, {});
  return { finished: a.finished, cites: a.cites, ctx, retried, costUsd, tokens, calls: attempts.length };
}

async function handleAsk(req: IncomingMessage, res: ServerResponse) {
  const started = Date.now();
  let questionLength = 0;
  const done = (outcome: Outcome, extra: Record<string, unknown> = {}) => log({ questionLength, latencyMs: Date.now() - started, provider: CONFIG.provider, model: modelName, outcome, ...extra });

  let question = '';
  try {
    const { body, tooLarge } = await readBody(req, CONFIG.maxBodyBytes);
    if (tooLarge) {
      done('bad_request', { reason: 'body' });
      return send(res, 413, { error: `Keep the request under ${CONFIG.maxBodyBytes} bytes.` });
    }
    const parsed = JSON.parse(body || '{}') as { question?: unknown };
    question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
  } catch {
    done('bad_request');
    return send(res, 400, { error: 'Send a JSON body with a "question" string.' });
  }
  questionLength = question.length;
  if (!question) {
    done('bad_request');
    return send(res, 400, { error: 'Type a question first.' });
  }
  if (question.length > CONFIG.maxQuestionChars) {
    done('bad_request');
    return send(res, 400, { error: `Keep the question under ${CONFIG.maxQuestionChars} characters.` });
  }
  // The clock for the caps starts once the body is in, so a slow body cannot bank a slot.
  const now = Date.now();
  if (inFlight >= CONFIG.maxInFlight) {
    done('busy');
    return send(res, 429, { error: `${CONFIG.maxInFlight} questions are already being answered. Try again in a few seconds.`, retryAfterSeconds: 5 });
  }
  if (minuteCount(now) >= CONFIG.perMinute) {
    const wait = Math.max(1, Math.ceil((minute[0]! + 60_000 - now) / 1000));
    done('ratelimited');
    return send(res, 429, { error: `${CONFIG.perMinute} questions have been asked this minute. Try again in ${wait} seconds.`, retryAfterSeconds: wait });
  }

  inFlight++;
  minute.push(now);
  /** A retry takes a slot only if one is free; otherwise the first draft is withheld as it stands. */
  const takeSlot = () => {
    const t = Date.now();
    if (minuteCount(t) >= CONFIG.perMinute) return false;
    minute.push(t);
    return true;
  };
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  try {
    const { finished, cites, ctx, retried, costUsd, tokens, calls } = await answer(question, controller.signal, takeSlot);
    const base = { page: finished.page, pageResolved: finished.pageResolved, provider: CONFIG.provider, elapsedMs: Date.now() - started, contextTokens: ctx.tokens, tokens, retried };
    const meta = { tokens, costUsd, calls, retried, page: finished.page.to };
    if (finished.selfCorrected) {
      done('blocked', { ...meta, reason: 'self-correction' });
      return send(res, 200, { ...base, answer: `The draft answer revised itself midway, so it was withheld. Ask again in plainer words, or open ${finished.page.label}.`, refused: true, blocked: true });
    }
    if (!cites.ok) {
      done('blocked', { ...meta, reason: 'citation', problems: cites.problems });
      return send(res, 200, { ...base, answer: `The draft answer carried a figure that could not be traced to its row in the published data, so it was withheld. Ask again in plainer words, or open ${finished.page.label}.`, refused: true, blocked: true });
    }
    if (finished.unverified.length) {
      done('blocked', { ...meta, reason: 'audit', unverified: finished.unverified });
      return send(res, 200, { ...base, answer: `The draft answer used a figure that is not in the published data, so it was withheld. The nearest report is ${finished.page.label}.`, refused: true, blocked: true });
    }
    done(finished.refused ? 'refused' : retried ? 'retried' : 'ok', { ...meta, pageResolved: finished.pageResolved });
    return send(res, 200, { ...base, answer: finished.answer, refused: finished.refused, blocked: false });
  } catch (e) {
    if (e instanceof ClientGone) {
      done('abandoned');
      return;
    }
    if (e instanceof ProviderTimeout) {
      done('timeout');
      return send(res, 504, { error: `The answer did not arrive within ${Math.round(CONFIG.timeoutMs / 1000)} seconds. Ask again.` });
    }
    const message = e instanceof Error ? e.message : String(e);
    done('error', { error: message.slice(0, 300) });
    console.error(`[ask] ${gstStamp()} ${message}`);
    return send(res, 502, { error: 'The answer service could not reach the model. Ask again in a moment.' });
  } finally {
    inFlight--;
  }
}

const startedAt = Date.now();
const server = createServer((req, res) => {
  const url = req.url ?? '/';
  if (req.method === 'POST' && (url === '/ask' || url === '/api/ask')) {
    handleAsk(req, res).catch((e) => {
      console.error(`[ask] ${gstStamp()} unhandled: ${String(e)}`);
      try {
        send(res, 500, { error: 'Internal error.' });
      } catch {
        /* response already gone */
      }
    });
    return;
  }
  if (req.method === 'GET' && (url === '/health' || url === '/api/ask/health')) {
    return send(res, 200, {
      ok: true,
      provider: CONFIG.provider,
      model: modelName,
      effort: CONFIG.effort,
      inFlight,
      lastMinute: minuteCount(Date.now()),
      caps: { inFlight: CONFIG.maxInFlight, perMinute: CONFIG.perMinute, timeoutMs: CONFIG.timeoutMs, retryWithinMs: CONFIG.retryWithinMs },
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      refusal: REFUSAL,
    });
  }
  send(res, 404, { error: 'Not found.' });
});

/** Refuses to start beside a live instance: two processes on one socket would each keep their own caps. */
function socketInUse(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!existsSync(path)) return resolve(false);
    const s = connect(path);
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

mkdirSync(runDir, { recursive: true });
if (await socketInUse(CONFIG.socket)) {
  console.error(`[ask] ${gstStamp()} another instance is already serving ${CONFIG.socket}; refusing to start`);
  process.exit(2);
}
if (existsSync(CONFIG.socket)) unlinkSync(CONFIG.socket);
server.listen(CONFIG.socket, () => {
  chmodSync(CONFIG.socket, 0o660);
  console.log(`[ask] ${gstStamp()} listening on ${CONFIG.socket} provider=${CONFIG.provider} model=${modelName} effort=${CONFIG.effort} caps=${CONFIG.maxInFlight}/${CONFIG.perMinute}/min timeout=${CONFIG.timeoutMs}ms`);
});
const stop = () => {
  server.close(() => {
    if (existsSync(CONFIG.socket)) unlinkSync(CONFIG.socket);
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2_000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
