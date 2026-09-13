/**
 * Measures WCAG 2.x contrast for every text and surface pair the stylesheet uses.
 * Reads the token values from src/styles/index.css so it cannot drift from them.
 *
 * Run:  bun scripts/check_contrast.ts
 * Fails (exit 1) if any text pair is below 4.5:1 or any non-text mark below 3:1.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'styles', 'index.css'), 'utf8');

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6}|var\\(--[a-z0-9-]+\\))`));
  if (!m) throw new Error(`Token --${name} not found in index.css`);
  const v = m[1]!.toLowerCase();
  // A semantic token may alias another, e.g. --row-hover: var(--paper-3). Resolve it
  // so the gate measures the colour that actually paints, not the alias.
  const alias = v.match(/^var\(--([a-z0-9-]+)\)$/);
  return alias ? token(alias[1]!) : v;
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const paper = token('paper');
const paper2 = token('paper-2');
const ink = token('ink');
const ink2 = token('ink-2');
const hazard = token('hazard');
const hazardText = token('hazard-text');
const rule = token('rule');
const rowHover = token('row-hover');
const spot = token('spot');
const spot2 = token('spot-2');
const ink3 = token('ink-3');

interface Pair {
  what: string;
  fg: string;
  bg: string;
  min: number;
}

const pairs: Pair[] = [
  { what: 'Body and table text (ink on paper)', fg: ink, bg: paper, min: 4.5 },
  { what: 'Labels and notes (ink-2 on paper)', fg: ink2, bg: paper, min: 4.5 },
  { what: 'Hazard text on paper', fg: hazardText, bg: paper, min: 4.5 },
  { what: 'Text on hovered row and stamp (ink on paper-2)', fg: ink, bg: paper2, min: 4.5 },
  { what: 'Labels on hovered row and stamp (ink-2 on paper-2)', fg: ink2, bg: paper2, min: 4.5 },
  { what: 'Hazard text on paper-2', fg: hazardText, bg: paper2, min: 4.5 },
  { what: 'Tooltip text (paper on ink)', fg: paper, bg: ink, min: 4.5 },
  { what: 'Chart readbox hazard text (#ff9a9a on ink)', fg: '#ff9a9a', bg: ink, min: 4.5 },
  { what: 'Hazard marks, bars and borders on paper (non-text)', fg: hazard, bg: paper, min: 3 },
  { what: 'Hairline rule on paper (decorative, reported only)', fg: rule, bg: paper, min: 0 },
  // The hovered row. The pair below the text pairs is the one that matters for
  // perception: --paper-2 gave a 1.11:1 step against the paper, which the principal
  // could not see on 13 Sep 2026. The floor of 1.2 holds that ground. The ink
  // bracket rule is what carries the signal, so it is measured against the hairline
  // it replaces, not against the paper.
  { what: 'Text on a hovered row (ink on row-hover)', fg: ink, bg: rowHover, min: 4.5 },
  { what: 'Labels on a hovered row (ink-2 on row-hover)', fg: ink2, bg: rowHover, min: 4.5 },
  { what: 'Hazard text on a hovered row', fg: hazardText, bg: rowHover, min: 4.5 },
  { what: 'Hovered row is visible against the paper (non-text)', fg: rowHover, bg: paper, min: 1.2 },
  { what: 'Hovered row bracket against the hairline it replaces (non-text)', fg: ink, bg: rule, min: 3 },
  // The second print ink used by the report charts, and its tint. Non-text marks,
  // measured on the paper and on the hovered band they sit on when pointed at.
  { what: 'Chart spot ink on paper (non-text)', fg: spot, bg: paper, min: 3 },
  { what: 'Chart spot tint on paper (non-text)', fg: spot2, bg: paper, min: 3 },
  { what: 'Chart spot ink on a hovered band (non-text)', fg: spot, bg: rowHover, min: 3 },
  { what: 'Chart spot tint on a hovered band (non-text)', fg: spot2, bg: rowHover, min: 3 },
  { what: 'Ring third tone on paper (non-text)', fg: ink3, bg: paper, min: 3 },
  { what: 'Hazard segment beside the spot ink (adjacent fills, reported only)', fg: hazard, bg: spot, min: 0 },
];

let failed = false;
console.log('Contrast, WCAG 2.x relative luminance');
for (const p of pairs) {
  const c = contrast(p.fg, p.bg);
  const ok = c >= p.min;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.toFixed(2)}:1  (min ${p.min})  ${p.what}  ${p.fg} on ${p.bg}`);
}
if (failed) {
  console.error('One or more pairs fail. Fix the tokens in src/styles/index.css.');
  process.exit(1);
}
console.log('All measured pairs pass.');
