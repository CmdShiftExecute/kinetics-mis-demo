/**
 * Cross-table reconciliation of the WRITTEN data files.
 *
 * Run:  bun scripts/reconcile.ts
 * Out:  public/data/reconciliation.json, exit 1 if any assertion fails.
 *
 * The generator asserts its own arithmetic in memory; this script re-reads
 * the JSON the browser will read and checks that every independently
 * published figure ties to every other one. The result is shown on the
 * Data basis page, so the reader sees the machine's own check.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gstStamp } from '../data/gst';
import type { Assertion, EngineerData, PlRungKey, Reconciliation, Rollup, VerticalData, VerticalIndexEntry } from '../data/schema';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');
const read = <T,>(rel: string): T => JSON.parse(readFileSync(join(dataDir, rel), 'utf8')) as T;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);


const rollup = read<Rollup>('rollup.json');
const index = read<VerticalIndexEntry[]>('index.json');
const verticals = index.map((v) => read<VerticalData>(v.file));
const engineers = index.flatMap((v) => v.engineers.map((e) => read<EngineerData>(`engineers/${e.slug}.json`)));

const assertions: Assertion[] = [];
const eq = (id: string, statement: string, left: number, right: number) => assertions.push({ id, statement, left, right, pass: left === right });

const m = rollup.meta.monthsElapsed;
const totalPl = rollup.pl.find((g) => g.key === 'total')!.rungs;
const rung = (k: PlRungKey) => totalPl.find((r) => r.key === k)!;

/* Division level */
eq('sales-rows-total', 'Sales rows sum to the netted division total (YTD revenue)', sum(rollup.sales.rows.map((r) => r.ytdRevenue)), rollup.sales.total.ytdRevenue);
eq('sales-netting', 'Sales total equals the netted YTD figure in the netting note', rollup.sales.total.ytdRevenue, rollup.sales.netting.nettedYtd);
eq('netting-gross', 'Netted YTD plus double-counted YTD equals the gross sheet sum', rollup.sales.netting.nettedYtd + rollup.sales.netting.doubleCountedYtd, rollup.sales.netting.grossSumYtd);
eq('sales-subtotal', 'Subtotal excluding the largest vertical plus the largest vertical equals the total (YTD revenue)', rollup.sales.subtotalExcludingLargest.ytdRevenue + rollup.sales.rows.find((r) => r.slug === rollup.largestVertical.slug)!.ytdRevenue, rollup.sales.total.ytdRevenue);
eq('sales-pl-revenue', 'Sales YTD revenue equals P&L YTD revenue', rollup.sales.total.ytdRevenue, rung('revenue').ytd);
eq('sales-pl-gm', 'Sales YTD gross margin equals P&L YTD gross margin', rollup.sales.total.ytdGm, rung('grossMargin').ytd);
eq('monthly-ytd', 'Monthly actuals sum to sales YTD revenue', sum(rollup.monthly.slice(0, m).map((p) => p.actual ?? 0)), rollup.sales.total.ytdRevenue);
eq('monthly-forecast', 'Monthly forecasts sum to the near-month plus rest-of-year forecast', sum(rollup.monthly.slice(m).map((p) => p.forecast ?? 0)), rollup.forecast.total.nearMonthForecast + rollup.forecast.total.restOfYearForecast);
eq('monthly-budget', 'Monthly budgets sum to the FY budget', sum(rollup.monthly.map((p) => p.budget)), rollup.forecast.total.fyBudget);
eq('forecast-components', 'YTD actual plus near-month plus rest-of-year equals FY forecast', rollup.forecast.total.ytdRevenue + rollup.forecast.total.nearMonthForecast + rollup.forecast.total.restOfYearForecast, rollup.forecast.total.fyForecast);
eq('forecast-rows-total', 'Forecast rows sum to the division FY forecast', sum(rollup.forecast.rows.map((r) => r.fyForecast)), rollup.forecast.total.fyForecast);
eq('forecast-sales-ytd', 'Forecast table YTD equals sales table YTD', rollup.forecast.total.ytdRevenue, rollup.sales.total.ytdRevenue);
eq('forecast-pl', 'FY forecast revenue equals P&L forecast revenue', rollup.forecast.total.fyForecast, rung('revenue').forecast);
eq('budget-pl', 'FY budget revenue equals P&L budget revenue', rollup.forecast.total.fyBudget, rung('revenue').budget);
eq('profitability-pl', 'Profitability total FY revenue equals P&L forecast revenue', rollup.profitability.total.fyRevenue, rung('revenue').forecast);
eq('profitability-np', 'Profitability total FY net profit equals P&L forecast BU-level net profit', rollup.profitability.total.fyNp, rung('buNetProfit').forecast);
eq('profitability-rows', 'Profitability rows sum to the total (FY net profit)', sum(rollup.profitability.rows.map((r) => r.fyNp)), rollup.profitability.total.fyNp);
eq('shares-100', 'Revenue shares sum to 100.0 (tenths)', Math.round(sum(rollup.profitability.rows.map((r) => r.revenueShare)) * 10), 1000);
for (const r of totalPl) {
  if (r.isPercent) continue;
  const a = rollup.pl[0]!.rungs.find((x) => x.key === r.key)!;
  const b = rollup.pl[1]!.rungs.find((x) => x.key === r.key)!;
  for (const col of ['ytd', 'forecast', 'budget'] as const) eq(`pl-groups-${r.key}-${col}`, `P&L ${r.label}, ${col}: excluding largest plus largest equals total`, a[col] + b[col], r[col]);
}
eq('pl-bu-profitability', 'P&L BU profitability equals gross margin less the four operating cost lines (YTD)', rung('grossMargin').ytd - rung('salaryCtc').ytd - rung('warehouseCost').ytd - rung('warehouseSalaries').ytd - rung('commonAdmin').ytd, rung('buProfitability').ytd);
eq('pl-bu-np', 'P&L BU-level net profit equals BU profitability less provisions and corporate overhead (YTD)', rung('buProfitability').ytd - rung('provisionsInterCo').ytd - rung('corporateOverhead').ytd, rung('buNetProfit').ytd);
eq('receivables-rows-net', 'Receivables rows sum to the division net to collect', sum(rollup.receivables.rows.map((r) => r.currentMonth)), rollup.receivables.total.currentMonth);
eq('receivables-change', 'Division net to collect change equals current less previous month', rollup.receivables.total.currentMonth - rollup.receivables.total.previousMonth, rollup.receivables.total.change);
eq('receivables-net-def', 'Net to collect equals total outstanding less provision', rollup.receivables.total.totalOutstanding - rollup.receivables.total.provision, rollup.receivables.total.currentMonth);
eq('receivables-due-split', 'Not yet due plus past due equals total outstanding', rollup.receivables.total.notYetDue + rollup.receivables.total.pastDue, rollup.receivables.total.totalOutstanding);
{
  const rs = rollup.receivables.total.reasons;
  eq('reasons-sum', 'The three reasons for non-collection sum to total outstanding', rs.internalGroup + rs.followUpNoResponse + rs.disputesAndNotDue, rollup.receivables.total.totalOutstanding);
  eq('reasons-split', 'Disputed plus within terms equals the disputes-and-not-due bucket', rs.disputed + rs.withinTerms, rs.disputesAndNotDue);
}
eq('unbilled-rows', 'Unbilled rows sum to the division current month', sum(rollup.unbilled.rows.map((r) => r.currentMonth)), rollup.unbilled.total.currentMonth);
eq('unbilled-bridge', 'Division unbilled bridge reconciles', rollup.unbilled.total.previousMonth + rollup.unbilled.total.newProjects - rollup.unbilled.total.clearedProjects + rollup.unbilled.total.ongoingChanges, rollup.unbilled.total.currentMonth);
eq('inventory-rows', 'Inventory rows sum to the division total stock', sum(rollup.inventory.rows.map((r) => r.totalStock)), rollup.inventory.total.totalStock);
eq('inventory-bands', 'Division inventory age bands sum to total stock', rollup.inventory.total.underOneYear + rollup.inventory.total.oneToTwoYears + rollup.inventory.total.twoToThreeYears + rollup.inventory.total.overThreeYears, rollup.inventory.total.totalStock);
eq('inventory-free', 'Division free stock equals total stock less stock mapped to purchase orders', rollup.inventory.total.totalStock - rollup.inventory.total.mappedToPurchaseOrders, rollup.inventory.total.freeStock);
eq('wc-total', 'Working capital total equals net receivables plus unbilled plus stock', rollup.workingCapital.total.receivablesNet + rollup.workingCapital.total.unbilled + rollup.workingCapital.total.inventoryStock, rollup.workingCapital.total.total);
eq('wc-receivables', 'Working capital receivables equal the receivables table net to collect', rollup.workingCapital.total.receivablesNet, rollup.receivables.total.currentMonth);
eq('overview-sales', 'Overview sales revenue equals the sales table total', rollup.overview.sales.ytdRevenue, rollup.sales.total.ytdRevenue);
eq('overview-delivery', 'Overview FY forecast equals the forecast table total', rollup.overview.delivery.fyForecast, rollup.forecast.total.fyForecast);
eq('overview-np', 'Overview FY forecast net profit equals the P&L rung', rollup.overview.profit.forecast.buNetProfit, rung('buNetProfit').forecast);
eq('overview-receivables', 'Overview net to collect equals the receivables table total', rollup.overview.receivables.currentMonth, rollup.receivables.total.currentMonth);

