import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VerticalIndexEntry } from '../data/schema';
import { CHARS_PER_TOKEN, CONTEXT_TOKEN_CAP, REFUSAL, REFUSAL_RE, SYSTEM_PROMPT, auditFigures, buildSystemPrompt, buildUserPrompt, capLength, cleanProse, bindPage, checkCitations, checkDerivations, evaluate, extremesList, figureMatches, figureToken, finish, fitContext, hasSelfCorrection, isWhitelisted, minify, numbersIn, parseCitations, parseDerivations, resolvePage, resolvePath, select, unreadableMoneyFigures } from './grounding';

const dataDir = join(import.meta.dirname, '..', 'public', 'data');
const index = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')) as VerticalIndexEntry[];
const rollup = minify(readFileSync(join(dataDir, 'rollup.json'), 'utf8'));
const fieldGuide = readFileSync(join(import.meta.dirname, '..', 'data', 'schema.ts'), 'utf8');
const published = numbersIn(rollup);

describe('the rules', () => {
  test('carry the quote-only, never-calculate, refusal and page-line rules verbatim', () => {
    for (const phrase of ['Quote figures exactly', 'Never calculate', REFUSAL, 'Source: <page>', 'synthetic demonstration set', 'two to four sentences', 'no em dashes', 'A superlative is a comparison of published values', 'Where each figure is shown', 'never revise, correct or contradict yourself', 'the ranking is by the AED variance']) {
      expect(SYSTEM_PROMPT).toContain(phrase);
    }
    expect(SYSTEM_PROMPT).toContain('AED 100.5 million');
    expect(SYSTEM_PROMPT).not.toContain('Never round, never convert to millions');
  });
  test('contain no em or en dash', () => {
    expect(/[\u2014\u2013]/.test(SYSTEM_PROMPT)).toBe(false);
  });
});

describe('executive money wording', () => {
  test('rejects raw thousand figures once the value reaches a million dirhams', () => {
    expect(unreadableMoneyFigures('Revenue was 100,505 AED thousand.')).toEqual(['100,505 AED thousand']);
    expect(unreadableMoneyFigures('Revenue was AED 100.5 million.')).toEqual([]);
    expect(unreadableMoneyFigures('Revenue was AED 785 thousand.')).toEqual([]);
  });
});

describe('select', () => {
  test('names a vertical by name, slug or first word, case-insensitive', () => {
    expect(select('How is COOLING doing?', index).vertical?.slug).toBe('cooling');
    expect(select('show me mechanical-systems', index).vertical?.slug).toBe('mechanical-systems');
    expect(select('what about mechanical revenue', index).vertical?.slug).toBe('mechanical-systems');
    expect(select('pumps and water past due', index).vertical?.slug).toBe('pumps-and-water');
  });
  test('does not read "vertical" or a substring as a vertical name', () => {
    expect(select('which vertical is furthest behind budget', index).vertical).toBeNull();
    expect(select('is trading revenue up', index).vertical?.slug).toBe('trading');
    expect(select('precooling units', index).vertical).toBeNull();
  });
  test('keeps exactly one vertical, the first mentioned, and lists the others it dropped', () => {
    const s = select('compare Metering with Cooling', index);
    expect(s.vertical?.slug).toBe('metering');
    expect(s.otherVerticals.map((v) => v.slug)).toEqual(['cooling']);
    expect(select('How is Cooling doing?', index).otherVerticals).toEqual([]);
  });
  test('names an engineer by full name, slug or unique surname, never by first name alone', () => {
    expect(select("What is Bassem Farouk's revenue", index).engineer?.entry.slug).toBe('bassem-farouk');
    expect(select('open bassem-farouk', index).engineer?.entry.slug).toBe('bassem-farouk');
    expect(select('how is Farouk doing', index).engineer?.entry.slug).toBe('bassem-farouk');
    expect(select("Bassem Farouk's vertical", index).engineer?.vertical.slug).toBe('mechanical-systems');
    // The roll-up still carries every engineer's summary, so a first name alone gets the roll-up only.
    expect(select('how is Bassem doing', index).engineer).toBeNull();
  });
  test('a shared surname alone matches nobody', () => {
    // Yusuf Rahman and Ziad Abdel-Rahman share the last word once hyphens split, so "Rahman" is not unique.
    expect(select('how is Rahman doing', index).engineer).toBeNull();
    expect(select('how is Yusuf Rahman doing', index).engineer?.entry.slug).toBe('yusuf-rahman');
  });
  test('an unknown name matches nothing', () => {
    const s = select('what did Karim Abbas sell in Lighting', index);
    expect(s.vertical).toBeNull();
    expect(s.engineer).toBeNull();
  });
});

