import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import type { Meta } from '../../data/schema';
import { NAV } from '../lib/nav';
import { AskLauncher } from './Ask';
import { ThemeControl } from './ThemeControl';

/** Persistent technical masthead: reporting context, modules, theme and report navigation. */
export function Masthead({ meta }: { meta: Meta }) {
  const header = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const navigate = useNavigate();
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    // Clearance includes the existing page/section entrance transforms.
    const measure = () => document.documentElement.style.setProperty('--mast-offset', `${element.getBoundingClientRect().height + 32}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    setSections(Array.from(element.closest('main')?.querySelectorAll<HTMLElement>('section.sec[id]') ?? []).map(section => ({ id: section.id, label: section.querySelector('h2')?.textContent ?? section.id })));
    return () => observer.disconnect();
  }, []);
  return (
    <header className="mast" ref={header}>
      <div className="mast-row">
        <div className="mast-brand">
          <Link to="/" className="wordmark display" aria-label="Halvard, back to the overview">
            Halvard
          </Link>
          <span className="mast-division">{meta.division}</span>
        </div>
        <div className="mast-identity">
          <p className="mast-system display">Management Information System</p>
          <dl className="stamp" aria-label="Reporting stamp">
          <div>
            <dt>Data as of</dt>
            <dd>{meta.dataAsOfLabel}</dd>
          </div>
          </dl>
        </div>
        <div className="mast-tools">
          <label className="mast-control">
            <span>Module</span>
            <select aria-label="Module" value="mis" onChange={(event) => {
              const port = event.target.value === 'warehouse' ? 927 : event.target.value === 'projects' ? 928 : null;
              if (port) window.location.assign(`https://node-ss.tail640a1e.ts.net:${port}/`);
            }}>
              <option value="mis">Group MIS</option>
              <option value="warehouse">Central Store</option>
              <option value="projects">Project Intelligence</option>
            </select>
          </label>
          <ThemeControl />
        </div>
      </div>
      <nav className="nav" aria-label="Reports">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            {n.label}
          </NavLink>
        ))}
        {sections.length > 0 && <select className="section-select" aria-label="Jump to section" value="" onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          navigate(`#${id}`);
          // Continue keyboard reading at the chosen section, rather than back in the masthead.
          requestAnimationFrame(() => document.getElementById(`${id}-title`)?.focus({ preventScroll: true }));
        }}>
          <option value="">On this page</option>
          {sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
        </select>}
        <AskLauncher meta={meta} />
      </nav>
    </header>
  );
}

export interface Crumb {
  to?: string;
  label: string;
}

/** Breadcrumb for drill pages: Overview, then the vertical, then the engineer or the aging table. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="You are here">
      <ol>
        <li>
          <Link to="/">Overview</Link>
        </li>
        {items.map((c, i) => (
          <li key={i} aria-current={c.to ? undefined : 'page'}>
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