/* Vertical level */
for (const v of verticals) {
  const srow = rollup.sales.rows.find((r) => r.slug === v.slug)!;
  const frow = rollup.forecast.rows.find((r) => r.slug === v.slug)!;
  const prow = rollup.profitability.rows.find((r) => r.slug === v.slug)!;
  const rrow = rollup.receivables.rows.find((r) => r.slug === v.slug)!;
  const urow = rollup.unbilled.rows.find((r) => r.slug === v.slug)!;
  const irow = rollup.inventory.rows.find((r) => r.slug === v.slug)!;
  const own = v.sales.engineers.filter((e) => !e.fromOtherVertical);
  const np = v.pl.find((r) => r.key === 'buNetProfit')!;
  eq(`${v.slug}-attributed-sales`, `${v.name}: attributed YTD revenue equals the summary sales row`, v.sales.attributedTotal.ytdRevenue, srow.ytdRevenue);
  eq(`${v.slug}-attributed-forecast`, `${v.name}: attributed FY forecast equals the summary forecast row`, v.sales.attributedTotal.fyForecastRevenue, frow.fyForecast);
  eq(`${v.slug}-engineers-sum`, `${v.name}: own engineer rows sum to the attributed total (YTD revenue)`, sum(own.map((e) => e.ytdRevenue)), v.sales.attributedTotal.ytdRevenue);
  eq(`${v.slug}-sheet-vs-attributed`, `${v.name}: sheet total less shared rows equals the attributed total`, v.sales.sheetTotal.ytdRevenue - sum(v.sales.engineers.filter((e) => e.fromOtherVertical).map((e) => e.ytdRevenue)), v.sales.attributedTotal.ytdRevenue);
  for (const e of v.sales.engineers) eq(`${v.slug}-${e.slug}-products`, `${v.name}: ${e.engineer}'s product rows sum to the engineer row (YTD revenue)`, sum(e.products.map((p) => p.ytdRevenue)), e.ytdRevenue);
  eq(`${v.slug}-by-product`, `${v.name}: product-line sub-totals sum to the sheet total (YTD revenue)`, sum(v.sales.byProduct.map((p) => p.ytdRevenue)), v.sales.sheetTotal.ytdRevenue);
  eq(`${v.slug}-pl-revenue`, `${v.name}: P&L YTD revenue equals attributed YTD revenue`, v.pl.find((r) => r.key === 'revenue')!.ytd, v.sales.attributedTotal.ytdRevenue);
  eq(`${v.slug}-pl-gm`, `${v.name}: P&L YTD gross margin equals attributed YTD gross margin`, v.pl.find((r) => r.key === 'grossMargin')!.ytd, v.sales.attributedTotal.ytdGm);
  eq(`${v.slug}-pl-np`, `${v.name}: P&L forecast net profit equals the profitability row`, np.forecast, prow.fyNp);
  eq(`${v.slug}-monthly`, `${v.name}: monthly actuals sum to YTD revenue`, sum(v.monthly.slice(0, m).map((p) => p.actual ?? 0)), v.sales.attributedTotal.ytdRevenue);
  eq(`${v.slug}-headline-np`, `${v.name}: headline net profit equals the P&L rung`, v.headline.buNetProfitYtd, np.ytd);
  eq(`${v.slug}-receivables-total`, `${v.name}: customer rows sum to the vertical net to collect`, sum(v.receivables.rows.map((r) => r.netToCollect)), v.receivables.total.netToCollect);
  eq(`${v.slug}-receivables-summary`, `${v.name}: vertical net to collect equals the summary receivables row`, v.receivables.total.netToCollect, rrow.currentMonth);
  eq(`${v.slug}-receivables-engineers`, `${v.name}: engineer subtotals sum to the vertical total outstanding`, sum(v.receivables.byEngineer.map((e) => e.totalOutstanding)), v.receivables.total.totalOutstanding);
  eq(`${v.slug}-receivables-reasons`, `${v.name}: reasons sum to total outstanding`, v.receivables.reasons.internalGroup + v.receivables.reasons.followUpNoResponse + v.receivables.reasons.disputesAndNotDue, v.receivables.total.totalOutstanding);
  for (const r of v.receivables.rows) {
    eq(`${v.slug}-${r.engineerSlug}-${r.customer.replace(/\W+/g, '-').toLowerCase()}-buckets`, `${v.name}: ${r.customer} aging buckets sum to total outstanding`, r.bucket0to30 + r.bucket31to90 + r.bucket91to365 + r.bucket1to2y + r.bucketOver2y, r.totalOutstanding);
  }
  eq(`${v.slug}-unbilled-bridge`, `${v.name}: unbilled bridge reconciles`, v.unbilled.bridge.previousMonth + v.unbilled.bridge.newProjects - v.unbilled.bridge.clearedProjects + v.unbilled.bridge.ongoingChanges, v.unbilled.bridge.currentMonth);
  eq(`${v.slug}-unbilled-summary`, `${v.name}: unbilled current month equals the summary unbilled row`, v.unbilled.bridge.currentMonth, urow.currentMonth);
  for (const p of v.unbilled.projects) {
    const a = p.aging;
    eq(`${v.slug}-${p.ref}-aging`, `${v.name}: ${p.ref} unbilled aging bands sum to its current balance`, a.le60 + a.d61to90 + a.d91to120 + a.d121to180 + a.d181to365 + a.d366to545 + a.d546to730 + a.over730, p.trend[2]);
  }
  eq(`${v.slug}-inventory-lines`, `${v.name}: inventory lines sum to the vertical total stock`, sum(v.inventory.lines.map((l) => l.totalStock)), v.inventory.total.totalStock);
  eq(`${v.slug}-inventory-summary`, `${v.name}: inventory total equals the summary inventory row`, v.inventory.total.totalStock, irow.totalStock);
  eq(`${v.slug}-inventory-bands`, `${v.name}: inventory age bands sum to total stock`, v.inventory.total.underOneYear + v.inventory.total.oneToTwoYears + v.inventory.total.twoToThreeYears + v.inventory.total.overThreeYears, v.inventory.total.totalStock);
  for (const t of v.targets) eq(`${v.slug}-target-${t.productLine.replace(/\W+/g, '-').toLowerCase()}`, `${v.name}: ${t.productLine} achieved less budget to date equals the stated variance`, t.achieved - t.budgetToDate, t.achievedVsBudgetToDate);
  if (v.production) eq(`${v.slug}-production`, `${v.name}: production value ties to YTD revenue`, v.production.total.value, v.sales.attributedTotal.ytdRevenue);
}

