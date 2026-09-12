/**
 * Ask the MIS regression gate: thirty questions with expected figures and
 * pages, derived from the generated data so they follow the seed, run against
 * a served /api/ask.
 *
 * Run:  bun scripts/ask_regression.ts [--base https://node-ss.tail640a1e.ts.net:926] [--out <dir>] [--insecure]
 *
 * A question passes when every expected figure appears verbatim (thousands
 * separators ignored), the page link is one of the expected pages, and the
 * service did not withhold the answer. An unanswerable question passes when the
 * answer carries the refusal wording. The gate fails below 28 of 30. Latency
 * p50 and p95 are reported; a p95 above 12 seconds is printed as a finding.
 * Every answer is also re-audited here against every published number, so a
 * figure the service let through is still counted.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngineerData, Rollup, VerticalData, VerticalIndexEntry } from '../data/schema';
import { gstStamp } from '../data/gst';
import { REFUSAL, auditFigures, hasSelfCorrection, numbersIn } from '../server/grounding';
import { ASK_SUGGESTIONS } from '../src/lib/askSuggestions';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const base = arg('base', 'http://127.0.0.1:4180').replace(/\/$/, '');
const out = arg('out', join(process.cwd(), 'screenshots', 'ask-regression'));
if (args.includes('--insecure')) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
mkdirSync(out, { recursive: true });

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');
const read = <T,>(rel: string): T => JSON.parse(readFileSync(join(dataDir, rel), 'utf8')) as T;
const r = read<Rollup>('rollup.json');
const index = read<VerticalIndexEntry[]>('index.json');
const vertical = (slug: string) => read<VerticalData>(`verticals/${slug}.json`);
const engineer = (slug: string) => read<EngineerData>(`engineers/${slug}.json`);

/* ---------- expected-figure formatting: what the panel would print ---------- */

const k = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-GB');
const pct = (n: number) => `${Math.abs(n).toFixed(1)}%`;
const x = (n: number) => `${Math.abs(n).toFixed(1)}`;

interface Q {
  id: number;
  kind: 'rollup' | 'vertical' | 'engineer' | 'unanswerable';
  question: string;
  figures: string[];
  pages: string[];
  refusal: boolean;
}

const o = r.overview;
const totalRungs = r.pl.find((g) => g.key === 'total')!.rungs;
const rung = (key: string) => totalRungs.find((g) => g.key === key)!;
const minBy = <T,>(xs: T[], f: (t: T) => number) => xs.reduce((a, b) => (f(b) < f(a) ? b : a));
const maxBy = <T,>(xs: T[], f: (t: T) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a));
const behind = minBy(r.sales.rows, (s) => s.dRevenue);
const bestGm = maxBy(r.sales.rows, (s) => s.ytdGmPct);
const largestShare = r.profitability.rows.find((p) => p.slug === r.largestVertical.slug)!;
const august = r.monthly.find((m) => m.index === r.meta.monthsElapsed)!;
const mostAged = maxBy(r.receivables.rows, (s) => s.agedOverOneYear);
const reasons = r.receivables.total.reasons;
const topReason = Math.max(reasons.internalGroup, reasons.followUpNoResponse, reasons.disputesAndNotDue);
const cooling = vertical('cooling');
const mech = vertical('mechanical-systems');
const fab = vertical('fabrication');
const bassem = engineer('bassem-farouk');
const rohan = engineer('rohan-pillai');
const engRoute = (e: EngineerData) => `/v/${e.vertical.slug}/e/${e.slug}`;

