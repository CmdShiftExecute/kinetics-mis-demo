import type { MonthPoint } from '../../data/schema';
import { AED_COMPACT_GUIDE, cx, k, signedK } from '../lib/format';

/**
 * The exact monthly figures behind whichever view of the chart is on screen. It
 * sits outside the view switch on purpose: the numbers do not change when the
 * drawing does, and a reader who wants a value should never have to find the
 * right view first.
 */
export function MonthlyValues({ points, year, id }: { points: MonthPoint[]; year: number; id: string }) {
  return (
    <details className="values" id={`${id}-values`}>
      <summary>Monthly values, {AED_COMPACT_GUIDE}</summary>
      <table className="mis compact">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col" className="left">
              Basis
            </th>
            <th scope="col">Revenue</th>
            <th scope="col">Budget</th>
            <th scope="col">Variance</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.index}>
              <td>
                {p.month} {year}
              </td>
              <td className="left muted">{p.actual != null ? 'Actual' : 'Forecast'}</td>
              <td className="num">{k(p.actual ?? p.forecast ?? 0)}</td>
              <td className="num">{k(p.budget)}</td>
              <td className={cx('num', p.variance < 0 && 'bad')}>{signedK(p.variance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
