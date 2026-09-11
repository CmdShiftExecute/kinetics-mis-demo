import type { EngineerRow, ProductRow } from '../../data/schema';
import { mult, pct } from '../lib/format';
import { Num } from './Num';

/** The sixteen numeric columns of the sales grid, in header order. */
export function NumericCells({ r, prefix }: { r: ProductRow | EngineerRow; prefix: string }) {
  const h = (i: number) => `${prefix}-${i}`;
  return (
    <>
      <Num v={r.openOrders} headers={h(1)} />
      <Num v={r.expectedOrders} headers={h(2)} />
      <Num v={r.ytdRevenue} headers={h(3)} />
      <Num v={r.ytdGm} headers={h(4)} />
      <Num v={r.ytdGmPct} f={pct} headers={h(5)} />
      <Num v={r.ytdBudgetRevenue} headers={h(6)} />
      <Num v={r.ytdBudgetGm} headers={h(7)} />
      <Num v={r.budgetGmPct} f={pct} headers={h(8)} />
      <Num v={r.nearMonthForecast} headers={h(9)} />
      <Num v={r.restOfYearForecast} headers={h(10)} />
      <Num v={r.fyForecastRevenue} headers={h(11)} />
      <Num v={r.fyForecastGm} headers={h(12)} />
      <Num v={r.fyBudgetRevenue} headers={h(13)} />
      <Num v={r.fyBudgetGm} headers={h(14)} />
      <Num v={r.priorYearRevenue} headers={h(15)} />
      <Num v={r.priorYearGm} headers={h(16)} />
    </>
  );
}

/** The four ROI columns. ROI is per engineer; product rows render NoRoiCells instead. */
export function RoiCells({ r, prefix }: { r: EngineerRow; prefix: string }) {
  const h = (i: number) => `${prefix}-${i}`;
  return (
    <>
      <Num v={r.roiPriorYear} f={mult} headers={h(17)} />
      <Num v={r.roiYtd} f={mult} bad={r.roiYtd < r.roiBudget * 0.85} headers={h(18)} />
      <Num v={r.roiBudget} f={mult} headers={h(19)} />
      <Num v={r.roiForecast} f={mult} bad={r.roiForecast < r.roiBudget * 0.85} headers={h(20)} />
    </>
  );
}

/** Product lines have no ROI: cost to employ is held per engineer, not per line. */
export function NoRoiCells({ prefix }: { prefix: string }) {
  return (
    <td colSpan={4} className="num muted" headers={`${prefix}-17 ${prefix}-18 ${prefix}-19 ${prefix}-20`}>
      n/a, ROI is per engineer
    </td>
  );
}
