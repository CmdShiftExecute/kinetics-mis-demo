interface Props {
  /** Label of the first column, e.g. "Engineer and product" or "Product line". */
  firstLabel: string;
  /** Near-month label, e.g. "Sep". */
  nearMonth: string;
  /** Rest-of-year label, e.g. "Oct to Dec". */
  restLabel: string;
}

/**
 * The grouped two-tier header for the sales performance grid. One producer,
 * used by the vertical page and the engineer page, so the two can never
 * disagree on column order.
 */
export function SalesHead({ firstLabel, nearMonth, restLabel }: Props) {
  return (
    <thead>
      <tr>
        <th />
        <th className="group" colSpan={2}>
          Orders
        </th>
        <th className="group" colSpan={3}>
          YTD actual
        </th>
        <th className="group" colSpan={3}>
          YTD budget
        </th>
        <th className="group" colSpan={4}>
          Forecast
        </th>
        <th className="group" colSpan={2}>
          FY budget
        </th>
        <th className="group" colSpan={2}>
          Prior year
        </th>
        <th className="group" colSpan={4}>
          ROI
        </th>
      </tr>
      <tr>
        <th>{firstLabel}</th>
        <th>Open</th>
        <th>Expected</th>
        <th>Revenue</th>
        <th>GM</th>
        <th>GM %</th>
        <th>Revenue</th>
        <th>GM</th>
        <th>GM %</th>
        <th>{nearMonth}</th>
        <th>{restLabel}</th>
        <th>FY revenue</th>
        <th>FY GM</th>
        <th>Revenue</th>
        <th>GM</th>
        <th>Revenue</th>
        <th>GM</th>
        <th>Prior yr</th>
        <th>YTD</th>
        <th>Budget</th>
        <th>Forecast</th>
      </tr>
    </thead>
  );
}
