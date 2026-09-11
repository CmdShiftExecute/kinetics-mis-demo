import type { Meta } from '../../data/schema';

/** The document stamp: reporting period, data as of (GST), revision, unit. */
export function Stamp({ meta }: { meta: Meta }) {
  return (
    <dl className="stamp" aria-label="Document stamp">
      <dt className="k">Reporting period</dt>
      <dd className="v">
        FY{meta.fiscalYear}, {meta.periodLabel}
      </dd>
      <dt className="k">Data as of</dt>
      <dd className="v">{meta.dataAsOfLabel}</dd>
      <dt className="k">Revision</dt>
      <dd className="v">{meta.revision}</dd>
      <dt className="k">Unit</dt>
      <dd className="v">
        {meta.currency} {meta.unit}s
      </dd>
      <span className="xh" aria-hidden="true" />
    </dl>
  );
}
