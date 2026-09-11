/**
 * Data contract for the Halvard MIS demo.
 *
 * Every figure the browser shows is read from JSON produced by
 * scripts/generate_demo_data.ts. Nothing is computed at runtime beyond
 * sorting, filtering and formatting. If a figure on screen is wrong, the
 * fix is in the generator or in this schema, never in a component.
 *
 * Precision policy: every money value is an integer in AED thousands,
 * rounded once at the lowest level the generator produces (a product line
 * in one month). Every total anywhere is a sum of those integers, so
 * independently published tables tie exactly. Percentages are plain numbers
 * rounded to one decimal (21.4 means 21.4 percent) and are derived from the
 * integer sums, never from other percentages.
 *
 * Timestamps are GST (Asia/Dubai, +04:00). Never UTC.
 */

export type Slug = string;

export interface Meta {
  company: string;
  division: string;
  fiscalYear: number;
  /** Human label for the year-to-date window, e.g. "January to August 2026". */
  periodLabel: string;
  monthsElapsed: number;
  /** Label of the last closed month, e.g. "August 2026". */
  currentMonthLabel: string;
  /** Label of the month before it, e.g. "July 2026". */
  previousMonthLabel: string;
  /** Label for the near-month forecast column, e.g. "September 2026". */
  nearMonth: string;
  /** Label for the remaining-months forecast column, e.g. "October to December 2026". */
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
  key: string;
  label: string;
}

/** A measure definition: what is measured, for which period, against which comparator. */
export interface Definition {
  key: string;
  term: string;
  text: string;
}

/* ---------- Sales ---------- */

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
  /** YTD revenue less YTD budget, AED thousands. */
  dRevenue: number;
  /** YTD revenue less YTD budget, percent of budget. */
  dRevenuePct: number;
  /** YTD gross margin less YTD budget gross margin, AED thousands. */
  dGm: number;
  /** YTD GM percent less budget GM percent, percentage points. */
  dGmPts: number;
}

export interface EngineerSummary {
  name: string;
  slug: string;
  ytdRevenue: number;
  ytdGm: number;
  ytdGmPct: number;
  budgetRevenue: number;
  dRevenue: number;
  fyForecast: number;
  fyBudget: number;
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
  /** The single figure every summary table shows. */
  nettedYtd: number;
  grossSumFy: number;
  doubleCountedFy: number;
  nettedFy: number;
  explanation: string;
  items: NettingItem[];
}

export interface SalesTable {
  rows: SalesRow[];
  subtotalExcludingLargest: SalesRow;
  total: SalesRow;
  netting: Netting;
}

/* ---------- Delivery (forecast) ---------- */

export interface ForecastRow {
  slug: Slug;
  name: string;
  priorYearRevenue: number;
  ytdRevenue: number;
  nearMonthForecast: number;
  restOfYearForecast: number;
  fyForecast: number;
  fyBudget: number;
  /** FY forecast less FY budget, AED thousands. */
  dFy: number;
  fcVsBudgetPct: number;
  yoyPct: number;
}

export interface ForecastTable {
  rows: ForecastRow[];
  subtotalExcludingLargest: ForecastRow;
  total: ForecastRow;
}

export interface MonthPoint {
  month: string;
  /** Index 1 to 12. */
  index: number;
  /** Closed months carry an actual; later months carry null. */
  actual: number | null;
  /** Open months carry a forecast; closed months carry null. */
  forecast: number | null;
  budget: number;
  /** Actual for closed months, forecast for open months, less budget. AED thousands. */
  variance: number;
}

/* ---------- Profit and loss ---------- */

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
  definition: string;
  /** Which table or extract feeds this rung, and how it is allocated. */
  feeds: string;
  subtotal: boolean;
  isPercent: boolean;
  ytd: number;
  forecast: number;
  budget: number;
  /** FY forecast less FY budget. AED thousands, or percentage points for percent rungs. */
  dForecastVsBudget: number;
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
  /** Share of netted division forecast revenue, percent, allocated so the rows sum to exactly 100.0. */
  revenueShare: number;
}

