/**
 * Deterministic synthetic data for the Halvard MIS demo.
 *
 * Run:  bun scripts/generate_demo_data.ts
 * Out:  public/data/rollup.json, index.json, verticals/<slug>.json, engineers/<slug>.json
 *
 * Everything is derived from one seed. Every rule the front end relies on
 * (netting, precision, the due-date model for receivables, bridge
 * reconciliation, provision rules, reason coherence) lives here and is
 * asserted before any file is written. scripts/reconcile.ts then re-checks
 * the written files independently.
 *
 * Nothing in this file is, or resembles, a real company, person or figure.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gstStamp } from '../data/gst';
import type {
  BalanceTotals,
  CustomerBalanceRow,
  Definition,
  EngineerBalance,
  EngineerData,
  EngineerRow,
  EngineerSummary,
  ForecastRow,
  ForecastTable,
  Inventory,
  InventoryLine,
  InventorySummaryRow,
  Meta,
  MonthPoint,
  Netting,
  NettingItem,
  Overview,
  PlGroup,
  PlRung,
  PlRungKey,
  ProductRow,
  Production,
  ProductionRow,
  ProfitabilityRow,
  ProfitabilityTable,
  ReasonKey,
  ReasonSplit,
  ReceivableItem,
  ReceivableSummaryRow,
  ReceivablesTable,
  Rollup,
  SalesRow,
  SalesTable,
  Slug,
  Source,
  TargetRow,
  UnbilledAging,
  UnbilledBridge,
  UnbilledProject,
  UnbilledStatus,
  UnbilledSummaryRow,
  VerticalData,
  VerticalIndexEntry,
  WorkingCapitalRow,
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
const R = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const pctOf = (a: number, b: number) => (b === 0 ? 0 : r1((a / b) * 100));

/* ---------- the business ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const MONTHS_ELAPSED = 8;
const FY = 2026;
/** Seasonality profile, sums to 1.000. Q4 is heavier, as in most Gulf contracting years. */
const SEASON = [0.07, 0.075, 0.088, 0.082, 0.084, 0.08, 0.078, 0.083, 0.086, 0.09, 0.092, 0.092];