/* Engineer level */
for (const e of engineers) {
  const v = verticals.find((x) => x.slug === e.vertical.slug)!;
  const row = v.sales.engineers.find((x) => x.slug === e.slug)!;
  eq(`${e.slug}-sales`, `${e.name}: engineer file YTD revenue equals the vertical sheet row`, e.sales.ytdRevenue, row.ytdRevenue);
  eq(`${e.slug}-monthly`, `${e.name}: monthly actuals sum to YTD revenue`, sum(e.monthly.slice(0, m).map((p) => p.actual ?? 0)), e.sales.ytdRevenue);
  eq(`${e.slug}-receivables`, `${e.name}: customer rows sum to the engineer total outstanding`, sum(e.receivables.rows.map((r) => r.totalOutstanding)), e.receivables.total.totalOutstanding);
  eq(`${e.slug}-receivables-vertical`, `${e.name}: engineer receivables equal the vertical's engineer subtotal`, e.receivables.total.netToCollect, v.receivables.byEngineer.find((x) => x.slug === e.slug)!.netToCollect);
  eq(`${e.slug}-contribution`, `${e.name}: direct contribution equals YTD gross margin less YTD cost to employ`, e.sales.ytdGm - e.sales.ctcYtd, e.headline.directContributionYtd);
  eq(`${e.slug}-bridge`, `${e.name}: unbilled bridge reconciles`, e.unbilled.bridge.previousMonth + e.unbilled.bridge.newProjects - e.unbilled.bridge.clearedProjects + e.unbilled.bridge.ongoingChanges, e.unbilled.bridge.currentMonth);
}
{
  const split = Object.values(rollup.engineerSplit).flat();
  eq('engineer-split-total', 'Engineer split rows sum to the netted division YTD revenue', sum(split.map((s) => s.ytdRevenue)), rollup.sales.total.ytdRevenue);
}

const failed = assertions.filter((a) => !a.pass);
const out: Reconciliation = { checkedAt: gstStamp(), policy: rollup.precisionPolicy, assertions, passed: assertions.length - failed.length, failed: failed.length };
// Rewrite only when the result changed, so a re-run on a deployed tree leaves it clean.
const target = join(dataDir, 'reconciliation.json');
let previous: Reconciliation | null = null;
try {
  previous = JSON.parse(readFileSync(target, 'utf8')) as Reconciliation;
} catch {
  previous = null;
}
const same = previous && JSON.stringify(previous.assertions) === JSON.stringify(out.assertions) && JSON.stringify(previous.policy) === JSON.stringify(out.policy);
if (!same) writeFileSync(target, JSON.stringify(out, null, 1));
else console.log('Reconciliation result unchanged; file not rewritten.');
console.log(`Reconciliation: ${out.passed} of ${assertions.length} assertions pass.`);
for (const f of failed) console.error(`FAIL  ${f.id}: ${f.statement} (${f.left} vs ${f.right})`);
if (failed.length) process.exit(1);
