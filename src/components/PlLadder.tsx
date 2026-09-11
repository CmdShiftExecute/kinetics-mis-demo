import { useState } from 'react';
import type { PlGroup, PlRung, PlRungKey } from '../../data/schema';
import { cx, k, pct, pts, signedK } from '../lib/format';

interface Props {
  groups: PlGroup[];
  cols: { ytd: string; forecast: string; budget: string };
  /** Show a forecast-versus-budget column: after every group, or after the last group only. */
  showVariance?: 'all' | 'last';
}

const fmt = (r: PlRung, v: number) => (r.isPercent ? pct(v) : k(v));
const isBad = (r: PlRung, v: number) => (r.key === 'buProfitability' || r.key === 'buNetProfit' || r.key === 'grossMargin') && v < 0;

/**
 * The P&L ladder, revenue down to BU-level net profit. Hover or focus a rung
 * and the rail explains what it means and which table feeds it. The rail is
 * a supplement: every definition is also in the section's disclosure.
 */
export function PlLadder({ groups, cols, showVariance }: Props) {
  const [active, setActive] = useState<PlRungKey | null>(null);
  const first = groups[0]!;
  const rung = active ? first.rungs.find((r) => r.key === active) : undefined;
  const totalGroup = groups[groups.length - 1]!;
  const totalRung = rung ? totalGroup.rungs.find((r) => r.key === rung.key) : undefined;
  const lastKey = totalGroup.key;
  const spanOf = (key: string) => (showVariance === 'all' || (showVariance === 'last' && key === lastKey) ? 4 : 3);

  return (
    <div className="pl">
      <div className="scroll-x">
        <table className="mis">
          <thead>
            {groups.length > 1 && (
              <tr>
                <td className="blank" />
                {groups.map((g) => (
                  <th key={g.key} className="group" scope="colgroup" colSpan={spanOf(g.key)}>
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th scope="col">Line</th>
              {groups.map((g) => (
                <Heads key={g.key} cols={cols} showVariance={spanOf(g.key) === 4} />
              ))}
            </tr>
          </thead>
          <tbody>
            {first.rungs.map((r) => (
              <tr
                key={r.key}
                className={cx('rung', r.subtotal && 'sub', active === r.key && 'active')}
                tabIndex={0}
                onMouseEnter={() => setActive(r.key)}
                onFocus={() => setActive(r.key)}
                aria-describedby="pl-rail"
              >
                <th scope="row">{r.label}</th>
                {groups.map((g) => {
                  const gr = g.rungs.find((x) => x.key === r.key)!;
                  return <RungCells key={g.key} r={gr} showVariance={spanOf(g.key) === 4} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="pl-rail" id="pl-rail" aria-live="polite">
        {rung ? (
          <>
            <p className="label">Line</p>
            <h3>{rung.label}</h3>
            <p>{rung.definition}</p>
            <p className="label">Fed by</p>
            <p>{rung.feeds}</p>
            {totalRung && (
              <dl className="vals">
                <dt>{cols.ytd}</dt>
                <dd className="num">{fmt(totalRung, totalRung.ytd)}</dd>
                <dt>{cols.forecast}</dt>
                <dd className="num">{fmt(totalRung, totalRung.forecast)}</dd>
                <dt>{cols.budget}</dt>
                <dd className="num">{fmt(totalRung, totalRung.budget)}</dd>
                <dt>Forecast vs budget</dt>
                <dd className={cx('num', totalRung.dForecastVsBudget < 0 && 'bad')}>{totalRung.isPercent ? pts(totalRung.dForecastVsBudget) : signedK(totalRung.dForecastVsBudget)}</dd>
              </dl>
            )}
          </>
        ) : (
          <>
            <p className="label">Definitions</p>
            <p style={{ marginTop: 'var(--s-md)' }}>Hover or tab to any line of the ladder to see what it means and which table feeds it.</p>
            <p className="muted">Costs below gross margin are synthetic ratios of revenue; the forecast column annualises the elapsed months. No phased profit budget exists, so profit is compared full year to full year.</p>
          </>
        )}
      </aside>
    </div>
  );
}

function Heads({ cols, showVariance }: { cols: Props['cols']; showVariance?: boolean }) {
  return (
    <>
      <th scope="col">{cols.ytd}</th>
      <th scope="col">{cols.forecast}</th>
      <th scope="col">{cols.budget}</th>
      {showVariance && <th scope="col">Forecast vs budget</th>}
    </>
  );
}

function RungCells({ r, showVariance }: { r: PlRung; showVariance?: boolean }) {
  return (
    <>
      <td className={cx('num', isBad(r, r.ytd) && 'bad')}>{fmt(r, r.ytd)}</td>
      <td className={cx('num', isBad(r, r.forecast) && 'bad')}>{fmt(r, r.forecast)}</td>
      <td className={cx('num', isBad(r, r.budget) && 'bad')}>{fmt(r, r.budget)}</td>
      {showVariance && <td className={cx('num', r.dForecastVsBudget < 0 && 'bad')}>{r.isPercent ? pts(r.dForecastVsBudget) : signedK(r.dForecastVsBudget)}</td>}
    </>
  );
}
