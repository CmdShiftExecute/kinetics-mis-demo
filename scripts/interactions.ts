/**
 * Interaction, keyboard, structure and resilience gate, run against a served build.
 *
 * Run:  bun scripts/interactions.ts [--base http://127.0.0.1:4180] [--out <dir>] [--insecure]
 *
 * Every check prints PASS or FAIL with its evidence. Exit code 1 on any failure.
 * The alignment gate is proven with a negative control: a cell is removed in
 * browser memory and the gate must report it.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const base = arg('base', 'http://127.0.0.1:4180').replace(/\/$/, '');
const out = arg('out', join(process.cwd(), 'screenshots'));
const insecure = args.includes('--insecure');
mkdirSync(out, { recursive: true });

const results: { ok: boolean; what: string }[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  results.push({ ok, what });
};

/** Every logical column of a table must have a cell under it, and spanning cells must end where their last header ends. */
const ALIGN_FN = `(sel) => {
  const table = document.querySelector(sel);
  if (!table) return { out: ['no table'], rows: 0, cols: 0 };
  const ths = Array.from(table.querySelectorAll('thead tr:last-child th, thead tr:last-child td'));
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const out = [];
  for (const row of rows) {
    const cells = Array.from(row.children);
    let col = 0;
    for (const cell of cells) {
      const span = cell.colSpan || 1;
      const first = ths[col];
      const last = ths[col + span - 1];
      if (!first || !last) { out.push('row ' + rows.indexOf(row) + ' overflows headers at col ' + col); break; }
      const a = first.getBoundingClientRect();
      const z = last.getBoundingClientRect();
      const b = cell.getBoundingClientRect();
      if (Math.abs(a.left - b.left) > 0.5) out.push('row ' + rows.indexOf(row) + ' col ' + col + ' left off by ' + (b.left - a.left).toFixed(1));
      if (Math.abs(z.right - b.right) > 0.5) out.push('row ' + rows.indexOf(row) + ' col ' + col + ' right off by ' + (b.right - z.right).toFixed(1));
      col += span;
    }
    if (col !== ths.length) out.push('row ' + rows.indexOf(row) + ' covers ' + col + ' of ' + ths.length + ' columns');
  }
  return { out, rows: rows.length, cols: ths.length };
}`;

async function alignment(page: Page, sel: string) {
  return page.evaluate(`(${ALIGN_FN})(${JSON.stringify(sel)})`) as Promise<{ out: string[]; rows: number; cols: number }>;
}

const browser = await chromium.launch();
const errors: string[] = [];
/** During the deliberate missing-data check a 404 in the console is the expected evidence, not a fault. */
let expectMissing = false;
let expected404 = 0;
/** During the deliberate Ask the MIS failure checks a failed /api/ask fetch is the expected evidence. */
let expectAskFailure = false;
let expectedAskFailures = 0;
async function newPage(width: number, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: insecure, reducedMotion });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (expectMissing && /404/.test(m.text())) {
      expected404++;
      return;
    }
    if (expectAskFailure && /api\/ask|Failed to load resource|502|net::ERR/.test(m.text())) {
      expectedAskFailures++;
      return;
    }
    errors.push(`[${width}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${width}] ${String(e)}`));
  return { context, page };
}