const questions: Q[] = [
  { id: 1, kind: 'rollup', question: 'What is year to date revenue for the division against budget?', figures: [k(o.sales.ytdRevenue), k(o.sales.ytdBudget)], pages: ['/', '/sales'], refusal: false },
  { id: 2, kind: 'rollup', question: ASK_SUGGESTIONS[0]!, figures: [behind.name, k(behind.dRevenue)], pages: ['/', '/sales'], refusal: false },
  { id: 3, kind: 'rollup', question: ASK_SUGGESTIONS[1]!, figures: [k(o.delivery.fyForecast), k(o.delivery.fyBudget)], pages: ['/', '/delivery'], refusal: false },
  { id: 4, kind: 'rollup', question: 'What is the forecast BU level net profit for the full year against budget?', figures: [k(rung('buNetProfit').forecast), k(rung('buNetProfit').budget)], pages: ['/', '/net-profit'], refusal: false },
  { id: 5, kind: 'rollup', question: 'Which verticals are forecast to make a loss this year?', figures: o.profit.lossMakers.flatMap((l) => [l.name, k(l.fyNp)]), pages: ['/', '/net-profit'], refusal: false },
  { id: 6, kind: 'rollup', question: 'What is net to collect at the current month end, and how did it move from the previous month?', figures: [k(o.receivables.currentMonth), k(o.receivables.change)], pages: ['/', '/receivables'], refusal: false },
  { id: 7, kind: 'rollup', question: ASK_SUGGESTIONS[2]!, figures: [k(o.receivables.pastDue)], pages: ['/', '/receivables'], refusal: false },
  { id: 8, kind: 'rollup', question: 'How much working capital is tied up in total?', figures: [k(o.workingCapital.total)], pages: ['/', '/working-capital'], refusal: false },
  { id: 9, kind: 'rollup', question: 'What is total stock across the division?', figures: [k(r.inventory.total.totalStock)], pages: ['/', '/working-capital'], refusal: false },
  { id: 10, kind: 'rollup', question: 'What is the unbilled balance at the current month end?', figures: [k(r.unbilled.total.currentMonth)], pages: ['/', '/working-capital'], refusal: false },
  { id: 11, kind: 'rollup', question: 'Which vertical has the highest year to date gross margin percent?', figures: [bestGm.name, pct(bestGm.ytdGmPct)], pages: ['/', '/sales'], refusal: false },
  { id: 12, kind: 'rollup', question: 'What is the revenue share of the largest vertical?', figures: [largestShare.name, pct(largestShare.revenueShare)], pages: ['/net-profit'], refusal: false },
  { id: 13, kind: 'rollup', question: `What was revenue in ${r.meta.currentMonthLabel} against budget for that month?`, figures: [k(august.actual ?? 0), k(august.budget)], pages: ['/', '/delivery'], refusal: false },
  { id: 14, kind: 'rollup', question: `What is the near-month revenue forecast for ${r.meta.nearMonth}?`, figures: [k(r.forecast.total.nearMonthForecast)], pages: ['/', '/delivery'], refusal: false },
  { id: 15, kind: 'rollup', question: 'Which vertical has the most receivables aged over one year?', figures: [mostAged.name, k(mostAged.agedOverOneYear)], pages: ['/receivables'], refusal: false },
  { id: 16, kind: 'rollup', question: 'How much year to date revenue is double counted between vertical sheets?', figures: [k(r.sales.netting.doubleCountedYtd)], pages: ['/', '/sales'], refusal: false },
  { id: 17, kind: 'rollup', question: 'What is the division gross margin percent year to date against the budget margin?', figures: [pct(o.sales.ytdGmPct), pct(o.sales.budgetGmPct)], pages: ['/', '/sales'], refusal: false },
  { id: 18, kind: 'rollup', question: 'What was prior year revenue, and what is the forecast year on year change?', figures: [k(r.forecast.total.priorYearRevenue), pct(r.forecast.total.yoyPct)], pages: ['/', '/delivery'], refusal: false },
  { id: 19, kind: 'rollup', question: 'Which reason accounts for the largest uncollected balance across the division?', figures: [k(topReason)], pages: ['/receivables'], refusal: false },
  { id: 20, kind: 'rollup', question: 'What is the division salary cost year to date?', figures: [k(rung('salaryCtc').ytd)], pages: ['/net-profit'], refusal: false },
  { id: 21, kind: 'vertical', question: 'How is Cooling doing on year to date revenue against budget?', figures: [k(cooling.headline.ytdRevenue), k(cooling.headline.budgetRevenue)], pages: ['/v/cooling', '/sales', '/'], refusal: false },
  { id: 22, kind: 'vertical', question: 'What is the full-year forecast BU net profit for Mechanical Systems against budget?', figures: [k(mech.headline.buNetProfitForecast), k(mech.headline.buNetProfitBudget)], pages: ['/v/mechanical-systems', '/net-profit'], refusal: false },
  { id: 23, kind: 'vertical', question: 'How much stock does Fabrication hold, and how much of it is free stock?', figures: [k(fab.inventory.total.totalStock), k(fab.inventory.total.freeStock)], pages: ['/v/fabrication', '/working-capital'], refusal: false },
  { id: 24, kind: 'engineer', question: "What is Bassem Farouk's year to date revenue against budget?", figures: [k(bassem.headline.ytdRevenue), k(bassem.headline.budgetRevenue)], pages: [engRoute(bassem), '/v/mechanical-systems'], refusal: false },
  { id: 25, kind: 'engineer', question: "What is Rohan Pillai's ROI year to date?", figures: [x(rohan.headline.roiYtd)], pages: [engRoute(rohan), '/v/electrical-distribution'], refusal: false },
  { id: 26, kind: 'unanswerable', question: 'What was the gross margin in the third quarter of last year?', figures: [], pages: [], refusal: true },
  { id: 27, kind: 'unanswerable', question: 'What is the combined year to date revenue of Cooling and Metering?', figures: [], pages: [], refusal: true },
  { id: 28, kind: 'unanswerable', question: 'Who is the managing director of Halvard?', figures: [], pages: [], refusal: true },
  { id: 29, kind: 'unanswerable', question: 'What is the cash balance in the bank today?', figures: [], pages: [], refusal: true },
  { id: 30, kind: 'unanswerable', question: 'What will division revenue be next year?', figures: [], pages: [], refusal: true },
];

