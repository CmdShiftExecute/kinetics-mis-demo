/**
 * Data contract for the Halvard MIS demo.
 *
 * Every figure the browser shows is read from JSON produced by
 * scripts/generate_demo_data.ts. Nothing is computed at runtime beyond
 * sorting, filtering and formatting. If a figure on screen is wrong, the
 * fix is in the generator or in this schema, never in a component.
 *
 * Units: all money values are AED thousands unless the field name says
 * otherwise. Percentages are plain numbers (21.4 means 21.4 percent).
 * Timestamps are GST (Asia/Dubai, +04:00). Never UTC.
 */

export type Slug = string;
export type Verdict = 'ON TRACK' | 'WATCH' | 'BEHIND';

export interface Meta {
  company: string;
  division: string;
  fiscalYear: number;
  /** Human label for the year-to-date window, e.g. "January to August 2026". */
  periodLabel: string;
  monthsElapsed: number;
  /** Label for the near-month forecast column, e.g. "September 2026". */
  nearMonth: string;
  /** Label for the remaining-months forecast column, e.g. "October to December". */
  restOfYear: string;
  /** ISO 8601 with a +04:00 offset. */
  dataAsOf: string;
  /** Rendered label, e.g. "07 Sep 2026 09:30 GST". */
  dataAsOfLabel: string;
  revision: string;
  currency: 'AED';
  unit: 'thousand';
  seed: number;
  /** ISO 8601 with a +04:00 offset. */
  generatedAt: string;
}

/** A named table that a figure was read from, so any number can name its source. */
export interface Source {
  /** Stable key, e.g. "rollup.sales". */
  key: string;
  /** Human label, e.g. "Sales performance by vertical". */
  label: string;
}

/* ---------- Roll-up (front page) ---------- */

export interface SalesRow {
  slug: Slug;
  name: string;
  openOrders: number;
  expectedOrders: number;
  ytdRevenue: number;
  ytdGm: number;
  ytdGmPct: number;
  budgetRevenue: number;
  budgetGm: number;
  budgetGmPct: number;
  /** Revenue delta against budget, AED thousands. */
  dRevenue: number;
  /** Gross margin delta against budget, AED thousands. */
  dGm: number;
  /** Gross margin percent delta against budget, percentage points. */
  dGmPts: number;
}

export interface EngineerSummary {
  name: string;
  /** Route segment for the engineer's own page. */
  slug: string;
  ytdRevenue: number;
  ytdGm: number;
  ytdGmPct: number;
  budgetRevenue: number;
  dRevenue: number;
}

export interface NettingItem {
  product: string;
  homeVertical: Slug;
  categoryVertical: Slug;
  engineer: string;
  ytdRevenue: number;
  fyForecastRevenue: number;
}

export interface Netting {
  /** What the vertical sheets would sum to if each sheet total were added. */
  grossSumYtd: number;
  /** Revenue that appears on two sheets, AED thousands. */
  doubleCountedYtd: number;
  /** The single figure the front page shows everywhere. */
  nettedYtd: number;
  grossSumFy: number;
  doubleCountedFy: number;
  nettedFy: number;
  explanation: string;
  items: NettingItem[];
}

export interface ForecastRow {
  slug: Slug;
  name: string;
  priorYearRevenue: number;
  ytdRevenue: number;
  nearMonthForecast: number;
  restOfYearForecast: number;
  fyForecast: number;
  fyBudget: number;
  fcVsBudgetPct: number;
  yoyPct: number;
}

export type PlRungKey =
  | 'revenue'
  | 'grossMargin'
  | 'gmPct'
  | 'salaryCtc'
  | 'warehouseCost'
  | 'warehouseSalaries'
  | 'commonAdmin'
  | 'buProfitability'
  | 'provisionsInterCo'
  | 'corporateOverhead'
  | 'buNetProfit';

