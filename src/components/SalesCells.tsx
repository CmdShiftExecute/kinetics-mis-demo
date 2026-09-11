import type { EngineerRow, ProductRow } from '../../data/schema';
import { mult, pct } from '../lib/format';
import { Num } from './Num';

/** The sixteen numeric columns of the sales grid, in header order. */
export function NumericCells({ r, tip }: { r: ProductRow | EngineerRow; tip: string }) {
  return (
    <>
      <Num v={r.openOrders} tip={tip} />
      <Num v={r.expectedOrders} tip={tip} />
      <Num v={r.ytdRevenue} tip={tip} />
      <Num v={r.ytdGm} tip={tip} />
      <Num v={r.ytdGmPct} f={pct} tip={tip} />
      <Num v={r.ytdBudgetRevenue} tip={tip} />
      <Num v={r.ytdBudgetGm} tip={tip} />
      <Num v={r.budgetGmPct} f={pct} tip={tip} />
      <Num v={r.nearMonthForecast} tip={tip} />
      <Num v={r.restOfYearForecast} tip={tip} />
      <Num v={r.fyForecastRevenue} tip={tip} />
      <Num v={r.fyForecastGm} tip={tip} />
      <Num v={r.fyBudgetRevenue} tip={tip} />
      <Num v={r.fyBudgetGm} tip={tip} />
      <Num v={r.priorYearRevenue} tip={tip} />
      <Num v={r.priorYearGm} tip={tip} />
    </>
  );
}

/** The four ROI columns. ROI is per engineer; product rows render an empty span instead. */
export function RoiCells({ r, tip }: { r: EngineerRow; tip: string }) {
  return (
    <>
      <Num v={r.roiPriorYear} f={mult} tip={tip} />
      <Num v={r.roiYtd} f={mult} bad={r.roiYtd < r.roiBudget * 0.85} tip={tip} />
      <Num v={r.roiBudget} f={mult} tip={tip} />
      <Num v={r.roiForecast} f={mult} bad={r.roiForecast < r.roiBudget * 0.85} tip={tip} />
    </>
  );
}

export const ROI_TIP_TEXT = 'ROI is gross margin divided by the engineer’s cost to employ for the same period.';
