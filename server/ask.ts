/**
 * Ask the MIS: the answer service.
 *
 * Listens on a Unix socket (never a TCP port), accepts POST /ask with a JSON
 * body { question }, selects the context, asks Claude through the configured
 * provider, audits the reply, and returns the answer with a page link.
 * nginx proxies /api/ask on the demo site to this socket.
 *
 * Caps: ASK_MAX_INFLIGHT questions at once, ASK_PER_MINUTE calls in any
 * sixty-second window, ASK_TIMEOUT_MS per model call. Every call is logged
 * to run/ask.log.jsonl with a GST stamp, the question's length (never its
 * text), tokens, latency, provider and outcome. Nothing else is stored.
 *
 * Run:  bun server/ask.ts   (the systemd user unit deploy/kinetics-ask.service does this)
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VerticalIndexEntry } from '../data/schema';
import { gstStamp } from '../data/gst';
import { REFUSAL, SYSTEM_PROMPT, buildSystemPrompt, buildUserPrompt, estimateTokens, finish, fitContext, minify, numbersIn, select } from './grounding';
import type { ContextFiles } from './grounding';
import { ProviderTimeout, askApi, askSubscription } from './provider';

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
  maxQuestionChars: 400,
};
if (CONFIG.provider !== 'subscription' && CONFIG.provider !== 'api') {
  console.error(`ASK_PROVIDER must be subscription or api, got "${CONFIG.provider}"`);
  process.exit(2);
}
if (CONFIG.provider === 'api' && !process.env.ANTHROPIC_API_KEY) {
  console.error('ASK_PROVIDER=api needs ANTHROPIC_API_KEY in the environment');
  process.exit(2);
}

/* ---------- data, read once at start; a regenerate needs a restart ---------- */

const index = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')) as VerticalIndexEntry[];
const rollupText = minify(readFileSync(join(dataDir, 'rollup.json'), 'utf8'));
const rollupNumbers = numbersIn(rollupText);
const fieldGuide = readFileSync(join(repo, 'data', 'schema.ts'), 'utf8');
const baseTokens = estimateTokens(SYSTEM_PROMPT) + estimateTokens(fieldGuide);
const fileCache = new Map<string, { text: string; numbers: Set<string> }>();
function file(rel: string) {
  let hit = fileCache.get(rel);
  if (!hit) {
    const text = minify(readFileSync(join(dataDir, rel), 'utf8'));
    hit = { text, numbers: numbersIn(text) };
    fileCache.set(rel, hit);
  }
  return hit;
}

/* ---------- caps ---------- */

let inFlight = 0;
const minute: number[] = [];
function minuteCount(now: number) {
  while (minute.length && minute[0]! <= now - 60_000) minute.shift();
  return minute.length;
}

/* ---------- log ---------- */

type Outcome = 'ok' | 'refused' | 'blocked' | 'timeout' | 'error' | 'ratelimited' | 'busy' | 'bad_request';
function log(entry: Record<string, unknown>) {
  try {
    appendFileSync(CONFIG.log, JSON.stringify({ ts: gstStamp(), ...entry }) + '\n');
  } catch {
    /* the log is telemetry; never fail a request over it */
  }
}

/* ---------- handling ---------- */

function send(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data), 'cache-control': 'no-store' });
  res.end(data);
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c: Buffer) => {
      body += c.toString();
      if (body.length > limit) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function answer(question: string) {
  const sel = select(question, index);
  const files: ContextFiles = { rollup: rollupText };
  if (sel.vertical) files.vertical = { entry: sel.vertical, text: file(sel.vertical.file).text };
  if (sel.engineer) files.engineer = { entry: sel.engineer.entry, vertical: sel.engineer.vertical, text: file(`engineers/${sel.engineer.entry.slug}.json`).text };
  const ctx = fitContext(files, baseTokens);
  const published = new Set(rollupNumbers);
  if (ctx.files.vertical) for (const n of file(ctx.files.vertical.entry.file).numbers) published.add(n);
  if (ctx.files.engineer) for (const n of file(`engineers/${ctx.files.engineer.entry.slug}.json`).numbers) published.add(n);
  const req = { system: buildSystemPrompt(ctx, fieldGuide), prompt: buildUserPrompt(question), model: CONFIG.provider === 'api' ? CONFIG.apiModel : CONFIG.model, effort: CONFIG.effort, timeoutMs: CONFIG.timeoutMs };
  const reply = CONFIG.provider === 'api' ? await askApi(req, process.env.ANTHROPIC_API_KEY!) : await askSubscription(req);
  const finished = finish(reply.text, sel, index, published, ctx.note);
  return { finished, reply, ctx, sel };
}

async function handleAsk(req: IncomingMessage, res: ServerResponse) {
  const started = Date.now();
  const now = started;
  let questionLength = 0;
  const done = (outcome: Outcome, extra: Record<string, unknown> = {}) =>
    log({ questionLength, latencyMs: Date.now() - started, provider: CONFIG.provider, model: CONFIG.provider === 'api' ? CONFIG.apiModel : CONFIG.model, outcome, ...extra });

  let question = '';
  try {
    const parsed = JSON.parse((await readBody(req, 8_192)) || '{}') as { question?: unknown };
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
  try {
    const { finished, reply, ctx } = await answer(question);
    const tokens = reply.tokens;
    const base = { page: finished.page, pageResolved: finished.pageResolved, provider: CONFIG.provider, elapsedMs: Date.now() - started, contextTokens: ctx.tokens, tokens };
    if (finished.unverified.length) {
      done('blocked', { tokens, costUsd: reply.costUsd, unverified: finished.unverified, page: finished.page.to });
      return send(res, 200, {
        ...base,
        answer: `The draft answer used a figure that is not in the published data, so it was withheld. The nearest report is ${finished.page.label}.`,
        refused: true,
        blocked: true,
      });
    }
    done(finished.refused ? 'refused' : 'ok', { tokens, costUsd: reply.costUsd, page: finished.page.to, pageResolved: finished.pageResolved });
    return send(res, 200, { ...base, answer: finished.answer, refused: finished.refused, blocked: false });
  } catch (e) {
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
      model: CONFIG.provider === 'api' ? CONFIG.apiModel : CONFIG.model,
      effort: CONFIG.effort,
      inFlight,
      lastMinute: minuteCount(Date.now()),
      caps: { inFlight: CONFIG.maxInFlight, perMinute: CONFIG.perMinute, timeoutMs: CONFIG.timeoutMs },
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      refusal: REFUSAL,
    });
  }
  send(res, 404, { error: 'Not found.' });
});

mkdirSync(runDir, { recursive: true });
if (existsSync(CONFIG.socket)) unlinkSync(CONFIG.socket);
server.listen(CONFIG.socket, () => {
  chmodSync(CONFIG.socket, 0o660);
  console.log(`[ask] ${gstStamp()} listening on ${CONFIG.socket} provider=${CONFIG.provider} model=${CONFIG.provider === 'api' ? CONFIG.apiModel : CONFIG.model} effort=${CONFIG.effort} caps=${CONFIG.maxInFlight}/${CONFIG.perMinute}/min timeout=${CONFIG.timeoutMs}ms`);
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
