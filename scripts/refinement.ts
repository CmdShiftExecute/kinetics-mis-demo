/**
 * Browser regression gate for the MIS refinement: themes, retained overview
 * analytics, sticky navigation, anchors, and responsive rendering.
 *
 * Run: bun scripts/refinement.ts [--base http://127.0.0.1:4181] [--out screenshots/refinement]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import type { Rollup } from '../data/schema';
import { k, mil } from '../src/lib/format';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf('--' + name);
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
};
const base = option('base', 'http://127.0.0.1:4181').replace(/\/$/, '');
const out = option('out', join(process.cwd(), 'screenshots', 'refinement'));
mkdirSync(out, { recursive: true });

type Result = { ok: boolean; assertion: string; detail: string };
const results: Result[] = [];
const check = (ok: boolean, assertion: string, detail = '') => {
  results.push({ ok, assertion, detail });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + assertion + (detail ? ' | ' + detail : ''));
};
const known = {
  parchment: { paper: '#f4f4f0', ink: '#111111', scheme: 'light' },
  light: { paper: '#ffffff', ink: '#151b24', scheme: 'light' },
  dark: { paper: '#171c21', ink: '#edf0f3', scheme: 'dark' },
} as const;
type Theme = keyof typeof known;

async function pageFor(browser: Awaited<ReturnType<typeof chromium.launch>>, width: number, denyStorage = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  if (denyStorage) {
    await context.addInitScript(() => {
      Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new DOMException('Denied', 'SecurityError'); } });
      Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new DOMException('Denied', 'SecurityError'); } });
    });
  }
  const page = await context.newPage();
  let askCalls = 0;
  await page.route('**/api/ask', async (route) => {
    askCalls++;
    await route.abort();
  });
  return { context, page, askCalls: () => askCalls };
}

