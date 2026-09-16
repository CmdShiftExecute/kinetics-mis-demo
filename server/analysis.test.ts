import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rollup, VerticalData, VerticalIndexEntry } from '../data/schema';
import { buildExecutiveAnalysis } from './analysis';

const dataDir = join(import.meta.dirname, '..', 'public', 'data');
const rollup = JSON.parse(readFileSync(join(dataDir, 'rollup.json'), 'utf8')) as Rollup;
const index = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')) as VerticalIndexEntry[];
const loadVertical = (entry: VerticalIndexEntry) => JSON.parse(readFileSync(join(dataDir, entry.file), 'utf8')) as VerticalData;

describe('executive analysis context', () => {
  const analysis = buildExecutiveAnalysis(rollup, index, loadVertical);

  test('ranks every company engineer by YTD revenue with supporting GM and budget fields', () => {
    expect(analysis.companyEngineerLeaderboard[0]).toMatchObject({
      rank: 1,
      name: 'Kavya Nair',
      slug: 'kavya-nair',
      verticalSlug: 'electrical-distribution',
      ytdRevenue: 12054,
      ytdGm: 1966,
      ytdGmPct: 16.3,
      budgetRevenue: 12056,
      dRevenue: -2,
    });
    expect(analysis.companyEngineerLeaderboard.every((row, i) => row.rank === i + 1)).toBe(true);
  });

  test('publishes one revenue leader for every vertical', () => {
    expect(Object.keys(analysis.engineerLeadersByVertical)).toHaveLength(index.length);
    expect(analysis.engineerLeadersByVertical['mechanical-systems']).toMatchObject({ name: 'Tarek Hamdan', ytdRevenue: 6130 });
  });

  test('carries all monthly vertical series and identifies the last completed quarter', () => {
    expect(Object.keys(analysis.verticalMonthly)).toHaveLength(index.length);
    expect(Object.values(analysis.verticalMonthly).every((months) => months.length === 12)).toBe(true);
    expect(analysis.latestActualMonth).toEqual({ index: 8, month: 'Aug' });
    expect(analysis.lastCompletedQuarter).toBe('q2');
  });

  test('reconciles quarter performance from the published monthly values', () => {
    const mechanical = analysis.quarterPerformance.q2.find((row) => row.slug === 'mechanical-systems');
    expect(mechanical).toMatchObject({
      name: 'Mechanical Systems',
      actual: 5909,
      budget: 6593,
      variance: -684,
      variancePct: -10.4,
      complete: true,
    });
  });
});