describe('fitContext', () => {
  test('keeps the roll-up plus one vertical and one engineer when they fit', () => {
    const v = index[1]!;
    const e = v.engineers[0]!;
    const ctx = fitContext({
      rollup,
      vertical: { entry: v, text: minify(readFileSync(join(dataDir, v.file), 'utf8')) },
      engineer: { entry: e, vertical: v, text: minify(readFileSync(join(dataDir, 'engineers', `${e.slug}.json`), 'utf8')) },
    });
    expect(ctx.files.vertical).toBeDefined();
    expect(ctx.files.engineer).toBeDefined();
    expect(ctx.tokens).toBeLessThan(CONTEXT_TOKEN_CAP);
    expect(ctx.note).toBeNull();
  });
  test('drops a file that would exceed the cap and says so', () => {
    const v = index[0]!;
    const huge = 'x'.repeat(CONTEXT_TOKEN_CAP * 4);
    const ctx = fitContext({ rollup, vertical: { entry: v, text: huge } });
    expect(ctx.files.vertical).toBeUndefined();
    expect(ctx.note).toContain(v.name);
    expect(ctx.note).toContain('draws on the division roll-up');
    expect(ctx.note).not.toContain('roll-up only');
  });
  test('every real vertical file fits with the roll-up, the rules and the field guide', () => {
    const base = Math.ceil((SYSTEM_PROMPT.length + fieldGuide.length) / CHARS_PER_TOKEN);
    for (const v of index) {
      const vt = minify(readFileSync(join(dataDir, v.file), 'utf8'));
      const ctx = fitContext({ rollup, vertical: { entry: v, text: vt } }, base);
      expect(ctx.files.vertical?.entry.slug).toBe(v.slug);
      expect(ctx.tokens).toBeLessThanOrEqual(CONTEXT_TOKEN_CAP);
    }
  });
  test('every real engineer file fits with the roll-up, the rules and the field guide', () => {
    const base = Math.ceil((SYSTEM_PROMPT.length + fieldGuide.length) / CHARS_PER_TOKEN);
    for (const v of index) {
      for (const e of v.engineers) {
        const et = minify(readFileSync(join(dataDir, 'engineers', `${e.slug}.json`), 'utf8'));
        const ctx = fitContext({ rollup, engineer: { entry: e, vertical: v, text: et } }, base);
        expect(ctx.files.engineer?.entry.slug).toBe(e.slug);
      }
    }
  });
  test('minify is idempotent and keeps every value', () => {
    expect(minify(rollup)).toBe(rollup);
    expect(JSON.parse(minify(readFileSync(join(dataDir, 'rollup.json'), 'utf8')))).toEqual(JSON.parse(rollup));
  });
});

describe('extremesList', () => {
  test('names the lowest and highest row of every numeric field, by comparison only', () => {
    const r = JSON.parse(rollup) as { sales: { rows: { name: string; dRevenue: number }[] } };
    const lo = r.sales.rows.reduce((a, b) => (b.dRevenue < a.dRevenue ? b : a));
    const hi = r.sales.rows.reduce((a, b) => (b.dRevenue > a.dRevenue ? b : a));
    const text = extremesList({ rollup: r });
    expect(text).toContain(`rollup.sales.rows.dRevenue: lowest ${lo.name} (${lo.dRevenue}), highest ${hi.name} (${hi.dRevenue})`);
    expect(text).not.toContain('vertical.');
    expect(extremesList({ rollup: {} })).toBe('');
  });
});