try {
  /* ---------- overview at 1440 ---------- */
  const { context, page } = await newPage(1440);
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('#sales table.mis');
  await page.waitForTimeout(1200);

  // 1. document width never exceeds the viewport
  for (const w of [1440, 1024, 390]) {
    const { context: c2, page: p2 } = await newPage(w);
    await p2.goto(`${base}/`, { waitUntil: 'networkidle' });
    await p2.waitForSelector('#sales table.mis');
    const docW = await p2.evaluate(() => document.documentElement.scrollWidth);
    check(docW <= w, `Overview document width at ${w}px is ${docW}px`);
    await c2.close();
  }

  // 2. sorting: the variance column is the default sort, largest shortfall first; clicking flips it
  const firstBefore = (await page.locator('#sales tbody tr').first().locator('td').first().innerText()).trim();
  const variances = await page.locator('#sales tbody tr:not(.total) td:nth-child(4)').allInnerTexts();
  const parsed = variances.map((v) => Number(v.replace(/[^\d.-]/g, '').replace('−', '-')) * (v.includes('−') ? -1 : 1));
  const ascending = parsed.every((v, i) => i === 0 || v >= parsed[i - 1]!);
  check(ascending, `Overview sales rows sort by variance with the largest shortfall first (first row ${firstBefore})`);
  await page.locator('#sales th[aria-sort] button', { hasText: 'Variance' }).click();
  await page.waitForTimeout(500);
  const firstAfter = (await page.locator('#sales tbody tr').first().locator('td').first().innerText()).trim();
  const sortAttr = await page.locator('#sales th[aria-sort="descending"]').count();
  check(firstAfter !== firstBefore && sortAttr === 1, `Clicking the header flips the sort and sets aria-sort (first row now ${firstAfter})`);
  await page.locator('#sales th[aria-sort] button', { hasText: 'Variance' }).click();
  await page.waitForTimeout(300);

  // 3. netting disclosure opens with the keyboard and is fully visible
  const summary = page.locator('#netting summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const nettingOpen = await page.locator('#netting').evaluate((el) => (el as HTMLDetailsElement).open);
  const box = await page.locator('#netting .netting-box').boundingBox();
  const clipped = await page.locator('#netting .netting-box').evaluate((el) => {
    let n: HTMLElement | null = el.parentElement;
    while (n) {
      const o = getComputedStyle(n).overflowX + getComputedStyle(n).overflowY;
      if (/hidden|auto|scroll/.test(o) && n !== document.body && n !== document.documentElement) {
        const r = n.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        if (b.bottom > r.bottom + 0.5 || b.right > r.right + 0.5) return true;
      }
      n = n.parentElement;
    }
    return false;
  });
  check(nettingOpen && box != null && box.height > 40 && !clipped, `Netting calculation opens by keyboard and is not clipped (${Math.round(box?.height ?? 0)}px tall)`);
  await page.screenshot({ path: join(out, 'gate netting disclosure.png'), clip: box ? { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 60), width: Math.min(1440, box.width + 16), height: box.height + 80 } : undefined });

  // 4. chart keyboard and exact values without hover
  const chart = page.locator('#pipeline svg.chart').first();
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(100);
  const readbox = (await chart.locator('.readbox text').first().evaluate((el) => el.textContent)) ?? '';
  check(/JUL 2026/.test(readbox), `Chart crosshair moves with arrow keys (read "${readbox}")`);
  const valueRows = await page.locator('#ov-values tbody tr').count();
  const valuesSummary = page.locator('#ov-values summary');
  await valuesSummary.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const valuesOpen = await page.locator('#ov-values').evaluate((el) => (el as HTMLDetailsElement).open);
  check(valueRows === 12 && valuesOpen, `Exact monthly values are in a table with ${valueRows} rows, opened by keyboard`);
  await page.locator('#pipeline svg.vchart').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const bars = await page.evaluate(() => Array.from(document.querySelectorAll('#pipeline svg.vchart rect.vbar')).map((r) => [r.getAttribute('height'), r.getAttribute('y')]));
  const barsOk = bars.length === 12 && bars.every(([h, y]) => h != null && y != null && Number.isFinite(Number(h)) && Number.isFinite(Number(y)) && Number(h) >= 1);
  check(barsOk, `Every variance bar carries a numeric height and y attribute after animating in (${bars.length} bars)`);
  const axisNote = await page.locator('#pipeline .chart-axis-note').first().innerText();
  check(/starts at .* not zero/i.test(axisNote), `Truncated revenue axis is labelled ("${axisNote.slice(0, 60)}")`);

  // 4b. PLAIN MOUSE HOVER. Check 4 above drives the chart with the keyboard, which is
  // why this gate passed for months while the principal could not make either the rows
  // or the charts respond to a mouse on 13 Sep 2026: nothing here had ever moved a
  // pointer. Each check below is followed by a negative control, because a check that
  // has never reported FAIL has never been tested.
  const lum = (rgb: string) => {
    const c = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number);
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
  };
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const away = async () => {
    await page.mouse.move(4, 4);
    await page.waitForTimeout(150);
  };

  // Element HANDLES, not locators. A locator built on `tr.hov` re-resolves on every
  // use, so the moment the negative control strips that class the locator silently
  // points at the NEXT row, which is genuinely hovered, and the control reports a
  // change that proves nothing. A handle stays bound to the one row under test.
  const hoverRow = (await page.locator('#sales table.mis tbody tr.hov').first().elementHandle())!;
  const hoverCell = (await hoverRow.$('td:nth-child(2)'))!;
  const firstCell = (await hoverRow.$('td:first-child'))!;
  await away();
  const atRest = lum(await hoverCell.evaluate((el) => getComputedStyle(el).backgroundColor));
  await hoverRow.hover();
  await page.waitForTimeout(250);
  const shaded = ratio(atRest, lum(await hoverCell.evaluate((el) => getComputedStyle(el).backgroundColor)));
  const bracket = await firstCell.evaluate((el) => getComputedStyle(el).boxShadow);
  check(shaded >= 1.2 && /rgb\(17, ?17, ?17\)/.test(bracket) && /inset/.test(bracket), `Hovering a row shades it ${shaded.toFixed(2)}:1 against the resting row and brackets it in an ink rule`);

  await away();
  await hoverRow.evaluate((el) => el.classList.remove('hov'));
  await hoverRow.hover();
  await page.waitForTimeout(200);
  const noHovClass = ratio(atRest, lum(await hoverCell.evaluate((el) => getComputedStyle(el).backgroundColor)));
  check(noHovClass < 1.02, `Negative control: with the hov class removed the identical hover changes nothing (${noHovClass.toFixed(2)}:1)`);
  await hoverRow.evaluate((el) => el.classList.add('hov'));

  // Both charts must answer a plain pointer move over empty plot area, with no click.
  for (const [sel, label] of [
    ['#pipeline svg.chart', 'The monthly revenue chart'],
    ['#pipeline svg.vchart', 'The variance plot'],
  ] as const) {
    await away();
    const c = page.locator(sel).first();
    await c.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const b = (await c.boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.2, { steps: 3 });
    await page.waitForTimeout(220);
    const xh = await c.locator('line.xh').count();
    check(xh === 1, `${label} answers a plain pointer move with a crosshair and no click (${xh} crosshair drawn)`);
  }

  // The control runs on a FRESH load: the hover state is shared by both charts, so a
  // crosshair left over from the check above would be counted as a false survivor and
  // the control would report a failure that says nothing about pointer handling.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pipeline svg.chart');
  await page.waitForTimeout(400);
  const ctrlChart = page.locator('#pipeline svg.chart').first();
  await ctrlChart.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const preCondition = await ctrlChart.locator('line.xh').count();
  // Disable the children too. The capture rect carries `pointer-events: all` in the
  // stylesheet, which overrides `none` inherited from the svg — so setting it on the
  // svg alone leaves the rect live and the control proves nothing. (That it kept
  // working is itself evidence the capture surface does its job.)
  await ctrlChart.evaluate((el) => {
    (el as SVGElement).style.pointerEvents = 'none';
    el.querySelectorAll('*').forEach((c) => ((c as SVGElement).style.pointerEvents = 'none'));
  });
  const cb = (await ctrlChart.boundingBox())!;
  await page.mouse.move(cb.x + cb.width * 0.62, cb.y + cb.height * 0.2, { steps: 3 });
  await page.waitForTimeout(260);
  const deadChart = await ctrlChart.locator('line.xh').count();
  check(preCondition === 0 && deadChart === 0, `Negative control: with pointer events off the identical move draws no crosshair (${preCondition} before, ${deadChart} after)`);
  await ctrlChart.evaluate((el) => {
    (el as SVGElement).style.pointerEvents = '';
    el.querySelectorAll('*').forEach((c) => ((c as SVGElement).style.pointerEvents = ''));
  });
  await away();

  // The pointer shape over a grid of figures must be the arrow, not the writing I-beam.
  const cursors = await page.evaluate(() => ({
    cell: getComputedStyle(document.querySelector('#sales table.mis td')!).cursor,
    head: getComputedStyle(document.querySelector('#sales table.mis th')!).cursor,
    link: getComputedStyle(document.querySelector('#sales table.mis a[href]')!).cursor,
    chart: getComputedStyle(document.querySelector('#pipeline svg.chart')!).cursor,
  }));
  check(
    cursors.cell === 'default' && cursors.head === 'default' && cursors.link === 'pointer' && cursors.chart === 'crosshair',
    `Pointer shapes are declared, not inherited: cell ${cursors.cell}, header ${cursors.head}, link ${cursors.link}, chart ${cursors.chart}`,
  );

  // 5. real keyboard traversal: tab through the page and record the sequence
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#sales table.mis');
  await page.waitForTimeout(800);
  const seq: string[] = [];
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press('Tab');
    const desc = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return 'body';
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}:${label}`;
    });
    seq.push(desc);
  }
  const has = (re: RegExp) => seq.some((s) => re.test(s));
  const order = [seq.findIndex((s) => /^a:Sales$/.test(s)), seq.findIndex((s) => /button:Sort by Vertical/.test(s)), seq.findIndex((s) => /button:Sort by Variance/.test(s)), seq.findIndex((s) => /^a:.*(Mechanical|Vertical Transport|Electrical)/.test(s)), seq.findIndex((s) => /summary:Netting/.test(s)), seq.findIndex((s) => /^svg/.test(s))];
  const inOrder = order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]!));
  check(inOrder && has(/summary:Definitions/), `Tab reaches nav, sort buttons, vertical links, the netting disclosure and the chart in reading order (${seq.filter((s) => s !== 'body').length} stops)`);
  writeFileSync(join(out, 'tab-sequence.json'), JSON.stringify(seq, null, 1));
  const ring = await page.evaluate(() => {
    const a = document.querySelector('#sales a.vlink') as HTMLElement;
    a.focus();
    const cs = getComputedStyle(a);
    return `${cs.outlineStyle} ${cs.outlineWidth}`;
  });
  check(/solid/.test(ring) && !/0px/.test(ring), `Focus ring is visible on links (${ring})`);

  // 6. drill: overview -> vertical -> engineer -> customer table, with return paths
  await page.locator('#sales a.vlink', { hasText: 'Mechanical Systems' }).click();
  await page.waitForURL(/\/v\/mechanical-systems$/, { waitUntil: 'commit' });
  await page.locator('h1', { hasText: /mechanical systems/i }).waitFor({ timeout: 10000 });
  await page.waitForSelector('#engineers table.mis tr.prod');
  const crumbs = await page.locator('.crumbs').innerText();
  check(/overview/i.test(crumbs) && /mechanical systems/i.test(crumbs), `Vertical page opens with a breadcrumb ("${crumbs.replace(/\n/g, ' / ')}")`);
  const sections = await page.locator('section.sec').count();
  check(sections === 6, `Vertical page shows six blocks (${sections})`);

  // 7. alignment with logical coverage and spanning right edges, at 1440 and 1024
  for (const w of [1440, 1024]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
    const a = await alignment(page, '#engineers > .scroll-x > table.mis.dense');
    check(a.out.length === 0 && a.rows > 0, `Sales grid cells cover every logical column and spanning edges match at ${w}px (${a.rows} rows, ${a.cols} columns${a.out.length ? '; ' + a.out.slice(0, 3).join('; ') : ''})`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#engineers > .scroll-x > table.mis.dense').screenshot({ path: join(out, 'gate sales grid aligned.png') });

  // 8. negative control: remove the last cell of a product row in memory; the gate must report it
  const negative = await page.evaluate(`(() => {
    const row = document.querySelector('#engineers > .scroll-x > table.mis.dense tbody tr.prod');
    const removed = row.lastElementChild;
    removed.remove();
    const res = (${ALIGN_FN})('#engineers > .scroll-x > table.mis.dense');
    row.appendChild(removed);
    return res;
  })()`) as { out: string[] };
  check(negative.out.length > 0, `Alignment gate reports a removed cell (negative control: ${negative.out[0] ?? 'nothing reported'})`);
  const after = await alignment(page, '#engineers > .scroll-x > table.mis.dense');
  check(after.out.length === 0, 'Alignment gate passes again once the cell is restored');

  // 9. header association: every data cell in the sales grid names existing header ids
  const assoc = await page.evaluate(() => {
    const table = document.querySelector('#engineers > .scroll-x > table.mis.dense')!;
    const cells = Array.from(table.querySelectorAll('tbody td, tbody th'));
    let missing = 0;
    for (const c of cells) {
      const h = c.getAttribute('headers');
      if (!h) {
        missing++;
        continue;
      }
      for (const id of h.split(' ')) if (!document.getElementById(id)) missing++;
    }
    const groups = table.querySelectorAll('thead th[scope="colgroup"]').length;
    return { cells: cells.length, missing, groups };
  });
  check(assoc.missing === 0 && assoc.groups === 7, `Every sales grid cell names its headers and the group headers carry scope="colgroup" (${assoc.cells} cells, ${assoc.groups} groups)`);

  // 10. row identity stays visible during horizontal scroll
  const sticky = await page.evaluate(async () => {
    const box = document.querySelector('#engineers .scroll-x') as HTMLElement;
    const first = box.querySelector('tbody th[scope="row"]') as HTMLElement;
    const before = first.getBoundingClientRect().left;
    box.scrollLeft = 600;
    await new Promise((r) => setTimeout(r, 100));
    const after = first.getBoundingClientRect().left;
    const scrolled = box.scrollLeft;
    box.scrollLeft = 0;
    return { before, after, scrolled };
  });
  check(sticky.scrolled > 0 && Math.abs(sticky.before - sticky.after) < 1, `Engineer name stays in place while the grid scrolls ${sticky.scrolled}px horizontally`);

  // 11. engineer page, then the wrong-vertical URL redirects
  const engName = (await page.locator('#engineers a.vlink').first().innerText()).trim();
  await page.locator('#engineers a.vlink').first().click();
  await page.waitForURL(/\/v\/mechanical-systems\/e\//, { waitUntil: 'commit' });
  await page.locator('h1', { hasText: new RegExp(engName.split(' ')[0]!, 'i') }).waitFor({ timeout: 10000 });
  const engSections = await page.locator('section.sec').count();
  check(engSections === 4, `Engineer page opens from the name (h1 "${engName}", ${engSections} sections)`);
  const engUrl = new URL(page.url());
  const engSlug = engUrl.pathname.split('/').pop()!;
  await page.goto(`${base}/v/fabrication/e/${engSlug}`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/v\/mechanical-systems\/e\//, { timeout: 10000 });
  check(/\/v\/mechanical-systems\/e\//.test(page.url()), `An engineer URL under the wrong vertical redirects to the canonical route (${new URL(page.url()).pathname})`);
  const crumbsE = await page.locator('.crumbs').innerText();
  check(/mechanical systems/i.test(crumbsE), `Engineer breadcrumb names the owning vertical ("${crumbsE.replace(/\n/g, ' / ')}")`);

  // 12. customer table from the vertical, then back
  await page.locator('.crumbs a', { hasText: 'Mechanical Systems' }).click();
  await page.waitForURL(/\/v\/mechanical-systems$/, { waitUntil: 'commit' });
  await page.locator('a.drill-link').waitFor();
  await page.locator('a.drill-link').click();
  await page.waitForURL(/\/v\/mechanical-systems\/receivables$/, { waitUntil: 'commit' });
  await page.waitForSelector('#aging table.mis');
  const customers = await page.locator('#aging tr.indent').count();
  const remarks = await page.locator('#aging tr.indent td.remark').count();
  check(customers > 0 && remarks === customers * 2, `Customer table lists ${customers} customers, each with both remarks`);
  const termsOk = await page.evaluate(() => Array.from(document.querySelectorAll('#aging tr.indent td:nth-child(2)')).every((td) => (td.textContent || '').trim().length > 0));
  check(termsOk, 'Every customer row shows its payment terms');
  await page.locator('.crumbs a', { hasText: 'Overview' }).click();
  await page.waitForURL(/\/$/, { waitUntil: 'commit' });
  check(true, 'Breadcrumb returns from the customer table to the overview');

  // 13. every report route renders its heading
  for (const [path, h] of [
    ['/sales', 'Sales'],
    ['/pipeline', 'Pipeline'],
    ['/net-profit', 'Net profit'],
    ['/receivables', 'Receivables'],
    ['/working-capital', 'Working capital'],
    ['/data-basis', 'Data basis'],
  ] as const) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const title = (await page.locator('h1').first().innerText()).trim();
    check(new RegExp(`^${h}$`, 'i').test(title), `${path} renders (h1 "${title}")`);
  }
  const recText = await page.locator('#reconciliation').innerText();
  check(/all pass/i.test(recText), `Data basis page shows the reconciliation result ("${(recText.match(/\d+ of \d+ assertions pass/) ?? [''])[0]}")`);

  // 13b. EVERY route must actually animate on entry, measured as rendered frames.
  // Until 13 Sep 2026 nothing here could tell an animated page from a dead one: the
  // row-reveal fade is imperceptible on its own, so Sales and Net profit — the two
  // pages with no headline strip and no chart — rendered identically from first paint
  // and the principal reported the app as static everywhere but the home page.
  const frameHashes = async (pg: Page, path: string) => {
    const seen = new Set<string>();
    await pg.goto(`${base}${path}`, { waitUntil: 'commit' });
    // Anchor on mount, not on navigation. Entry motion starts when the content exists,
    // so a heavy page that paints late would otherwise be sampled twice while blank and
    // read as static. Waiting for the h1 makes the window the same on every route.
    await pg.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
    for (const gap of [0, 60, 90, 140, 220, 400]) {
      await pg.waitForTimeout(gap);
      const buf = await pg.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 860 } });
      seen.add(createHash('md5').update(buf).digest('hex'));
    }
    return seen.size;
  };
  for (const path of ['/', '/sales', '/pipeline', '/net-profit', '/receivables', '/working-capital', '/data-basis']) {
    const n = await frameHashes(page, path);
    check(n >= 3, `${path} animates on entry (${n} distinct rendered frames across the first 1.4s; a static page gives 2)`);
  }

  // 14. invalid route, missing data, malformed data
  await page.goto(`${base}/no/such/page`, { waitUntil: 'networkidle' });
  const nf = (await page.locator('h1').first().innerText()).trim();
  check(/nothing here/i.test(nf), `Invalid route shows the not-found page (h1 "${nf}")`);
  expectMissing = true;
  await page.goto(`${base}/v/no-such-vertical`, { waitUntil: 'networkidle' });
  const missing = await page.locator('.errbox').innerText();
  expectMissing = false;
  check(/no such vertical/i.test(missing) && /not found|HTTP|valid JSON/i.test(missing), `Missing vertical data shows a readable error ("${missing.replace(/\n/g, ' ').slice(0, 90)}"; ${expected404} expected 404 in the console)`);
  await page.route('**/data/rollup.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"meta": {}}' }));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const malformed = await page.locator('.errbox').innerText();
  check(/expected shape/i.test(malformed), `Malformed data shows a readable shape error ("${malformed.replace(/\n/g, ' ').slice(0, 110)}")`);
  await page.unroute('**/data/rollup.json');
  await context.close();

  // 15. reduced motion: nothing animates and the page is complete
  const { context: rc, page: rp } = await newPage(1440, 'reduce');
  await rp.goto(`${base}/`, { waitUntil: 'networkidle' });
  await rp.waitForSelector('#sales table.mis');
  await rp.waitForTimeout(400);
  const anims = await rp.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  const opacityOk = await rp.evaluate(() => Array.from(document.querySelectorAll('section.sec, tr')).every((el) => getComputedStyle(el).opacity === '1'));
  check(anims === 0 && opacityOk, `Under reduced motion nothing is animating and every section and row is fully visible (${anims} running animations)`);
  // Negative control for check 13b: with motion off the same page must render STATIC.
  const staticFrames = new Set<string>();
  await rp.goto(`${base}/sales`, { waitUntil: 'commit' });
  await rp.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
  for (const gap of [0, 60, 90, 140, 220, 400]) {
    await rp.waitForTimeout(gap);
    staticFrames.add(createHash('md5').update(await rp.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 860 } })).digest('hex'));
  }
  check(staticFrames.size <= 2, `Negative control: under reduced motion /sales renders static (${staticFrames.size} distinct frames, against ${'>=3'} with motion on)`);
  await rp.locator('.ask-launch').click();
  await rp.waitForSelector('[data-testid="ask-panel"]');
  const panelAnims = await rp.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  check(panelAnims === 0, `Under reduced motion the Ask the MIS panel opens without animating (${panelAnims} running animations)`);
  await rc.close();

  /* ---------- Ask the MIS panel ---------- */
  const { context: ac, page: ap } = await newPage(1440);
  await ap.goto(`${base}/`, { waitUntil: 'networkidle' });
  await ap.waitForSelector('#sales table.mis');
  await ap.waitForTimeout(400);

  // 16. opens with the keyboard shortcut and focus lands in the question input
  await ap.keyboard.press('Control+KeyK');
  await ap.waitForSelector('[data-testid="ask-panel"]', { timeout: 5000 });
  const focusInInput = await ap.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return !!el && el.tagName === 'INPUT' && !!el.closest('[data-testid="ask-panel"]');
  });
  check(focusInInput, 'Ask the MIS opens with Ctrl+K and focus lands in the question input');

  // 17. focus is trapped: forty Tabs and ten Shift+Tabs never leave the panel
  let escaped = 0;
  for (let i = 0; i < 40; i++) {
    await ap.keyboard.press('Tab');
    if (!(await ap.evaluate(() => !!document.activeElement?.closest('[data-testid="ask-panel"]')))) escaped++;
  }
  for (let i = 0; i < 10; i++) {
    await ap.keyboard.press('Shift+Tab');
    if (!(await ap.evaluate(() => !!document.activeElement?.closest('[data-testid="ask-panel"]')))) escaped++;
  }
  check(escaped === 0, `Focus stays inside the panel across 50 Tab presses (${escaped} escapes)`);

  // 18. Escape closes the panel and returns focus to the launcher
  await ap.keyboard.press('Escape');
  await ap.waitForTimeout(150);
  const closed = (await ap.locator('[data-testid="ask-panel"]').count()) === 0;
  const backOnLauncher = await ap.evaluate(() => document.activeElement?.classList.contains('ask-launch') === true);
  check(closed && backOnLauncher, 'Escape closes the panel and focus returns to the Ask the MIS launcher');

  // 19. a suggested question round-trips to an answer with a page link (a real call to /api/ask)
  await ap.locator('.ask-launch').click();
  await ap.waitForSelector('[data-testid="ask-panel"]');
  const suggestion = (await ap.locator('.ask-sugg').first().innerText()).trim();
  await ap.locator('.ask-sugg').first().click();
  const workingShown = await ap.locator('.ask-working').count();
  await ap.waitForSelector('.ask-turn[data-state="done"], .ask-turn[data-state="error"]', { timeout: 45000 });
  const turnState = await ap.locator('.ask-turn').first().getAttribute('data-state');
  const answerText = (await ap.locator('.ask-turn .ask-a, .ask-turn .ask-err').first().innerText()).trim();
  const linkCount = await ap.locator('.ask-turn .ask-src a').count();
  const linkHref = linkCount ? await ap.locator('.ask-turn .ask-src a').first().getAttribute('href') : null;
  check(turnState === 'done' && workingShown === 1 && answerText.length > 20 && linkCount === 1, `"${suggestion}" round-trips to an answer with a page link (state ${turnState}, link ${linkHref ?? 'none'}, "${answerText.slice(0, 70)}")`);
  const dashes = /[\u2014\u2013]/.test(answerText);
  check(!dashes, 'The answer carries no em or en dash');

  // 20. the page link opens a real page while the panel and the transcript stay on screen
  if (linkCount) {
    await ap.locator('.ask-turn .ask-src a').first().click();
    await ap.waitForTimeout(800);
    const h1 = (await ap.locator('h1').first().innerText()).trim();
    const panelStays = (await ap.locator('[data-testid="ask-panel"]').count()) === 1;
    const turnStays = (await ap.locator('.ask-turn[data-state="done"]').count()) === 1;
    check(h1.length > 0 && !/nothing here/i.test(h1) && panelStays && turnStays, `The answer's page link opens a real page and the conversation stays on screen (${new URL(ap.url()).pathname}, h1 "${h1}")`);
  } else {
    check(false, 'The answer carried no page link to follow');
  }

  // 20b. the transcript survives a reload of the tab, and New chat clears it
  await ap.reload({ waitUntil: 'networkidle' });
  await ap.waitForSelector('#sales table.mis, section.sec');
  await ap.waitForTimeout(400);
  const afterReload = await ap.locator('[data-testid="ask-panel"] .ask-turn[data-state="done"]').count();
  check(afterReload === 1, `After a reload the panel is still open with the answer in it (${afterReload} turn)`);
  await ap.locator('[data-testid="ask-new"]').click();
  await ap.waitForTimeout(200);
  const cleared = (await ap.locator('.ask-turn').count()) === 0 && (await ap.locator('.ask-sugg').count()) === 3;
  check(cleared, 'New chat clears the transcript and shows the three suggestions again');
  await ap.keyboard.press('Escape');
  await ap.waitForTimeout(150);

  // 21. negative control: with the service unreachable the panel says so in words
  expectAskFailure = true;
  await ap.route('**/api/ask', (route) => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>502 Bad Gateway</html>' }));
  await ap.locator('.ask-launch').first().click();
  await ap.waitForSelector('[data-testid="ask-panel"]');
  await ap.locator('input[type="text"]').fill('Is the service up?');
  await ap.keyboard.press('Enter');
  await ap.waitForSelector('.ask-turn[data-state="error"]', { timeout: 10000 });
  const unavailable = (await ap.locator('.ask-err').first().innerText()).trim();
  check(/not available/i.test(unavailable), `With the socket absent (502) the panel shows the unavailable state ("${unavailable}")`);
  await ap.unroute('**/api/ask');

  // 22. the 30-second timeout state renders when the service never answers
  await ap.route('**/api/ask', async (route) => {
    await new Promise((r) => setTimeout(r, 32000));
    await route.abort();
  });
  await ap.locator('input[type="text"]').fill('Will this ever answer?');
  await ap.keyboard.press('Enter');
  await ap.waitForSelector('.ask-turn[data-state="error"]:nth-of-type(2), .ask-turn[data-state="error"] >> nth=1', { timeout: 40000 });
  const timedOut = (await ap.locator('.ask-err').nth(1).innerText()).trim();
  check(/30 seconds/.test(timedOut), `After 30 seconds without a reply the panel shows the timeout state ("${timedOut}")`);
  await ap.unroute('**/api/ask');
  expectAskFailure = false;
  await ac.close();

  // 23. the panel does not break the phone width
  const { context: pc, page: pp } = await newPage(390);
  await pp.goto(`${base}/`, { waitUntil: 'networkidle' });
  await pp.waitForSelector('#sales table.mis');
  await pp.locator('.ask-launch').click();
  await pp.waitForSelector('[data-testid="ask-panel"]');
  const phoneW = await pp.evaluate(() => document.documentElement.scrollWidth);
  const panelW = (await pp.locator('[data-testid="ask-panel"]').boundingBox())?.width ?? 0;
  check(phoneW <= 390 && Math.round(panelW) <= 390 && panelW > 300, `At 390px the open panel keeps the document at ${phoneW}px and fills ${panelW.toFixed(2)}px`);
  await pc.close();

  // 24. console errors
  check(errors.length === 0, `No console errors (${errors.length}; ${expectedAskFailures} expected during the deliberate service failures)`);
  for (const e of errors) console.log('   ' + e);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} interaction checks pass.`);