const META: Meta = {
  company: 'Halvard Engineering Group',
  division: 'Building Technologies Division',
  fiscalYear: FY,
  periodLabel: `January to ${MONTHS_LONG[MONTHS_ELAPSED - 1]} ${FY}`,
  monthsElapsed: MONTHS_ELAPSED,
  currentMonthLabel: `${MONTHS_LONG[MONTHS_ELAPSED - 1]} ${FY}`,
  previousMonthLabel: `${MONTHS_LONG[MONTHS_ELAPSED - 2]} ${FY}`,
  nearMonth: `${MONTHS_LONG[MONTHS_ELAPSED]} ${FY}`,
  restOfYear: `${MONTHS_LONG[MONTHS_ELAPSED + 1]} to December ${FY}`,
  dataAsOf: '2026-09-07T09:30:00+04:00',
  dataAsOfLabel: '07 Sep 2026 09:30 GST',
  revision: 'R4',
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
  receivableSeverity: number;
  /** A vertical that runs a factory reports a production schedule. */
  factory?: boolean;
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
    receivableSeverity: 1.0,
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
    receivableSeverity: 0.9,
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
    receivableSeverity: 1.35,
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
    receivableSeverity: 0.7,
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
    receivableSeverity: 1.2,
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
    receivableSeverity: 0.6,
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
    receivableSeverity: 0.85,
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
    receivableSeverity: 0.8,
    factory: true,
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
    receivableSeverity: 1.1,
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
    receivableSeverity: 0.75,
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

/** Payment terms and the number of days after the invoice date at which a balance becomes past due. */
const TERMS: { label: string; days: number }[] = [
  { label: '30 days from invoice', days: 30 },
  { label: '60 days from invoice', days: 60 },
  { label: '90 days from invoice', days: 90 },
  { label: '45 days, post-dated cheque', days: 45 },
  { label: '30 percent advance, balance at 60 days', days: 60 },
  { label: 'Against delivery', days: 0 },
];

/** Remarks are drawn per reason so the flag, the reason and the remark never contradict one another. */
const REMARKS: Record<ReasonKey | 'withinTerms', { previous: string[]; current: string[] }> = {
  internalGroup: {
    previous: ['Raised with group finance', 'Included in the August intercompany schedule'],
    current: ['Group settlement scheduled for the Q4 intercompany run', 'Intercompany offset agreed with group finance, posting in September'],
  },
  followUpNoResponse: {
    previous: ['Follow-up call made 12 Aug 2026', 'Escalated to client finance head', 'Promised in August, not received', 'Reminder sent 05 Aug 2026', 'Under review by client audit'],
    current: [
      'No response to three reminders',
      'Payment promised by 15 Sep 2026',
      'Awaiting consultant certification of payment certificate 7',
      'Legal notice issued 02 Sep 2026',
      'Partial payment received 28 Aug 2026, balance being chased',
      'Client finance head confirmed release this month',
    ],
  },
  disputesAndNotDue: {
    previous: ['Dispute raised with the client project team', 'Site meeting held on the variation claim'],
    current: ['Client disputes variation on order', 'Invoice re-issued after purchase order mismatch, client reviewing'],
  },
  withinTerms: {
    previous: ['Invoiced on delivery', 'Statement of account sent'],
    current: ['Within terms, no action required', 'Post-dated cheque received, dated 24 Sep 2026'],
  },
};

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

/* ---------- leaf generation: integers at the lowest level ---------- */

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
  const monthlyBudget = SEASON.map((s) => R(fyBudget * s));
  const monthlyActual = monthlyBudget.map((b, i) => (i < MONTHS_ELAPSED ? R(b * leafPerf * noise(0.06)) : null));
  const monthlyForecast = monthlyBudget.map((b, i) => (i >= MONTHS_ELAPSED ? R(b * v.fcFactor * noise(0.04)) : null));
  const ytdGmPct = budgetGmPct + between(-0.022, 0.018);
  const fcGmPct = ytdGmPct * 0.6 + budgetGmPct * 0.4;
  const priorYearRevenue = R((fyBudget / (1 + v.growth)) * noise(0.055));
  const priorYearGm = R(priorYearRevenue * (budgetGmPct - 0.008 + between(-0.01, 0.01)));
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
    openOrders: R((fyForecast / 12) * between(1.2, 3.4)),
    expectedOrders: R((fyForecast / 12) * between(0.4, 1.8)),
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
  const raw = v.engineers.map(() => between(0.6, 1.4));
  const shares = raw.map((x) => x / sum(raw));
  v.engineers.forEach((eng, ei) => {
    engineerMeta.set(eng, { name: eng, home: v.slug, ctc: R(between(180, 420)) });
    const engBudget = v.fyBudget * shares[ei]!;
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
const ytdGmOf = (l: Leaf) => R(ytdOf(l) * l.ytdGmPct);
const fyForecastGmOf = (l: Leaf) => R(fyForecastOf(l) * l.fcGmPct);
const fyBudgetGmOf = (l: Leaf) => R(fyBudgetOf(l) * l.budgetGmPct);
const ytdBudgetGmOf = (l: Leaf) => R(ytdBudgetOf(l) * l.budgetGmPct);

function productRow(l: Leaf): ProductRow {
  const ytd = ytdOf(l);
  const ytdB = ytdBudgetOf(l);
  const ytdGm = ytdGmOf(l);
  const ytdBudgetGm = ytdBudgetGmOf(l);
  return {
    product: l.product,
    alsoReportedOn: l.alsoIn,
    openOrders: l.openOrders,
    expectedOrders: l.expectedOrders,
    ytdRevenue: ytd,
    ytdGm,
    ytdGmPct: pctOf(ytdGm, ytd),
    ytdBudgetRevenue: ytdB,
    ytdBudgetGm,
    budgetGmPct: pctOf(ytdBudgetGm, ytdB),
    nearMonthForecast: nearOf(l),
    restOfYearForecast: restOf(l),
    fyForecastRevenue: fyForecastOf(l),
    fyForecastGm: fyForecastGmOf(l),
    fyBudgetRevenue: fyBudgetOf(l),
    fyBudgetGm: fyBudgetGmOf(l),
    priorYearRevenue: l.priorYearRevenue,
    priorYearGm: l.priorYearGm,
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

type Numeric = Omit<ProductRow, 'product' | 'alsoReportedOn'>;

function sumRows(rows: Numeric[]): Numeric {
  const out = {} as Record<(typeof NUM_KEYS)[number], number>;
  for (const k of NUM_KEYS) out[k] = sum(rows.map((r) => r[k]));
  return {
    ...out,
    ytdGmPct: pctOf(out.ytdGm, out.ytdRevenue),
    budgetGmPct: pctOf(out.ytdBudgetGm, out.ytdBudgetRevenue),
  };
}

function roiRow(agg: Numeric, ctcAnnual: number) {
  const ctcYtd = R(ctcAnnual * (MONTHS_ELAPSED / 12));
  const ctcPriorYear = R(ctcAnnual * 0.95);
  const roi = (gm: number, ctc: number) => (ctc ? r1(gm / ctc) : 0);
  return {
    ctcAnnual,
    ctcYtd,
    ctcPriorYear,
    roiPriorYear: roi(agg.priorYearGm, ctcPriorYear),
    roiYtd: roi(agg.ytdGm, ctcYtd),
    roiBudget: roi(agg.fyBudgetGm, ctcAnnual),
    roiForecast: roi(agg.fyForecastGm, ctcAnnual),
  };
}

function engineerRow(name: string, rows: ProductRow[], fromOtherVertical: Slug | null): EngineerRow {
  const meta = engineerMeta.get(name)!;
  const agg = sumRows(rows);
  return {
    engineer: name,
    slug: slugify(name),
    homeVertical: meta.home,
    fromOtherVertical,
    ...agg,
    ...roiRow(agg, meta.ctc),
    products: rows,
  };
}

function totalRow(label: string, engineers: EngineerRow[]): EngineerRow {
  const agg = sumRows(engineers.flatMap((e) => e.products));
  const ctc = sum(engineers.filter((e) => !e.fromOtherVertical).map((e) => engineerMeta.get(e.engineer)!.ctc));
  return {
    engineer: label,
    slug: slugify(label),
    homeVertical: engineers[0]?.homeVertical ?? '',
    fromOtherVertical: null,
    ...agg,
    ...roiRow(agg, ctc),
    products: [],
  };
}

function monthlySeries(ls: Leaf[]): MonthPoint[] {
  return MONTHS.map((m, i) => {
    const actual = i < MONTHS_ELAPSED ? sum(ls.map((l) => l.monthlyActual[i] ?? 0)) : null;
    const forecast = i >= MONTHS_ELAPSED ? sum(ls.map((l) => l.monthlyForecast[i] ?? 0)) : null;
    const budget = sum(ls.map((l) => l.monthlyBudget[i]!));
    return { month: m, index: i + 1, actual, forecast, budget, variance: (actual ?? forecast ?? 0) - budget };
  });
}

/* ---------- P&L: integers per vertical, groups are sums ---------- */

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
  { key: 'revenue', label: 'Revenue', definition: 'Invoiced sales for the period, each product line counted once in its home vertical.', feeds: 'Sales performance, engineer and product rows', subtotal: false, isPercent: false },
  { key: 'grossMargin', label: 'Gross margin', definition: 'Revenue less the cost of goods sold, before any operating cost.', feeds: 'Sales performance, engineer and product rows', subtotal: false, isPercent: false },
  { key: 'gmPct', label: 'GM percent', definition: 'Gross margin as a share of revenue.', feeds: 'Derived from the two rungs above', subtotal: false, isPercent: true },
  { key: 'salaryCtc', label: 'Salary cost to company', definition: 'Full employment cost of the vertical: engineers, support staff, benefits and end of service.', feeds: 'Synthetic: engineer cost to employ times a 1.35 support factor; the forecast annualises the elapsed months', subtotal: false, isPercent: false },
  { key: 'warehouseCost', label: 'Warehouse cost', definition: 'Rent, handling and freight for stock held by this vertical.', feeds: 'Synthetic: a fixed ratio of revenue per vertical; the forecast annualises the elapsed months', subtotal: false, isPercent: false },
  { key: 'warehouseSalaries', label: 'Warehouse salaries', definition: 'Storekeepers and logistics staff allocated by stock share.', feeds: 'Synthetic: a fixed ratio of revenue per vertical; the forecast annualises the elapsed months', subtotal: false, isPercent: false },
  { key: 'commonAdmin', label: 'Common admin, selling and depreciation', definition: 'Shared division costs allocated to verticals by revenue share.', feeds: 'Synthetic: a fixed ratio of revenue per vertical; the forecast annualises the elapsed months', subtotal: false, isPercent: false },
  { key: 'buProfitability', label: 'BU profitability', definition: 'Gross margin less the four operating cost lines above. The vertical head is judged on this rung.', feeds: 'Derived: gross margin less salary, warehouse cost, warehouse salaries and common admin', subtotal: true, isPercent: false },
  { key: 'provisionsInterCo', label: 'Provisions and inter-company interest', definition: 'Bad debt and stock provisions charged this period, plus interest on group funding. A charge for the period, not the provision balance shown in the receivables and inventory tables.', feeds: 'Synthetic: a fixed ratio of revenue per vertical', subtotal: false, isPercent: false },
  { key: 'corporateOverhead', label: 'Corporate overhead', definition: 'Group head office charge allocated to the division by revenue share.', feeds: 'Synthetic: a fixed ratio of revenue per vertical', subtotal: false, isPercent: false },
  { key: 'buNetProfit', label: 'BU-level net profit', definition: 'What the vertical keeps after every cost it carries, including group charges.', feeds: 'Derived: BU profitability less provisions and corporate overhead', subtotal: true, isPercent: false },
];

type PlNumbers = Record<Exclude<PlRungKey, 'gmPct' | 'buProfitability' | 'buNetProfit'>, number>;
type PlDerived = Record<PlRungKey, number>;

function plNumbersFor(v: VerticalConfig, own: Leaf[], col: 'ytd' | 'forecast' | 'budget'): PlNumbers {
  const revenue = sum(own.map((l) => (col === 'ytd' ? ytdOf(l) : col === 'forecast' ? fyForecastOf(l) : fyBudgetOf(l))));
  const grossMargin = sum(own.map((l) => (col === 'ytd' ? ytdGmOf(l) : col === 'forecast' ? fyForecastGmOf(l) : fyBudgetGmOf(l))));
  const ctcAnnual = sum(v.engineers.map((e) => engineerMeta.get(e)!.ctc)) * 1.35;
  const revYtd = sum(own.map(ytdOf));
  const ratios = costRatios.get(v.slug)!;
  const scale = col === 'ytd' ? 1 : 12 / MONTHS_ELAPSED;
  const base = col === 'budget' ? sum(own.map(ytdBudgetOf)) : revYtd;
  const budgetFactor = col === 'budget' ? 0.97 : 1;
  const salaryCtc = col === 'budget' ? R(ctcAnnual * 0.98) : R(ctcAnnual * (MONTHS_ELAPSED / 12) * scale);
  return {
    revenue,
    grossMargin,
    salaryCtc,
    warehouseCost: R(base * ratios.warehouse * scale * budgetFactor),
    warehouseSalaries: R(base * ratios.warehouseSalaries * scale * budgetFactor),
    commonAdmin: R(base * ratios.commonAdmin * scale * budgetFactor),
    provisionsInterCo: R(base * ratios.provisions * scale * (col === 'budget' ? 0.8 : 1)),
    corporateOverhead: R(base * ratios.corporate * scale),
  };
}

function derive(n: PlNumbers): PlDerived {
  const buProfitability = n.grossMargin - n.salaryCtc - n.warehouseCost - n.warehouseSalaries - n.commonAdmin;
  const buNetProfit = buProfitability - n.provisionsInterCo - n.corporateOverhead;
  return {
    ...n,
    gmPct: pctOf(n.grossMargin, n.revenue),
    buProfitability,
    buNetProfit,
  };
}

function rungsFrom(cols: { ytd: PlDerived; forecast: PlDerived; budget: PlDerived }): PlRung[] {
  return PL_DEFS.map((def) => {
    const ytd = cols.ytd[def.key];
    const forecast = cols.forecast[def.key];
    const budget = cols.budget[def.key];
    return { ...def, ytd, forecast, budget, dForecastVsBudget: def.isPercent ? r1(forecast - budget) : forecast - budget };
  });
}

function sumPl(parts: { ytd: PlNumbers; forecast: PlNumbers; budget: PlNumbers }[]): { ytd: PlDerived; forecast: PlDerived; budget: PlDerived } {
  const add = (col: 'ytd' | 'forecast' | 'budget'): PlNumbers => {
    const keys = Object.keys(parts[0]![col]) as (keyof PlNumbers)[];
    const out = {} as PlNumbers;
    for (const k of keys) out[k] = sum(parts.map((p) => p[col][k]));
    return out;
  };
  return { ytd: derive(add('ytd')), forecast: derive(add('forecast')), budget: derive(add('budget')) };
}

/* ---------- receivables: an invoice model with contractual terms ---------- */

function customerBalances(v: VerticalConfig, own: Leaf[]): CustomerBalanceRow[] {
  const rows: CustomerBalanceRow[] = [];
  const monthly = sum(own.map(fyForecastOf)) / 12;
  const used = new Set<string>();
  for (const eng of v.engineers) {
    const count = 1 + Math.floor(rnd() * 3);
    for (let c = 0; c < count; c++) {
      let customer = rnd() < 0.14 ? pick(GROUP_CUSTOMERS) : pick(CUSTOMERS);
      let guard = 0;
      while (used.has(customer) && guard++ < 8) customer = pick(CUSTOMERS);
      used.add(customer);
      const isGroup = customer.endsWith('(group)');
      const terms = rnd() < 0.85 ? pick(TERMS.slice(0, 5)) : TERMS[5]!;
      const invoices = 2 + Math.floor(rnd() * 5);
      const old = rnd() < 0.62 * v.receivableSeverity;
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let notYetDue = 0;
      let agedOverOneYear = 0;
      for (let i = 0; i < invoices; i++) {
        const u = rnd();
        let age: number;
        if (u < 0.5) age = 3 + Math.floor(rnd() * 43);
        else if (u < 0.76) age = 46 + Math.floor(rnd() * 75);
        else if (u < 0.88 || !old) age = 121 + Math.floor(rnd() * 245);
        else if (u < 0.95) age = 366 + Math.floor(rnd() * 365);
        else age = 731 + Math.floor(rnd() * 400);
        const amount = R(monthly * between(0.04, 0.34) * v.receivableSeverity);
        if (age <= 30) b0 += amount;
        else if (age <= 90) b1 += amount;
        else if (age <= 365) b2 += amount;
        else if (age <= 730) b3 += amount;
        else b4 += amount;
        if (age <= terms.days) notYetDue += amount;
        if (age > 365) agedOverOneYear += amount;
      }
      const totalOutstanding = b0 + b1 + b2 + b3 + b4;
      const pastDue = totalOutstanding - notYetDue;
      const dispute = !isGroup && rnd() < 0.18;
      const reason: ReasonKey = isGroup ? 'internalGroup' : dispute || pastDue === 0 ? 'disputesAndNotDue' : 'followUpNoResponse';
      const family = reason === 'disputesAndNotDue' && !dispute ? 'withinTerms' : reason;
      // provision rule: half of 1 to 2 years, all of over 2 years, a quarter of a disputed 91 to 365 day balance
      const provision = R(0.5 * b3 + b4 + (dispute ? 0.25 * b2 : 0));
      const netToCollect = totalOutstanding - provision;
      const previousMonthNet = R(netToCollect * (isGroup ? between(0.9, 1.04) : between(0.78, 1.1)));
      const currentRemark = family === 'disputesAndNotDue' && dispute && rnd() < 0.6 ? `Client disputes variation on order ${4000 + Math.floor(rnd() * 900)}, credit note under review` : pick(REMARKS[family].current);
      rows.push({
        engineer: eng,
        engineerSlug: slugify(eng),
        customer,
        terms: terms.label,
        termsDays: terms.days,
        invoices,
        bucket0to30: b0,
        bucket31to90: b1,
        bucket91to365: b2,
        bucket1to2y: b3,
        bucketOver2y: b4,
        totalOutstanding,
        provision,
        netToCollect,
        notYetDue,
        pastDue,
        agedOverOneYear,
        dispute,
        reason,
        previousMonthNet,
        change: netToCollect - previousMonthNet,
        previousRemark: pick(REMARKS[family].previous),
        currentRemark,
      });
    }
  }
  return rows.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

function balanceTotals(rows: CustomerBalanceRow[]): BalanceTotals {
  const s = (f: (r: CustomerBalanceRow) => number) => sum(rows.map(f));
  return {
    customers: rows.length,
    bucket0to30: s((r) => r.bucket0to30),
    bucket31to90: s((r) => r.bucket31to90),
    bucket91to365: s((r) => r.bucket91to365),
    bucket1to2y: s((r) => r.bucket1to2y),
    bucketOver2y: s((r) => r.bucketOver2y),
    totalOutstanding: s((r) => r.totalOutstanding),
    provision: s((r) => r.provision),
    netToCollect: s((r) => r.netToCollect),
    notYetDue: s((r) => r.notYetDue),
    pastDue: s((r) => r.pastDue),
    agedOverOneYear: s((r) => r.agedOverOneYear),
    disputed: sum(rows.filter((r) => r.dispute).map((r) => r.totalOutstanding)),
    previousMonthNet: s((r) => r.previousMonthNet),
    change: s((r) => r.change),
  };
}

function reasonSplit(rows: CustomerBalanceRow[]): ReasonSplit {
  const b: ReasonSplit = { internalGroup: 0, followUpNoResponse: 0, disputesAndNotDue: 0, disputed: 0, withinTerms: 0 };
  for (const r of rows) {
    b[r.reason] += r.totalOutstanding;
    if (r.reason === 'disputesAndNotDue') {
      if (r.dispute) b.disputed += r.totalOutstanding;
      else b.withinTerms += r.totalOutstanding;
    }
  }
  return b;
}

/* ---------- unbilled ---------- */

function unbilledAging(total: number, status: UnbilledStatus): UnbilledAging {
  const zero: UnbilledAging = { le60: 0, d61to90: 0, d91to120: 0, d121to180: 0, d181to365: 0, d366to545: 0, d546to730: 0, over730: 0 };
  if (total === 0 || status === 'cleared') return zero;
  if (status === 'new') {
    const late = R(total * between(0, 0.25));
    return { ...zero, le60: total - late, d61to90: late };
  }
  const w = [0.3, 0.25, 0.15, 0.12, 0.1, 0.05, 0.02, 0.01].map((x) => x * noise(0.35));
  const wsum = sum(w);
  const parts = w.map((x) => R((total * x) / wsum));
  const drift = total - sum(parts);
  parts[0] = parts[0]! + drift;
  return { le60: parts[0]!, d61to90: parts[1]!, d91to120: parts[2]!, d121to180: parts[3]!, d181to365: parts[4]!, d366to545: parts[5]!, d546to730: parts[6]!, over730: parts[7]! };
}

const UNBILLED_REMARKS: Record<UnbilledStatus, { previous: string[]; current: string[] }> = {
  new: { previous: ['Not on last month’s schedule'], current: ['Delivered and awaiting client certification', 'Handover complete, payment certificate being raised'] },
  cleared: { previous: ['Certification received, invoice under preparation'], current: ['Invoiced 28 Aug 2026 after certification'] },
  ongoing: {
    previous: ['Certification pending with consultant', 'Client holding pending variation approval', 'Awaiting handover sign-off'],
    current: ['Consultant certification still pending, meeting set for 16 Sep 2026', 'Variation approval received, certification expected in September', 'Partial certification received, balance in review'],
  },
};

function unbilledFor(v: VerticalConfig, own: Leaf[]): { projects: UnbilledProject[]; bridge: UnbilledBridge } {
  const projects: UnbilledProject[] = [];
  const monthly = sum(own.map(fyForecastOf)) / 12;
  const names = [...PROJECT_NAMES];
  for (let i = 0; i < v.unbilledProjects; i++) {
    const idx = Math.floor(rnd() * names.length);
    const project = names.splice(idx, 1)[0]!;
    const base = monthly * between(0.2, 0.7);
    const kind = rnd();
    let trend: [number, number, number];
    let status: UnbilledStatus;
    if (kind < 0.25) {
      trend = [0, 0, R(base)];
      status = 'new';
    } else if (kind < 0.45) {
      trend = [R(base * 1.1), R(base), 0];
      status = 'cleared';
    } else {
      const m0 = base * between(0.8, 1.2);
      trend = [R(m0), R(m0 * between(0.85, 1.15)), R(base)];
      status = 'ongoing';
    }
    const aging = unbilledAging(trend[2], status);
    const engineer = pick(v.engineers);
    projects.push({
      ref: `UB-${v.slug.slice(0, 3).toUpperCase()}-${String(1040 + i * 7 + Math.floor(rnd() * 5)).padStart(4, '0')}`,
      project,
      engineer,
      engineerSlug: slugify(engineer),
      customer: pick(CUSTOMERS),
      trend,
      status,
      aging,
      agedOver60: trend[2] - aging.le60,
      provision: trend[2] > 0 && rnd() < 0.3 ? R(trend[2] * between(0.05, 0.2)) : 0,
      previousRemark: pick(UNBILLED_REMARKS[status].previous),
      currentRemark: pick(UNBILLED_REMARKS[status].current),
    });
  }
  return { projects, bridge: bridgeFor(projects, v.slug) };
}

/** The month bridge for any set of unbilled projects; throws if it does not reconcile. */
function bridgeFor(projects: UnbilledProject[], label: string): UnbilledBridge {
  const previousMonth = sum(projects.map((p) => p.trend[1]));
  const currentMonth = sum(projects.map((p) => p.trend[2]));
  const newProjects = sum(projects.filter((p) => p.status === 'new').map((p) => p.trend[2]));
  const clearedProjects = sum(projects.filter((p) => p.status === 'cleared').map((p) => p.trend[1]));
  const ongoingChanges = currentMonth - previousMonth - newProjects + clearedProjects;
  const bridge = { previousMonth, newProjects, clearedProjects, ongoingChanges, currentMonth };
  if (bridge.previousMonth + bridge.newProjects - bridge.clearedProjects + bridge.ongoingChanges !== bridge.currentMonth) {
    throw new Error(`Unbilled bridge does not reconcile for ${label}`);
  }
  return bridge;
}

/* ---------- inventory ---------- */

function inventoryLine(product: string, total: number): InventoryLine {
  const under1 = R(total * between(0.55, 0.78));
  const rest = total - under1;
  const over3 = R(rest * between(0.08, 0.3));
  const twoToThree = R(rest * between(0.15, 0.35));
  const oneToTwo = rest - twoToThree - over3;
  const agedOverOneYear = oneToTwo + twoToThree + over3;
  const mapped = R(total * between(0.3, 0.62));
  const free = total - mapped;
  return {
    product,
    totalStock: total,
    underOneYear: under1,
    oneToTwoYears: oneToTwo,
    twoToThreeYears: twoToThree,
    overThreeYears: over3,
    agedOverOneYear,
    nonMovingObsolete: R(over3 * between(0.3, 0.8)),
    // provision rule: half of stock aged 2 to 3 years plus all stock over 3 years
    provision: R(0.5 * twoToThree + over3),
    mappedToPurchaseOrders: mapped,
    mappedOverOneYear: R(Math.min(mapped, agedOverOneYear) * between(0.1, 0.4)),
    freeStock: free,
    freeStockOverOneYear: Math.min(free, R(agedOverOneYear * between(0.5, 0.85))),
  };
}

function sumInventory(product: string, lines: InventoryLine[]): InventoryLine {
  const s = (f: (l: InventoryLine) => number) => sum(lines.map(f));
  return {
    product,
    totalStock: s((l) => l.totalStock),
    underOneYear: s((l) => l.underOneYear),
    oneToTwoYears: s((l) => l.oneToTwoYears),
    twoToThreeYears: s((l) => l.twoToThreeYears),
    overThreeYears: s((l) => l.overThreeYears),
    agedOverOneYear: s((l) => l.agedOverOneYear),
    nonMovingObsolete: s((l) => l.nonMovingObsolete),
    provision: s((l) => l.provision),
    mappedToPurchaseOrders: s((l) => l.mappedToPurchaseOrders),
    mappedOverOneYear: s((l) => l.mappedOverOneYear),
    freeStock: s((l) => l.freeStock),
    freeStockOverOneYear: s((l) => l.freeStockOverOneYear),
  };
}

function inventoryFor(v: VerticalConfig, own: Leaf[]): Inventory {
  const fy = sum(own.map(fyBudgetOf));
  const total = R(fy * between(0.07, 0.19));
  const raw = v.products.map(() => between(0.5, 1.5));
  const parts = raw.map((x) => R((total * x) / sum(raw)));
  parts[0] = parts[0]! + (total - sum(parts));
  const lines = v.products.map((p, i) => inventoryLine(p, parts[i]!));
  const nItems = 1 + Math.floor(rnd() * 3);
  const inTransit = [];
  for (let i = 0; i < nItems; i++) {
    const day = 12 + Math.floor(rnd() * 70);
    const d = new Date(FY, MONTHS_ELAPSED, day); // the near month plus an offset, GST calendar
    const arrival = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    inTransit.push({ item: pick(IN_TRANSIT_ITEMS), value: R(total * between(0.05, 0.22)), expectedArrival: arrival });
  }
  return { lines, total: sumInventory('Total', lines), inTransit };
}

/* ---------- targets ---------- */

function sectorOf(product: string): string {
  const p = product.toLowerCase();
  if (/maintenance|service|spares|commissioning|retrofit|modernisation/.test(p)) return 'Service';
  if (/cable|lighting|consumable|tools|field devices|licence|meters$/.test(p)) return 'Trading';
  return 'Projects';
}

function targetsFor(v: VerticalConfig, own: Leaf[]): TargetRow[] {
  const rows: TargetRow[] = [];
  for (const product of v.products) {
    const pl = own.filter((l) => l.product === product);
    if (!pl.length) continue;
    const target = sum(pl.map(fyBudgetOf));
    const achieved = sum(pl.map(ytdOf));
    const budgetToDate = sum(pl.map(ytdBudgetOf));
    rows.push({
      productLine: product,
      sector: sectorOf(product),
      target,
      aspiration: R(target * between(1.1, 1.25)),
      achieved,
      achievedPct: pctOf(achieved, target),
      budgetToDate,
      achievedVsBudgetToDate: achieved - budgetToDate,
    });
  }
  return rows;
}

/* ---------- production, factory verticals only ---------- */

function productionFor(v: VerticalConfig, monthly: MonthPoint[], gmPct: number): Production | null {
  if (!v.factory) return null;
  const rows: ProductionRow[] = [];
  for (let i = 0; i < MONTHS_ELAPSED; i++) {
    const value = monthly[i]!.actual ?? 0;
    const cogs = value * (1 - gmPct / 100);
    rows.push({
      month: MONTHS[i]!,
      deliveredQty: R((value * 1000) / between(140, 190)),
      value,
      materialCost: R(cogs * 0.72),
      labourCost: R(cogs * 0.28),
    });
  }
  const total: ProductionRow = {
    month: 'Total',
    deliveredQty: sum(rows.map((r) => r.deliveredQty)),
    value: sum(rows.map((r) => r.value)),
    materialCost: sum(rows.map((r) => r.materialCost)),
    labourCost: sum(rows.map((r) => r.labourCost)),
  };
  return { qtyUnit: 'square metres', rows, total };
}

/* ---------- sources, definitions, policy ---------- */

const SOURCES: Record<string, Source> = {
  'rollup.sales': { key: 'rollup.sales', label: 'Sales performance by vertical' },
  'rollup.forecast': { key: 'rollup.forecast', label: 'Revenue forecast and pipeline by vertical' },
  'rollup.pl': { key: 'rollup.pl', label: 'Profit and loss summary' },
  'rollup.profitability': { key: 'rollup.profitability', label: 'Vertical profitability' },
  'rollup.receivables': { key: 'rollup.receivables', label: 'Receivables by vertical' },
  'rollup.unbilled': { key: 'rollup.unbilled', label: 'Unbilled by vertical' },
  'rollup.inventory': { key: 'rollup.inventory', label: 'Inventory by vertical' },
  'rollup.monthly': { key: 'rollup.monthly', label: 'Monthly revenue, actual and forecast against budget' },
  'vertical.sales': { key: 'vertical.sales', label: 'Sales performance by sales engineer' },
  'vertical.pl': { key: 'vertical.pl', label: 'Vertical profit and loss' },
  'vertical.targets': { key: 'vertical.targets', label: 'Business targets by product line' },
  'vertical.inventory': { key: 'vertical.inventory', label: 'Inventory outlook' },
  'vertical.unbilled': { key: 'vertical.unbilled', label: 'Unbilled projects and month bridge' },
  'vertical.production': { key: 'vertical.production', label: 'Production schedule' },
  'vertical.receivables': { key: 'vertical.receivables', label: 'Receivables by engineer and customer' },
  'engineer.sales': { key: 'engineer.sales', label: 'Sales performance by product line, one engineer' },
  'engineer.targets': { key: 'engineer.targets', label: 'Business targets by product line, one engineer' },
  'engineer.unbilled': { key: 'engineer.unbilled', label: 'Unbilled projects against one engineer' },
  'engineer.receivables': { key: 'engineer.receivables', label: 'Receivables by customer, one engineer' },
};

const DEFS: Definition[] = [
  { key: 'ytdRevenue', term: 'YTD revenue', text: `Invoiced revenue for ${META.periodLabel}, AED thousands, each product line counted once in its home vertical.` },
  { key: 'ytdBudget', term: 'YTD budget', text: `The approved ${FY} budget phased by month and summed for the same ${MONTHS_ELAPSED} months.` },
  { key: 'variance', term: 'Variance', text: 'Actual less budget for the same period, AED thousands. Negative is below budget and is shown in red.' },
  { key: 'gmPct', term: 'GM percent', text: 'Gross margin divided by revenue for the same period.' },
  { key: 'openOrders', term: 'Open orders', text: 'Confirmed customer orders on the system that are not yet invoiced. Not revenue.' },
  { key: 'expectedOrders', term: 'Expected orders', text: 'Opportunities the engineer rates above 90 percent probability, plus letters of intent. Not secured business and not revenue.' },
  { key: 'fyForecast', term: 'FY forecast', text: `YTD actual revenue plus the engineer forecasts for ${META.nearMonth} and ${META.restOfYear}.` },
  { key: 'fyBudget', term: 'FY budget', text: `The approved ${FY} revenue budget for the full year.` },
  { key: 'nearMonth', term: 'Near-month forecast', text: `The engineer forecast for ${META.nearMonth}, the first open month.` },
  { key: 'restOfYear', term: 'Rest-of-year forecast', text: `The engineer forecast for ${META.restOfYear}.` },
  { key: 'priorYear', term: 'Prior year', text: `Full-year ${FY - 1} actual revenue and gross margin.` },
  { key: 'yoy', term: 'Year on year', text: `FY ${FY} forecast against FY ${FY - 1} actual, percent.` },
  { key: 'plColumns', term: 'P&L columns', text: `YTD is ${META.periodLabel} actual. FY forecast is the full year, with costs annualised from the elapsed months. FY budget is the approved full-year budget. No phased profit budget exists for the elapsed months, so profit is compared full year to full year only.` },
  { key: 'buProfitability', term: 'BU profitability', text: 'Gross margin less salary, warehouse cost, warehouse salaries and common admin. The rung a vertical head controls.' },
  { key: 'buNetProfit', term: 'BU-level net profit', text: 'BU profitability less provisions, inter-company interest and corporate overhead.' },
  { key: 'roiYtd', term: 'ROI year to date', text: `YTD gross margin divided by the engineer's cost to employ for the same ${MONTHS_ELAPSED} months. A multiple, not a percentage.` },
  { key: 'roiBudget', term: 'Budget ROI', text: 'FY budget gross margin divided by annual cost to employ.' },
  { key: 'roiForecast', term: 'Forecast ROI', text: 'FY forecast gross margin divided by annual cost to employ.' },
  { key: 'roiPriorYear', term: 'Prior-year ROI', text: `FY ${FY - 1} gross margin divided by FY ${FY - 1} cost to employ.` },
  { key: 'directContribution', term: 'Direct contribution', text: 'YTD gross margin less YTD cost to employ. Not a profit and loss: warehouse, admin, provisions and group charges are booked at the vertical, not the person.' },
  { key: 'totalOutstanding', term: 'Total outstanding', text: `All unpaid invoices at ${META.currentMonthLabel} month end, whatever their age.` },
  { key: 'netToCollect', term: 'Net to collect', text: 'Total outstanding less the provision. The balance the business still expects to collect. It is not a cash forecast and carries no date.' },
  { key: 'provisionReceivable', term: 'Provision (receivables)', text: 'Half of balances aged 1 to 2 years, all of balances aged over 2 years, and a quarter of a disputed balance aged 91 to 365 days.' },
  { key: 'agingBuckets', term: 'Aging buckets', text: 'Days since the invoice date, whatever the payment terms. A balance can sit in 31 to 90 days and still be within terms.' },
  { key: 'pastDue', term: 'Past due', text: 'Invoices older than the customer’s payment terms, from invoice date plus terms. This is the contractual measure of lateness.' },
  { key: 'notYetDue', term: 'Not yet due', text: 'Invoices inside the customer’s payment terms.' },
  { key: 'agedOverOneYear', term: 'Aged over one year', text: 'Invoices older than 365 days.' },
  { key: 'dispute', term: 'Dispute', text: 'The engineer has flagged the balance as disputed by the customer.' },
  { key: 'reasons', term: 'Reasons for non-collection', text: 'Each customer balance carries one reason: internal group companies; follow-up, no timeline or no response; disputes and not yet due. The third is shown split into disputed balances and balances with nothing past due. Reasons partition total outstanding.' },
  { key: 'monthOnMonth', term: 'Month on month', text: `Net to collect at ${META.currentMonthLabel} month end against ${META.previousMonthLabel} month end.` },
  { key: 'unbilled', term: 'Unbilled', text: 'Work delivered and not yet invoiced, by project. The three-month trend shows two months ago, last month and this month.' },
  { key: 'unbilledAging', term: 'Unbilled aging', text: 'Days since delivery, in the eight bands used by the reference pack.' },
  { key: 'bridge', term: 'Month bridge', text: 'Previous month, plus projects new this month, less projects cleared by invoicing, plus or less changes on ongoing projects, equals current month.' },
  { key: 'inventoryBands', term: 'Inventory age bands', text: 'Stock value at cost by age since receipt: under 1 year, 1 to 2, 2 to 3, over 3 years. The bands sum to total stock.' },
  { key: 'inventoryProvision', term: 'Provision (inventory)', text: 'Half of stock aged 2 to 3 years plus all stock over 3 years.' },
  { key: 'mappedLpo', term: 'Mapped to purchase orders', text: 'Stock already allocated to a customer order. Free stock is total stock less this.' },
  { key: 'freeStockOverOneYear', term: 'Free stock over one year', text: 'Unallocated stock older than a year: the part of inventory most at risk.' },
  { key: 'nonMoving', term: 'Non-moving or obsolete', text: 'Stock with no movement in the year, or superseded. A subset of the over-3-year band.' },
  { key: 'inTransit', term: 'In transit', text: 'Goods paid for or committed and not yet received, with the expected arrival date. Not included in stock.' },
  { key: 'target', term: 'Target', text: `The full-year ${FY} target for the product line, equal to its approved budget.` },
  { key: 'aspiration', term: 'Aspiration', text: 'The stretch figure agreed with the vertical head.' },
  { key: 'budgetToDate', term: 'Budget to date', text: `The target phased by month and summed for ${META.periodLabel}. Achieved is compared with this, not with the full-year target.` },
  { key: 'attributedTotal', term: 'Attributed total', text: 'This vertical’s own engineers only. This is the figure every summary table carries.' },
  { key: 'sheetTotal', term: 'Sheet total', text: 'Every row on this sheet, including product lines sold by other verticals’ engineers. Adding sheet totals across verticals would double count them.' },
  { key: 'revenueShare', term: 'Revenue share', text: 'Share of netted division forecast revenue, allocated to one decimal so the rows sum to exactly 100.0.' },
  { key: 'workingCapital', term: 'Working capital tied up', text: 'Net receivables plus unbilled plus stock at cost. Goods in transit are shown beside it and not added.' },
  { key: 'production', term: 'Production', text: 'Factory output by month: quantity delivered, its invoiced value, and the material and labour cost booked. Value ties to the vertical’s monthly revenue.' },
];
const DEFINITIONS: Record<string, Definition> = Object.fromEntries(DEFS.map((d) => [d.key, d]));

const PRECISION_POLICY = [
  'Every money value is an integer in AED thousands, rounded once at the lowest level the generator produces: one product line in one month.',
  'Every total is a sum of those integers. Sales, forecast, profit and loss, monthly series, vertical files and engineer files therefore tie exactly, with no display rounding.',
  'Gross margin is rounded once per product line and column; margins at every higher level are sums.',
  'Percentages are rounded to one decimal and derived from the integer sums, never from other percentages.',
  'Revenue shares are allocated to one decimal by largest remainder so the ten rows sum to exactly 100.0.',
  'Cost lines below gross margin are rounded once per vertical and column; division groups are sums of vertical rungs.',
  'scripts/reconcile.ts re-reads the written JSON and asserts every cross-table equality. Its result is published on the Data basis page.',
];

const ASSUMPTIONS = [
  'All figures are synthetic and generated from one seed. No real company, person, customer, project or figure appears.',
  'Costs below gross margin are fixed ratios of revenue per vertical, not a finance extract. The forecast column annualises the elapsed months.',
  `No approved profit budget exists for the elapsed months. Profit is compared full year to full year; no year-to-date profit attainment is shown.`,
  'Receivables are modelled as invoices with an age and the customer’s payment terms. Past due is age beyond terms; aging buckets are age since invoice.',
  'The provision on receivables and on inventory follows the written rules on the Data basis page. Net to collect is outstanding less provision, not a dated cash forecast.',
  'Expected orders are opportunities rated above 90 percent plus letters of intent. They are not secured business.',
  'ROI is gross margin over cost to employ for the same period. Costs other than cost to employ are held at the vertical, so no engineer profit and loss is shown.',
  'Production value ties to the factory vertical’s monthly revenue; quantity and cost split are synthetic.',
];

/* ---------- assemble ---------- */

const largest = VERTICALS.reduce((a, b) => (a.fyBudget > b.fyBudget ? a : b));

interface Built {
  v: VerticalConfig;
  own: Leaf[];
  file: VerticalData;
  plParts: { ytd: PlNumbers; forecast: PlNumbers; budget: PlNumbers };
  attributed: EngineerRow;
  engineerFiles: EngineerData[];
}

const built: Built[] = [];
const nettingItems: NettingItem[] = [];

for (const v of VERTICALS) {
  const own = leaves.filter((l) => l.home === v.slug);
  const sharedIn = leaves.filter((l) => l.alsoIn === v.slug);
  const ownEngineers = v.engineers.map((eng) => engineerRow(eng, own.filter((l) => l.engineer === eng).map(productRow), null));
  const sharedEngineers = [...new Set(sharedIn.map((l) => l.engineer))].map((eng) =>
    engineerRow(eng, sharedIn.filter((l) => l.engineer === eng).map(productRow), engineerMeta.get(eng)!.home),
  );
  const attributedTotal = totalRow('Attributed total', ownEngineers);
  const sheetTotal = totalRow('Sheet total', [...ownEngineers, ...sharedEngineers]);
  const sheetLeaves = [...own, ...sharedIn];
  const byProduct: ProductRow[] = [...new Set(sheetLeaves.map((l) => l.product))].map((product) => {
    const rows = sheetLeaves.filter((l) => l.product === product).map(productRow);
    const alsoIn = rows.find((r) => r.alsoReportedOn)?.alsoReportedOn ?? null;
    return { product, alsoReportedOn: sharedIn.some((l) => l.product === product) ? null : alsoIn, ...sumRows(rows) };
  });
  const plParts = { ytd: plNumbersFor(v, own, 'ytd'), forecast: plNumbersFor(v, own, 'forecast'), budget: plNumbersFor(v, own, 'budget') };
  const pl = rungsFrom({ ytd: derive(plParts.ytd), forecast: derive(plParts.forecast), budget: derive(plParts.budget) });
  const balances = customerBalances(v, own);
  const reasons = reasonSplit(balances);
  const total = balanceTotals(balances);
  const byEngineer: EngineerBalance[] = v.engineers.map((eng) => ({ engineer: eng, slug: slugify(eng), ...balanceTotals(balances.filter((r) => r.engineer === eng)) }));
  const unbilled = unbilledFor(v, own);
  const monthly = monthlySeries(own);
  const targets = targetsFor(v, own);
  const s = attributedTotal;
  const np = (k: PlRungKey, col: 'ytd' | 'forecast' | 'budget') => pl.find((r) => r.key === k)![col];

  const engineerFiles: EngineerData[] = ownEngineers.map((row) => {
    const engLeaves = own.filter((l) => l.engineer === row.engineer);
    const engRows = balances.filter((r) => r.engineer === row.engineer);
    const engProjects = unbilled.projects.filter((p) => p.engineer === row.engineer);
    const engTotal = balanceTotals(engRows);
    const engTargets: TargetRow[] = row.products.map((p) => {
      const vt = targets.find((t) => t.productLine === p.product);
      const ratio = vt && vt.target ? vt.aspiration / vt.target : 1.15;
      return {
        productLine: p.product,
        sector: sectorOf(p.product),
        target: p.fyBudgetRevenue,
        aspiration: R(p.fyBudgetRevenue * ratio),
        achieved: p.ytdRevenue,
        achievedPct: pctOf(p.ytdRevenue, p.fyBudgetRevenue),
        budgetToDate: p.ytdBudgetRevenue,
        achievedVsBudgetToDate: p.ytdRevenue - p.ytdBudgetRevenue,
      };
    });
    return {
      meta: META,
      slug: row.slug,
      name: row.engineer,
      vertical: { slug: v.slug, name: v.name },
      sources: SOURCES,
      definitions: DEFINITIONS,
      headline: {
        ytdRevenue: row.ytdRevenue,
        budgetRevenue: row.ytdBudgetRevenue,
        dRevenue: row.ytdRevenue - row.ytdBudgetRevenue,
        ytdGmPct: row.ytdGmPct,
        fyForecast: row.fyForecastRevenue,
        fyBudget: row.fyBudgetRevenue,
        dFy: row.fyForecastRevenue - row.fyBudgetRevenue,
        roiYtd: row.roiYtd,
        roiBudget: row.roiBudget,
        ctcYtd: row.ctcYtd,
        ctcAnnual: row.ctcAnnual,
        directContributionYtd: row.ytdGm - row.ctcYtd,
        receivablesNet: engTotal.netToCollect,
        receivablesChange: engTotal.change,
        pastDue: engTotal.pastDue,
      },
      sales: row,
      monthly: monthlySeries(engLeaves),
      targets: engTargets,
      unbilled: { projects: engProjects, bridge: bridgeFor(engProjects, `${v.slug}/${row.slug}`) },
      receivables: { rows: engRows, total: engTotal, reasons: reasonSplit(engRows) },
      peers: ownEngineers.filter((e) => e.slug !== row.slug).map((e) => ({ slug: e.slug, name: e.engineer })),
    };
  });

  const file: VerticalData = {
    meta: META,
    slug: v.slug,
    name: v.name,
    isLargest: v.slug === largest.slug,
    sources: SOURCES,
    definitions: DEFINITIONS,
    headline: {
      ytdRevenue: s.ytdRevenue,
      budgetRevenue: s.ytdBudgetRevenue,
      dRevenue: s.ytdRevenue - s.ytdBudgetRevenue,
      ytdGmPct: s.ytdGmPct,
      budgetGmPct: s.budgetGmPct,
      fyForecast: s.fyForecastRevenue,
      fyBudget: s.fyBudgetRevenue,
      dFy: s.fyForecastRevenue - s.fyBudgetRevenue,
      buNetProfitYtd: np('buNetProfit', 'ytd'),
      buNetProfitForecast: np('buNetProfit', 'forecast'),
      buNetProfitBudget: np('buNetProfit', 'budget'),
      receivablesNet: total.netToCollect,
      receivablesChange: total.change,
      pastDue: total.pastDue,
    },
    sales: { engineers: [...ownEngineers, ...sharedEngineers], sheetTotal, attributedTotal, byProduct },
    pl,
    targets,
    inventory: inventoryFor(v, own),
    unbilled,
    production: productionFor(v, monthly, s.ytdGmPct),
    receivables: { rows: balances, byEngineer, total, reasons },
    monthly,
  };
  built.push({ v, own, file, plParts, attributed: attributedTotal, engineerFiles });

  for (const l of sharedIn) {
    nettingItems.push({
      product: l.product,
      homeVertical: l.home,
      categoryVertical: v.slug,
      engineer: l.engineer,
      ytdRevenue: ytdOf(l),
      fyForecastRevenue: fyForecastOf(l),
    });
  }
}

/* ---------- summary tables ---------- */

const salesRowOf = (slug: Slug, name: string, s: Numeric): SalesRow => ({
  slug,
  name,
  openOrders: s.openOrders,
  expectedOrders: s.expectedOrders,
  ytdRevenue: s.ytdRevenue,
  ytdGm: s.ytdGm,
  ytdGmPct: s.ytdGmPct,
  budgetRevenue: s.ytdBudgetRevenue,
  budgetGm: s.ytdBudgetGm,
  budgetGmPct: s.budgetGmPct,
  dRevenue: s.ytdRevenue - s.ytdBudgetRevenue,
  dRevenuePct: pctOf(s.ytdRevenue - s.ytdBudgetRevenue, s.ytdBudgetRevenue),
  dGm: s.ytdGm - s.ytdBudgetGm,
  dGmPts: r1(s.ytdGmPct - s.budgetGmPct),
});

const forecastRowOf = (slug: Slug, name: string, s: Numeric): ForecastRow => ({
  slug,
  name,
  priorYearRevenue: s.priorYearRevenue,
  ytdRevenue: s.ytdRevenue,
  nearMonthForecast: s.nearMonthForecast,
  restOfYearForecast: s.restOfYearForecast,
  fyForecast: s.fyForecastRevenue,
  fyBudget: s.fyBudgetRevenue,
  dFy: s.fyForecastRevenue - s.fyBudgetRevenue,
  fcVsBudgetPct: pctOf(s.fyForecastRevenue - s.fyBudgetRevenue, s.fyBudgetRevenue),
  yoyPct: pctOf(s.fyForecastRevenue - s.priorYearRevenue, s.priorYearRevenue),
});

const others = built.filter((b) => b.v.slug !== largest.slug);
const aggExcl = sumRows(others.flatMap((b) => b.own.map(productRow)));
const aggAll = sumRows(leaves.map(productRow));

const sales: SalesTable = {
  rows: built.map((b) => salesRowOf(b.v.slug, b.v.name, b.attributed)),
  subtotalExcludingLargest: salesRowOf('excluding-largest', `Subtotal excluding ${largest.name}`, aggExcl),
  total: salesRowOf('total', 'Division total, netted', aggAll),
  netting: (() => {
    const doubleYtd = sum(nettingItems.map((i) => i.ytdRevenue));
    const doubleFy = sum(nettingItems.map((i) => i.fyForecastRevenue));
    const n: Netting = {
      grossSumYtd: aggAll.ytdRevenue + doubleYtd,
      doubleCountedYtd: doubleYtd,
      nettedYtd: aggAll.ytdRevenue,
      grossSumFy: aggAll.fyForecastRevenue + doubleFy,
      doubleCountedFy: doubleFy,
      nettedFy: aggAll.fyForecastRevenue,
      explanation:
        'Fabricated ductwork and pipe supports sold by Mechanical Systems and Cooling engineers are reported on their home sheet and again on the Fabrication sheet. Adding the sheet totals would count that revenue twice. Every summary total counts each product line once, in its home vertical, and the Fabrication row shows only work sold by its own team.',
      items: nettingItems,
    };
    return n;
  })(),
};
if (sum(sales.rows.map((r) => r.ytdRevenue)) !== sales.total.ytdRevenue) throw new Error('Netting failure: sales rows do not sum to the netted total');

const engineerSplit: Record<Slug, EngineerSummary[]> = {};
for (const b of built) {
  engineerSplit[b.v.slug] = b.file.sales.engineers
    .filter((e) => !e.fromOtherVertical)
    .map((e) => ({
      name: e.engineer,
      slug: e.slug,
      ytdRevenue: e.ytdRevenue,
      ytdGm: e.ytdGm,
      ytdGmPct: e.ytdGmPct,
      budgetRevenue: e.ytdBudgetRevenue,
      dRevenue: e.ytdRevenue - e.ytdBudgetRevenue,
      fyForecast: e.fyForecastRevenue,
      fyBudget: e.fyBudgetRevenue,
    }));
}

const forecast: ForecastTable = {
  rows: built.map((b) => forecastRowOf(b.v.slug, b.v.name, b.attributed)),
  subtotalExcludingLargest: forecastRowOf('excluding-largest', `Subtotal excluding ${largest.name}`, aggExcl),
  total: forecastRowOf('total', 'Division total, netted', aggAll),
};

const largestBuilt = built.find((b) => b.v.slug === largest.slug)!;
const pl: PlGroup[] = [
  { key: 'excludingLargest', label: `Excluding ${largest.name}`, rungs: rungsFrom(sumPl(others.map((b) => b.plParts))) },
  { key: 'largest', label: largest.name, rungs: rungsFrom(sumPl([largestBuilt.plParts])) },
  { key: 'total', label: 'Division total', rungs: rungsFrom(sumPl(built.map((b) => b.plParts))) },
];
const totalRung = (k: PlRungKey) => pl[2]!.rungs.find((r) => r.key === k)!;

/** Largest-remainder allocation of tenths so shares sum to exactly 100.0. */
function allocateShares(values: number[]): number[] {
  const total = sum(values);
  const raw = values.map((v) => (v / total) * 1000);
  const floors = raw.map((x) => Math.floor(x));
  let remaining = 1000 - sum(floors);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (const o of order) {
    if (remaining <= 0) break;
    floors[o.i] = floors[o.i]! + 1;
    remaining--;
  }
  return floors.map((t) => t / 10);
}

const shares = allocateShares(built.map((b) => b.attributed.fyForecastRevenue));
const profRowOf = (slug: Slug, name: string, rev: number, gm: number, np: number, share: number): ProfitabilityRow => ({
  slug,
  name,
  fyRevenue: rev,
  fyGm: gm,
  fyNp: np,
  gmPct: pctOf(gm, rev),
  npPct: pctOf(np, rev),
  revenueShare: share,
});
const profRows = built.map((b, i) => profRowOf(b.v.slug, b.v.name, b.attributed.fyForecastRevenue, b.attributed.fyForecastGm, b.file.pl.find((r) => r.key === 'buNetProfit')!.forecast, shares[i]!));
const profitability: ProfitabilityTable = {
  rows: profRows,
  subtotalExcludingLargest: profRowOf(
    'excluding-largest',
    `Subtotal excluding ${largest.name}`,
    aggExcl.fyForecastRevenue,
    aggExcl.fyForecastGm,
    pl[0]!.rungs.find((r) => r.key === 'buNetProfit')!.forecast,
    r1(sum(profRows.filter((r) => r.slug !== largest.slug).map((r) => r.revenueShare))),
  ),
  total: profRowOf('total', 'Division total, netted', aggAll.fyForecastRevenue, aggAll.fyForecastGm, totalRung('buNetProfit').forecast, r1(sum(shares))),
};
if (profitability.total.revenueShare !== 100) throw new Error(`Revenue shares sum to ${profitability.total.revenueShare}, not 100`);
if (profitability.total.fyRevenue !== totalRung('revenue').forecast) throw new Error('Profitability revenue does not equal P&L forecast revenue');

const itemOf = (b: Built, r: CustomerBalanceRow): ReceivableItem => ({
  customer: r.customer,
  engineer: r.engineer,
  engineerSlug: r.engineerSlug,
  vertical: b.v.slug,
  verticalName: b.v.name,
  totalOutstanding: r.totalOutstanding,
  pastDue: r.pastDue,
  reason: r.reason,
  remark: r.currentRemark,
});

function receivableSummary(slug: Slug, name: string, bs: Built[]): ReceivableSummaryRow {
  const rows = bs.flatMap((b) => b.file.receivables.rows);
  const t = balanceTotals(rows);
  const reasons = reasonSplit(rows);
  const largestItems = bs
    .flatMap((b) => b.file.receivables.rows.map((r) => itemOf(b, r)))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .slice(0, 3);
  return {
    slug,
    name,
    previousMonth: t.previousMonthNet,
    currentMonth: t.netToCollect,
    change: t.change,
    totalOutstanding: t.totalOutstanding,
    provision: t.provision,
    pastDue: t.pastDue,
    pastDuePct: pctOf(t.pastDue, t.totalOutstanding),
    agedOverOneYear: t.agedOverOneYear,
    agedOverOneYearPct: pctOf(t.agedOverOneYear, t.totalOutstanding),
    notYetDue: t.notYetDue,
    disputed: t.disputed,
    reasons,
    largest: largestItems,
  };
}

const allItems = built.flatMap((b) => b.file.receivables.rows.map((r) => itemOf(b, r)));
const receivables: ReceivablesTable = {
  rows: built.map((b) => receivableSummary(b.v.slug, b.v.name, [b])),
  subtotalExcludingLargest: receivableSummary('excluding-largest', `Subtotal excluding ${largest.name}`, others),
  total: receivableSummary('total', 'Division total', built),
  largestByReason: {
    internalGroup: allItems.filter((i) => i.reason === 'internalGroup').sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 5),
    followUpNoResponse: allItems.filter((i) => i.reason === 'followUpNoResponse').sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 5),
    disputesAndNotDue: allItems.filter((i) => i.reason === 'disputesAndNotDue').sort((a, b) => b.totalOutstanding - a.totalOutstanding).slice(0, 5),
  },
};
{
  const rs = receivables.total.reasons;
  if (rs.internalGroup + rs.followUpNoResponse + rs.disputesAndNotDue !== receivables.total.totalOutstanding) throw new Error('Reason buckets do not sum to total outstanding');
  if (rs.disputed + rs.withinTerms !== rs.disputesAndNotDue) throw new Error('Disputed plus within terms does not equal the third reason bucket');
  for (const b of built) {
    for (const r of b.file.receivables.rows) {
      const family = r.reason === 'disputesAndNotDue' && !r.dispute ? 'withinTerms' : r.reason;
      const ok = REMARKS[family].current.some((c) => r.currentRemark.startsWith(c.replace(/ on order$/, ''))) && REMARKS[family].previous.includes(r.previousRemark);
      if (!ok) throw new Error(`Remark does not match reason for ${r.customer} in ${b.v.slug}`);
      if (r.dispute && r.reason !== 'disputesAndNotDue') throw new Error(`Disputed balance carries the wrong reason: ${r.customer}`);
      if (r.customer.endsWith('(group)') && r.reason !== 'internalGroup') throw new Error(`Group balance carries the wrong reason: ${r.customer}`);
      if (r.notYetDue + r.pastDue !== r.totalOutstanding) throw new Error(`Not yet due plus past due does not equal outstanding for ${r.customer}`);
    }
  }
}

const unbilledRowOf = (slug: Slug, name: string, projects: UnbilledProject[]): UnbilledSummaryRow => {
  const bridge = bridgeFor(projects, slug);
  return {
    slug,
    name,
    projects: projects.filter((p) => p.trend[2] > 0).length,
    ...bridge,
    agedOver60: sum(projects.map((p) => p.agedOver60)),
    provision: sum(projects.map((p) => p.provision)),
  };
};
const unbilled = {
  rows: built.map((b) => unbilledRowOf(b.v.slug, b.v.name, b.file.unbilled.projects)),
  total: unbilledRowOf('total', 'Division total', built.flatMap((b) => b.file.unbilled.projects)),
};

const inventoryRowOf = (slug: Slug, name: string, inv: Inventory[]): InventorySummaryRow => {
  const t = sumInventory(name, inv.map((i) => i.total));
  const { product: _product, ...rest } = t;
  void _product;
  return { slug, name, ...rest, inTransit: sum(inv.flatMap((i) => i.inTransit.map((x) => x.value))) };
};
const inventory = {
  rows: built.map((b) => inventoryRowOf(b.v.slug, b.v.name, [b.file.inventory])),
  total: inventoryRowOf('total', 'Division total', built.map((b) => b.file.inventory)),
};

const wcRowOf = (slug: Slug, name: string, rec: ReceivableSummaryRow, ub: UnbilledSummaryRow, inv: InventorySummaryRow): WorkingCapitalRow => ({
  slug,
  name,
  receivablesNet: rec.currentMonth,
  receivablesPastDue: rec.pastDue,
  unbilled: ub.currentMonth,
  inventoryStock: inv.totalStock,
  inventoryFreeStockOverOneYear: inv.freeStockOverOneYear,
  inTransit: inv.inTransit,
  total: rec.currentMonth + ub.currentMonth + inv.totalStock,
});
const workingCapital = {
  rows: built.map((b, i) => wcRowOf(b.v.slug, b.v.name, receivables.rows[i]!, unbilled.rows[i]!, inventory.rows[i]!)),
  total: wcRowOf('total', 'Division total', receivables.total, unbilled.total, inventory.total),
};

/* ---------- overview ---------- */

const topThree = [...receivables.rows].sort((a, b) => b.currentMonth - a.currentMonth).slice(0, 3);
const overview: Overview = {
  sales: {
    ytdRevenue: sales.total.ytdRevenue,
    ytdBudget: sales.total.budgetRevenue,
    variance: sales.total.dRevenue,
    variancePct: sales.total.dRevenuePct,
    ytdGmPct: sales.total.ytdGmPct,
    budgetGmPct: sales.total.budgetGmPct,
    gmPts: sales.total.dGmPts,
  },
  delivery: {
    fyForecast: forecast.total.fyForecast,
    fyBudget: forecast.total.fyBudget,
    variance: forecast.total.dFy,
    variancePct: forecast.total.fcVsBudgetPct,
    priorYear: forecast.total.priorYearRevenue,
    yoyPct: forecast.total.yoyPct,
  },
  profit: {
    ytd: { grossMargin: totalRung('grossMargin').ytd, buProfitability: totalRung('buProfitability').ytd, buNetProfit: totalRung('buNetProfit').ytd },
    forecast: { grossMargin: totalRung('grossMargin').forecast, buProfitability: totalRung('buProfitability').forecast, buNetProfit: totalRung('buNetProfit').forecast },
    budget: { grossMargin: totalRung('grossMargin').budget, buProfitability: totalRung('buProfitability').budget, buNetProfit: totalRung('buNetProfit').budget },
    npForecastVsBudget: totalRung('buNetProfit').dForecastVsBudget,
    lossMakers: profRows.filter((r) => r.fyNp < 0).sort((a, b) => a.fyNp - b.fyNp).map((r) => ({ slug: r.slug, name: r.name, fyNp: r.fyNp })),
  },
  receivables: {
    previousMonth: receivables.total.previousMonth,
    currentMonth: receivables.total.currentMonth,
    change: receivables.total.change,
    totalOutstanding: receivables.total.totalOutstanding,
    pastDue: receivables.total.pastDue,
    pastDuePct: receivables.total.pastDuePct,
    agedOverOneYear: receivables.total.agedOverOneYear,
    agedOverOneYearPct: receivables.total.agedOverOneYearPct,
    concentration: {
      slugs: topThree.map((r) => r.slug),
      names: topThree.map((r) => r.name),
      share: pctOf(sum(topThree.map((r) => r.currentMonth)), receivables.total.currentMonth),
    },
  },
  workingCapital: {
    receivablesNet: workingCapital.total.receivablesNet,
    unbilled: workingCapital.total.unbilled,
    inventoryStock: workingCapital.total.inventoryStock,
    freeStockOverOneYear: workingCapital.total.inventoryFreeStockOverOneYear,
    total: workingCapital.total.total,
  },
};

const rollup: Rollup = {
  meta: META,
  sources: SOURCES,
  definitions: DEFINITIONS,
  precisionPolicy: PRECISION_POLICY,
  assumptions: ASSUMPTIONS,
  overview,
  sales,
  engineerSplit,
  forecast,
  pl,
  largestVertical: { slug: largest.slug, name: largest.name },
  profitability,
  receivables,
  unbilled,
  inventory,
  workingCapital,
  monthly: monthlySeries(leaves),
};

/* ---------- in-memory assertions before writing ---------- */

{
  const ytdFromMonths = sum(rollup.monthly.slice(0, MONTHS_ELAPSED).map((m) => m.actual ?? 0));
  if (ytdFromMonths !== sales.total.ytdRevenue) throw new Error(`Monthly series ${ytdFromMonths} does not tie to YTD ${sales.total.ytdRevenue}`);
  if (totalRung('revenue').ytd !== sales.total.ytdRevenue) throw new Error('P&L YTD revenue does not equal sales YTD revenue');
  if (totalRung('grossMargin').ytd !== sales.total.ytdGm) throw new Error('P&L YTD gross margin does not equal sales YTD gross margin');
  if (forecast.total.ytdRevenue + forecast.total.nearMonthForecast + forecast.total.restOfYearForecast !== forecast.total.fyForecast) throw new Error('Forecast components do not sum to FY forecast');
  for (const r of pl[2]!.rungs) {
    if (r.isPercent) continue;
    const a = pl[0]!.rungs.find((x) => x.key === r.key)!;
    const b = pl[1]!.rungs.find((x) => x.key === r.key)!;
    for (const col of ['ytd', 'forecast', 'budget'] as const) if (a[col] + b[col] !== r[col]) throw new Error(`P&L groups do not sum for ${r.key} ${col}`);
  }
  for (const b of built) {
    if (b.file.production && b.file.production.total.value !== b.attributed.ytdRevenue) throw new Error(`Production value does not tie to revenue for ${b.v.slug}`);
    const inv = b.file.inventory.total;
    if (inv.underOneYear + inv.oneToTwoYears + inv.twoToThreeYears + inv.overThreeYears !== inv.totalStock) throw new Error(`Inventory bands do not sum for ${b.v.slug}`);
    for (const p of b.file.unbilled.projects) {
      const a = p.aging;
      if (a.le60 + a.d61to90 + a.d91to120 + a.d121to180 + a.d181to365 + a.d366to545 + a.d546to730 + a.over730 !== p.trend[2]) throw new Error(`Unbilled aging does not sum for ${p.ref}`);
    }
  }
}

/* A division-level total that lands on a round thousand reads as a placeholder; refuse it so the seed is changed rather than trusted. */
{
  const headline: [string, number][] = [
    ['sales YTD revenue', sales.total.ytdRevenue],
    ['sales YTD budget', sales.total.budgetRevenue],
    ['FY forecast', forecast.total.fyForecast],
    ['FY budget', forecast.total.fyBudget],
    ['prior year', forecast.total.priorYearRevenue],
    ['net to collect', receivables.total.currentMonth],
    ['total outstanding', receivables.total.totalOutstanding],
    ['unbilled', unbilled.total.currentMonth],
    ['stock', inventory.total.totalStock],
  ];
  for (const [label, v] of headline) if (v % 1000 === 0) throw new Error(`Division ${label} is a round thousand (${v}); change the seed or the noise so it does not read as a placeholder`);
}

/* ---------- write ---------- */

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'data');
mkdirSync(join(outDir, 'verticals'), { recursive: true });
mkdirSync(join(outDir, 'engineers'), { recursive: true });
writeFileSync(join(outDir, 'rollup.json'), JSON.stringify(rollup, null, 1));
const index: VerticalIndexEntry[] = built.map((b) => ({
  slug: b.v.slug,
  name: b.v.name,
  file: `verticals/${b.v.slug}.json`,
  engineers: b.engineerFiles.map((e) => ({ slug: e.slug, name: e.name })),
}));
writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
const slugs = new Set<string>();
for (const b of built) {
  writeFileSync(join(outDir, 'verticals', `${b.v.slug}.json`), JSON.stringify(b.file, null, 1));
  for (const e of b.engineerFiles) {
    if (slugs.has(e.slug)) throw new Error(`Duplicate engineer slug ${e.slug}`);
    slugs.add(e.slug);
    writeFileSync(join(outDir, 'engineers', `${e.slug}.json`), JSON.stringify(e, null, 1));
  }
}

const fmtM = (thousands: number) => (thousands / 1000).toFixed(1);
console.log(`Generated ${built.length} vertical files, ${slugs.size} engineer files and rollup.json at ${META.generatedAt}`);
console.log(`Netted YTD revenue AED ${fmtM(sales.total.ytdRevenue)}M (gross ${fmtM(sales.netting.grossSumYtd)}M, double counted ${fmtM(sales.netting.doubleCountedYtd)}M)`);
console.log(`YTD revenue vs budget ${sales.total.dRevenue} (${sales.total.dRevenuePct}%); FY forecast vs budget ${forecast.total.dFy} (${forecast.total.fcVsBudgetPct}%)`);
console.log(`BU net profit YTD ${totalRung('buNetProfit').ytd}, FY forecast ${totalRung('buNetProfit').forecast}, FY budget ${totalRung('buNetProfit').budget}`);
console.log(`Receivables net to collect ${receivables.total.currentMonth} (past due ${receivables.total.pastDue}, ${receivables.total.pastDuePct}%; aged over one year ${receivables.total.agedOverOneYear}, ${receivables.total.agedOverOneYearPct}%)`);
