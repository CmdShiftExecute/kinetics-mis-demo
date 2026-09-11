import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
      <p className="bracket">[ No such page ]</p>
      <h1 className="display" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', margin: 'var(--s-md) 0' }}>
        Nothing here
      </h1>
      <Link to="/" className="drill-link press">
        Back to the front page
      </Link>
    </div>
  );
}