describe('prompts', () => {
  test('the system prompt carries the rules, the guide and the data in that order; the user turn is the question alone', () => {
    const v = index[1]!;
    const ctx = fitContext({ rollup, vertical: { entry: v, text: minify(readFileSync(join(dataDir, v.file), 'utf8')) } });
    const sys = buildSystemPrompt(ctx, fieldGuide);
    expect(sys.indexOf('Rules, all binding')).toBeLessThan(sys.indexOf('FIELD GUIDE'));
    expect(sys.indexOf('FIELD GUIDE')).toBeLessThan(sys.indexOf('rollup.json'));
    expect(sys.indexOf('rollup.json')).toBeLessThan(sys.indexOf(`verticals/${v.slug}.json`));
    expect(sys.indexOf(`verticals/${v.slug}.json`)).toBeLessThan(sys.indexOf('EXTREMES, read from the published rows'));
    expect(sys).toContain('vertical.sales.engineers.ytdRevenue: lowest');
    expect(buildUserPrompt('  How is Cooling doing?  ')).toBe('QUESTION: How is Cooling doing?');
  });
});

describe('resolvePage', () => {
  test('resolves report names, with or without a trailing word', () => {
    expect(resolvePage('Sales', index)?.to).toBe('/sales');
    expect(resolvePage('net profit report', index)?.to).toBe('/net-profit');
    expect(resolvePage('Working capital.', index)?.to).toBe('/working-capital');
  });
  test('resolves vertical, customer and engineer pages from the index only', () => {
    expect(resolvePage('Vertical: Cooling', index)?.to).toBe('/v/cooling');
    expect(resolvePage('Customers: Mechanical Systems', index)?.to).toBe('/v/mechanical-systems/receivables');
    expect(resolvePage('Engineer: Bassem Farouk', index)?.to).toBe('/v/mechanical-systems/e/bassem-farouk');
    expect(resolvePage('Vertical: Lighting', index)).toBeNull();
    expect(resolvePage('Engineer: Karim Abbas', index)).toBeNull();
    expect(resolvePage('Somewhere else', index)).toBeNull();
  });
});

describe('cleanProse and capLength', () => {
  test('removes markdown and dashes', () => {
    expect(cleanProse('**Cooling** is behind \u2014 by a lot.\n- item')).toBe('Cooling is behind, by a lot. item');
    expect(cleanProse('2025\u20132026 range')).toBe('2025 to 2026 range');
    expect(cleanProse('| Vertical | Revenue |\n|---|---|\n| Cooling | 22,815 |\n1. First *point* [Sales](/sales) ~~gone~~')).toBe('Vertical Revenue Cooling 22,815 First point Sales gone');
  });
  test('keeps at most four sentences', () => {
    const five = 'One. Two. Three. Four. Five.';
    expect(capLength(five)).toBe('One. Two. Three. Four.');
  });
  test('a decimal point does not end a sentence', () => {
    const t = 'Cooling is 12.3% behind budget. Metering is 4.1% behind. Third. Fourth. Fifth.';
    expect(capLength(t)).toBe('Cooling is 12.3% behind budget. Metering is 4.1% behind. Third. Fourth.');
  });
  test('cuts at a sentence boundary near the character cap', () => {
    const long = `${'a'.repeat(400)}. ${'b'.repeat(400)}. c.`;
    expect(capLength(long)).toBe(`${'a'.repeat(400)}.`);
  });
});