for (const s of ASK_SUGGESTIONS) if (!questions.some((q) => q.question === s)) throw new Error(`Suggested question is not in the regression set: ${s}`);
if (questions.length !== 30) throw new Error(`Expected 30 questions, have ${questions.length}`);

/* ---------- every published number, for the independent audit ---------- */

const published = numbersIn(readFileSync(join(dataDir, 'rollup.json'), 'utf8'));
for (const v of index) {
  for (const n of numbersIn(readFileSync(join(dataDir, v.file), 'utf8'))) published.add(n);
  for (const e of v.engineers) for (const n of numbersIn(readFileSync(join(dataDir, 'engineers', `${e.slug}.json`), 'utf8'))) published.add(n);
}

/* ---------- run ---------- */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripGroups = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/(\d) (?=\d{3}\b)/g, '$1');
function hasFigure(answer: string, figure: string): boolean {
  const a = stripGroups(answer).toLowerCase();
  const f = stripGroups(figure).toLowerCase();
  if (!/\d/.test(f)) return a.includes(f);
  // "21.0%" and "21%" are the same published value; accept either spelling of a whole-number percentage.
  const forms = [f];
  const whole = /^(\d+)\.0(%)$/.exec(f);
  if (whole) forms.push(`${whole[1]}${whole[2]}`);
  return forms.some((x) => new RegExp(`(?<![\\d.])${esc(x)}(?![\\d])(?!\\.\\d)`).test(a));
}

interface Reply {
  answer?: string;
  page?: { label: string; to: string };
  refused?: boolean;
  blocked?: boolean;
  elapsedMs?: number;
  error?: string;
  retryAfterSeconds?: number;
}

async function ask(question: string): Promise<{ status: number; body: Reply; ms: number }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = Date.now();
    const res = await fetch(`${base}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
    const ms = Date.now() - t0;
    const body = (await res.json().catch(() => ({}))) as Reply;
    if (res.status === 429 && attempt < 3) {
      const wait = (body.retryAfterSeconds ?? 5) + 1;
      console.log(`      rate limited, waiting ${wait} s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    return { status: res.status, body, ms };
  }
  throw new Error('unreachable');
}

interface Result extends Q {
  status: number;
  answer: string;
  page: string;
  pageLabel: string;
  refused: boolean;
  blocked: boolean;
  ms: number;
  missing: string[];
  pageOk: boolean;
  unverified: string[];
  /** The prose changed its mind midway. Never acceptable, whatever the figures. */
  unclean: boolean;
  pass: boolean;
}

