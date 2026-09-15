/** Regressions from the read-only review. Blocks every model call and external navigation. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args[args.indexOf('--' + name) + 1] || fallback;
const base = (args.includes('--base') ? option('base', '') : 'http://127.0.0.1:4181').replace(/\/$/, '');
const out = args.includes('--out') ? option('out', '') : 'screenshots/review-fixes';
mkdirSync(out, { recursive: true });
const results: { browser: string; test: string; ok: boolean; detail: unknown }[] = [];
for (const [name, engine] of [['chromium', chromium], ['firefox', firefox]] as const) {
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const departures: string[] = [];
  let modelCalls = 0;
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('/api/ask')) { modelCalls++; return route.abort(); }
    if (new URL(url).origin !== new URL(base).origin) { departures.push(url); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (ok: boolean, test: string, detail: unknown = '') => {
    results.push({ browser: name, test, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${test} ${JSON.stringify(detail)}`);
  };
  const ready = async (path = '/') => {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.locator('.mast').waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  try {
    for (const [value, port, keys] of [['Central Store', 927, 1], ['Project Intelligence', 928, 2]] as const) {
      await ready();
      const count = departures.length;
      const url = page.url();
      const trigger = page.getByRole('button', { name: 'Module', exact: true });
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      for (let i = 0; i < keys; i++) await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      check(departures.length === count && page.url() === url && await page.getByRole('menuitem', { name: value }).evaluate(el => el === document.activeElement), 'Module menu arrows browse without navigation', value);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      check(departures.length === count + 1 && departures.at(-1) === `https://node-ss.tail640a1e.ts.net:${port}/`, 'Explicit activation requests the chosen module only', departures.at(-1));
    }
    await ready();
    check((await page.locator('.mast-tools').innerText()).trim() === '', 'Closed circular controls display no module or theme names');
    const circles = await page.locator('.mast-icon').evaluateAll(elements => elements.map(el => ({ radius: getComputedStyle(el).borderRadius, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    check(circles.length === 2 && circles.every(c => c.radius === '50%' && c.width === c.height), 'Both masthead triggers are genuinely circular', circles);
    for (const label of ['Module', 'Theme']) {
      const trigger = page.getByRole('button', { name: label, exact: true });
      await trigger.click();
      check(await trigger.getAttribute('aria-expanded') === 'true', 'Circular trigger opens its menu', label);
      await page.keyboard.press('Escape');
      check(await trigger.getAttribute('aria-expanded') === 'false' && await trigger.evaluate(el => el === document.activeElement), 'Escape closes menu and restores trigger focus', label);
      await trigger.click();
      await page.locator('h1').click();
      check(await trigger.getAttribute('aria-expanded') === 'false', 'Outside click dismisses menu', label);
    }
    await page.getByRole('button', { name: 'Theme', exact: true }).click();
    await page.keyboard.press('Tab');
    check(await page.getByRole('button', { name: 'Theme', exact: true }).getAttribute('aria-expanded') === 'false', 'Tab exits the menu and closes it');
    await ready();
    const before = page.url();
    const section = page.getByLabel('Jump to section');
    await section.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const id = await section.inputValue();
    check(page.url() === before && id !== '' && await section.evaluate(el => el === document.activeElement), 'Section arrows browse without navigation or focus loss', id);
    await page.keyboard.press('Tab');
    check(await page.getByRole('button', { name: 'Go to selected section' }).evaluate(el => el === document.activeElement), 'Section Go follows select in tab order');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check(new URL(page.url()).hash === '#' + id && await page.evaluate(() => document.activeElement?.id) === id + '-title', 'Explicit Go navigates and focuses the selected heading');
    for (const [width, height] of [[1440, 900], [1366, 768]] as const) {
      await page.setViewportSize({ width, height });
      for (const path of ['/net-profit', '/v/mechanical-systems']) {
        await ready(path);
        await page.locator('#pl-rail').waitFor();
        // Sample where the rail should stick, and where its parent should carry it away.
        const samples = await page.evaluate(async () => {
          const rail = document.querySelector<HTMLElement>('#pl-rail')!;
          const parent = rail.parentElement!;
          const origin = scrollY + parent.getBoundingClientRect().top;
          const offset = parseFloat(getComputedStyle(rail).top);
          const values = [];
          for (const top of [offset + 20, offset - 20, 0, -60]) {
            scrollTo(0, origin - top);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const r = rail.getBoundingClientRect();
            const p = parent.getBoundingClientRect();
            const mast = document.querySelector('.mast')!.getBoundingClientRect();
            values.push({ top: r.top, bottom: r.bottom, parentBottom: p.bottom, mastBottom: mast.bottom, offset, visibleOrExiting: r.top >= mast.bottom || Math.abs(r.bottom - p.bottom) < 2 });
          }
          return values;
        });
        check(samples.every(s => s.offset >= s.mastBottom && s.visibleOrExiting) && Math.abs(samples[1]!.top - samples[1]!.offset) < 2, 'P&L rail sticks below masthead and exits with its parent', { path, width, samples });
      }
    }
    for (const width of [360, 390, 440, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await ready();
      const fit = await page.evaluate(() => {
        const selectors = ['.ask-launch', '.section-control', '.mast-icon[aria-label="Module"]', '.mast-tools'];
        return { overflow: document.documentElement.scrollWidth > innerWidth, controls: selectors.map(selector => {
          const el = document.querySelector(selector)!;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { selector, left: r.left, right: r.right, visible: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && !!hit && el.contains(hit) };
        }) };
      });
      check(!fit.overflow && fit.controls.every(c => c.visible), 'Ask and navigation controls visible without horizontal scrolling', { width, fit });
      if (width === 390) {
        await page.getByRole('button', { name: 'Theme', exact: true }).click();
        const menuBox = await page.getByRole('menu', { name: 'Theme options' }).boundingBox();
        check(!!menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= width, 'Phone dropdown fits within the viewport', menuBox);
        await page.screenshot({ path: join(out, name + '-phone-menu.png') });
        await page.keyboard.press('Escape');
        await page.screenshot({ path: join(out, name + '-phone.png') });
        await page.locator('.ask-launch').click();
        check(await page.getByTestId('ask-panel').isVisible(), 'Visible phone Ask button opens the panel');
        await page.keyboard.press('Escape');
        check(!await page.getByTestId('ask-panel').isVisible(), 'Phone Ask panel closes normally');
      }
    }
    check(errors.length === 0 && modelCalls === 0, 'No runtime errors or model requests', { errors, modelCalls });
  } catch (error) {
    check(false, 'Browser checks completed', { error: String(error), url: page.url(), body: await page.locator('body').innerText().catch(() => ''), errors });
  } finally {
    await browser.close();
  }
}
writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2));
const failures = results.filter(r => !r.ok);
console.log(`${results.length - failures.length}/${results.length} review regression checks passed`);
process.exitCode = failures.length ? 1 : 0;