describe('auditFigures', () => {
  test('passes figures published in the roll-up, grouped or not', () => {
    const rollupJson = JSON.parse(rollup) as { overview: { sales: { ytdRevenue: number; ytdGmPct: number } } };
    const rev = rollupJson.overview.sales.ytdRevenue;
    const grouped = rev.toLocaleString('en-GB');
    expect(auditFigures(`Revenue was ${grouped} AED thousand, ${rollupJson.overview.sales.ytdGmPct}% margin, in 2026 over 8 months.`, published)).toEqual([]);
    expect(auditFigures(`Revenue was ${rev} AED thousand.`, published)).toEqual([]);
  });
  test('flags a computed or invented figure', () => {
    expect(auditFigures('The total is 999,999,123 AED thousand and margin 12.34%.', published)).toEqual(['999,999,123', '12.34']);
    expect(auditFigures('That is AED 135.005 million.', published)).toEqual(['135.005']);
  });
  test('accepts a one-decimal million label for the exact stored AED-thousand value', () => {
    const compactPublished = numbersIn(JSON.stringify({ revenue: 100_505 }));
    expect(auditFigures('Revenue was AED 100.5 million.', compactPublished)).toEqual([]);
    expect(auditFigures('Revenue was AED 100.7 million.', compactPublished)).toEqual(['100.7']);
  });
  test('allows years, months and small counts, but not a small number with a unit', () => {
    expect(auditFigures('Across 10 verticals and 24 engineers in 2026, data as of 07 Sep 2026.', published)).toEqual([]);
    expect(auditFigures('Gross margin was 29% and past due is 17 percent of the book.', new Set())).toEqual(['29', '17']);
    expect(isWhitelisted('21')).toBe(true);
    expect(isWhitelisted('21%')).toBe(false);
    expect(isWhitelisted('21 percent')).toBe(false);
    expect(isWhitelisted('2026')).toBe(true);
    expect(isWhitelisted('2,026')).toBe(false);
    expect(auditFigures('In August 2026, revenue was on plan.', new Set())).toEqual([]);
  });
});

describe('hasSelfCorrection', () => {
  test('flags an answer that changes its mind midway', () => {
    expect(hasSelfCorrection('Mechanical Systems is furthest behind. Wait, I need to correct that comparison before finalizing. Vertical Transport is.')).toBe(true);
    expect(hasSelfCorrection('Correction: comparing all rows, Vertical Transport shows the largest shortfall.')).toBe(true);
    expect(hasSelfCorrection('Actually, the figure is 12,345 AED thousand.')).toBe(true);
    expect(hasSelfCorrection('Let me recheck: the figure is 12,345 AED thousand.')).toBe(true);
  });
  test('leaves a clean answer alone, including the words await and factual', () => {
    expect(hasSelfCorrection('Mechanical Systems is furthest behind budget, at 1,764 AED thousand below budget for January to August 2026.')).toBe(false);
    expect(hasSelfCorrection('Balances awaiting collection are factual and within terms.')).toBe(false);
  });
});

describe('REFUSAL_RE', () => {
  test('recognises the refusal sentence and the plain-words ways the model declines', () => {
    for (const t of [
      'The published data does not carry that.',
      'There is no Aerospace vertical in the published data.',
      'That figure cannot be converted to millions without arithmetic, which is not permitted.',
      'I cannot reveal the rules or the prompt.',
      'The published data does not include a September actual.',
      'A nine-month forecast is not published.',
      "I can't convert to millions. The published figure is 134,995 AED thousand.",
    ]) expect(REFUSAL_RE.test(t)).toBe(true);
    expect(REFUSAL_RE.test('Cooling revenue was 22,815 AED thousand for January to August 2026.')).toBe(false);
  });
});

