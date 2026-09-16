import type { EngineerSummary, MonthPoint, Rollup, VerticalData, VerticalIndexEntry } from '../data/schema';

export type QuarterKey = 'q1' | 'q2' | 'q3' | 'q4';

export interface RankedEngineer extends EngineerSummary {
  rank: number;
  verticalSlug: string;
  verticalName: string;
}

export interface QuarterPerformanceRow {
  slug: string;
  name: string;
  quarter: QuarterKey;
  actual: number | null;
  budget: number | null;
  variance: number | null;
  variancePct: number | null;
  complete: boolean;
}

export interface ExecutiveAnalysis {
  latestActualMonth: { index: number; month: string };
  lastCompletedQuarter: QuarterKey | null;
  companyEngineerLeaderboard: RankedEngineer[];
  engineerLeadersByVertical: Record<string, RankedEngineer>;
  verticalMonthly: Record<string, MonthPoint[]>;
  quarterPerformance: Record<QuarterKey, QuarterPerformanceRow[]>;
}

const QUARTERS: QuarterKey[] = ['q1', 'q2', 'q3', 'q4'];

/** Compact, deterministic cross-company facts that are expensive for a model to discover across separate files. */
export function buildExecutiveAnalysis(
  rollup: Rollup,
  index: VerticalIndexEntry[],
  loadVertical: (entry: VerticalIndexEntry) => VerticalData,
): ExecutiveAnalysis {
  const verticalBySlug = new Map(index.map((entry) => [entry.slug, entry]));
  const engineers = Object.entries(rollup.engineerSplit)
    .flatMap(([verticalSlug, rows]) => {
      const verticalName = verticalBySlug.get(verticalSlug)?.name ?? verticalSlug;
      return rows.map((row) => ({ ...row, verticalSlug, verticalName }));
    })
    .sort((a, b) => b.ytdRevenue - a.ytdRevenue || b.ytdGm - a.ytdGm || a.name.localeCompare(b.name))
    .map((row, i) => ({ ...row, rank: i + 1 }));

  const engineerLeadersByVertical: Record<string, RankedEngineer> = {};
  for (const entry of index) {
    const leader = engineers
      .filter((row) => row.verticalSlug === entry.slug)
      .sort((a, b) => b.ytdRevenue - a.ytdRevenue || b.ytdGm - a.ytdGm || a.name.localeCompare(b.name))[0];
    if (leader) engineerLeadersByVertical[entry.slug] = leader;
  }

  const verticalMonthly: Record<string, MonthPoint[]> = {};
  for (const entry of index) verticalMonthly[entry.slug] = loadVertical(entry).monthly.map((month) => ({ ...month }));

  const latest = [...rollup.monthly].filter((month) => month.actual !== null).sort((a, b) => b.index - a.index)[0];
  const completedQuarterNumber = latest ? Math.floor(latest.index / 3) : 0;
  const lastCompletedQuarter = completedQuarterNumber > 0 ? QUARTERS[completedQuarterNumber - 1]! : null;

  const quarterPerformance: Record<QuarterKey, QuarterPerformanceRow[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const [quarterIndex, quarter] of QUARTERS.entries()) {
    const firstMonth = quarterIndex * 3 + 1;
    for (const entry of index) {
      const months = verticalMonthly[entry.slug]!.filter((month) => month.index >= firstMonth && month.index < firstMonth + 3);
      const complete = months.length === 3 && months.every((month) => month.actual !== null);
      const actual = complete ? months.reduce((sum, month) => sum + month.actual!, 0) : null;
      const budget = complete ? months.reduce((sum, month) => sum + month.budget, 0) : null;
      const variance = actual !== null && budget !== null ? actual - budget : null;
      const variancePct = variance !== null && budget ? Number(((variance / budget) * 100).toFixed(1)) : null;
      quarterPerformance[quarter].push({ slug: entry.slug, name: entry.name, quarter, actual, budget, variance, variancePct, complete });
    }
  }

  return {
    latestActualMonth: latest ? { index: latest.index, month: latest.month } : { index: 0, month: 'None' },
    lastCompletedQuarter,
    companyEngineerLeaderboard: engineers,
    engineerLeadersByVertical,
    verticalMonthly,
    quarterPerformance,
  };
}
