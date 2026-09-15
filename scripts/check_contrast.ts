/**
 * Measures WCAG 2.x contrast for every text and surface pair the stylesheet uses,
 * in every supported theme. Reads the token values from src/styles/index.css so it
 * cannot drift from them.
 *
 * Run:  bun scripts/check_contrast.ts
 * Fails (exit 1) if any text pair is below 4.5:1 or any non-text mark below 3:1.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'styles', 'index.css'), 'utf8');

type Tokens = Map<string, string>;

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Theme selector ${selector} not found in index.css`);
  const open = css.indexOf('{', start + selector.length);
  if (open < 0) throw new Error(`Theme selector ${selector} has no declaration block`);
  let depth = 1;
  for (let i = open + 1; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`Theme selector ${selector} has an unclosed declaration block`);
}

function declarations(source: string): Tokens {
  const tokens: Tokens = new Map();
  for (const match of source.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) tokens.set(match[1]!.toLowerCase(), match[2]!.trim().toLowerCase());
  return tokens;
}

const baseTokens = declarations(block(':root'));

function themeTokens(theme: 'parchment' | 'light' | 'dark'): Tokens {
  if (theme === 'parchment') return new Map(baseTokens);
  // Theme blocks are deliberately mandatory even though their tokens inherit the
  // parchment base. A missing selector must fail rather than silently testing base.
  return new Map([...baseTokens, ...declarations(block(`:root[data-theme='${theme}']`))]);
}

function token(tokens: Tokens, name: string, trail: string[] = []): string {
  if (trail.includes(name)) throw new Error(`Token alias cycle: ${[...trail, name].map((n) => `--${n}`).join(' -> ')}`);
  const value = tokens.get(name);
  if (!value) throw new Error(`Token --${name} not found in theme`);
  const alias = value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (alias) return token(tokens, alias[1]!, [...trail, name]);
  if (!/^#[0-9a-f]{6}$/.test(value)) throw new Error(`Token --${name} must resolve to a six-digit hex colour, got "${value}"`);
  return value;
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

// Forecast bars are translucent. Measure their painted color, not just the ink.
const forecastOpacity = Number(css.match(/\.chart \.vbar\.fc\s*\{\s*fill-opacity:\s*([\d.]+)/)?.[1]);
if (!(forecastOpacity > 0 && forecastOpacity <= 1)) throw new Error('Missing or invalid forecast-bar opacity');
function composite(fg: string, bg: string, opacity: number): string {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(fg.slice(i, i + 2), 16) * opacity + parseInt(bg.slice(i, i + 2), 16) * (1 - opacity)).toString(16).padStart(2, '0')).join('');
}

interface Pair {
  what: string;
  fg: string;
  bg: string;
  min: number;
}

function pairsFor(tokens: Tokens): Pair[] {
  const paper = token(tokens, 'paper');
  const paper2 = token(tokens, 'paper-2');
  const ink = token(tokens, 'ink');
  const ink2 = token(tokens, 'ink-2');
  const hazard = token(tokens, 'hazard');
  const hazardText = token(tokens, 'hazard-text');
  const readboxHazard = token(tokens, 'readbox-hazard');
  const rule = token(tokens, 'rule');
  const rowHover = token(tokens, 'row-hover');
  const spot = token(tokens, 'spot');
  const spot2 = token(tokens, 'spot-2');
  const ink3 = token(tokens, 'ink-3');
  return [
  { what: 'Translucent forecast variance bar (non-text)', fg: composite(ink, paper, forecastOpacity), bg: paper, min: 3 },
  { what: 'Translucent adverse forecast variance bar (non-text)', fg: composite(hazard, paper, forecastOpacity), bg: paper, min: 3 },
  { what: 'Body and table text (ink on paper)', fg: ink, bg: paper, min: 4.5 },
  { what: 'Labels and notes (ink-2 on paper)', fg: ink2, bg: paper, min: 4.5 },
  { what: 'Hazard text on paper', fg: hazardText, bg: paper, min: 4.5 },
  { what: 'Text on hovered row and stamp (ink on paper-2)', fg: ink, bg: paper2, min: 4.5 },
  { what: 'Labels on hovered row and stamp (ink-2 on paper-2)', fg: ink2, bg: paper2, min: 4.5 },
  { what: 'Hazard text on paper-2', fg: hazardText, bg: paper2, min: 4.5 },
  { what: 'Tooltip text (paper on ink)', fg: paper, bg: ink, min: 4.5 },
  { what: 'Chart readbox hazard text on ink', fg: readboxHazard, bg: ink, min: 4.5 },
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
  { what: 'Ring third tone on a hovered band (non-text)', fg: ink3, bg: rowHover, min: 3 },
  { what: 'Hazard marks, bars and borders on a hovered band (non-text)', fg: hazard, bg: rowHover, min: 3 },
  { what: 'Hazard segment beside the spot ink (adjacent fills, reported only)', fg: hazard, bg: spot, min: 0 },
  ];
}

let failed = false;
console.log('Contrast, WCAG 2.x relative luminance');
for (const theme of ['parchment', 'light', 'dark'] as const) {
  console.log(`Theme: ${theme}`);
  try {
    for (const p of pairsFor(themeTokens(theme))) {
      const c = contrast(p.fg, p.bg);
      const ok = c >= p.min;
      if (!ok) failed = true;
      console.log(`${ok ? 'PASS' : 'FAIL'}  [${theme}] ${c.toFixed(2)}:1  (min ${p.min})  ${p.what}  ${p.fg} on ${p.bg}`);
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL  [${theme}] ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed) {
  console.error('One or more theme pairs fail. Fix the tokens in src/styles/index.css.');
  process.exit(1);
}
console.log('All measured pairs pass.');