export interface ProfitabilityTable {
  rows: ProfitabilityRow[];
  subtotalExcludingLargest: ProfitabilityRow;
  total: ProfitabilityRow;
}

/* ---------- Receivables ---------- */

export type ReasonKey = 'internalGroup' | 'followUpNoResponse' | 'disputesAndNotDue';

export interface ReasonBuckets {
  internalGroup: number;
  followUpNoResponse: number;
  disputesAndNotDue: number;
}

/** The three reference buckets, with the third split into its two components. */
export interface ReasonSplit extends ReasonBuckets {
  /** Balances the engineer has flagged as disputed. */
  disputed: number;
  /** Balances with nothing beyond the customer's terms. */
  withinTerms: number;
}

export interface ReceivableItem {
  customer: string;
  engineer: string;
  engineerSlug: string;
  vertical: Slug;
  verticalName: string;
  totalOutstanding: number;
  pastDue: number;
  reason: ReasonKey;
  remark: string;
}

export interface ReceivableSummaryRow {
  slug: Slug;
  name: string;
  /** Net to collect at the previous month end. */
  previousMonth: number;
  /** Net to collect at the current month end. */
  currentMonth: number;
  change: number;
  totalOutstanding: number;
  provision: number;
  /** Beyond the customer's contractual terms, from invoice date plus terms. */
  pastDue: number;
  pastDuePct: number;
  /** Invoice age over one year, whatever the terms. */
  agedOverOneYear: number;
  agedOverOneYearPct: number;
  notYetDue: number;
  disputed: number;
  reasons: ReasonSplit;
  /** The three largest balances in this vertical. */
  largest: ReceivableItem[];
}

export interface ReceivablesTable {
  rows: ReceivableSummaryRow[];
  subtotalExcludingLargest: ReceivableSummaryRow;
  total: ReceivableSummaryRow;
  /** The five largest balances in the division under each reason. */
  largestByReason: Record<ReasonKey, ReceivableItem[]>;
}

/* ---------- Working capital ---------- */

export interface UnbilledSummaryRow {
  slug: Slug;
  name: string;
  projects: number;
  previousMonth: number;
  newProjects: number;
  clearedProjects: number;
  ongoingChanges: number;
  currentMonth: number;
  /** Unbilled older than 60 days since delivery. */
  agedOver60: number;
  provision: number;
}

export interface InventorySummaryRow {
  slug: Slug;
  name: string;
  totalStock: number;
  underOneYear: number;
  oneToTwoYears: number;
  twoToThreeYears: number;
  overThreeYears: number;
  agedOverOneYear: number;
  nonMovingObsolete: number;
  provision: number;
  mappedToPurchaseOrders: number;
  mappedOverOneYear: number;
  freeStock: number;
  freeStockOverOneYear: number;
  inTransit: number;
}

export interface WorkingCapitalRow {
  slug: Slug;
  name: string;
  receivablesNet: number;
  receivablesPastDue: number;
  unbilled: number;
  inventoryStock: number;
  inventoryFreeStockOverOneYear: number;
  inTransit: number;
  total: number;
}

/* ---------- Overview ---------- */

export interface Overview {
  sales: {
    ytdRevenue: number;
    ytdBudget: number;
    variance: number;
    variancePct: number;
    ytdGmPct: number;
    budgetGmPct: number;
    gmPts: number;
  };
  delivery: {
    fyForecast: number;
    fyBudget: number;
    variance: number;
    variancePct: number;
    priorYear: number;
    yoyPct: number;
  };
  profit: {
    ytd: { grossMargin: number; buProfitability: number; buNetProfit: number };
    forecast: { grossMargin: number; buProfitability: number; buNetProfit: number };
    budget: { grossMargin: number; buProfitability: number; buNetProfit: number };
    npForecastVsBudget: number;
    lossMakers: { slug: Slug; name: string; fyNp: number }[];
  };
  receivables: {
    previousMonth: number;
    currentMonth: number;
    change: number;
    totalOutstanding: number;
    pastDue: number;
    pastDuePct: number;
    agedOverOneYear: number;
    agedOverOneYearPct: number;
    /** The three largest verticals by net to collect and their combined share. */
    concentration: { slugs: Slug[]; names: string[]; share: number };
  };
  workingCapital: {
    receivablesNet: number;
    unbilled: number;
    inventoryStock: number;
    freeStockOverOneYear: number;
    total: number;
  };
}