const results: Result[] = [];
console.log(`Ask the MIS regression against ${base} at ${gstStamp()}\n`);
for (const q of questions) {
  const { status, body, ms } = await ask(q.question);
  const answer = body.answer ?? body.error ?? '';
  const page = body.page?.to ?? '';
  const refused = body.refused === true || new RegExp(esc(REFUSAL.replace(/\.$/, '')), 'i').test(answer);
  const blocked = body.blocked === true;
  const missing = q.figures.filter((f) => !hasFigure(answer, f));
  const pageOk = q.refusal ? true : q.pages.includes(page);
  const unverified = status === 200 ? auditFigures(answer, published) : [];
  const unclean = status === 200 && !blocked && hasSelfCorrection(answer);
  const pass = status === 200 && !blocked && !unclean && (q.refusal ? refused : missing.length === 0 && pageOk) && unverified.length === 0;
  results.push({ ...q, status, answer, page, pageLabel: body.page?.label ?? '', refused, blocked, ms, missing, pageOk, unverified, unclean, pass });
  const why = pass ? '' : status !== 200 ? ` HTTP ${status}` : blocked ? ' withheld' : unclean ? ' revised itself midway' : q.refusal && !refused ? ' no refusal' : [missing.length ? ` missing ${missing.join(', ')}` : '', pageOk ? '' : ` page ${page || 'none'}`, unverified.length ? ` unverified ${unverified.join(', ')}` : ''].join('');
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${String(q.id).padStart(2)} ${(ms / 1000).toFixed(1).padStart(5)}s  ${q.question}${why}`);
}

const times = results.map((x) => x.ms).sort((a, b) => a - b);
const pick = (p: number) => times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)]!;
const p50 = pick(50);
const p95 = pick(95);
const passed = results.filter((x) => pass(x)).length;
function pass(x: Result) {
  return x.pass;
}
const stray = results.filter((x) => x.unverified.length).length;
const uncleanCount = results.filter((x) => x.unclean).length;
const withheld = results.filter((x) => x.blocked).length;
const byKind = (kind: Q['kind']) => `${results.filter((x) => x.kind === kind && x.pass).length} of ${results.filter((x) => x.kind === kind).length}`;

const summary = {
  base,
  ranAt: gstStamp(),
  passed,
  total: results.length,
  threshold: 28,
  byKind: { rollup: byKind('rollup'), vertical: byKind('vertical'), engineer: byKind('engineer'), unanswerable: byKind('unanswerable') },
  latencyMs: { p50, p95, max: times[times.length - 1], min: times[0] },
  answersWithUnverifiedFigures: stray,
  answersThatRevisedThemselves: uncleanCount,
  answersWithheld: withheld,
  results,
};
writeFileSync(join(out, 'ask-regression.json'), JSON.stringify(summary, null, 1));
const md = [
  `# Ask the MIS regression`,
  ``,
  `Origin ${base}, run ${summary.ranAt}. Passed ${passed} of ${results.length} (threshold 28). Latency p50 ${(p50 / 1000).toFixed(1)} s, p95 ${(p95 / 1000).toFixed(1)} s. Answers with a figure absent from the published data: ${stray}. Answers that revised themselves midway: ${uncleanCount}. Answers withheld by the service: ${withheld}.`,
  ``,
  `| # | Kind | Question | Seconds | Page | Result | Answer |`,
  `|---|---|---|---|---|---|---|`,
  ...results.map((x) => `| ${x.id} | ${x.kind} | ${x.question} | ${(x.ms / 1000).toFixed(1)} | ${x.pageLabel || x.page || ''} | ${x.pass ? 'pass' : 'fail'}${x.blocked ? ' (withheld)' : ''}${x.unclean ? ' (revised itself)' : ''}${x.missing.length ? `, missing ${x.missing.join(', ')}` : ''}${x.unverified.length ? `, unverified ${x.unverified.join(', ')}` : ''} | ${x.answer.replace(/\|/g, '/')} |`),
].join('\n');
writeFileSync(join(out, 'ask-regression.md'), md + '\n');

console.log(`\nPassed ${passed} of ${results.length}: roll-up ${summary.byKind.rollup}, vertical ${summary.byKind.vertical}, engineer ${summary.byKind.engineer}, unanswerable ${summary.byKind.unanswerable}.`);
console.log(`Latency p50 ${(p50 / 1000).toFixed(1)} s, p95 ${(p95 / 1000).toFixed(1)} s, max ${(times[times.length - 1]! / 1000).toFixed(1)} s.`);
if (p95 > 12_000) console.log(`FINDING: p95 latency ${(p95 / 1000).toFixed(1)} s is above 12 seconds.`);
if (stray) console.log(`FINDING: ${stray} answer(s) carried a figure absent from the published data.`);
if (uncleanCount) console.log(`FINDING: ${uncleanCount} answer(s) revised themselves midway.`);
if (withheld) console.log(`FINDING: ${withheld} answer(s) were withheld by the service.`);
console.log(`Transcript: ${join(out, 'ask-regression.json')} and ask-regression.md`);
if (passed < 28) {
  console.error(`\nRegression gate FAILED: ${passed} of ${results.length} is below 28.`);
  process.exit(1);
}
console.log(`\nRegression gate passed.`);
