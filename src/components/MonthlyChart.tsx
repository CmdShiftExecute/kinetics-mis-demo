import type { MonthPoint } from '../../data/schema';
import { ChartSwitch } from './ChartSwitch';
import { MonthlyLine } from './MonthlyLine';
import { MonthlyBars } from './MonthlyBars';
import { MonthlyValues } from './MonthlyValues';

/**
 * The twelve-month series with its three readings behind one switch, and the
 * exact figures underneath in a table that does not change with the view.
 *
 * Trend line answers "what is the shape of the year", columns answer "how did
 * each month do against its own budget", cumulative answers "are we ahead of
 * plan". They are three different questions, which is the test for whether a
 * second view earns its place.
 */
export function MonthlyChart({ points, year, subject, id, height = 230 }: { points: MonthPoint[]; year: number; subject: string; id: string; height?: number }) {
  return (
    <>
      <ChartSwitch
        id={`${id}-monthly`}
        views={[
          { key: 'line', label: 'Trend line', icon: 'line', render: () => <MonthlyLine points={points} year={year} subject={subject} id={id} height={height} /> },
          { key: 'columns', label: 'Monthly columns', icon: 'columns', render: () => <MonthlyBars points={points} year={year} subject={subject} id={`${id}-col`} mode="columns" height={height + 20} /> },
          { key: 'cumulative', label: 'Cumulative to plan', icon: 'area', render: () => <MonthlyBars points={points} year={year} subject={subject} id={`${id}-cum`} mode="cumulative" height={height + 20} /> },
        ]}
      />
      <MonthlyValues points={points} year={year} id={id} />
    </>
  );
}
