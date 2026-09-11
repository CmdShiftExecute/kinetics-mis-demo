import type { Meta } from '../../data/schema';

export function Footer({ meta }: { meta: Meta }) {
  return (
    <footer className="foot">
      <span>
        Source: {meta.company}, {meta.division} net profit MIS, FY{meta.fiscalYear}, revision {meta.revision}
      </span>
      <span>Data as of {meta.dataAsOfLabel}. Synthetic demonstration data.</span>
    </footer>
  );
}
