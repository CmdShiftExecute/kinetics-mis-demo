# Kinetics MIS Demo

## What this is

This is a zero-backend management information system demo built for a fictional engineering group, Halvard Engineering Group, Building Technologies Division. It is a static Vite and React page sitting on top of finished JSON tables. Nothing is computed in the browser beyond sorting, filtering and formatting. All data is synthetic and generated from one seed. No real company, person or figure appears anywhere in this repository.

## Routes

The app has three routes, plus a not-found page for anything else.

| Route | Page | Content |
|---|---|---|
| `/` | Front page | Division masthead, a data-as-of stamp, the Readout, and five sections |
| `/v/<slug>` | Vertical page | One vertical, broken into six blocks |
| `/v/<slug>/overdue` | Overdue page | The customer aging table for that vertical |
| `/v/<slug>/e/<engineer>` | Engineer page | One sales engineer: product lines, monthly run, targets, unbilled projects, overdue by customer |

Engineer slugs are the engineer's name in kebab case (for example `bassem-farouk`) and are unique across the company. The ten vertical slugs are electrical-distribution, cooling, mechanical-systems, pumps-and-water, vertical-transport, metering, automation, fabrication, trading and services.

## Run it

Install dependencies with `bun install`, then generate the data with `bun run data` (writes `public/data/rollup.json`, `index.json`, `verticals/<slug>.json` and `engineers/<slug>.json`) before the first run. `bun run dev` starts the development server. For a production build, run `bun run build`, then `bun run preview` to serve the built site.

`bun run contrast` measures the contrast ratio of every text and surface pair on the page. `bun run screenshots` uses Playwright to capture the app at 1440 and 390 pixels wide, and needs `bunx playwright install chromium` once before its first run. `bun run check` runs the data generator, the build and the contrast check together, in that order.

## Data schema

`data/schema.ts` is the one contract every screen reads from. It defines two top-level shapes.

`Meta` carries the company name, division, fiscal year, period label, the near-month and rest-of-year forecast labels, a data-as-of timestamp, a revision tag, currency, unit and seed. Both `Rollup` and `VerticalData` embed a `Meta` object.

`Rollup` is the front page data. It groups nine tables: `sales`, `engineerSplit`, `forecast`, `pl`, `profitability`, `overdue`, `monthly`, `readout` and `netting`.

`VerticalData` is one vertical's sheet. It carries a `headline`, `sales` (engineer rows with product sub-rows underneath each engineer), `pl`, `targets`, `inventory`, `unbilled` (with its month bridge), `overdue` (row detail, a per-engineer roll-up, a running total and a reason breakdown), and `monthly`.

Every money value in both shapes is in AED thousands unless the field name says otherwise. Percentages are plain numbers, so 21.4 means 21.4 percent, not a fraction. Every timestamp is GST, Asia/Dubai, with a real plus-four-hours offset. None of them are UTC.

## The rules the generator encodes

The netting rule: some product lines are sold by one vertical's own engineers but also belong to another vertical's category, so they show up on that other vertical's sheet too. Revenue from a shared line counts once, in its home vertical. The Fabrication row on the front page shows only work sold by the Fabrication team, not the shared ductwork and pipe-support lines that other verticals' engineers sell. Each vertical file carries both a sheet total, covering every row shown on that sheet, and an attributed total, covering that vertical's own engineers only.

The unbilled month bridge must reconcile. Previous month plus new projects, less cleared projects, plus ongoing changes, must equal the current month exactly. The generator throws an error and refuses to write any output files if a single vertical's bridge does not balance.

Overdue is everything beyond the 0 to 30 day bucket. A customer's total outstanding balance, minus whatever falls in the current 0 to 30 day window, is what counts as overdue.

Provisions follow two separate rules. On the overdue side, provision is half of the 1 to 2 year bucket, all of the over 2 year bucket, and a quarter of the 91 to 365 day bucket when the balance is disputed. On the inventory side, provision is half of stock aged 2 to 3 years and all of stock aged over 3 years.

The Readout's verdict thresholds live as data, in `rollup.json` under `readout.thresholds`, not hardcoded inside a component. Each of the five scorecard lines, selling, delivering, keeping, earning and collecting, carries its own on-track, watch and behind cutoffs there.

## Regenerating

To build a different but still internally coherent business, change `SEED` near the top of `scripts/generate_demo_data.ts` and run `bun run data` again. To change vertical names, budgets, performance factors or the engineer roster, edit the `VERTICALS` array in the same file, then regenerate. If a figure on screen is wrong, the fix belongs in the generator or in `data/schema.ts`. It never belongs in a component.

## Stack

Vite 8, React 19, TypeScript in strict mode, Tailwind v4 through its Vite plugin, Motion, d3-scale, d3-shape and d3-array, React Router, and Bun as the runtime and package manager. Fonts are self-hosted through Fontsource, Archivo Black and JetBrains Mono.

## Deploying

The build output is a static `dist/` folder. Any static host that falls back to `index.html` for unknown paths works, since the app is a single-page application.
