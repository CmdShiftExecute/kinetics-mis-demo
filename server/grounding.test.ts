import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VerticalIndexEntry } from '../data/schema';
import { CHARS_PER_TOKEN, CONTEXT_TOKEN_CAP, REFUSAL, SYSTEM_PROMPT, auditFigures, buildSystemPrompt, buildUserPrompt, capLength, cleanProse, finish, fitContext, minify, numbersIn, resolvePage, select } from './grounding';

const dataDir = join(import.meta.dirname, '..', 'public', 'data');
const index = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')) as VerticalIndexEntry[];
const rollup = minify(readFileSync(join(dataDir, 'rollup.json'), 'utf8'));
const fieldGuide = readFileSync(join(import.meta.dirname, '..', 'data', 'schema.ts'), 'utf8');
const published = numbersIn(rollup);

describe('the rules', () => {
  test('carry the quote-only, never-calculate, refusal and page-line rules verbatim', () => {
    for (const phrase of ['Quote figures exactly', 'Never calculate', REFUSAL, 'Source: <page>', 'synthetic demonstration set', 'two to four sentences', 'no em dashes', 'A superlative is a comparison of published values', 'Where each figure is shown']) {
      expect(SYSTEM_PROMPT).toContain(phrase);
    }
  });
  test('contain no em or en dash', () => {
    expect(/[\u2014\u2013]/.test(SYSTEM_PROMPT)).toBe(false);
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
  test('keeps exactly one vertical, the first mentioned', () => {
    expect(select('compare Metering with Cooling', index).vertical?.slug).toBe('metering');
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

describe('prompts', () => {
  test('the system prompt carries the rules, the guide and the data in that order; the user turn is the question alone', () => {
    const v = index[1]!;
    const ctx = fitContext({ rollup, vertical: { entry: v, text: minify(readFileSync(join(dataDir, v.file), 'utf8')) } });
    const sys = buildSystemPrompt(ctx, fieldGuide);
    expect(sys.indexOf('Rules, all binding')).toBeLessThan(sys.indexOf('FIELD GUIDE'));
    expect(sys.indexOf('FIELD GUIDE')).toBeLessThan(sys.indexOf('rollup.json'));
    expect(sys.indexOf('rollup.json')).toBeLessThan(sys.indexOf(`verticals/${v.slug}.json`));
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
  test('allows years, months and small counts', () => {
    expect(auditFigures('Across 10 verticals and 24 engineers in 2026, data as of 07 Sep 2026.', published)).toEqual([]);
  });
});

describe('finish', () => {
  const sel = select('How is Cooling doing?', index);
  test('resolves the Source line into a link and strips it from the prose', () => {
    const f = finish('Cooling is behind budget. See the report.\nSource: Vertical: Cooling', sel, index, published, null);
    expect(f.page.to).toBe('/v/cooling');
    expect(f.pageResolved).toBe(true);
    expect(f.answer).toBe('Cooling is behind budget. See the report.');
    expect(f.refused).toBe(false);
  });
  test('falls back to the context page when the Source line does not resolve', () => {
    const f = finish('Something.\nSource: The moon', sel, index, published, null);
    expect(f.pageResolved).toBe(false);
    expect(f.page.to).toBe('/v/cooling');
    const g = finish('Something.', select('anything', index), index, published, null);
    expect(g.page.to).toBe('/');
  });
  test('detects the refusal wording', () => {
    const f = finish(`${REFUSAL} The nearest report is Delivery.\nSource: Delivery`, sel, index, published, null);
    expect(f.refused).toBe(true);
    expect(f.page.to).toBe('/delivery');
  });
  test('reports invented figures and appends the context note', () => {
    const f = finish('Revenue was 123,456,789 AED thousand.\nSource: Sales', sel, index, published, 'Note.');
    expect(f.unverified).toEqual(['123,456,789']);
    expect(f.answer.endsWith('Note.')).toBe(true);
  });
});