export interface PlRung {
  key: PlRungKey;
  label: string;
  /** Plain-English definition shown on hover. */
  definition: string;
  /** Which table feeds this rung. */
  feeds: string;
  /** Whether the rung is a subtotal (rendered with a rule above it). */
  subtotal: boolean;
  /** Percent rungs are formatted as percentages, everything else as AED thousands. */
  isPercent: boolean;
  ytd: number;
  forecast: number;
  budget: number;
}

export interface PlGroup {
  key: 'excludingLargest' | 'largest' | 'total';
  label: string;
  rungs: PlRung[];
}

export interface ProfitabilityRow {
  slug: Slug;
  name: string;
  fyRevenue: number;
  fyGm: number;
  fyNp: number;
  gmPct: number;
  npPct: number;
  /** Share of netted group revenue, percent. Attribution basis, sums to 100. */
  revenueShare: number;
}

export interface ReasonBuckets {
  internalGroup: number;
  noTimelineOrResponse: number;
  disputesAndNotDue: number;
}

export interface OverdueSummaryRow {
  slug: Slug;
  name: string;
  previousMonth: number;
  currentMonth: number;
  change: number;
  reasons: ReasonBuckets;
  /** The largest single remark for this vertical, shown on hover. */
  topRemark: string;
  /** Overdue beyond one year, AED thousands. */
  overOneYear: number;
  /** Share of this vertical's overdue that is older than a year, percent. */
  overOneYearPct: number;
  /** True when overOneYearPct breaches the same threshold the Collecting verdict uses. */
  agingFlag: boolean;
}

export interface MonthPoint {
  month: string;
  /** Index 1 to 12. */
  index: number;
  actual: number | null;
  forecast: number | null;
  budget: number;
}

export interface ScorecardItem {
  key: 'selling' | 'delivering' | 'keeping' | 'earning' | 'collecting';
  /** The MD's question this line answers. */
  question: string;
  label: string;
  verdict: Verdict;
  /** The single figure that justifies the verdict, already formatted. */
  figure: string;
  note: string;
}

export interface Readout {
  headline: {
    /** AED millions, one decimal. */
    valueMillions: number;
    label: string;
    sub: string;
  };
  lines: string[];
  scorecard: ScorecardItem[];
  /** Thresholds used, so the rule is visible and editable. */
  thresholds: Record<string, string>;
}

export interface Rollup {
  meta: Meta;
  readout: Readout;
  sources: Record<string, Source>;
  sales: { rows: SalesRow[]; total: SalesRow; netting: Netting };
  engineerSplit: Record<Slug, EngineerSummary[]>;
  forecast: { rows: ForecastRow[]; total: ForecastRow };
  pl: PlGroup[];
  largestVertical: { slug: Slug; name: string };
  profitability: { rows: ProfitabilityRow[]; total: ProfitabilityRow };
  overdue: { rows: OverdueSummaryRow[]; total: OverdueSummaryRow };
  monthly: MonthPoint[];
}

/* ---------- Vertical sheet (drill page) ---------- */

export interface ProductRow {
  product: string;
  /** Present when this product is also reported on another vertical's sheet. */
  alsoReportedOn: Slug | null;
  openOrders: number;
  expectedOrders: number;
  ytdRevenue: number;
  ytdGm: number;
  ytdGmPct: number;
  ytdBudgetRevenue: number;
  ytdBudgetGm: number;
  budgetGmPct: number;
  nearMonthForecast: number;
  restOfYearForecast: number;
  fyForecastRevenue: number;
  fyForecastGm: number;
  fyBudgetRevenue: number;
  fyBudgetGm: number;
  priorYearRevenue: number;
  priorYearGm: number;
}

export interface EngineerRow extends Omit<ProductRow, 'product' | 'alsoReportedOn'> {
  engineer: string;
  /** Route segment for the engineer's own page, unique across the company. */
  slug: string;
  /** The vertical the engineer belongs to; the engineer page lives under it. */
  homeVertical: Slug;
  /** True when this engineer belongs to another vertical and appears here only for a shared product line. */
  fromOtherVertical: Slug | null;
  roiPriorYear: number;
  roiYtd: number;
  roiBudget: number;
  roiForecast: number;
  products: ProductRow[];
}

