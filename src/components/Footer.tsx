import type { Meta } from '../../data/schema';
import { Link } from 'react-router';

export function Footer({ meta }: { meta: Meta }) {
  return (
    <footer className="foot">
      <span>
        {meta.company}, {meta.division}. Net profit MIS FY{meta.fiscalYear}, revision {meta.revision}. Data as of {meta.dataAsOfLabel}.
      </span>
      <span>
        Synthetic demonstration data. <Link to="/data-basis">Sources, definitions and reconciliation</Link>
      </span>
    </footer>
  );
}
