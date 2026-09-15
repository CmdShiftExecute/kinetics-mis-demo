import { useEffect, useState } from 'react';

type Theme = 'parchment' | 'light' | 'dark';
const STORAGE_KEY = 'halvard-mis-theme';
const validTheme = (value: string | null | undefined): Theme => value === 'light' || value === 'dark' ? value : 'parchment';

/** The early head script restores the theme before paint; storage is optional. */
export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>(() => validTheme(document.documentElement.dataset.theme));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Private browsing can deny storage. */ }
  }, [theme]);
  return (
    <label className="mast-control">
      <span>Theme</span>
      <select aria-label="Theme" value={theme} onChange={(event) => setTheme(validTheme(event.target.value))}>
        <option value="parchment">Parchment</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