export interface TargetRow {
  productLine: string;
  target: number;
  aspiration: number;
  achieved: number;
  achievedPct: number;
}

export interface InTransitItem {
  item: string;
  value: number;
  /** Date in GST, YYYY-MM-DD. */
  expectedArrival: string;
}

export interface Inventory {
  totalStock: number;
  underOneYear: number;
  overOneYear: number;
  overTwoYears: number;
  overThreeYears: number;
  provision: number;
  mappedToPurchaseOrders: number;
  freeStock: number;
  freeStockOverOneYear: number;
  inTransit: InTransitItem[];
}

export interface UnbilledProject {
  ref: string;
  project: string;
  engineer: string;
  customer: string;
  /** Three values: two months ago, last month, this month. */
  trend: [number, number, number];
  provision: number;
  remark: string;
}

export interface UnbilledBridge {
  previousMonth: number;
  newProjects: number;
  clearedProjects: number;
  ongoingChanges: number;
  currentMonth: number;
}

export interface OverdueDetailRow {
  engineer: string;
  customer: string;
  terms: string;
  bucket0to30: number;
  bucket31to90: number;
  bucket91to365: number;
  bucket1to2y: number;
  bucketOver2y: number;
  totalOutstanding: number;
  provision: number;
  netToCollect: number;
  /** Overdue is everything beyond the 0 to 30 day bucket. */
  overdue: number;
  dispute: boolean;
  previousMonthOverdue: number;
  previousRemark: string;
  currentRemark: string;
  reason: keyof ReasonBuckets;
}

export interface EngineerOverdue {
  engineer: string;
  slug: string;
  customers: number;
  bucket0to30: number;
  bucket31to90: number;
  bucket91to365: number;
  bucket1to2y: number;
  bucketOver2y: number;
  totalOutstanding: number;
  provision: number;
  netToCollect: number;
  overdue: number;
  previousMonthOverdue: number;
  change: number;
  disputed: number;
}

export interface OverdueTotals extends Omit<EngineerOverdue, 'engineer'> {}

export interface VerticalData {
  meta: Meta;
  slug: Slug;
  name: string;
  isLargest: boolean;
  sources: Record<string, Source>;
  headline: {
    ytdRevenue: number;
    budgetRevenue: number;
    ytdGmPct: number;
    fyForecast: number;
    fyBudget: number;
    overdue: number;
  };
  sales: {
    engineers: EngineerRow[];
    /** Sheet total: every row on this sheet, including rows shared from other verticals. */
    sheetTotal: EngineerRow;
    /** Attributed total: only this vertical's own engineers. Equals the front page figure. */
    attributedTotal: EngineerRow;
  };
  pl: PlRung[];
  targets: TargetRow[];
  inventory: Inventory;
  unbilled: { projects: UnbilledProject[]; bridge: UnbilledBridge };
  overdue: {
    rows: OverdueDetailRow[];
    byEngineer: EngineerOverdue[];
    total: OverdueTotals;
    reasons: ReasonBuckets;
  };
  monthly: MonthPoint[];
}

/* ---------- Engineer page ---------- */

export interface EngineerData {
  meta: Meta;
  slug: string;
  name: string;
  vertical: { slug: Slug; name: string };
  sources: Record<string, Source>;
  headline: {
    ytdRevenue: number;
    budgetRevenue: number;
    ytdGmPct: number;
    fyForecast: number;
    fyBudget: number;
    roiYtd: number;
    roiBudget: number;
    overdue: number;
    overdueChange: number;
  };
  /** The engineer's row with product sub-rows, including lines also reported on another vertical's sheet. */
  sales: EngineerRow;
  monthly: MonthPoint[];
  targets: TargetRow[];
  unbilled: { projects: UnbilledProject[]; bridge: UnbilledBridge };
  overdue: { rows: OverdueDetailRow[]; total: OverdueTotals; reasons: ReasonBuckets };
  /** The other engineers of the same vertical, for navigation. */
  peers: { slug: string; name: string }[];
}

export interface VerticalIndexEntry {
  slug: Slug;
  name: string;
  file: string;
}