export interface Rollup {
  meta: Meta;
  sources: Record<string, Source>;
  definitions: Record<string, Definition>;
  precisionPolicy: string[];
  assumptions: string[];
  overview: Overview;
  sales: SalesTable;
  engineerSplit: Record<Slug, EngineerSummary[]>;
  forecast: ForecastTable;
  pl: PlGroup[];
  largestVertical: { slug: Slug; name: string };
  profitability: ProfitabilityTable;
  receivables: ReceivablesTable;
  unbilled: { rows: UnbilledSummaryRow[]; total: UnbilledSummaryRow };
  inventory: { rows: InventorySummaryRow[]; total: InventorySummaryRow };
  workingCapital: { rows: WorkingCapitalRow[]; total: WorkingCapitalRow };
  monthly: MonthPoint[];
}

/* ---------- Vertical sheet ---------- */

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
  slug: string;
  homeVertical: Slug;
  /** Set when this engineer belongs to another vertical and appears here only for a shared product line. */
  fromOtherVertical: Slug | null;
  /** Annual cost to employ, AED thousands: the ROI denominator. */
  ctcAnnual: number;
  /** Cost to employ for the elapsed months. */
  ctcYtd: number;
  ctcPriorYear: number;
  /** Prior-year gross margin over prior-year cost to employ. */
  roiPriorYear: number;
  /** YTD gross margin over cost to employ for the elapsed months. */
  roiYtd: number;
  /** FY budget gross margin over annual cost to employ. */
  roiBudget: number;
  /** FY forecast gross margin over annual cost to employ. */
  roiForecast: number;
  products: ProductRow[];
}

export interface TargetRow {
  productLine: string;
  sector: string;
  /** Full-year target, equal to the approved budget for the line. */
  target: number;
  aspiration: number;
  achieved: number;
  achievedPct: number;
  /** Seasonally phased budget for the elapsed months. */
  budgetToDate: number;
  achievedVsBudgetToDate: number;
}

export interface InTransitItem {
  item: string;
  value: number;
  /** Date in GST, YYYY-MM-DD. */
  expectedArrival: string;
}

export interface InventoryLine {
  product: string;
  totalStock: number;
  underOneYear: number;
  oneToTwoYears: number;
  twoToThreeYears: number;
  overThreeYears: number;
  agedOverOneYear: number;
  nonMovingObsolete: number;
  provision: number;
  mappedToPurchaseOrders: number;
  mappedOverOneYear: number;
  freeStock: number;
  freeStockOverOneYear: number;
}

export interface Inventory {
  lines: InventoryLine[];
  total: InventoryLine;
  inTransit: InTransitItem[];
}

export type UnbilledStatus = 'new' | 'cleared' | 'ongoing';

export interface UnbilledAging {
  le60: number;
  d61to90: number;
  d91to120: number;
  d121to180: number;
  d181to365: number;
  d366to545: number;
  d546to730: number;
  over730: number;
}

export interface UnbilledProject {
  ref: string;
  project: string;
  engineer: string;
  engineerSlug: string;
  customer: string;
  /** Three values: two months ago, last month, this month. */
  trend: [number, number, number];
  status: UnbilledStatus;
  aging: UnbilledAging;
  agedOver60: number;
  provision: number;
  previousRemark: string;
  currentRemark: string;
}

export interface UnbilledBridge {
  previousMonth: number;
  newProjects: number;
  clearedProjects: number;
  ongoingChanges: number;
  currentMonth: number;
}

export interface ProductionRow {
  month: string;
  deliveredQty: number;
  value: number;
  materialCost: number;
  labourCost: number;
}

