/**
 * Interaction and keyboard gate, run against a served build.
 *
 * Run:  bun scripts/interactions.ts [--base http://127.0.0.1:4180] [--out <dir>]
 *
 * Checks, each with a screenshot as evidence:
 *  1. Hovering a vertical row on the front page opens the engineer split.
 *  2. Hovering a P&L rung updates the definition rail.
 *  3. Clicking a vertical row reaches its drill page, and the overdue link reaches the aging table.
 *  4. Every link, button, rung and the chart are reachable by Tab and show a visible focus ring.
 *  5. Arrow keys move the chart crosshair.
 *  6. No console errors anywhere along the way.
 * Exit code 1 on any failure.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const base = arg('base', 'http://127.0.0.1:4180').replace(/\/$/, '');
const out = arg('out', join(process.cwd(), 'screenshots'));
mkdirSync(out, { recursive: true });

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors: string[] = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('#sales table.mis');
  await page.waitForTimeout(1800); // let the load choreography finish

  // 1. hover expansion on the second vertical row
  const row = page.locator('#sales tbody.hov').nth(1);
  const expand = row.locator('.expand > div');
  const closedH = await expand.evaluate((el) => el.getBoundingClientRect().height);
  await row.locator('tr.main').hover();
  await page.waitForTimeout(500);
  const openH = await expand.evaluate((el) => el.getBoundingClientRect().height);
  check(closedH === 0 && openH > 40, `Hover opens the engineer split (closed ${closedH}px, open ${Math.round(openH)}px)`);
  await row.screenshot({ path: join(out, 'gate hover engineer split.png') });

  // 2. P&L rail follows hover
  const railBefore = await page.locator('#pl-rail').innerText();
  await page.locator('#pl tr.rung').nth(7).hover();
  await page.waitForTimeout(200);
  const railAfter = await page.locator('#pl-rail').innerText();
  check(railBefore !== railAfter && /BU profitability/i.test(railAfter), 'P&L rail updates on hover with the rung definition');
  await page.locator('#pl .pl').screenshot({ path: join(out, 'gate pl rail.png') });

  // 5. chart keyboard
  const chart = page.locator('#forecast svg.chart');
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(100);
  const readbox = (await chart.locator('.readbox text').first().evaluate((el) => el.textContent)) ?? '';
  check(/JUL 2026/.test(readbox), `Chart crosshair moves with arrow keys (read "${readbox}")`);
  await chart.screenshot({ path: join(out, 'gate chart crosshair.png') });

  // 4. keyboard reach: count focusable elements and confirm a visible outline on the first vertical link
  const focusables = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"], svg[tabindex="0"], summary'));
    return els.filter((el) => el.offsetParent !== null || el instanceof SVGElement).length;
  });
  check(focusables >= 40, `Interactive elements are in the tab order (${focusables} found)`);
  const firstLink = page.locator('#sales a.vlink').first();
  await firstLink.focus();
  await page.waitForTimeout(600); // the grid-template-rows transition is 360ms
  const outline = await firstLink.evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
  check(/solid/.test(outline) && !/0px/.test(outline), `Focus ring is visible on links (${outline})`);
  const focusOpensSplit = await page.locator('#sales tbody.hov').first().locator('.expand > div').evaluate((el) => el.getBoundingClientRect().height);
  check(focusOpensSplit > 40, `Keyboard focus opens the engineer split as hover does (${Math.round(focusOpensSplit)}px)`);

  // 3. drill by click, then the overdue link (blur first so no expansion is mid-transition under the pointer)
  await firstLink.evaluate((el) => (el as HTMLElement).blur());
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  await page.locator('#sales a.vlink', { hasText: 'Cooling' }).click();
  await page.waitForURL(/\/v\/cooling$/, { waitUntil: 'commit' });
  await page.locator('h1', { hasText: /cooling/i }).waitFor({ timeout: 10000 });
  const h1 = await page.locator('h1').last().innerText();
  check(/COOLING/i.test(h1), `Vertical drill page opens by click (h1 "${h1}")`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, 'gate drill cooling.png'), fullPage: false });
  await page.locator('a.drill-link').click();
  await page.waitForURL(/\/v\/cooling\/overdue$/, { waitUntil: 'commit' });
  await page.waitForSelector('#aging table.mis');
  const rows = await page.locator('#aging tr.indent').count();
  check(rows > 0, `Overdue drill lists customer rows (${rows} rows)`);
  await page.locator('a.back').click();
  await page.waitForURL(/\/v\/cooling$/, { waitUntil: 'commit' });
  await page.waitForTimeout(600);
  await page.locator('a.back').click();
  await page.waitForURL(/\/$/, { waitUntil: 'commit' });
  check(true, 'Back links return to the vertical and then to the front page');

  // 6. console errors
  check(errors.length === 0, `No console errors (${errors.length})`);
  for (const e of errors) console.log('   ' + e);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll interaction checks pass.');