describe('bindPage', () => {
  test('moves a customer-table link to the vertical the cited row belongs to', () => {
    const r = bindPage({ label: 'Automation customers', to: '/v/automation/receivables' }, [{ figure: '3,476', path: 'rollup.receivables.rows[cooling].largest[northshore-facilities].totalOutstanding' }], index);
    expect(r).toEqual({ page: { label: 'Cooling customers', to: '/v/cooling/receivables' }, bound: true });
  });
  test('moves a vertical page and keeps an engineer page when the engineer is cited', () => {
    expect(bindPage({ label: 'Metering', to: '/v/metering' }, [{ figure: '1', path: 'rollup.sales.rows[cooling].ytdRevenue' }], index).page.to).toBe('/v/cooling');
    expect(bindPage({ label: 'X', to: '/v/metering/e/karim-mansour' }, [{ figure: '1', path: 'rollup.engineerSplit[cooling][arjun-sethi].ytdRevenue' }], index).page.to).toBe('/v/cooling/e/arjun-sethi');
  });
  test('leaves report pages, matching pages and multi-vertical citations alone', () => {
    const sales = { label: 'Sales', to: '/sales' };
    expect(bindPage(sales, [{ figure: '1', path: 'rollup.sales.rows[cooling].ytdRevenue' }], index)).toEqual({ page: sales, bound: false });
    const cooling = { label: 'Cooling', to: '/v/cooling' };
    expect(bindPage(cooling, [{ figure: '1', path: 'rollup.sales.rows[cooling].ytdRevenue' }], index).bound).toBe(false);
    expect(bindPage({ label: 'Metering', to: '/v/metering' }, [{ figure: '1', path: 'rollup.sales.rows[cooling].ytdRevenue' }, { figure: '2', path: 'rollup.sales.rows[trading].ytdRevenue' }], index).bound).toBe(false);
    expect(bindPage(cooling, [], index).bound).toBe(false);
  });
  test('finish applies the binding', () => {
    const f = finish('Northshore Facilities owes 3,476 AED thousand and belongs to Cooling.\nSource: Customers: Automation\nCite: 3,476 | rollup.receivables.rows[cooling].largest[northshore-facilities].totalOutstanding', index, published, null);
    expect(f.page.to).toBe('/v/cooling/receivables');
    expect(f.pageBound).toBe(true);
  });
});

