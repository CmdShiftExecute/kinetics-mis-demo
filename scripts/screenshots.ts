/**
 * Captures the demo at desktop and phone widths with a real Chromium.
 *
 * Run:  bun scripts/screenshots.ts [--base http://127.0.0.1:4173] [--out <dir>] [--tag <label>]
 * Default output: ./screenshots (gitignored).
 *
 * Reduced motion is requested so the capture shows the settled page, not a
 * frame mid-animation. Fonts are awaited before every capture.
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
/** Accept the tailnet's self-signed certificate when pointed at node-ss. */
const insecure = args.includes('--insecure');
const tag = arg('tag', 'halvard-mis');

const pages = [
  { path: '/', name: 'front' },
  { path: '/v/mechanical-systems', name: 'vertical-mechanical-systems' },
  { path: '/v/mechanical-systems/overdue', name: 'overdue-mechanical-systems' },
  { path: '/v/mechanical-systems/e/bassem-farouk', name: 'engineer-bassem-farouk' },
];
const viewports = [
  { width: 1440, height: 900, name: '1440' },
  { width: 390, height: 844, name: '390', mobile: true },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
      ignoreHTTPSErrors: insecure,
      isMobile: vp.mobile ?? false,
      hasTouch: vp.mobile ?? false,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const p of pages) {
      await page.goto(`${base}${p.path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('table.mis', { timeout: 15000 });
      await page.waitForTimeout(400);
      const file = join(out, `${tag} ${p.name} ${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`wrote ${file}`);
    }
    await context.close();
    if (errors.length) {
      console.error(`Console errors at ${vp.name}:`);
      for (const e of errors) console.error('  ' + e);
      process.exitCode = 1;
    } else {
      console.log(`No console errors at ${vp.name}.`);
    }
  }
} finally {
  await browser.close();
}
