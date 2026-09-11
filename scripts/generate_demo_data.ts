/**
 * Deterministic synthetic data for the Halvard MIS demo.
 *
 * Run:  bun scripts/generate_demo_data.ts
 * Out:  public/data/rollup.json, public/data/index.json, public/data/verticals/<slug>.json
 *
 * Everything is derived from one seed. Change SEED to get a different but
 * equally coherent business. Every rule the front end relies on (netting,
 * bridge reconciliation, readout thresholds, provision rules) lives here and
 * is asserted before any file is written.
 *
 * Nothing in this file is, or resembles, a real company, person or figure.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  EngineerRow,
  EngineerSummary,
  ForecastRow,
  Inventory,
  Meta,
  MonthPoint,
  Netting,
  NettingItem,
  EngineerOverdue,
  OverdueDetailRow,
  OverdueSummaryRow,
  OverdueTotals,
  PlGroup,
  PlRung,
  PlRungKey,
  ProductRow,
  ProfitabilityRow,
  ReasonBuckets,
  Readout,
  Rollup,
  SalesRow,
  ScorecardItem,
  Slug,
  Source,
  TargetRow,
  UnbilledProject,
  Verdict,
  VerticalData,
  VerticalIndexEntry,
} from '../data/schema';

/* ---------- deterministic randomness ---------- */

const SEED = 20260911;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const noise = (spread: number) => 1 + between(-spread, spread);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ---------- time, always GST ---------- */