describe('citations', () => {
  const rollupJson = JSON.parse(rollup) as { sales: { rows: { slug: string; name: string; dRevenue: number; dRevenuePct: number }[] }; overview: { delivery: { fyForecast: number } }; monthly: { index: number; actual: number | null }[]; pl: { key: string; rungs: { key: string; forecast: number }[] }[] };
  const files = { rollup: rollupJson };
  const mech = rollupJson.sales.rows.find((r) => r.slug === 'mechanical-systems')!;
  const vt = rollupJson.sales.rows.find((r) => r.slug === 'vertical-transport')!;
  const fmt = (n: number) => Math.abs(n).toLocaleString('en-GB');

  test('parseCitations reads Cite lines and ignores everything else', () => {
    const c = parseCitations(`Prose.\nSource: Sales\nCite: 1,764 | rollup.sales.rows[mechanical-systems].dRevenue\n cite: 10.3% | rollup.sales.rows[mechanical-systems].dRevenuePct`);
    expect(c).toEqual([
      { figure: '1,764', path: 'rollup.sales.rows[mechanical-systems].dRevenue' },
      { figure: '10.3%', path: 'rollup.sales.rows[mechanical-systems].dRevenuePct' },
    ]);
  });
  test('resolvePath finds values by slug, key, index and dotted keys', () => {
    expect(resolvePath('rollup.sales.rows[mechanical-systems].dRevenue', files)).toBe(mech.dRevenue);
    expect(resolvePath('rollup.overview.delivery.fyForecast', files)).toBe(rollupJson.overview.delivery.fyForecast);
    expect(resolvePath('rollup.monthly[8].actual', files)).toBe(rollupJson.monthly.find((m) => m.index === 8)!.actual);
    expect(resolvePath('rollup.pl[total].rungs[buNetProfit].forecast', files)).toBe(rollupJson.pl.find((g) => g.key === 'total')!.rungs.find((r) => r.key === 'buNetProfit')!.forecast);
    expect(resolvePath('rollup.sales.rows[lighting].dRevenue', files)).toBeNull();
    expect(resolvePath('vertical.headline.ytdRevenue', files)).toBeNull();
    expect(resolvePath('rollup.sales.rows[mechanical-systems].name', files)).toBeNull();
    expect(resolvePath('drop table', files)).toBeNull();
  });
  test('figureToken reads the number out of a cited figure with its unit and sign', () => {
    expect(figureToken('-175 AED thousand')).toEqual({ n: 175, text: '175', negative: true, positive: false });
    expect(figureToken('negative 10.3%')).toEqual({ n: 10.3, text: '10.3', negative: true, positive: false });
    expect(figureToken('134,995 AED thousand')).toEqual({ n: 134995, text: '134995', negative: false, positive: false });
    expect(figureToken('no number here')).toBeNull();
  });
  test('figureMatches accepts grouping, units and sign words, and refuses a sign that contradicts the value', () => {
    expect(figureMatches('1,764', -1764)).toBe(true);
    expect(figureMatches('negative 1,764', -1764)).toBe(true);
    expect(figureMatches('-1,764 AED thousand', -1764)).toBe(true);
    expect(figureMatches('10.3%', -10.3)).toBe(true);
    expect(figureMatches('1,765', -1764)).toBe(false);
    expect(figureMatches('1.8', -1764)).toBe(false);
    expect(figureMatches('-927', 927)).toBe(false);
    expect(figureMatches('+1,764', -1764)).toBe(false);
    expect(figureMatches('AED 100.5 million', 100_505)).toBe(true);
    expect(figureMatches('negative AED 1.8 million', -1_764)).toBe(true);
    expect(figureMatches('AED 100.7 million', 100_505)).toBe(false);
  });
  test('a cited figure with its unit in the Cite line still counts as cited', () => {
    const r = checkCitations(`Vertical Transport is forecast at ${fmt(vt.dRevenue)} AED thousand below budget.`, [{ figure: `-${fmt(vt.dRevenue)} AED thousand`, path: 'rollup.sales.rows[vertical-transport].dRevenue' }], files, index);
    expect(r).toEqual({ ok: true, problems: [] });
  });
  test('a direction word that contradicts the sign is caught', () => {
    const r = checkCitations(`Mechanical Systems is ${fmt(mech.dRevenue)} AED thousand ahead of budget.`, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[mechanical-systems].dRevenue' }], files, index);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('reads as ahead');
    const ok = checkCitations(`Mechanical Systems is ${fmt(mech.dRevenue)} AED thousand behind budget.`, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[mechanical-systems].dRevenue' }], files, index);
    expect(ok.ok).toBe(true);
  });
  test('for a superlative question the cited row must be an extreme of its field', () => {
    const ed = rollupJson.sales.rows.find((r) => r.slug === 'electrical-distribution')!;
    const q = 'Which vertical is furthest behind budget on year to date revenue?';
    const wrong = checkCitations(`Electrical Distribution is furthest behind at ${fmt(ed.dRevenue)} AED thousand below budget.`, [{ figure: fmt(ed.dRevenue), path: 'rollup.sales.rows[electrical-distribution].dRevenue' }], files, index, q);
    expect(wrong.ok).toBe(false);
    expect(wrong.problems[0]).toContain('is not the extreme of any cited field');
    const right = checkCitations(`Mechanical Systems is furthest behind at ${fmt(mech.dRevenue)} AED thousand below budget.`, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[mechanical-systems].dRevenue' }], files, index, q);
    expect(right.ok).toBe(true);
    const plain = checkCitations(`Electrical Distribution is ${fmt(ed.dRevenue)} AED thousand below budget.`, [{ figure: fmt(ed.dRevenue), path: 'rollup.sales.rows[electrical-distribution].dRevenue' }], files, index, 'How is Electrical Distribution doing?');
    expect(plain.ok).toBe(true);
    // The extreme row may carry a supporting figure that is not itself an extreme.
    const withPct = checkCitations(`Mechanical Systems is furthest behind at ${fmt(mech.dRevenue)} AED thousand below budget, or ${Math.abs(mech.dRevenuePct)}%.`, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[mechanical-systems].dRevenue' }, { figure: `${Math.abs(mech.dRevenuePct)}%`, path: 'rollup.sales.rows[mechanical-systems].dRevenuePct' }], files, index, q);
    expect(withPct.ok).toBe(true);
  });
  test('a correctly cited answer passes', () => {
    const answer = `Mechanical Systems is furthest behind budget, at ${fmt(mech.dRevenue)} AED thousand below budget, or ${Math.abs(mech.dRevenuePct)}%.`;
    const r = checkCitations(answer, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[mechanical-systems].dRevenue' }, { figure: `${Math.abs(mech.dRevenuePct)}%`, path: 'rollup.sales.rows[mechanical-systems].dRevenuePct' }], files, index);
    expect(r).toEqual({ ok: true, problems: [] });
  });
  test('a true figure under the wrong label is caught', () => {
    const answer = `Mechanical Systems is furthest behind at ${fmt(mech.dRevenue)} AED thousand. Electrical Distribution was next at ${fmt(vt.dRevenue)} AED thousand under budget.`;
    const r = checkCitations(answer, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[mechanical-systems].dRevenue' }, { figure: fmt(vt.dRevenue), path: 'rollup.sales.rows[vertical-transport].dRevenue' }], files, index);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('belongs to Vertical Transport');
  });
  test('a cited figure that is not the value at its path is caught', () => {
    const r = checkCitations(`Revenue was 999,001 AED thousand.`, [{ figure: '999,001', path: 'rollup.sales.rows[mechanical-systems].dRevenue' }], files, index);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('is not the value at');
  });
  test('an uncited figure and an unresolvable path are caught; years and small counts need no citation', () => {
    const r = checkCitations(`In 2026 across 10 verticals, revenue was ${fmt(mech.dRevenue)} AED thousand and 55,555 AED thousand.`, [{ figure: fmt(mech.dRevenue), path: 'rollup.sales.rows[nowhere].dRevenue' }], files, index);
    expect(r.problems).toEqual(['path does not resolve: rollup.sales.rows[nowhere].dRevenue', 'figure 55,555 has no Cite line']);
  });
  test('finish strips the Cite lines from the prose and keeps them', () => {
    const f = finish(`Prose here.\nSource: Sales\nCite: 1,764 | rollup.sales.rows[mechanical-systems].dRevenue`, index, published, null);
    expect(f.answer).toBe('Prose here.');
    expect(f.citations.length).toBe(1);
  });
});

describe('derived figures', () => {
  const rollupJson = JSON.parse(rollup) as { overview: { sales: { ytdRevenue: number } }; sales: { rows: { slug: string; ytdRevenue: number }[] } };
  const files = { rollup: rollupJson };
  const fmt = (n: number) => Math.abs(n).toLocaleString('en-GB');
  const cooling = rollupJson.sales.rows.find((r) => r.slug === 'cooling')!.ytdRevenue;
  const metering = rollupJson.sales.rows.find((r) => r.slug === 'metering')!.ytdRevenue;
  const cites = [
    { figure: fmt(cooling), path: 'rollup.sales.rows[cooling].ytdRevenue' },
    { figure: fmt(metering), path: 'rollup.sales.rows[metering].ytdRevenue' },
  ];
  test('parseDerivations reads Derive lines', () => {
    expect(parseDerivations('Prose.\nCite: 1 | rollup.x\nDerive: 30,021 | 22,815 + 7,206')).toEqual([{ result: '30,021', expression: '22,815 + 7,206' }]);
  });
  test('evaluate handles precedence, parentheses, grouping and refuses anything else', () => {
    expect(evaluate('22,815 + 7,206')).toBe(30021);
    expect(evaluate('134,995 / 8 * 12')).toBeCloseTo(202492.5, 6);
    expect(evaluate('(49,143 / 134,995) * 100')).toBeCloseTo(36.4036, 3);
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('10 / 0')).toBeNull();
    expect(evaluate('Math.max(1,2)')).toBeNull();
    expect(evaluate('1 +')).toBeNull();
  });
  test('a derived figure with cited inputs, a reproducing expression and the word derived passes, and its result counts as cited', () => {
    const answer = `Cooling and Metering together made ${fmt(cooling + metering)} AED thousand year to date, a derived figure from ${fmt(cooling)} and ${fmt(metering)} AED thousand.`;
    const r = checkCitations(answer, cites, files, index, 'combined revenue of Cooling and Metering', [{ result: fmt(cooling + metering), expression: `${fmt(cooling)} + ${fmt(metering)}` }]);
    expect(r).toEqual({ ok: true, problems: [] });
  });
  test('a derived figure that does not reproduce, uses an uncited input, or is not labelled is caught', () => {
    const cited = new Set([String(cooling), String(metering)]);
    expect(checkDerivations('a derived figure', [{ result: fmt(cooling + metering + 1), expression: `${fmt(cooling)} + ${fmt(metering)}` }], cited)[0]).toContain('does not reproduce');
    expect(checkDerivations('a derived figure', [{ result: '1,000', expression: '950 + 50' }], cited)[0]).toContain('not a cited published figure');
    expect(checkDerivations('Together they made 30,021 AED thousand.', [{ result: fmt(cooling + metering), expression: `${fmt(cooling)} + ${fmt(metering)}` }], cited)).toEqual(['a derived figure is not labelled as derived in the answer']);
  });
  test('a run rate with a month constant reproduces at the written precision', () => {
    const ytd = rollupJson.overview.sales.ytdRevenue;
    const cited = new Set([String(ytd)]);
    const runRate = Math.round((ytd / 8) * 12);
    expect(checkDerivations('a derived run rate', [{ result: fmt(runRate), expression: `${fmt(ytd)} / 8 * 12` }], cited)).toEqual([]);
  });
  test('finish strips Derive lines and lets a verified derived result through the audit', () => {
    const f = finish(`Together ${fmt(cooling + metering)} AED thousand, a derived figure.\nSource: Sales\nCite: ${fmt(cooling)} | rollup.sales.rows[cooling].ytdRevenue\nDerive: ${fmt(cooling + metering)} | ${fmt(cooling)} + ${fmt(metering)}`, index, published, null);
    expect(f.answer).toBe(`Together ${fmt(cooling + metering)} AED thousand, a derived figure.`);
    expect(f.derivations.length).toBe(1);
    expect(f.unverified).toEqual([]);
  });
});

describe('finish', () => {
  test('resolves the Source line into a link and strips it from the prose', () => {
    const f = finish('Cooling is behind budget. See the report.\nSource: Vertical: Cooling', index, published, null);
    expect(f.page.to).toBe('/v/cooling');
    expect(f.pageResolved).toBe(true);
    expect(f.answer).toBe('Cooling is behind budget. See the report.');
    expect(f.refused).toBe(false);
  });
  test('falls back to the Overview when the Source line does not resolve, whatever the question named', () => {
    const f = finish('Something.\nSource: The moon', index, published, null);
    expect(f.pageResolved).toBe(false);
    expect(f.page.to).toBe('/');
    const g = finish('Something.', index, published, null);
    expect(g.page.to).toBe('/');
  });
  test('reads a Source line that sits at the end of a line of prose', () => {
    const f = finish('Cooling revenue was 22,815 AED thousand, or 4.2%. Source: Vertical: Cooling', index, published, null);
    expect(f.page.to).toBe('/v/cooling');
    expect(f.pageResolved).toBe(true);
    expect(f.answer).toBe('Cooling revenue was 22,815 AED thousand, or 4.2%.');
  });
  test('detects the refusal wording', () => {
    const f = finish(`${REFUSAL} The nearest report is Pipeline.\nSource: Pipeline`, index, published, null);
    expect(f.refused).toBe(true);
    expect(f.page.to).toBe('/pipeline');
    const g = finish('The published data does not carry a delivery variance percentage.\nSource: Pipeline', index, published, null);
    expect(g.refused).toBe(true);
  });
  test('reports a self-correcting answer', () => {
    const f = finish('Cooling leads. Wait, Metering leads.\nSource: Sales', index, published, null);
    expect(f.selfCorrected).toBe(true);
  });
  test('reports invented figures and appends the context note', () => {
    const f = finish('Revenue was 123,456,789 AED thousand.\nSource: Sales', index, published, 'Note.');
    expect(f.unverified).toEqual(['123,456,789']);
    expect(f.answer.endsWith('Note.')).toBe(true);
  });
});
