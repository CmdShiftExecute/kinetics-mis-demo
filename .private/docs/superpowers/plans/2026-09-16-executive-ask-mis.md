# Executive Ask MIS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve readable financial precision and make Ask MIS answer grounded executive ranking, trend and calculation questions across the company.

**Architecture:** A shared adaptive formatter controls every visible AED value. A pure server-side analysis builder produces a compact cross-company dataset from the existing published JSON; the grounding layer gives Claude this dataset and mechanically validates its citations and calculations.

**Tech Stack:** TypeScript 6, React 19, Bun tests, Vite, Playwright.

## Global Constraints

- AED values remain stored as integer thousands; only presentation changes.
- Use two decimals from AED 1m to below AED 10m, one decimal at AED 10m and above, and whole thousands below AED 1m.
- Every answer number must be cited or be a recomputed calculation.
- Missing data must be described specifically; unsupported figures must never be invented.
- Keep the existing Claude OAuth/subscription provider and Unix-socket service architecture.

---

### Task 1: Adaptive money precision

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `server/format.test.ts`
- Modify: `server/grounding.ts`
- Modify: `server/grounding.test.ts`
- Modify: `scripts/ask_regression.ts`

**Interfaces:**
- Produces: `k(thousands: number): string` and `mil(thousands: number, decimals?: number): string` with adaptive precision.
- Produces: compact-number audit forms matching the displayed precision.

- [ ] Add failing assertions for `k(5048) === '5.05m'`, `k(4982) === '4.98m'`, `k(135000) === '135m'`, and citation acceptance of `AED 5.05 million` for a stored value of `5048`.
- [ ] Run `bun test server/format.test.ts server/grounding.test.ts` and confirm failures are caused by one-decimal formatting.
- [ ] Add one shared precision selector and use it in UI formatting, grounding number forms and live regression expectations.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Deterministic executive analysis context

**Files:**
- Create: `server/analysis.ts`
- Create: `server/analysis.test.ts`
- Modify: `server/ask.ts`
- Modify: `server/grounding.ts`
- Modify: `server/grounding.test.ts`

**Interfaces:**
- Produces: `buildExecutiveAnalysis(rollup, index, loadVertical): ExecutiveAnalysis`.
- `ExecutiveAnalysis` contains `companyEngineerLeaderboard`, `engineerLeadersByVertical`, `verticalMonthly`, `quarterPerformance`, `latestActualMonth` and `lastCompletedQuarter`.
- Grounding accepts `analysis` as a citation root alongside `rollup`, `vertical` and `engineer`.

- [ ] Write tests using the published dataset that assert the company revenue leader, one leader per vertical, ten vertical monthly series, the last completed quarter and reconciled quarterly sums.
- [ ] Run `bun test server/analysis.test.ts` and confirm the missing module is the RED result.
- [ ] Implement the pure builder with no model calls and no duplicated source values.
- [ ] Add the compact analysis JSON to service context and to the published-number audit.
- [ ] Extend path resolution, prompt construction, page binding and rankable extremes to support `analysis.*` citations.
- [ ] Run analysis and grounding tests and confirm they pass.

### Task 3: Executive analyst instructions and safeguards

**Files:**
- Modify: `server/grounding.ts`
- Modify: `server/grounding.test.ts`
- Modify: `server/ask.ts`
- Modify: `scripts/ask_regression.ts`

**Interfaces:**
- Produces: a system prompt that defaults ambiguous “best” questions to the agreed business measures and requires useful fallback analysis.
- Preserves: citation, arithmetic, direction, superlative, self-correction and money-style validation.

- [ ] Add prompt tests requiring ranking, comparison, calculation, default measures, specific missing-data explanations and closest-useful-answer behaviour.
- [ ] Add validator tests for company-wide engineer ranking and calculated monthly/quarterly answers from `analysis` paths.
- [ ] Run the focused tests and confirm the new expectations fail under the lookup-bot prompt.
- [ ] Rewrite the behavioural rules and extend company-wide superlative validation without weakening number checks.
- [ ] Expand the live regression question set and expected pages for the three executive examples.
- [ ] Run grounding tests and compile the Ask service and regression script.

### Task 4: Panel copy and end-to-end verification

**Files:**
- Modify: `src/components/Ask.tsx`
- Modify: `src/lib/askSuggestions.ts`
- Modify: `docs/ASK_THE_MIS.md`
- Modify: `scripts/interactions.ts`

**Interfaces:**
- Produces: executive-analysis panel copy and suggestions.
- Preserves: keyboard access, focus trap, persisted conversation, error and timeout states.

- [ ] Add interaction expectations for the revised description, suggestions and an analytical answer with a verified calculation.
- [ ] Run the focused browser check and confirm the old copy fails.
- [ ] Update the copy, suggestions and plain-language documentation.
- [ ] Run unit tests, typecheck, lint, contrast and production build.
- [ ] Run the full 120+ browser interaction suite and responsive screenshots at 390px, 1024px and 1440px.
- [ ] Inspect representative overview, sales, vertical and Ask panel screenshots and confirm there is no clipping, collision or unexpected horizontal overflow.