function gstStamp(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}+04:00`;
}

/* ---------- the business ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_ELAPSED = 8;
/** Seasonality profile, sums to 1.000. Q4 is heavier, as in most Gulf contracting years. */
const SEASON = [0.07, 0.075, 0.088, 0.082, 0.084, 0.08, 0.078, 0.083, 0.086, 0.09, 0.092, 0.092];

const META: Meta = {
  company: 'Halvard Engineering Group',
  division: 'Building Technologies Division',
  fiscalYear: 2026,
  periodLabel: 'January to August 2026',
  monthsElapsed: MONTHS_ELAPSED,
  nearMonth: 'September 2026',
  restOfYear: 'October to December 2026',
  dataAsOf: '2026-09-07T09:30:00+04:00',
  dataAsOfLabel: '07 Sep 2026 09:30 GST',
  revision: 'R3',
  currency: 'AED',
  unit: 'thousand',
  seed: SEED,
  generatedAt: gstStamp(),
};

interface VerticalConfig {
  slug: Slug;
  name: string;
  /** Full-year budget revenue, AED thousands. */
  fyBudget: number;
  /** Year-to-date performance against budget, 1.00 is on budget. */
  perf: number;
  /** Forecast factor for the remaining months against budget. */
  fcFactor: number;
  /** Budget gross margin as a fraction. */
  gm: number;
  /** Growth over prior year built into the budget. */
  growth: number;
  engineers: string[];
  products: string[];
  /** Products this vertical's engineers sell that are also reported on another vertical's sheet. */
  shared?: { product: string; alsoIn: Slug }[];
  unbilledProjects: number;
  overdueSeverity: number;
}

const VERTICALS: VerticalConfig[] = [
  {
    slug: 'electrical-distribution',
    name: 'Electrical Distribution',
    fyBudget: 78_500,
    perf: 0.992,
    fcFactor: 0.995,
    gm: 0.188,
    growth: 0.11,
    engineers: ['Rohan Pillai', 'Farah Haddad', 'Dinesh Iyer', 'Marwan Saleh', 'Kavya Nair'],
    products: ['LV switchgear', 'Busway systems', 'Distribution boards', 'Power factor correction', 'Cable management'],
    unbilledProjects: 0,
    overdueSeverity: 1.0,
  },
  {
    slug: 'cooling',
    name: 'Cooling',
    fyBudget: 34_200,
    perf: 1.052,
    fcFactor: 1.02,
    gm: 0.221,
    growth: 0.08,
    engineers: ['Joseph Villanueva', 'Lina Khoury', 'Arjun Sethi'],
    products: ['Chillers', 'Air handling units', 'Fan coil units', 'Cooling towers'],
    shared: [{ product: 'Fabricated ductwork', alsoIn: 'fabrication' }],
    unbilledProjects: 3,
    overdueSeverity: 0.9,
  },
  {
    slug: 'mechanical-systems',
    name: 'Mechanical Systems',
    fyBudget: 26_800,
    perf: 0.912,
    fcFactor: 0.96,
    gm: 0.204,
    growth: 0.06,
    engineers: ['Bassem Farouk', 'Sneha Menon', 'Tarek Hamdan'],
    products: ['Fire dampers', 'Insulation', 'Valves and actuators'],
    shared: [
      { product: 'Fabricated ductwork', alsoIn: 'fabrication' },
      { product: 'Fabricated pipe supports', alsoIn: 'fabrication' },
    ],
    unbilledProjects: 4,
    overdueSeverity: 1.35,
  },
  {
    slug: 'pumps-and-water',
    name: 'Pumps and Water',
    fyBudget: 18_400,
    perf: 1.021,
    fcFactor: 1.0,
    gm: 0.243,
    growth: 0.09,
    engineers: ['Omar Nasser', 'Meera Dsouza'],
    products: ['End suction pumps', 'Booster sets', 'Water treatment', 'Pressure vessels'],
    unbilledProjects: 0,
    overdueSeverity: 0.7,
  },
  {
    slug: 'vertical-transport',
    name: 'Vertical Transport',
    fyBudget: 16_900,
    perf: 0.882,
    fcFactor: 0.94,
    gm: 0.198,
    growth: 0.14,
    engineers: ['Hana Qureshi', 'Yusuf Rahman', 'Divya Bhatt'],
    products: ['Passenger lifts', 'Escalators', 'Modernisation', 'Maintenance contracts'],
    unbilledProjects: 3,
    overdueSeverity: 1.2,
  },
  {
    slug: 'metering',
    name: 'Metering',
    fyBudget: 9_800,
    perf: 1.118,
    fcFactor: 1.05,
    gm: 0.262,
    growth: 0.22,
    engineers: ['Karim Mansour', 'Ananya Kapoor'],
    products: ['Utility meters', 'Sub-metering', 'Meter data platform', 'Installation services'],
    unbilledProjects: 0,
    overdueSeverity: 0.6,
  },
  {
    slug: 'automation',
    name: 'Automation',
    fyBudget: 11_300,
    perf: 0.951,
    fcFactor: 0.98,
    gm: 0.274,
    growth: 0.12,
    engineers: ['Nadia Zaki', 'Vikram Fernandes'],
    products: ['Building controllers', 'Field devices', 'Motor control', 'Software licences'],
    unbilledProjects: 2,
    overdueSeverity: 0.85,
  },
  {
    slug: 'fabrication',
    name: 'Fabrication',
    fyBudget: 6_400,
    perf: 1.004,
    fcFactor: 1.0,
    gm: 0.171,
    growth: 0.05,
    engineers: ['Rami Aziz'],
    products: ['Sheet metal enclosures', 'Structural brackets', 'Site fabrication'],
    unbilledProjects: 0,
    overdueSeverity: 0.8,
  },
  {
    slug: 'trading',
    name: 'Trading',
    fyBudget: 5_900,
    perf: 0.934,
    fcFactor: 0.97,
    gm: 0.132,
    growth: 0.03,
    engineers: ['Faisal Reyes'],
    products: ['Cables', 'Lighting', 'Consumables', 'Tools'],
    unbilledProjects: 0,
    overdueSeverity: 1.1,
  },
  {
    slug: 'services',
    name: 'Services',
    fyBudget: 7_200,
    perf: 1.062,
    fcFactor: 1.02,
    gm: 0.311,
    growth: 0.1,
    engineers: ['Ziad Abdel-Rahman', 'Priya Kulkarni'],
    products: ['Annual maintenance contracts', 'Spares', 'Commissioning', 'Retrofits'],
    unbilledProjects: 0,
    overdueSeverity: 0.75,
  },
];

const CUSTOMERS = [
  'Meridian Contracting',
  'Al Rawabi Developments',
  'Northshore Facilities',
  'Dunelight Hospitality',
  'Crescent Bay Builders',
  'Ironline MEP Contracting',
  'Sable Ridge Properties',
  'Oryx Cold Chain',
  'Kalima Facilities',
  'Blue Harbour Marine Works',
  'Tamarind Retail Holdings',
  'Westgate Industrial Park',
  'Palmline Residential',
  'Redsand Logistics',
  'Amberfield Schools',
  'Corniche Medical Centre',
  'Silverstone Data Centres',
  'Falcon Ridge Estates',
  'Greenway Districts',
  'Harbourline Aviation Services',
];
const GROUP_CUSTOMERS = ['Halvard Contracting (group)', 'Halvard Facilities Management (group)'];

const TERMS = [
  '30 days from invoice',
  '60 days from invoice',
  '90 days from invoice',
  '45 days, post-dated cheque',
  '30 percent advance, balance 60 days',
  'Against delivery',
];

const CURRENT_REMARKS = [
  'Post-dated cheque received, dated 24 Sep 2026',
  'Awaiting consultant certification of payment certificate 7',
  'Retention due after defects period, Nov 2026',
  'Client disputes variation on order 4412',
  'Payment promised by 15 Sep 2026',
  'No response to three reminders',
  'Group settlement scheduled for Q4',
  'Invoice re-issued after purchase order mismatch',
  'Legal notice issued 02 Sep 2026',
  'Partial payment received 28 Aug 2026',
  'Client finance head confirmed release this month',
  'Held pending site handover sign-off',
];
const PREVIOUS_REMARKS = [
  'Follow-up call made 12 Aug 2026',
  'Statement of account sent',
  'Awaiting payment certificate',
  'Escalated to client finance head',
  'Under review by client audit',
  'Promised in August, not received',
  'Reminder sent 05 Aug 2026',
];

const PROJECT_NAMES = [
  'Tower 3 chilled water plant',
  'District cooling substation',
  'Warehouse ventilation retrofit',
  'Hotel lift modernisation',
  'School campus building controls',
  'Hospital air handling replacement',
  'Data hall precision cooling',
  'Marina pump station',
  'Residential block ductwork',
  'Mall escalator replacement',
  'Office tower fit-out services',
  'Logistics park fire dampers',
];

const IN_TRANSIT_ITEMS = [
  'Container of switchgear panels',
  'Chiller module, two units',
  'Air handling units, four units',
  'Escalator trusses',
  'Sub-meter batch, 1,200 units',
  'Pump sets, six units',
  'Controller stock replenishment',
  'Sheet steel coils',
  'Cable drums',
  'Spares consignment',
];

/* ---------- leaf generation ---------- */

interface Leaf {
  home: Slug;
  alsoIn: Slug | null;
  engineer: string;
  product: string;
  monthlyBudget: number[];
  monthlyActual: (number | null)[];
  monthlyForecast: (number | null)[];
  budgetGmPct: number;
  ytdGmPct: number;
  fcGmPct: number;
  priorYearRevenue: number;
  priorYearGm: number;
  openOrders: number;
  expectedOrders: number;
}

function makeLeaf(v: VerticalConfig, engineer: string, product: string, fyBudget: number, alsoIn: Slug | null): Leaf {
  const budgetGmPct = v.gm + between(-0.03, 0.03);
  const leafPerf = v.perf * noise(0.07);
  const monthlyBudget = SEASON.map((s) => fyBudget * s);
  const monthlyActual = monthlyBudget.map((b, i) => (i < MONTHS_ELAPSED ? b * leafPerf * noise(0.06) : null));
  const monthlyForecast = monthlyBudget.map((b, i) => (i >= MONTHS_ELAPSED ? b * v.fcFactor * noise(0.04) : null));
  const ytdGmPct = budgetGmPct + between(-0.022, 0.018);
  const fcGmPct = ytdGmPct * 0.6 + budgetGmPct * 0.4;
  const priorYearRevenue = (fyBudget / (1 + v.growth)) * noise(0.05);
  const priorYearGm = priorYearRevenue * (budgetGmPct - 0.008 + between(-0.01, 0.01));
  const fyForecast = sum(monthlyActual.map((x) => x ?? 0)) + sum(monthlyForecast.map((x) => x ?? 0));
  return {
    home: v.slug,
    alsoIn,
    engineer,
    product,
    monthlyBudget,
    monthlyActual,
    monthlyForecast,
    budgetGmPct,
    ytdGmPct,
    fcGmPct,
    priorYearRevenue,
    priorYearGm,
    openOrders: (fyForecast / 12) * between(1.2, 3.4),
    expectedOrders: (fyForecast / 12) * between(0.4, 1.8),
  };
}

interface EngineerMeta {
  name: string;
  home: Slug;
  /** Annual cost to employ, AED thousands. */
  ctc: number;
}

const leaves: Leaf[] = [];
const engineerMeta = new Map<string, EngineerMeta>();

for (const v of VERTICALS) {
  const n = v.engineers.length;
  // engineer shares, uneven on purpose
  const raw = v.engineers.map(() => between(0.6, 1.4));
  const shares = raw.map((x) => x / sum(raw));
  v.engineers.forEach((eng, ei) => {
    engineerMeta.set(eng, { name: eng, home: v.slug, ctc: r0(between(180, 420)) });
    const engBudget = v.fyBudget * shares[ei]!;
    // pick 2 or 3 own products for this engineer, rotating so every product is sold by someone
    const count = n === 1 ? v.products.length : 2 + Math.floor(rnd() * 2);
    const owned: string[] = [];
    for (let k = 0; k < count; k++) owned.push(v.products[(ei + k) % v.products.length]!);
    const sharedForThis = (v.shared ?? []).filter((_, si) => (si + ei) % Math.max(1, n) === 0 || n === 1 || (v.shared ?? []).length >= n);
    const allProducts = [...owned, ...sharedForThis.map((s) => s.product)];
    const praw = allProducts.map((_, i) => between(0.5, 1.5) * (i >= owned.length ? 0.55 : 1));
    const pshares = praw.map((x) => x / sum(praw));
    allProducts.forEach((product, pi) => {
      const shared = sharedForThis.find((s) => s.product === product);
      leaves.push(makeLeaf(v, eng, product, engBudget * pshares[pi]!, shared ? shared.alsoIn : null));
    });
  });
}

/* ---------- aggregation helpers ---------- */

const ytdOf = (l: Leaf) => sum(l.monthlyActual.slice(0, MONTHS_ELAPSED).map((x) => x ?? 0));
const ytdBudgetOf = (l: Leaf) => sum(l.monthlyBudget.slice(0, MONTHS_ELAPSED));
const nearOf = (l: Leaf) => l.monthlyForecast[MONTHS_ELAPSED] ?? 0;
const restOf = (l: Leaf) => sum(l.monthlyForecast.slice(MONTHS_ELAPSED + 1).map((x) => x ?? 0));
const fyForecastOf = (l: Leaf) => ytdOf(l) + nearOf(l) + restOf(l);
const fyBudgetOf = (l: Leaf) => sum(l.monthlyBudget);

function productRow(l: Leaf): ProductRow {
  const ytd = ytdOf(l);
  const ytdB = ytdBudgetOf(l);
  const fyF = fyForecastOf(l);
  const fyB = fyBudgetOf(l);
  return {
    product: l.product,
    alsoReportedOn: l.alsoIn,
    openOrders: r0(l.openOrders),
    expectedOrders: r0(l.expectedOrders),
    ytdRevenue: r0(ytd),
    ytdGm: r0(ytd * l.ytdGmPct),
    ytdGmPct: r1(l.ytdGmPct * 100),
    ytdBudgetRevenue: r0(ytdB),
    ytdBudgetGm: r0(ytdB * l.budgetGmPct),
    budgetGmPct: r1(l.budgetGmPct * 100),
    nearMonthForecast: r0(nearOf(l)),
    restOfYearForecast: r0(restOf(l)),
    fyForecastRevenue: r0(fyF),
    fyForecastGm: r0(fyF * l.fcGmPct),
    fyBudgetRevenue: r0(fyB),
    fyBudgetGm: r0(fyB * l.budgetGmPct),
    priorYearRevenue: r0(l.priorYearRevenue),
    priorYearGm: r0(l.priorYearGm),
  };
}

const NUM_KEYS = [
  'openOrders',
  'expectedOrders',
  'ytdRevenue',
  'ytdGm',
  'ytdBudgetRevenue',
  'ytdBudgetGm',
  'nearMonthForecast',
  'restOfYearForecast',
  'fyForecastRevenue',
  'fyForecastGm',
  'fyBudgetRevenue',
  'fyBudgetGm',
  'priorYearRevenue',
  'priorYearGm',
] as const;

function sumRows(rows: ProductRow[]): Omit<ProductRow, 'product' | 'alsoReportedOn'> {
  const out: Record<string, number> = {};
  for (const k of NUM_KEYS) out[k] = sum(rows.map((r) => r[k]));
  const pct = (a: number, b: number) => (b === 0 ? 0 : r1((a / b) * 100));
  return {
    ...(out as Record<(typeof NUM_KEYS)[number], number>),
    ytdGmPct: pct(out.ytdGm!, out.ytdRevenue!),
    budgetGmPct: pct(out.ytdBudgetGm!, out.ytdBudgetRevenue!),
  };
}

function engineerRow(name: string, rows: ProductRow[], fromOtherVertical: Slug | null): EngineerRow {
  const meta = engineerMeta.get(name)!;
  const agg = sumRows(rows);
  const ctcYtd = meta.ctc * (MONTHS_ELAPSED / 12);
  return {
    engineer: name,
    fromOtherVertical,
    ...agg,
    roiPriorYear: r1(agg.priorYearGm / (meta.ctc * 0.95)),
    roiYtd: r1(agg.ytdGm / ctcYtd),
    roiBudget: r1(agg.fyBudgetGm / meta.ctc),
    roiForecast: r1(agg.fyForecastGm / meta.ctc),
    products: rows,
  };
}

function totalRow(label: string, engineers: EngineerRow[]): EngineerRow {
  const agg = sumRows(engineers.flatMap((e) => e.products));
  const ctc = sum(engineers.filter((e) => !e.fromOtherVertical).map((e) => engineerMeta.get(e.engineer)!.ctc));
  const ctcYtd = ctc * (MONTHS_ELAPSED / 12);
  return {
    engineer: label,
    fromOtherVertical: null,
    ...agg,
    roiPriorYear: ctc ? r1(agg.priorYearGm / (ctc * 0.95)) : 0,
    roiYtd: ctc ? r1(agg.ytdGm / ctcYtd) : 0,
    roiBudget: ctc ? r1(agg.fyBudgetGm / ctc) : 0,
    roiForecast: ctc ? r1(agg.fyForecastGm / ctc) : 0,
    products: [],
  };
}

function monthlySeries(ls: Leaf[]): MonthPoint[] {
  return MONTHS.map((m, i) => ({
    month: m,
    index: i + 1,
    actual: i < MONTHS_ELAPSED ? r0(sum(ls.map((l) => l.monthlyActual[i] ?? 0))) : null,
    forecast: i >= MONTHS_ELAPSED ? r0(sum(ls.map((l) => l.monthlyForecast[i] ?? 0))) : null,
    budget: r0(sum(ls.map((l) => l.monthlyBudget[i]!))),
  }));
}

/* ---------- P&L ---------- */

interface CostRatios {
  warehouse: number;
  warehouseSalaries: number;
  commonAdmin: number;
  provisions: number;
  corporate: number;
}
const costRatios = new Map<Slug, CostRatios>();
for (const v of VERTICALS) {
  costRatios.set(v.slug, {
    warehouse: between(0.012, 0.028),
    warehouseSalaries: between(0.008, 0.018),
    commonAdmin: between(0.034, 0.052),
    provisions: between(0.004, 0.012),
    corporate: between(0.021, 0.032),
  });
}

const PL_DEFS: { key: PlRungKey; label: string; definition: string; feeds: string; subtotal: boolean; isPercent: boolean }[] = [
  { key: 'revenue', label: 'Revenue', definition: 'Invoiced sales for the period, counted once per product line.', feeds: 'Sales performance, engineer rows', subtotal: false, isPercent: false },
  { key: 'grossMargin', label: 'Gross margin', definition: 'Revenue less the cost of goods sold, before any operating cost.', feeds: 'Sales performance, engineer rows', subtotal: false, isPercent: false },
  { key: 'gmPct', label: 'GM percent', definition: 'Gross margin as a share of revenue.', feeds: 'Derived from the two rungs above', subtotal: false, isPercent: true },
  { key: 'salaryCtc', label: 'Salary cost to company', definition: 'Full employment cost of the vertical: engineers, support staff, benefits and end of service.', feeds: 'Finance cost extract, monthly static value', subtotal: false, isPercent: false },
  { key: 'warehouseCost', label: 'Warehouse cost', definition: 'Rent, handling and freight for stock held by this vertical.', feeds: 'Finance cost extract, monthly static value', subtotal: false, isPercent: false },
  { key: 'warehouseSalaries', label: 'Warehouse salaries', definition: 'Storekeepers and logistics staff allocated by stock share.', feeds: 'Finance cost extract, monthly static value', subtotal: false, isPercent: false },
  { key: 'commonAdmin', label: 'Common admin, selling and depreciation', definition: 'Shared division costs allocated by revenue share.', feeds: 'Finance cost extract, allocation key', subtotal: false, isPercent: false },
  { key: 'buProfitability', label: 'BU profitability', definition: 'Gross margin less the four operating cost lines above. The vertical head is judged on this rung.', feeds: 'Derived', subtotal: true, isPercent: false },
  { key: 'provisionsInterCo', label: 'Provisions and inter-company interest', definition: 'Bad debt and stock provisions booked this period, plus interest on group funding.', feeds: 'Finance cost extract and the overdue provision column', subtotal: false, isPercent: false },
  { key: 'corporateOverhead', label: 'Corporate overhead', definition: 'Group head office charge allocated to the division.', feeds: 'Group allocation', subtotal: false, isPercent: false },
  { key: 'buNetProfit', label: 'BU-level net profit', definition: 'What the vertical keeps after every cost it carries, including group charges.', feeds: 'Derived', subtotal: true, isPercent: false },
];

interface PlNumbers {
  revenue: number;
  grossMargin: number;
  salaryCtc: number;
  warehouseCost: number;
  warehouseSalaries: number;
  commonAdmin: number;
  provisionsInterCo: number;
  corporateOverhead: number;
}

function plNumbersFor(ls: Leaf[], slugs: Slug[], col: 'ytd' | 'forecast' | 'budget'): PlNumbers {
  const revenue = sum(ls.map((l) => (col === 'ytd' ? ytdOf(l) : col === 'forecast' ? fyForecastOf(l) : fyBudgetOf(l))));
  const gm = sum(
    ls.map((l) =>
      col === 'ytd' ? ytdOf(l) * l.ytdGmPct : col === 'forecast' ? fyForecastOf(l) * l.fcGmPct : fyBudgetOf(l) * l.budgetGmPct,
    ),
  );
  const ctcAnnual = sum([...engineerMeta.values()].filter((e) => slugs.includes(e.home)).map((e) => e.ctc)) * 1.35;
  const salaryYtd = ctcAnnual * (MONTHS_ELAPSED / 12);
  // costs are static values from the finance extract; the forecast column annualises YTD.
  const revYtd = sum(ls.map(ytdOf));
  const ratios = (k: keyof CostRatios) =>
    sum(slugs.map((s) => costRatios.get(s)![k] * sum(ls.filter((l) => l.home === s).map(ytdOf)))) / Math.max(1, revYtd);
  const scale = col === 'ytd' ? 1 : col === 'forecast' ? 12 / MONTHS_ELAPSED : 12 / MONTHS_ELAPSED;
  const base = col === 'budget' ? sum(ls.map(ytdBudgetOf)) : revYtd;
  const salary = col === 'budget' ? ctcAnnual * 0.98 : salaryYtd * scale;
  return {
    revenue,
    grossMargin: gm,
    salaryCtc: salary,
    warehouseCost: base * ratios('warehouse') * scale * (col === 'budget' ? 0.97 : 1),
    warehouseSalaries: base * ratios('warehouseSalaries') * scale * (col === 'budget' ? 0.97 : 1),
    commonAdmin: base * ratios('commonAdmin') * scale * (col === 'budget' ? 0.97 : 1),
    provisionsInterCo: base * ratios('provisions') * scale * (col === 'budget' ? 0.8 : 1),
    corporateOverhead: base * ratios('corporate') * scale,
  };
}

function plRungs(ls: Leaf[], slugs: Slug[]): PlRung[] {
  const cols = { ytd: plNumbersFor(ls, slugs, 'ytd'), forecast: plNumbersFor(ls, slugs, 'forecast'), budget: plNumbersFor(ls, slugs, 'budget') };
  const derive = (n: PlNumbers): Record<PlRungKey, number> => {
    const buProfitability = n.grossMargin - n.salaryCtc - n.warehouseCost - n.warehouseSalaries - n.commonAdmin;
    const buNetProfit = buProfitability - n.provisionsInterCo - n.corporateOverhead;
    return {
      revenue: r0(n.revenue),
      grossMargin: r0(n.grossMargin),
      gmPct: n.revenue ? r1((n.grossMargin / n.revenue) * 100) : 0,
      salaryCtc: r0(n.salaryCtc),
      warehouseCost: r0(n.warehouseCost),
      warehouseSalaries: r0(n.warehouseSalaries),
      commonAdmin: r0(n.commonAdmin),
      buProfitability: r0(buProfitability),
      provisionsInterCo: r0(n.provisionsInterCo),
      corporateOverhead: r0(n.corporateOverhead),
      buNetProfit: r0(buNetProfit),
    };
  };
  const d = { ytd: derive(cols.ytd), forecast: derive(cols.forecast), budget: derive(cols.budget) };
  return PL_DEFS.map((def) => ({ ...def, ytd: d.ytd[def.key], forecast: d.forecast[def.key], budget: d.budget[def.key] }));
}

/* ---------- overdue, unbilled, inventory, targets ---------- */

function overdueRows(v: VerticalConfig): OverdueDetailRow[] {
  const rows: OverdueDetailRow[] = [];
  const vLeaves = leaves.filter((l) => l.home === v.slug);
  const monthly = sum(vLeaves.map(fyForecastOf)) / 12;
  const used = new Set<string>();
  for (const eng of v.engineers) {
    const count = 1 + Math.floor(rnd() * 3);
    for (let c = 0; c < count; c++) {
      let customer = rnd() < 0.14 ? pick(GROUP_CUSTOMERS) : pick(CUSTOMERS);
      let guard = 0;
      while (used.has(customer) && guard++ < 8) customer = pick(CUSTOMERS);
      used.add(customer);
      const scale = monthly * between(0.15, 0.9) * v.overdueSeverity;
      const old = rnd() < 0.5 * v.overdueSeverity;
      const b0 = scale * between(0.4, 1.2);
      const b1 = scale * between(0.2, 0.9);
      const b2 = scale * between(0.05, 0.6);
      const b3 = old ? scale * between(0.2, 0.7) : rnd() < 0.2 ? scale * between(0.02, 0.12) : 0;
      const b4 = old && rnd() < 0.6 ? scale * between(0.1, 0.45) : 0;
      const dispute = rnd() < 0.18;
      const isGroup = customer.endsWith('(group)');
      const reason: keyof ReasonBuckets = isGroup ? 'internalGroup' : dispute || rnd() < 0.25 ? 'disputesAndNotDue' : 'noTimelineOrResponse';
      // provision rule: half of 1 to 2 years, all of over 2 years, all of any disputed amount older than 90 days
      const provision = 0.5 * b3 + b4 + (dispute ? 0.25 * b2 : 0);
      const total = b0 + b1 + b2 + b3 + b4;
      const overdue = total - b0;
      const prev = overdue * (isGroup ? between(0.88, 1.04) : between(0.76, 1.1));
      rows.push({
        engineer: eng,
        customer,
        terms: pick(TERMS),
        bucket0to30: r0(b0),
        bucket31to90: r0(b1),
        bucket91to365: r0(b2),
        bucket1to2y: r0(b3),
        bucketOver2y: r0(b4),
        totalOutstanding: 0,
        provision: r0(provision),
        netToCollect: 0,
        overdue: 0,
        dispute,
        previousMonthOverdue: r0(prev),
        previousRemark: pick(PREVIOUS_REMARKS),
        currentRemark: dispute ? 'Client disputes variation on order ' + (4000 + Math.floor(rnd() * 900)) : isGroup ? 'Group settlement scheduled for Q4' : pick(CURRENT_REMARKS),
        reason,
      });
    }
  }
  for (const r of rows) {
    r.totalOutstanding = r.bucket0to30 + r.bucket31to90 + r.bucket91to365 + r.bucket1to2y + r.bucketOver2y;
    r.overdue = r.totalOutstanding - r.bucket0to30;
    r.netToCollect = r.totalOutstanding - r.provision;
  }
  return rows.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

function overdueSubtotal(rows: OverdueDetailRow[]): OverdueTotals {
  const t = {
    customers: rows.length,
    bucket0to30: sum(rows.map((r) => r.bucket0to30)),
    bucket31to90: sum(rows.map((r) => r.bucket31to90)),
    bucket91to365: sum(rows.map((r) => r.bucket91to365)),
    bucket1to2y: sum(rows.map((r) => r.bucket1to2y)),
    bucketOver2y: sum(rows.map((r) => r.bucketOver2y)),
    totalOutstanding: sum(rows.map((r) => r.totalOutstanding)),
    provision: sum(rows.map((r) => r.provision)),
    netToCollect: sum(rows.map((r) => r.netToCollect)),
    overdue: sum(rows.map((r) => r.overdue)),
    previousMonthOverdue: sum(rows.map((r) => r.previousMonthOverdue)),
    change: 0,
    disputed: sum(rows.filter((r) => r.dispute).map((r) => r.overdue)),
  };
  t.change = t.overdue - t.previousMonthOverdue;
  return t;
}

function reasonBuckets(rows: OverdueDetailRow[]): ReasonBuckets {
  const b: ReasonBuckets = { internalGroup: 0, noTimelineOrResponse: 0, disputesAndNotDue: 0 };
  for (const r of rows) b[r.reason] += r.overdue;
  return b;
}

function unbilledFor(v: VerticalConfig): { projects: UnbilledProject[]; bridge: VerticalData['unbilled']['bridge'] } {
  const projects: UnbilledProject[] = [];
  const vLeaves = leaves.filter((l) => l.home === v.slug);
  const monthly = sum(vLeaves.map(fyForecastOf)) / 12;
  const names = [...PROJECT_NAMES];
  for (let i = 0; i < v.unbilledProjects; i++) {
    const idx = Math.floor(rnd() * names.length);
    const project = names.splice(idx, 1)[0]!;
    const base = monthly * between(0.2, 0.7);
    const kind = rnd();
    let trend: [number, number, number];
    let remark: string;
    if (kind < 0.25) {
      trend = [0, 0, r0(base)];
      remark = 'New this month, delivery complete, awaiting client certification';
    } else if (kind < 0.45) {
      trend = [r0(base * 1.1), r0(base), 0];
      remark = 'Invoiced 28 Aug 2026 after certification';
    } else {
      const m0 = base * between(0.8, 1.2);
      trend = [r0(m0), r0(m0 * between(0.85, 1.15)), r0(base)];
      remark = pick(['Certification pending with consultant', 'Client holding pending variation approval', 'Partial certification received, balance in review']);
    }
    projects.push({
      ref: `UB-${v.slug.slice(0, 3).toUpperCase()}-${String(1040 + i * 7 + Math.floor(rnd() * 5)).padStart(4, '0')}`,
      project,
      engineer: pick(v.engineers),
      customer: pick(CUSTOMERS),
      trend,
      provision: trend[2] > 0 && rnd() < 0.3 ? r0(trend[2] * between(0.05, 0.2)) : 0,
      remark,
    });
  }
  const previousMonth = sum(projects.map((p) => p.trend[1]));
  const currentMonth = sum(projects.map((p) => p.trend[2]));
  const newProjects = sum(projects.filter((p) => p.trend[1] === 0 && p.trend[2] > 0).map((p) => p.trend[2]));
  const clearedProjects = sum(projects.filter((p) => p.trend[1] > 0 && p.trend[2] === 0).map((p) => p.trend[1]));
  const ongoingChanges = currentMonth - previousMonth - newProjects + clearedProjects;
  const bridge = { previousMonth, newProjects, clearedProjects, ongoingChanges, currentMonth };
  if (bridge.previousMonth + bridge.newProjects - bridge.clearedProjects + bridge.ongoingChanges !== bridge.currentMonth) {
    throw new Error(`Unbilled bridge does not reconcile for ${v.slug}`);
  }
  return { projects, bridge };
}

function inventoryFor(v: VerticalConfig): Inventory {
  const vLeaves = leaves.filter((l) => l.home === v.slug);
  const fy = sum(vLeaves.map(fyBudgetOf));
  const total = fy * between(0.07, 0.19);
  const under1 = total * between(0.55, 0.78);
  const rest = total - under1;
  const over3 = rest * between(0.08, 0.3);
  const over2 = rest * between(0.15, 0.35);
  const over1 = rest - over2 - over3;
  // provision rule: half of 2 to 3 years, all of over 3 years
  const provision = 0.5 * over2 + over3;
  const mapped = total * between(0.3, 0.62);
  const free = total - mapped;
  const freeOver1 = Math.min(free, (over1 + over2 + over3) * between(0.5, 0.85));
  const nItems = 1 + Math.floor(rnd() * 3);
  const items = [];
  for (let i = 0; i < nItems; i++) {
    const day = 12 + Math.floor(rnd() * 70);
    const d = new Date(2026, 8, day); // September 2026 plus offset, GST calendar
    const arrival = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    items.push({ item: pick(IN_TRANSIT_ITEMS), value: r0(total * between(0.05, 0.22)), expectedArrival: arrival });
  }
  return {
    totalStock: r0(total),
    underOneYear: r0(under1),
    overOneYear: r0(over1),
    overTwoYears: r0(over2),
    overThreeYears: r0(over3),
    provision: r0(provision),
    mappedToPurchaseOrders: r0(mapped),
    freeStock: r0(free),
    freeStockOverOneYear: r0(freeOver1),
    inTransit: items,
  };
}

function targetsFor(v: VerticalConfig): TargetRow[] {
  const rows: TargetRow[] = [];
  for (const product of v.products) {
    const pl = leaves.filter((l) => l.home === v.slug && l.product === product);
    if (!pl.length) continue;
    const target = r0(sum(pl.map(fyBudgetOf)));
    const achieved = r0(sum(pl.map(ytdOf)));
    rows.push({ productLine: product, target, aspiration: r0(target * between(1.1, 1.25)), achieved, achievedPct: target ? r1((achieved / target) * 100) : 0 });
  }
  return rows;
}

/** Share of overdue older than a year at which a vertical is flagged. The Collecting verdict uses the same number. */
const AGING_FLAG_PCT = 15;

/* ---------- assemble ---------- */

const SOURCES: Record<string, Source> = {
  'rollup.sales': { key: 'rollup.sales', label: 'Sales performance by vertical' },
  'rollup.forecast': { key: 'rollup.forecast', label: 'Revenue forecast and pipeline by vertical' },
  'rollup.pl': { key: 'rollup.pl', label: 'Profit and loss summary' },
  'rollup.profitability': { key: 'rollup.profitability', label: 'Vertical profitability' },
  'rollup.overdue': { key: 'rollup.overdue', label: 'Overdue collections by vertical' },
  'rollup.monthly': { key: 'rollup.monthly', label: 'Monthly revenue, actual and forecast against budget' },
  'vertical.sales': { key: 'vertical.sales', label: 'Sales performance by engineer' },
  'vertical.pl': { key: 'vertical.pl', label: 'Vertical profit and loss' },
  'vertical.targets': { key: 'vertical.targets', label: 'Business targets by product line' },
  'vertical.inventory': { key: 'vertical.inventory', label: 'Inventory outlook' },
  'vertical.unbilled': { key: 'vertical.unbilled', label: 'Unbilled projects and month bridge' },
  'vertical.overdue': { key: 'vertical.overdue', label: 'Overdue by engineer and customer' },
};

const largest = VERTICALS.reduce((a, b) => (a.fyBudget > b.fyBudget ? a : b));
const allHomeLeaves = leaves; // every leaf exactly once, attribution basis

const verticalFiles: VerticalData[] = [];
const salesRows: SalesRow[] = [];
const forecastRows: ForecastRow[] = [];
const profRows: ProfitabilityRow[] = [];
const overdueRowsSummary: OverdueSummaryRow[] = [];
const engineerSplit: Record<Slug, EngineerSummary[]> = {};
const nettingItems: NettingItem[] = [];

const nettedFyRevenue = sum(allHomeLeaves.map(fyForecastOf));

for (const v of VERTICALS) {
  const own = leaves.filter((l) => l.home === v.slug);
  const sharedIn = leaves.filter((l) => l.alsoIn === v.slug);
  const ownEngineers = v.engineers.map((eng) =>
    engineerRow(eng, own.filter((l) => l.engineer === eng).map(productRow), null),
  );
  const sharedEngineers = [...new Set(sharedIn.map((l) => l.engineer))].map((eng) =>
    engineerRow(eng, sharedIn.filter((l) => l.engineer === eng).map(productRow), engineerMeta.get(eng)!.home),
  );
  const attributedTotal = totalRow('Attributed total', ownEngineers);
  const sheetTotal = totalRow('Sheet total', [...ownEngineers, ...sharedEngineers]);
  const pl = plRungs(own, [v.slug]);
  const od = overdueRows(v);
  const odReasons = reasonBuckets(od);
  const odTotal = overdueSubtotal(od);
  const byEngineer: EngineerOverdue[] = v.engineers.map((eng) => ({ engineer: eng, ...overdueSubtotal(od.filter((r) => r.engineer === eng)) }));
  const unbilled = unbilledFor(v);
  const monthly = monthlySeries(own);
  const s = attributedTotal;

  verticalFiles.push({
    meta: META,
    slug: v.slug,
    name: v.name,
    isLargest: v.slug === largest.slug,
    sources: SOURCES,
    headline: {
      ytdRevenue: s.ytdRevenue,
      budgetRevenue: s.ytdBudgetRevenue,
      ytdGmPct: s.ytdGmPct,
      fyForecast: s.fyForecastRevenue,
      fyBudget: s.fyBudgetRevenue,
      overdue: odTotal.overdue,
    },
    sales: { engineers: [...ownEngineers, ...sharedEngineers], sheetTotal, attributedTotal },
    pl,
    targets: targetsFor(v),
    inventory: inventoryFor(v),
    unbilled,
    overdue: { rows: od, byEngineer, total: odTotal, reasons: odReasons },
    monthly,
  });

  salesRows.push({
    slug: v.slug,
    name: v.name,
    openOrders: s.openOrders,
    expectedOrders: s.expectedOrders,
    ytdRevenue: s.ytdRevenue,
    ytdGm: s.ytdGm,
    ytdGmPct: s.ytdGmPct,
    budgetRevenue: s.ytdBudgetRevenue,
    budgetGm: s.ytdBudgetGm,
    budgetGmPct: s.budgetGmPct,
    dRevenue: s.ytdRevenue - s.ytdBudgetRevenue,
    dGm: s.ytdGm - s.ytdBudgetGm,
    dGmPts: r1(s.ytdGmPct - s.budgetGmPct),
  });
  engineerSplit[v.slug] = ownEngineers.map((e) => ({
    name: e.engineer,
    ytdRevenue: e.ytdRevenue,
    ytdGm: e.ytdGm,
    ytdGmPct: e.ytdGmPct,
    budgetRevenue: e.ytdBudgetRevenue,
    dRevenue: e.ytdRevenue - e.ytdBudgetRevenue,
  }));
  forecastRows.push({
    slug: v.slug,
    name: v.name,
    priorYearRevenue: s.priorYearRevenue,
    ytdRevenue: s.ytdRevenue,
    nearMonthForecast: s.nearMonthForecast,
    restOfYearForecast: s.restOfYearForecast,
    fyForecast: s.fyForecastRevenue,
    fyBudget: s.fyBudgetRevenue,
    fcVsBudgetPct: r1((s.fyForecastRevenue / s.fyBudgetRevenue - 1) * 100),
    yoyPct: r1((s.fyForecastRevenue / s.priorYearRevenue - 1) * 100),
  });
  const np = pl.find((r) => r.key === 'buNetProfit')!;
  profRows.push({
    slug: v.slug,
    name: v.name,
    fyRevenue: s.fyForecastRevenue,
    fyGm: s.fyForecastGm,
    fyNp: np.forecast,
    gmPct: r1((s.fyForecastGm / s.fyForecastRevenue) * 100),
    npPct: r1((np.forecast / s.fyForecastRevenue) * 100),
    revenueShare: r1((s.fyForecastRevenue / r0(nettedFyRevenue)) * 100),
  });
  const top = [...od].sort((a, b) => b.overdue - a.overdue)[0];
  overdueRowsSummary.push({
    slug: v.slug,
    name: v.name,
    previousMonth: odTotal.previousMonthOverdue,
    currentMonth: odTotal.overdue,
    change: odTotal.overdue - odTotal.previousMonthOverdue,
    reasons: odReasons,
    topRemark: top ? `${top.customer}: ${top.currentRemark}` : 'No overdue balances',
    overOneYear: odTotal.bucket1to2y + odTotal.bucketOver2y,
    overOneYearPct: odTotal.overdue ? r1(((odTotal.bucket1to2y + odTotal.bucketOver2y) / odTotal.overdue) * 100) : 0,
    agingFlag: odTotal.overdue ? ((odTotal.bucket1to2y + odTotal.bucketOver2y) / odTotal.overdue) * 100 > AGING_FLAG_PCT : false,
  });
  for (const l of sharedIn) {
    nettingItems.push({
      product: l.product,
      homeVertical: l.home,
      categoryVertical: v.slug,
      engineer: l.engineer,
      ytdRevenue: r0(ytdOf(l)),
      fyForecastRevenue: r0(fyForecastOf(l)),
    });
  }
}

/* totals and netting */

const salesTotal: SalesRow = (() => {
  const t = sumRows(allHomeLeaves.map(productRow));
  return {
    slug: 'total',
    name: 'All verticals, netted',
    openOrders: t.openOrders,
    expectedOrders: t.expectedOrders,
    ytdRevenue: t.ytdRevenue,
    ytdGm: t.ytdGm,
    ytdGmPct: t.ytdGmPct,
    budgetRevenue: t.ytdBudgetRevenue,
    budgetGm: t.ytdBudgetGm,
    budgetGmPct: t.budgetGmPct,
    dRevenue: t.ytdRevenue - t.ytdBudgetRevenue,
    dGm: t.ytdGm - t.ytdBudgetGm,
    dGmPts: r1(t.ytdGmPct - t.budgetGmPct),
  };
})();

const doubleYtd = sum(nettingItems.map((i) => i.ytdRevenue));
const doubleFy = sum(nettingItems.map((i) => i.fyForecastRevenue));
const netting: Netting = {
  grossSumYtd: salesTotal.ytdRevenue + doubleYtd,
  doubleCountedYtd: doubleYtd,
  nettedYtd: salesTotal.ytdRevenue,
  grossSumFy: r0(nettedFyRevenue) + doubleFy,
  doubleCountedFy: doubleFy,
  nettedFy: r0(nettedFyRevenue),
  explanation:
    'Fabricated ductwork and pipe supports sold by Mechanical Systems and Cooling engineers are reported on their home sheet and again on the Fabrication sheet. Adding the sheet totals would count that revenue twice. Every total on this page counts each product line once, in its home vertical, and the Fabrication row shows only work sold by its own team.',
  items: nettingItems,
};

// The netted total must equal the sum of the attributed rows exactly.
if (sum(salesRows.map((r) => r.ytdRevenue)) !== salesTotal.ytdRevenue) {
  throw new Error(`Netting failure: rows sum ${sum(salesRows.map((r) => r.ytdRevenue))} vs netted ${salesTotal.ytdRevenue}`);
}

const forecastTotal: ForecastRow = (() => {
  const t = sumRows(allHomeLeaves.map(productRow));
  return {
    slug: 'total',
    name: 'All verticals, netted',
    priorYearRevenue: t.priorYearRevenue,
    ytdRevenue: t.ytdRevenue,
    nearMonthForecast: t.nearMonthForecast,
    restOfYearForecast: t.restOfYearForecast,
    fyForecast: t.fyForecastRevenue,
    fyBudget: t.fyBudgetRevenue,
    fcVsBudgetPct: r1((t.fyForecastRevenue / t.fyBudgetRevenue - 1) * 100),
    yoyPct: r1((t.fyForecastRevenue / t.priorYearRevenue - 1) * 100),
  };
})();

const otherSlugs = VERTICALS.filter((v) => v.slug !== largest.slug).map((v) => v.slug);
const pl: PlGroup[] = [
  { key: 'excludingLargest', label: `Excluding ${largest.name}`, rungs: plRungs(leaves.filter((l) => l.home !== largest.slug), otherSlugs) },
  { key: 'largest', label: largest.name, rungs: plRungs(leaves.filter((l) => l.home === largest.slug), [largest.slug]) },
  { key: 'total', label: 'Division total', rungs: plRungs(leaves, VERTICALS.map((v) => v.slug)) },
];

const profTotal: ProfitabilityRow = (() => {
  const total = pl[2]!.rungs;
  const rev = total.find((r) => r.key === 'revenue')!.forecast;
  const gm = total.find((r) => r.key === 'grossMargin')!.forecast;
  const np = total.find((r) => r.key === 'buNetProfit')!.forecast;
  return {
    slug: 'total',
    name: 'Division total, netted',
    fyRevenue: rev,
    fyGm: gm,
    fyNp: np,
    gmPct: r1((gm / rev) * 100),
    npPct: r1((np / rev) * 100),
    revenueShare: r1(sum(profRows.map((r) => r.revenueShare))),
  };
})();
if (Math.abs(profTotal.revenueShare - 100) > 0.3) throw new Error(`Revenue shares sum to ${profTotal.revenueShare}, not 100`);

const overdueTotal: OverdueSummaryRow = {
  slug: 'total',
  name: 'All verticals',
  previousMonth: sum(overdueRowsSummary.map((r) => r.previousMonth)),
  currentMonth: sum(overdueRowsSummary.map((r) => r.currentMonth)),
  change: sum(overdueRowsSummary.map((r) => r.change)),
  reasons: {
    internalGroup: sum(overdueRowsSummary.map((r) => r.reasons.internalGroup)),
    noTimelineOrResponse: sum(overdueRowsSummary.map((r) => r.reasons.noTimelineOrResponse)),
    disputesAndNotDue: sum(overdueRowsSummary.map((r) => r.reasons.disputesAndNotDue)),
  },
  topRemark: '',
  overOneYear: sum(overdueRowsSummary.map((r) => r.overOneYear)),
  overOneYearPct: 0,
  agingFlag: false,
};
overdueTotal.overOneYearPct = r1((overdueTotal.overOneYear / overdueTotal.currentMonth) * 100);
overdueTotal.agingFlag = overdueTotal.overOneYearPct > AGING_FLAG_PCT;
{
  const rs = overdueTotal.reasons;
  if (rs.internalGroup + rs.noTimelineOrResponse + rs.disputesAndNotDue !== overdueTotal.currentMonth) {
    throw new Error('Reason buckets do not sum to overdue');
  }
}

/* ---------- the Readout: deterministic judgement ---------- */

const fmtM = (thousands: number) => (thousands / 1000).toFixed(1);
const fmtPct = (x: number) => `${Math.abs(x).toFixed(1)}%`;

function verdictRatio(ratio: number, onTrack: number, watch: number): Verdict {
  return ratio >= onTrack ? 'ON TRACK' : ratio >= watch ? 'WATCH' : 'BEHIND';
}

const totalPl = pl[2]!.rungs;
const rung = (k: PlRungKey) => totalPl.find((r) => r.key === k)!;
const sellingRatio = salesTotal.ytdRevenue / salesTotal.budgetRevenue;
const deliveringRatio = forecastTotal.fyForecast / forecastTotal.fyBudget;
const keepingPts = salesTotal.dGmPts;
const earningRatio = rung('buNetProfit').ytd / rung('buNetProfit').budget / (MONTHS_ELAPSED / 12);
const overdueChangePct = (overdueTotal.change / overdueTotal.previousMonth) * 100;
const overOneYearShare = (overdueTotal.overOneYear / overdueTotal.currentMonth) * 100;

const collectingVerdict: Verdict =
  overdueChangePct <= 0 && overOneYearShare <= AGING_FLAG_PCT
    ? 'ON TRACK'
    : overdueChangePct <= 5 && overOneYearShare <= AGING_FLAG_PCT + 10
      ? 'WATCH'
      : 'BEHIND';

const scorecard: ScorecardItem[] = [
  {
    key: 'selling',
    question: 'How are we selling?',
    label: 'Selling',
    verdict: verdictRatio(sellingRatio, 0.98, 0.92),
    figure: `${(sellingRatio * 100).toFixed(1)}% of YTD budget`,
    note: `Revenue AED ${fmtM(salesTotal.ytdRevenue)}M against AED ${fmtM(salesTotal.budgetRevenue)}M budgeted for ${MONTHS_ELAPSED} months.`,
  },
  {
    key: 'delivering',
    question: 'What will we deliver this year?',
    label: 'Delivering',
    verdict: verdictRatio(deliveringRatio, 0.98, 0.92),
    figure: `${(deliveringRatio * 100).toFixed(1)}% of FY budget`,
    note: `Full-year forecast AED ${fmtM(forecastTotal.fyForecast)}M against a budget of AED ${fmtM(forecastTotal.fyBudget)}M.`,
  },
  {
    key: 'keeping',
    question: 'What do we keep as margin?',
    label: 'Keeping',
    verdict: keepingPts >= -0.75 ? 'ON TRACK' : keepingPts >= -2 ? 'WATCH' : 'BEHIND',
    figure: `${salesTotal.ytdGmPct.toFixed(1)}% gross margin`,
    note: keepingPts === 0 ? `Exactly on the ${salesTotal.budgetGmPct.toFixed(1)}% budget.` : `${keepingPts > 0 ? 'Up' : 'Down'} ${Math.abs(keepingPts).toFixed(1)} points against the ${salesTotal.budgetGmPct.toFixed(1)}% budget.`,
  },
  {
    key: 'earning',
    question: 'What do we keep as profit?',
    label: 'Earning',
    verdict: verdictRatio(earningRatio, 0.95, 0.8),
    figure: `${(earningRatio * 100).toFixed(0)}% of YTD budget`,
    note: `BU net profit AED ${fmtM(rung('buNetProfit').ytd)}M against AED ${fmtM(rung('buNetProfit').budget * (MONTHS_ELAPSED / 12))}M budgeted to date.`,
  },
  {
    key: 'collecting',
    question: 'Where is the cash stuck?',
    label: 'Collecting',
    verdict: collectingVerdict,
    figure: `AED ${fmtM(overdueTotal.currentMonth)}M overdue`,
    note: `${overdueChangePct >= 0 ? 'Up' : 'Down'} ${fmtPct(overdueChangePct)} on the month; ${overOneYearShare.toFixed(0)}% of it is older than a year.`,
  },
];

const losers = profRows.filter((r) => r.fyNp < 0).map((r) => r.name);
const reasons = overdueTotal.reasons;
const biggestReason =
  reasons.disputesAndNotDue >= reasons.noTimelineOrResponse && reasons.disputesAndNotDue >= reasons.internalGroup
    ? 'disputes and balances not yet due'
    : reasons.noTimelineOrResponse >= reasons.internalGroup
      ? 'customers with no payment timeline or no response'
      : 'internal group companies';
const biggestReasonShare = (Math.max(reasons.disputesAndNotDue, reasons.noTimelineOrResponse, reasons.internalGroup) / overdueTotal.currentMonth) * 100;

const readout: Readout = {
  headline: {
    valueMillions: Number(fmtM(rung('buNetProfit').ytd)),
    label: 'BU-level net profit, year to date',
    sub: `${(earningRatio * 100).toFixed(0)}% of the year-to-date budget`,
  },
  lines: [
    `Revenue is ${fmtPct((sellingRatio - 1) * 100)} ${sellingRatio >= 1 ? 'ahead of' : 'behind'} budget at ${MONTHS_ELAPSED} months, and the full-year forecast lands ${fmtPct((deliveringRatio - 1) * 100)} ${deliveringRatio >= 1 ? 'above' : 'below'} the AED ${fmtM(forecastTotal.fyBudget)}M budget.`,
    `Gross margin is holding at ${salesTotal.ytdGmPct.toFixed(1)}% against a ${salesTotal.budgetGmPct.toFixed(1)}% budget; BU net profit is ${(earningRatio * 100).toFixed(0)}% of budget${losers.length ? `, with ${losers.length > 1 ? losers.slice(0, -1).join(', ') + ' and ' + losers[losers.length - 1] : losers[0]} below break-even after group charges` : ''}.`,
    `AED ${fmtM(overdueTotal.currentMonth)}M is overdue, ${overdueTotal.change >= 0 ? 'up' : 'down'} AED ${fmtM(Math.abs(overdueTotal.change))}M on the month; ${biggestReasonShare.toFixed(0)}% of it sits with ${biggestReason}.`,
  ],
  scorecard,
  thresholds: {
    selling: 'ON TRACK at 98% of YTD budget or better; WATCH at 92%; BEHIND below',
    delivering: 'ON TRACK at 98% of FY budget or better; WATCH at 92%; BEHIND below',
    keeping: 'ON TRACK within 0.75 points of budget GM%; WATCH within 2 points; BEHIND beyond',
    earning: 'ON TRACK at 95% of YTD budget NP or better; WATCH at 80%; BEHIND below',
    collecting: `ON TRACK if overdue fell and under ${AGING_FLAG_PCT}% is older than a year; WATCH if up under 5% and under ${AGING_FLAG_PCT + 10}% is older than a year; BEHIND otherwise. A vertical is flagged red at the same ${AGING_FLAG_PCT}% line`,
  },
};

const rollup: Rollup = {
  meta: META,
  readout,
  sources: SOURCES,
  sales: { rows: salesRows, total: salesTotal, netting },
  engineerSplit,
  forecast: { rows: forecastRows, total: forecastTotal },
  pl,
  largestVertical: { slug: largest.slug, name: largest.name },
  profitability: { rows: profRows, total: profTotal },
  overdue: { rows: overdueRowsSummary, total: overdueTotal },
  monthly: monthlySeries(leaves),
};

/* ---------- monthly series must tie to YTD ---------- */
{
  const ytdFromMonths = sum(rollup.monthly.slice(0, MONTHS_ELAPSED).map((m) => m.actual ?? 0));
  if (Math.abs(ytdFromMonths - salesTotal.ytdRevenue) > VERTICALS.length * 4) {
    throw new Error(`Monthly series ${ytdFromMonths} does not tie to YTD ${salesTotal.ytdRevenue}`);
  }
}

/* ---------- write ---------- */

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'data');
mkdirSync(join(outDir, 'verticals'), { recursive: true });
writeFileSync(join(outDir, 'rollup.json'), JSON.stringify(rollup, null, 1));
const index: VerticalIndexEntry[] = verticalFiles.map((v) => ({ slug: v.slug, name: v.name, file: `verticals/${v.slug}.json` }));
writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
for (const v of verticalFiles) writeFileSync(join(outDir, 'verticals', `${v.slug}.json`), JSON.stringify(v, null, 1));

console.log(`Generated ${verticalFiles.length} vertical files and rollup.json at ${META.generatedAt}`);
console.log(`Netted YTD revenue AED ${fmtM(salesTotal.ytdRevenue)}M (gross ${fmtM(netting.grossSumYtd)}M, double counted ${fmtM(doubleYtd)}M)`);
console.log(`Scorecard: ${scorecard.map((s) => `${s.label} ${s.verdict}`).join(' | ')}`);
console.log(`Headline: AED ${readout.headline.valueMillions}M BU net profit YTD, ${readout.headline.sub}`);
