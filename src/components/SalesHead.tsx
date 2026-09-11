interface Props {
  /** Unique prefix for header ids on this table, so cells can name their headers. */
  prefix: string;
  /** Label of the first column, e.g. "Engineer and product line" or "Product line". */
  firstLabel: string;
  nearMonth: string;
  restLabel: string;
}

const SALES_COLS = [
  'Open',
  'Expected',
  'Revenue',
  'GM',
  'GM %',
  'Revenue',
  'GM',
  'GM %',
  'nearMonth',
  'restLabel',
  'FY revenue',
  'FY GM',
  'Revenue',
  'GM',
  'Revenue',
  'GM',
  'Prior yr',
  'YTD',
  'Budget',
  'Forecast',
] as const;

const GROUPS: { label: string; span: number }[] = [
  { label: 'Orders', span: 2 },
  { label: 'YTD actual', span: 3 },
  { label: 'YTD budget', span: 3 },
  { label: 'Forecast', span: 4 },
  { label: 'FY budget', span: 2 },
  { label: 'Prior year', span: 2 },
  { label: 'ROI', span: 4 },
];

/**
 * The grouped two-tier header for the sales performance grid. One producer,
 * used by the vertical page and the engineer page, so the two can never
 * disagree on column order. Group headers carry scope="colgroup", leaf headers
 * carry ids that the cells reference.
 */
export function SalesHead({ prefix, firstLabel, nearMonth, restLabel }: Props) {
  return (
    <thead>
      <tr>
        <td className="sticky-first blank" />
        {GROUPS.map((g) => (
          <th key={g.label} className="group" scope="colgroup" colSpan={g.span}>
            {g.label}
          </th>
        ))}
      </tr>
      <tr>
        <th scope="col" id={`${prefix}-0`} className="sticky-first">
          {firstLabel}
        </th>
        {SALES_COLS.map((c, i) => (
          <th scope="col" id={`${prefix}-${i + 1}`} key={i}>
            {c === 'nearMonth' ? nearMonth : c === 'restLabel' ? restLabel : c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