export interface Production {
  qtyUnit: string;
  rows: ProductionRow[];
  total: ProductionRow;
}

export interface CustomerBalanceRow {
  engineer: string;
  engineerSlug: string;
  customer: string;
  terms: string;
  termsDays: number;
  invoices: number;
  bucket0to30: number;
  bucket31to90: number;
  bucket91to365: number;
  bucket1to2y: number;
  bucketOver2y: number;
  totalOutstanding: number;
  provision: number;
  netToCollect: number;
  /** Within terms: invoice age at or below the customer's terms. */
  notYetDue: number;
  /** Beyond terms: invoice age above the customer's terms. */
  pastDue: number;
  agedOverOneYear: number;
  dispute: boolean;
  reason: ReasonKey;
  /** Net to collect at the previous month end. */
  previousMonthNet: number;
  change: number;
  previousRemark: string;
  currentRemark: string;
}

export interface EngineerBalance {
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
  notYetDue: number;
  pastDue: number;
  agedOverOneYear: number;
  disputed: number;
  previousMonthNet: number;
  change: number;
}

export type BalanceTotals = Omit<EngineerBalance, 'engineer' | 'slug'>;

export interface VerticalData {
  meta: Meta;
  slug: Slug;
  name: string;
  isLargest: boolean;
  sources: Record<string, Source>;
  definitions: Record<string, Definition>;
  headline: {
    ytdRevenue: number;
    budgetRevenue: number;
    dRevenue: number;
    ytdGmPct: number;
    budgetGmPct: number;
    fyForecast: number;
    fyBudget: number;
    dFy: number;
    buNetProfitYtd: number;
    buNetProfitForecast: number;
    buNetProfitBudget: number;
    receivablesNet: number;
    receivablesChange: number;
    pastDue: number;
  };
  sales: {
    engineers: EngineerRow[];
    /** Every row on this sheet, including rows shared from other verticals. */
    sheetTotal: EngineerRow;
    /** Only this vertical's own engineers. Equals the summary figure. */
    attributedTotal: EngineerRow;
    /** Sub-totals by product line across every row on the sheet, as the reference sheet carries them. */
    byProduct: ProductRow[];
  };
  pl: PlRung[];
  targets: TargetRow[];
  inventory: Inventory;
  unbilled: { projects: UnbilledProject[]; bridge: UnbilledBridge };
  /** Present only for a vertical that runs a factory. */
  production: Production | null;
  receivables: {
    rows: CustomerBalanceRow[];
    byEngineer: EngineerBalance[];
    total: BalanceTotals;
    reasons: ReasonSplit;
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
  definitions: Record<string, Definition>;
  headline: {
    ytdRevenue: number;
    budgetRevenue: number;
    dRevenue: number;
    ytdGmPct: number;
    fyForecast: number;
    fyBudget: number;
    dFy: number;
    roiYtd: number;
    roiBudget: number;
    ctcYtd: number;
    ctcAnnual: number;
    /** YTD gross margin less YTD cost to employ. Not a profit and loss: vertical and group costs are excluded. */
    directContributionYtd: number;
    receivablesNet: number;
    receivablesChange: number;
    pastDue: number;
  };
  sales: EngineerRow;
  monthly: MonthPoint[];
  targets: TargetRow[];
  unbilled: { projects: UnbilledProject[]; bridge: UnbilledBridge };
  receivables: { rows: CustomerBalanceRow[]; total: BalanceTotals; reasons: ReasonSplit };
  peers: { slug: string; name: string }[];
}

export interface VerticalIndexEntry {
  slug: Slug;
  name: string;
  file: string;
  engineers: { slug: string; name: string }[];
}

/* ---------- Reconciliation ---------- */

export interface Assertion {
  id: string;
  statement: string;
  left: number;
  right: number;
  pass: boolean;
}

export interface Reconciliation {
  /** ISO 8601 with a +04:00 offset. */
  checkedAt: string;
  policy: string[];
  assertions: Assertion[];
  passed: number;
  failed: number;
}
