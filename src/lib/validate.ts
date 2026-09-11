/**
 * Shape validation at the data boundary. Valid JSON of the wrong shape must
 * produce a readable error, never a blank page. These checks are deliberately
 * structural (keys, arrays, numbers) rather than a full schema mirror.
 */

export class DataShapeError extends Error {
  constructor(file: string, detail: string) {
    super(`${file} does not have the expected shape: ${detail}.`);
    this.name = 'DataShapeError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function need(file: string, o: unknown, keys: string[], path = ''): asserts o is Obj {
  if (!isObj(o)) throw new DataShapeError(file, `${path || 'root'} is not an object`);
  for (const key of keys) if (!(key in o)) throw new DataShapeError(file, `missing ${path ? path + '.' : ''}${key}`);
}
function needArray(file: string, v: unknown, path: string, min = 0): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new DataShapeError(file, `${path} is not an array`);
  if (v.length < min) throw new DataShapeError(file, `${path} has ${v.length} rows, expected at least ${min}`);
}
function needNumber(file: string, v: unknown, path: string) {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new DataShapeError(file, `${path} is not a number`);
}

function needMeta(file: string, meta: unknown) {
  need(file, meta, ['company', 'division', 'fiscalYear', 'periodLabel', 'monthsElapsed', 'dataAsOfLabel', 'currency', 'unit'], 'meta');
  needNumber(file, meta.monthsElapsed, 'meta.monthsElapsed');
  if (!/\+04:00$/.test(String(meta.dataAsOf))) throw new DataShapeError(file, 'meta.dataAsOf is not a GST (+04:00) timestamp');
}

function needMonthly(file: string, v: unknown, path: string) {
  needArray(file, v, path, 12);
  for (const p of v) {
    need(file, p, ['month', 'index', 'budget', 'variance'], path);
    needNumber(file, p.budget, `${path}.budget`);
  }
}

export function validateRollup(file: string, v: unknown): void {
  need(file, v, ['meta', 'sources', 'definitions', 'overview', 'sales', 'engineerSplit', 'forecast', 'pl', 'largestVertical', 'profitability', 'receivables', 'unbilled', 'inventory', 'workingCapital', 'monthly', 'precisionPolicy', 'assumptions']);
  needMeta(file, v.meta);
  need(file, v.sales, ['rows', 'total', 'subtotalExcludingLargest', 'netting'], 'sales');
  needArray(file, v.sales.rows, 'sales.rows', 1);
  for (const r of v.sales.rows) {
    need(file, r, ['slug', 'name', 'ytdRevenue', 'budgetRevenue', 'dRevenue', 'ytdGmPct'], 'sales.rows[]');
    needNumber(file, r.ytdRevenue, 'sales.rows[].ytdRevenue');
  }
  need(file, v.forecast, ['rows', 'total'], 'forecast');
  needArray(file, v.forecast.rows, 'forecast.rows', 1);
  needArray(file, v.pl, 'pl', 3);
  for (const g of v.pl) {
    need(file, g, ['key', 'label', 'rungs'], 'pl[]');
    needArray(file, g.rungs, 'pl[].rungs', 11);
  }
  need(file, v.profitability, ['rows', 'total'], 'profitability');
  need(file, v.receivables, ['rows', 'total', 'largestByReason'], 'receivables');
  needArray(file, v.receivables.rows, 'receivables.rows', 1);
  need(file, v.overview, ['sales', 'delivery', 'profit', 'receivables', 'workingCapital'], 'overview');
  needMonthly(file, v.monthly, 'monthly');
}

export function validateVertical(file: string, v: unknown): void {
  need(file, v, ['meta', 'slug', 'name', 'headline', 'sales', 'pl', 'targets', 'inventory', 'unbilled', 'receivables', 'monthly', 'sources', 'definitions']);
  needMeta(file, v.meta);
  need(file, v.sales, ['engineers', 'sheetTotal', 'attributedTotal', 'byProduct'], 'sales');
  needArray(file, v.sales.engineers, 'sales.engineers', 1);
  for (const e of v.sales.engineers) {
    need(file, e, ['engineer', 'slug', 'homeVertical', 'products', 'ytdRevenue', 'roiYtd', 'ctcAnnual'], 'sales.engineers[]');
    needArray(file, e.products, 'sales.engineers[].products');
  }
  needArray(file, v.pl, 'pl', 11);
  need(file, v.inventory, ['lines', 'total', 'inTransit'], 'inventory');
  need(file, v.unbilled, ['projects', 'bridge'], 'unbilled');
  need(file, v.receivables, ['rows', 'byEngineer', 'total', 'reasons'], 'receivables');
  needArray(file, v.receivables.rows, 'receivables.rows');
  for (const r of v.receivables.rows) need(file, r, ['customer', 'terms', 'termsDays', 'totalOutstanding', 'pastDue', 'notYetDue', 'reason', 'currentRemark'], 'receivables.rows[]');
  needMonthly(file, v.monthly, 'monthly');
}

export function validateEngineer(file: string, v: unknown): void {
  need(file, v, ['meta', 'slug', 'name', 'vertical', 'headline', 'sales', 'monthly', 'targets', 'unbilled', 'receivables', 'peers', 'sources', 'definitions']);
  needMeta(file, v.meta);
  need(file, v.vertical, ['slug', 'name'], 'vertical');
  need(file, v.sales, ['products', 'ytdRevenue', 'roiYtd', 'ctcYtd'], 'sales');
  needArray(file, v.sales.products, 'sales.products', 1);
  need(file, v.receivables, ['rows', 'total', 'reasons'], 'receivables');
  needMonthly(file, v.monthly, 'monthly');
}

export function validateIndex(file: string, v: unknown): void {
  needArray(file, v, 'root', 1);
  for (const e of v) need(file, e, ['slug', 'name', 'file', 'engineers'], 'root[]');
}

export function validateReconciliation(file: string, v: unknown): void {
  need(file, v, ['checkedAt', 'policy', 'assertions', 'passed', 'failed']);
  needArray(file, v.assertions, 'assertions', 1);
  for (const a of v.assertions) need(file, a, ['id', 'statement', 'left', 'right', 'pass'], 'assertions[]');
}
