import { Link } from 'react-router';
import { NAV } from '../lib/nav';

export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
      <p className="label">No such page</p>
      <h1 className="display page-title" style={{ margin: 'var(--s-md) 0' }}>
        Nothing here
      </h1>
      <p>The address does not match a report, a vertical, a customer table or an engineer page. The reports are:</p>
      <nav className="vnav" aria-label="Reports">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to}>
            {n.label}
          </Link>
        ))}
      </nav>
      <Link to="/" className="drill-link press">
        Back to the overview
      </Link>
    </div>
  );
}
