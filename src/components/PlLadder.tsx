import { useState } from 'react';
import { motion } from 'motion/react';
import type { PlGroup, PlRung, PlRungKey } from '../../data/schema';
import { cx, k, pct } from '../lib/format';
import { useRowReveal } from './Reveal';

interface Props {
  groups: PlGroup[];
  cols: { ytd: string; forecast: string; budget: string };
  tip: string;
}

const fmt = (r: PlRung, v: number) => (r.isPercent ? pct(v) : k(v));
const isBad = (r: PlRung, v: number) => (r.key === 'buProfitability' || r.key === 'buNetProfit' || r.key === 'grossMargin') && v < 0;

/**
 * The P&L ladder, revenue down to BU-level net profit. Hover or focus a rung
 * and the rail explains what it means and which table feeds it.
 */
export function PlLadder({ groups, cols, tip }: Props) {
  const [active, setActive] = useState<PlRungKey | null>(null);
  const rowReveal = useRowReveal();
  const first = groups[0]!;
  const rung = active ? first.rungs.find((r) => r.key === active) : undefined;
  const totalGroup = groups[groups.length - 1]!;
  const totalRung = rung ? totalGroup.rungs.find((r) => r.key === rung.key) : undefined;

  return (
    <div className="pl">
      <div className="scroll-x">
        <table className="mis">
          <thead>
            {groups.length > 1 && (
              <tr>
                <th />
                {groups.map((g) => (
                  <th key={g.key} className="group" colSpan={3}>
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th>Rung</th>
              {groups.map((g) => (
                <MemoHeads key={g.key} cols={cols} />
              ))}
            </tr>
          </thead>
          <tbody>
            {first.rungs.map((r, i) => (
              <motion.tr
                key={r.key}
                className={cx('rung', r.subtotal && 'sub', active === r.key && 'active')}
                tabIndex={0}
                onMouseEnter={() => setActive(r.key)}
                onFocus={() => setActive(r.key)}
                aria-describedby="pl-rail"
                {...rowReveal(i)}
              >
                <td>{r.label}</td>
                {groups.map((g) => {
                  const gr = g.rungs.find((x) => x.key === r.key)!;
                  return (
                    <RungCells key={g.key} r={gr} tip={tip} />
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="pl-rail" id="pl-rail" aria-live="polite">
        {rung ? (
          <>
            <p className="label">Rung</p>
            <h3>{rung.label}</h3>
            <p>{rung.definition}</p>
            <p className="label">Fed by</p>
            <p>{rung.feeds}</p>
            {totalRung && (
              <dl className="vals">
                <dt className="label">{cols.ytd}</dt>
                <dd className="num">{fmt(totalRung, totalRung.ytd)}</dd>
                <dt className="label">{cols.forecast}</dt>
                <dd className="num">{fmt(totalRung, totalRung.forecast)}</dd>
                <dt className="label">{cols.budget}</dt>
                <dd className="num">{fmt(totalRung, totalRung.budget)}</dd>
              </dl>
            )}
          </>
        ) : (
          <>
            <p className="label">Definitions</p>
            <p style={{ marginTop: 'var(--s-md)' }}>Hover or tab to any rung of the ladder to see what it means and which table feeds it.</p>
            <p className="muted">Costs below gross margin are static values from the monthly finance extract. Revenue and margin are live from the sales tables.</p>
          </>
        )}
      </aside>
    </div>
  );
}

function MemoHeads({ cols }: { cols: Props['cols'] }) {
  return (
    <>
      <th>{cols.ytd}</th>
      <th>{cols.forecast}</th>
      <th>{cols.budget}</th>
    </>
  );
}

function RungCells({ r, tip }: { r: PlRung; tip: string }) {
  return (
    <>
      <td className={cx('num', isBad(r, r.ytd) && 'bad')} data-tip={`${tip} Fed by: ${r.feeds}.`}>
        {fmt(r, r.ytd)}
      </td>
      <td className={cx('num', isBad(r, r.forecast) && 'bad')} data-tip={`${tip} Forecast column annualises year-to-date costs.`}>
        {fmt(r, r.forecast)}
      </td>
      <td className={cx('num', isBad(r, r.budget) && 'bad')} data-tip={`${tip} Budget as approved for FY.`}>
        {fmt(r, r.budget)}
      </td>
    </>
  );
}