async function ready(page: Page, path = '/') {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mast');
  await page.waitForSelector('h1');
}
async function themeState(page: Page) {
  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    return {
      theme: root.dataset.theme || 'parchment',
      paper: cs.getPropertyValue('--paper').trim(),
      ink: cs.getPropertyValue('--ink').trim(),
      background: cs.backgroundColor,
      color: cs.color,
      scheme: cs.colorScheme,
    };
  });
  return { ...state, paper: normalHex(state.paper), ink: normalHex(state.ink) };
}
function normalHex(value: string) {
  const hex = value.toLowerCase();
  return /^#[0-9a-f]{3}$/.test(hex) ? '#' + hex.slice(1).split('').map((part) => part + part).join('') : hex;
}
function rgb(hex: string) {
  const value = normalHex(hex).slice(1);
  return 'rgb(' + parseInt(value.slice(0, 2), 16) + ', ' + parseInt(value.slice(2, 4), 16) + ', ' + parseInt(value.slice(4, 6), 16) + ')';
}
async function chooseTheme(page: Page, theme: Theme) {
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('menuitemradio', { name: theme, exact: false }).click();
  await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme);
}
async function overviewFingerprint(page: Page) {
  return page.locator('#answers, #sales, #pipeline, #net-profit, #receivables').allTextContents().then((parts) => parts.join('\n').replace(/\s+/g, ' ').trim());
}
async function headerVisible(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('.mast')!.getBoundingClientRect();
    const heading = document.querySelector('h1')!.getBoundingClientRect();
    return { header: { top: header.top, bottom: header.bottom }, heading: { top: heading.top, bottom: heading.bottom }, visible: header.top >= -1 && header.bottom > 0 };
  });
}
function signedPercent(value: number) {
  return (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(1) + '%';
}

const browser = await chromium.launch();
try {
  const { context, page, askCalls } = await pageFor(browser, 1440);
  await ready(page);
  const rollup = await page.evaluate(async () => (await fetch('/data/rollup.json')).json()) as Rollup;
  const headlineExpected = [
    mil(rollup.overview.sales.ytdRevenue),
    mil(rollup.overview.delivery.fyForecast),
    mil(rollup.overview.profit.forecast.buNetProfit),
    mil(rollup.overview.receivables.pastDue),
  ];
  const headlineActual = await page.locator('#answers .big').allInnerTexts();
  check(headlineActual.length === 4 && headlineExpected.every((value, i) => headlineActual[i] === value), 'Four headline values match rollup.json', headlineActual.join(' | '));
  const businessRows = await page.locator('#sales tbody tr:not(.total)').count();
  const totalText = await page.locator('#sales tbody tr.total').innerText();
  const totalValues = [rollup.sales.total.ytdRevenue, rollup.sales.total.budgetRevenue, rollup.sales.total.dRevenue].map(k);
  check(businessRows === 10 && totalText.includes(rollup.sales.total.name) && totalValues.every((value: string) => totalText.includes(value)), 'Sales table retains ten businesses and rollup total values', totalText.replace(/\s+/g, ' '));
  const overview = await overviewFingerprint(page);
  for (const text of [6_198, 11_320, 12_581, 106_932, 59_132, 5_529, 102_653, 9_053, 23_177, 134_883].map(k).concat('83.1% of net to collect')) {
    check(overview.includes(text), 'Overview retains exact analytic string', text);
  }
  const worstShortfall = rollup.sales.rows.reduce((worst, row) => row.dRevenue < worst.dRevenue ? row : worst);
  const priorityText = await page.locator('.attention').innerText();
  const priorityExpected = [
    worstShortfall.name,
    mil(Math.abs(worstShortfall.dRevenue), 2) + ' largest YTD shortfall',
    signedPercent(worstShortfall.dRevenuePct) + ' vs YTD budget.',
    mil(rollup.overview.receivables.agedOverOneYear) + ' aged over a year',
    rollup.overview.receivables.concentration.share.toFixed(1) + '% of net receivables',
    String(rollup.overview.profit.lossMakers.length) + (rollup.overview.profit.lossMakers.length === 1 ? ' business forecasts a loss' : ' businesses forecast a loss'),
  ];
  check(priorityExpected.every((text) => priorityText.includes(text)), 'Management priorities match published shortfall, aging, concentration, and loss-makers', priorityText.replace(/\s+/g, ' '));

  await page.getByTestId('ov-monthly-switch').locator('button[data-view="cumulative"]').click();
  await page.locator('#sales th[aria-sort] button', { hasText: 'Variance' }).click();
  await page.waitForTimeout(250);
  const sortedBefore = await page.locator('#sales tbody tr:not(.total)').first().innerText();
  const fingerprintBefore = await overviewFingerprint(page);
  await chooseTheme(page, 'light');
  const afterChange = await themeState(page);
  const chartKept = await page.getByTestId('ov-monthly-switch').locator('button[data-view="cumulative"]').getAttribute('aria-pressed');
  const sortedAfter = await page.locator('#sales tbody tr:not(.total)').first().innerText();
  check(afterChange.paper === known.light.paper && afterChange.ink === known.light.ink && afterChange.background === rgb(known.light.paper) && afterChange.color === rgb(known.light.ink) && afterChange.scheme === known.light.scheme, 'Light select applies known tokens and computed colors', JSON.stringify(afterChange));
  check(chartKept === 'true' && sortedBefore === sortedAfter, 'Theme change preserves current chart view and sort', sortedAfter.slice(0, 50));
  check(fingerprintBefore === await overviewFingerprint(page), 'Theme change does not mutate overview analytics');

  for (const theme of Object.keys(known) as Theme[]) {
    await chooseTheme(page, theme);
    const state = await themeState(page);
    check(state.theme === theme && state.paper === known[theme].paper && state.ink === known[theme].ink && state.background === rgb(known[theme].paper) && state.color === rgb(known[theme].ink) && state.scheme === known[theme].scheme, 'Theme select resolves ' + theme + ' tokens, computed colors, and color scheme', JSON.stringify(state));
    await page.goto(base + '/pipeline', { waitUntil: 'networkidle' });
    check((await themeState(page)).theme === theme, 'Theme persists on report navigation', theme);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    check((await themeState(page)).theme === theme, 'Theme persists on reload/navigation return', theme);
  }
  await page.reload({ waitUntil: 'networkidle' });
  check((await themeState(page)).theme === 'dark', 'Theme persists through a full reload', 'dark');
  await page.goto(base + '/sales#netting-items', { waitUntil: 'networkidle' });
  await page.waitForSelector('#netting-items');
  const coldAnchor = await page.evaluate(() => {
    const item = document.querySelector('#netting-items')!.getBoundingClientRect();
    const mast = document.querySelector('.mast')!.getBoundingClientRect();
    return { itemTop: item.top, mastBottom: mast.bottom, visible: item.top >= mast.bottom - 2 && item.top < innerHeight };
  });
  check(coldAnchor.visible, 'Cold /sales#netting-items anchor lands below persistent header', JSON.stringify(coldAnchor));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.getByLabel('Jump to section').selectOption('net-profit');
  await page.getByRole('button', { name: 'Go to selected section' }).click();
  await page.waitForTimeout(250);
  const jump = await page.evaluate(() => {
    const target = document.querySelector('#net-profit')!.getBoundingClientRect();
    const mast = document.querySelector('.mast')!.getBoundingClientRect();
    return { targetTop: target.top, mastBottom: mast.bottom, visible: target.top >= mast.bottom - 2 && target.top < innerHeight };
  });
  check(jump.visible, 'Jump-to-section first navigation clears sticky header', JSON.stringify(jump));
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.getByLabel('Jump to section').selectOption('net-profit');
  await page.getByRole('button', { name: 'Go to selected section' }).click();
  await page.waitForTimeout(250);
  const repeatJump = await page.evaluate(() => {
    const target = document.querySelector('#net-profit')!.getBoundingClientRect();
    const mast = document.querySelector('.mast')!.getBoundingClientRect();
    return { targetTop: target.top, mastBottom: mast.bottom, focusedId: document.activeElement?.id, visible: target.top >= mast.bottom - 2 && target.top < innerHeight };
  });
  check(repeatJump.visible && repeatJump.focusedId === 'net-profit-title', 'Jump-to-section repeats from top and focuses destination heading', JSON.stringify(repeatJump));
  await page.getByRole('button', { name: 'Theme', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const beforeKeyboardChoice = await themeState(page);
  await page.keyboard.press('Enter');
  const keyboardTheme = await themeState(page);
  const themeFocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Theme');
  check(beforeKeyboardChoice.theme === 'dark' && keyboardTheme.theme === 'light' && themeFocused, 'Keyboard theme menu requires activation and returns focus to its trigger', JSON.stringify(keyboardTheme));
  await page.locator('.ask-launch').click();
  await page.waitForSelector('[data-testid="ask-panel"]');
  const overlay = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ask-panel"]')!.getBoundingClientRect();
    const mast = document.querySelector('.mast')!.getBoundingClientRect();
    const x = panel.left + Math.min(20, panel.width / 2);
    const y = Math.max(panel.top + 4, Math.min(mast.bottom - 4, panel.bottom - 4));
    const top = document.elementFromPoint(x, y);
    return { x, y, overlap: panel.top < mast.bottom, panelIsTop: !!top?.closest('[data-testid="ask-panel"]') };
  });
  check(!overlay.overlap || overlay.panelIsTop, 'Ask MIS panel paints above persistent header where they overlap', JSON.stringify(overlay));
  await page.keyboard.press('Escape');
  check(askCalls() === 0, 'Regression gate made no Ask MIS API calls');
  await context.close();

  const invalid = await pageFor(browser, 1280);
  await invalid.context.addInitScript(() => localStorage.setItem('mis-theme', 'invalid'));
  await ready(invalid.page);
  check((await themeState(invalid.page)).theme === 'parchment' && await invalid.page.locator('#sales table.mis').count() === 1, 'Invalid stored theme falls back without blocking render');
  check(invalid.askCalls() === 0, 'Invalid-storage check made no Ask MIS API calls');
  await invalid.context.close();

  const denied = await pageFor(browser, 1280, true);
  await ready(denied.page);
  check((await themeState(denied.page)).theme === 'parchment' && await denied.page.locator('#sales table.mis').count() === 1, 'Denied localStorage does not block rendering');
  check(denied.askCalls() === 0, 'Denied-storage check made no Ask MIS API calls');
  await denied.context.close();

  const responsive = await pageFor(browser, 390);
  for (const theme of Object.keys(known) as Theme[]) {
    for (const width of [390, 768, 1280, 1440]) {
      await responsive.page.setViewportSize({ width, height: 900 });
      await ready(responsive.page);
      await chooseTheme(responsive.page, theme);
      await responsive.page.waitForTimeout(400);
      const fit = await responsive.page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
      check(fit.width <= width, 'Overview fits ' + width + 'px in ' + theme, JSON.stringify(fit));
      await responsive.page.screenshot({ path: join(out, 'overview-' + theme + '-' + width + '.png'), fullPage: false });
      if (width === 1440) {
        await responsive.page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
            scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 180));
          }
          scrollTo(0, document.documentElement.scrollHeight);
        });
        const rects = await headerVisible(responsive.page);
        await responsive.page.evaluate(() => scrollTo(0, 0));
        await responsive.page.waitForTimeout(400);
        const topRects = await headerVisible(responsive.page);
        check(rects.visible && topRects.heading.top >= topRects.header.bottom - 2, 'Persistent header and heading positions survive stepped overview scroll in ' + theme, JSON.stringify({ bottom: rects, top: topRects }));
        await responsive.page.screenshot({ path: join(out, 'overview-' + theme + '-1440-full.png'), fullPage: true });
      }
      check(responsive.askCalls() === 0, 'Responsive check made no Ask MIS API calls', theme + ' ' + width);
    }
  }
  await responsive.context.close();

  const routes = await pageFor(browser, 1280);
  for (const path of ['/sales', '/pipeline', '/net-profit', '/receivables', '/working-capital', '/data-basis', '/v/mechanical-systems', '/v/mechanical-systems/receivables', '/v/mechanical-systems/e/bassem-farouk']) {
    await ready(routes.page, path);
    check((await routes.page.locator('h1').first().innerText()).trim().length > 0, 'Main/drill route renders a heading', path);
    await chooseTheme(routes.page, 'dark');
    check((await themeState(routes.page)).theme === 'dark', 'Theme works on route', path);
  }
  check(routes.askCalls() === 0, 'Route coverage made no Ask MIS API calls');
  await routes.context.close();
} catch (error) {
  check(false, 'Regression gate completed without an unexpected browser error', error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2));
const failures = results.filter((result) => !result.ok);
if (failures.length) {
  console.error(String(failures.length) + ' refinement assertion(s) failed. Results: ' + join(out, 'results.json'));
  process.exit(1);
}
console.log('All ' + results.length + ' refinement assertions pass. Results: ' + join(out, 'results.json'));
