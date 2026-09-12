/**
 * The two ways a question reaches Claude.
 *
 * subscription: the `claude` CLI headless on this host, on the principal's
 *   Max subscription, the same pattern as the CareerOps assessment shim. The
 *   OAuth credential never leaves the host and is the only variable handed
 *   to the child process besides PATH, HOME and TZ.
 * api: the Messages API with a metered key from ANTHROPIC_API_KEY. Shipped
 *   as code only. It is switched on by the unit file, never by default, and it
 *   was not exercised when written because no key may be obtained for it.
 */

import { spawn } from 'node:child_process';

export interface ModelRequest {
  system: string;
  prompt: string;
  model: string;
  /** low, medium, high, xhigh or max. Medium: at low the model corrected itself inside the answer on a superlative question (measured 12 Sep 2026). */
  effort: string;
  timeoutMs: number;
}

export interface ModelReply {
  text: string;
  tokens: { input?: number; output?: number; cacheRead?: number; cacheCreation?: number };
  costUsd?: number;
}

export class ProviderTimeout extends Error {
  constructor(ms: number) {
    super(`no reply within ${Math.round(ms / 1000)} seconds`);
    this.name = 'ProviderTimeout';
  }
}

const CLI_FLAGS = ['-p', '--output-format', 'json', '--setting-sources', '', '--tools', '', '--no-session-persistence'];

export function askSubscription(req: ModelRequest): Promise<ModelReply> {
  return new Promise((resolve, reject) => {
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      HOME: process.env.HOME ?? '/tmp',
      TZ: 'Asia/Dubai',
    };
    if (process.env.CLAUDE_CODE_OAUTH_TOKEN) env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const child = spawn('claude', [...CLI_FLAGS, '--model', req.model, '--effort', req.effort, '--system-prompt', req.system], { cwd: '/tmp', env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill('SIGKILL');
      reject(new ProviderTimeout(req.timeoutMs));
    }, req.timeoutMs);
    child.stdout.on('data', (c: Buffer) => (out += c.toString()));
    child.stderr.on('data', (c: Buffer) => (err += c.toString()));
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error(`claude could not start: ${e.message}`));
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`));
      let parsed: { is_error?: boolean; result?: unknown; usage?: Record<string, unknown>; total_cost_usd?: number };
      try {
        parsed = JSON.parse(out) as typeof parsed;
      } catch {
        return reject(new Error(`claude returned non-JSON output: ${out.slice(0, 200)}`));
      }
      if (parsed.is_error) return reject(new Error(`claude reported an error: ${String(parsed.result).slice(0, 300)}`));
      if (typeof parsed.result !== 'string' || !parsed.result.trim()) return reject(new Error('claude returned no text'));
      const u = parsed.usage ?? {};
      const num = (k: string) => (typeof u[k] === 'number' ? (u[k] as number) : undefined);
      resolve({
        text: parsed.result,
        tokens: { input: num('input_tokens'), output: num('output_tokens'), cacheRead: num('cache_read_input_tokens'), cacheCreation: num('cache_creation_input_tokens') },
        costUsd: parsed.total_cost_usd,
      });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(req.prompt);
  });
}

export async function askApi(req: ModelRequest, apiKey: string): Promise<ModelReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: req.model, max_tokens: 1024, system: req.system, output_config: { effort: req.effort }, messages: [{ role: 'user', content: req.prompt }] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Messages API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: Record<string, unknown> };
    const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
    if (!text) throw new Error('Messages API returned no text');
    const u = body.usage ?? {};
    const num = (k: string) => (typeof u[k] === 'number' ? (u[k] as number) : undefined);
    return { text, tokens: { input: num('input_tokens'), output: num('output_tokens'), cacheRead: num('cache_read_input_tokens'), cacheCreation: num('cache_creation_input_tokens') } };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new ProviderTimeout(req.timeoutMs);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
