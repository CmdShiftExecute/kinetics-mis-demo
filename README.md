# Kinetics MIS Demo

## What this is

This is a zero-backend management information system demo built for a fictional engineering group, Halvard Engineering Group, Building Technologies Division. It is a static Vite and React application sitting on top of finished JSON tables. Nothing is computed in the browser beyond sorting, filtering and formatting. All data is synthetic, generated from one seed. No real company, person or figure appears anywhere in this repository.

## Routes

| Route | Description |
|---|---|
| `/` | Overview: the division headline, the data-as-of stamp, and summary blocks for sales, pipeline, profit, receivables and working capital. |
| `/sales` | Sales: YTD revenue and gross margin by vertical against budget, with the netting explanation. |
| `/pipeline` | Pipeline: revenue forecast by vertical against budget and against prior year. |
| `/net-profit` | Net profit: the profit and loss ladder from revenue down to BU-level net profit, division total, and vertical profitability. |
| `/receivables` | Receivables: net to collect, past due and aging by vertical, with the largest balances by reason. |
| `/working-capital` | Working capital: receivables, unbilled and inventory tied up by vertical. |
| `/data-basis` | Data basis: sources, definitions, the precision policy, the assumptions, and the reconciliation result. |
| `/v/:slug` | One vertical's sheet: headline, sales by engineer, profit and loss, targets, inventory, unbilled projects, and, for the factory vertical only, production. |
| `/v/:slug/receivables` | The full customer aging table for one vertical, by engineer and customer. |
| `/v/:slug/e/:eng` | One sales engineer: product lines, monthly run, targets, unbilled projects, receivables by customer. |
| `*` | Not found. |

An engineer URL opened under the wrong vertical, an engineer slug that does not belong to that vertical, redirects to the engineer's own canonical `/v/:slug/e/:eng` route.

The ten vertical slugs are electrical-distribution, cooling, mechanical-systems, pumps-and-water, vertical-transport, metering, automation, fabrication, trading and services.

## Run it

1. `bun install` installs dependencies.
2. `bun run data` runs the generator, `scripts/generate_demo_data.ts`, and writes `public/data/rollup.json`, `index.json`, `verticals/<slug>.json` and `engineers/<slug>.json`.
3. `bun run reconcile` re-reads the written files and asserts every cross-table equality, then writes `public/data/reconciliation.json`. This is the check shown on the Data basis page.
4. `bun run typecheck` runs the TypeScript compiler in strict mode with no emitted output.
5. `bun run lint` runs oxlint.
6. `bun run build` runs the typecheck and then the Vite production build.
7. `bun run preview` serves the built site at `127.0.0.1:4180`.
8. `bun run contrast` measures the WCAG contrast of every text and surface pair the stylesheet defines.
9. `bun run interactions --base <origin> [--insecure]` runs the interaction, keyboard, structure and resilience gate against a served build. `--insecure` skips certificate checks when the origin is self-signed.
10. `bun run screenshots` captures every route at desktop, laptop and phone widths.
11. `bun run ask` starts the Ask the MIS answer service on its Unix socket. `bun run preview` proxies `/api/ask` to that socket the same way the live nginx site does, so the panel works end to end against a local build.
12. `bun run ask:test` runs the unit tests for the grounding module: context selection, the token cap, page resolution, the citation check and the figure audit.
13. `bun run ask:regression --base <origin> [--insecure]` runs the 33-question regression gate against a served `/api/ask` (20 roll-up, 3 vertical, 2 engineer, 5 unanswerable, 3 derived), threshold 31 of 33 to pass. `--insecure` skips certificate checks when the origin is self-signed.
14. `bun run check` chains `data`, `reconcile`, `typecheck`, `lint`, `ask:test`, `build` and `contrast`, in that order.

`bun x playwright install chromium` installs the Chromium build that the interaction gate, the screenshot script and the performance probe all drive. Run it once before the first use of any of the three. `scripts/perf_probe.ts` is run directly with `bun scripts/perf_probe.ts [--base <origin>] [--path <route>]`, not through a package script.

## Data schema

`data/schema.ts` is the one contract every screen reads from.

`Meta` carries the company name, division, fiscal year, the period label, months elapsed, the current and previous month labels, the near-month and rest-of-year forecast labels, a data-as-of timestamp and label, a revision tag, currency, unit and seed. `Rollup`, `VerticalData` and `EngineerData` each embed a `Meta` object.

`Rollup` is the front-page data. It carries `sources`, `definitions`, `precisionPolicy` and `assumptions`, then the tables: `overview`, `sales` with `engineerSplit`, `forecast`, `pl`, `profitability`, `receivables`, `unbilled`, `inventory`, `workingCapital` and `monthly`.

`VerticalData` is one vertical's sheet: a `headline`, `sales` with engineer rows carrying product sub-rows, a sheet total and an attributed total, `pl`, `targets`, `inventory`, `unbilled` with its month bridge, `production`, present only for the vertical that runs a factory, `receivables` with customer rows, a per-engineer roll-up, a total and a reason split, and `monthly`.

`EngineerData` is one sales engineer: a `headline`, one `sales` row with its product lines, `monthly`, `targets`, `unbilled`, `receivables`, and a list of `peers` in the same vertical.

`VerticalIndexEntry` lists a vertical's slug, name, file and its engineers, for `index.json`. `Reconciliation` is the shape `reconcile.ts` writes: a checked-at timestamp, the policy lines, and the list of assertions with each one's pass or fail state.

Units: every money value is an integer in AED thousands. Percentages are plain numbers to one decimal, so 21.4 means 21.4 percent. Every timestamp is GST, Asia/Dubai, with a real plus-four-hours offset. None of them are UTC.

## The rules the generator encodes

The netting rule. Fabricated ductwork and fabricated pipe supports are sold by Cooling and Mechanical Systems engineers but also belong to the Fabrication vertical's own sheet. Revenue from a shared line counts once, in its home vertical. Each vertical file carries a sheet total, covering every row shown on that sheet, and an attributed total, covering that vertical's own engineers only. Every division summary uses the attributed figures, so the Fabrication row on the front page shows only work sold by the Fabrication team.

The precision policy. Every money value is an integer in AED thousands, rounded once at the lowest level the generator produces, one product line in one month. Every higher total is a sum of those integers, so sales, forecast, profit and loss, monthly series, vertical files and engineer files tie exactly with no display rounding. Gross margin is rounded once per product line and column, and margins above that are sums. Percentages are rounded to one decimal from the integer sums, never from other percentages. Revenue shares are allocated to one decimal by largest remainder so the ten rows sum to exactly 100.0.

The receivables due-date model. Each customer balance is modelled as invoices with an age and the customer's payment terms. Past due is age beyond terms, from invoice date plus terms. Aging buckets are age since the invoice, regardless of terms, so a balance can sit in the 31-to-90-day bucket and still be within terms. Net to collect is total outstanding less the provision. It is the balance the business still expects to collect, not a dated cash forecast. Every balance carries one reason: internal group companies, follow-up with no response, or disputes and not yet due, and the third is shown split into disputed balances and balances with nothing past due. The reasons are derived from one underlying state, so the dispute flag, the reason and the remark always agree, and the reasons always sum to total outstanding. The provision is half of the balance aged 1 to 2 years, all of the balance aged over 2 years, and a quarter of a disputed balance aged 91 to 365 days.

The unbilled bridge and aging. Each vertical's unbilled month bridge must reconcile exactly: previous month plus new projects, less cleared projects, plus ongoing changes, equals the current month. The generator throws and refuses to write output if a single vertical's bridge does not balance. Unbilled aging is reported in eight bands from 60 days or under out to over 730 days, and the amount aged over 60 days is called out on the summary row.

Inventory bands and the provision rule. Stock is reported by age since receipt in four bands, under 1 year, 1 to 2, 2 to 3, and over 3 years, and the bands sum to total stock. The provision is half of the stock aged 2 to 3 years plus all of the stock aged over 3 years. Free stock is total stock less whatever is mapped to a purchase order.

Targets and budget to date. Each product line's target equals its approved full-year budget. Achievement is compared against budget to date, the target phased by month and summed for the elapsed months, not against the full-year target.

Production. Only the Fabrication vertical runs a factory. Its `production` block reports quantity delivered, invoiced value, and material and labour cost by month, and the value ties to that vertical's monthly revenue.

The round-thousand guard. A division-level total that lands on an exact round thousand would read as a placeholder rather than a real figure, so the generator throws if any headline total is an exact multiple of 1,000, forcing a change to the seed or the noise rather than shipping a number that looks like a placeholder.

Profit is compared full year to full year. No approved profit budget exists for the elapsed months, so every profit and loss column compares YTD actual, full-year forecast and full-year budget, and no year-to-date profit attainment figure is shown anywhere.

## Gates

`bun run reconcile` re-reads the written JSON files, independently of the generator's own in-memory checks, and asserts that every figure published in more than one place ties exactly. This is the machine's own check, and its result, the pass and fail counts plus the policy lines, is what renders on the Data basis page.

`bun run typecheck` runs the TypeScript compiler across the project in strict mode and fails on any type error.

`bun run lint` runs oxlint across the source.

`bun run contrast` reads the color tokens directly out of `src/styles/index.css`, so it cannot drift from the stylesheet, and fails if any text pair falls below a 4.5 to 1 contrast ratio or any non-text mark falls below 3 to 1.

`bun run interactions` drives a real, served build with Playwright and checks structure, keyboard behaviour and resilience. Every check prints pass or fail with its evidence. The column alignment check carries a negative control: the gate removes a cell from a table in browser memory and confirms the alignment check reports the break, so a check that has never been seen to fail is not trusted blind. The gate also performs a real keyboard traversal of the interface, not a click simulation, to confirm the pages are usable without a mouse. Two chart checks guard the draw-in itself: for every line Motion is drawing, the dash pattern the browser computed must be the one Motion wrote as an attribute, because a stylesheet rule on `stroke-dasharray` silently beats that attribute and leaves the line pre-drawn and solid (this is how the dashed forecast line sat static until 13 Sep 2026); and the forecast segment must be revealed after the actual line completes, measured as distinct rendered frames in the forecast region, with the clip deliberately defeated as the negative control. The four report charts (sales bullets, the P&L bridge, receivables ageing, working-capital composition) are checked against the published data itself: one segment per non-zero value and one end figure per row, a readout on plain pointer movement, a keyboard walk, a pointer-events negative control, the bridge tying its net-profit readout to the ladder's cell and printing the rung's definition, and every bar at rest under reduced motion. Every chart also carries a view switch, so the gate additionally checks that each of the ten switches offers its views, that each view's marks actually entered with a real box and full opacity (with a negative control that forces one mark back to its entry state), that a chosen view survives a reload, and that a composition ring's arcs sum to the whole circle and each starts where the last ended.

`bun run screenshots` captures every route at desktop, laptop and phone widths with a real Chromium, waits for fonts to load and for animation to settle, and fails the run on any console error.

`scripts/perf_probe.ts` scrolls the longest page for four seconds in a real Chromium and records requestAnimationFrame interval timing: median, 95th percentile, maximum, and the count of intervals above 25 milliseconds. Its numbers are observer-dependent, so they are only meaningful when comparing before and after a change, on the same machine, against the same origin.

`bun run ask:test` checks the grounding module in isolation: which files a question selects, the token cap, how a page link is resolved, and the figure audit that decides whether a number may be shown.

`bun run ask:regression` drives the live answer service with thirty real questions and checks the reply against the published data itself, never against a stored expectation, so the gate stays true after the seed changes. It fails below 28 of 30 and prints a finding if the 95th percentile latency runs past 12 seconds.

Measured on 13 Sep 2026 against the live origin on node-ss: the reconciliation passes 527 of 527 assertions (`public/data/reconciliation.json`), the interaction gate passes 120 of 120 checks against https://node-ss.tail640a1e.ts.net:926/, and the tree carries no em or en dash, attribution line, credential shape or reference label (`bash deploy/scan-staged.sh` gates every commit chain).

## Ask the MIS

Every page carries a right-hand panel, opened with Ctrl+K on Windows and Linux or Cmd+K on a Mac, or from the "Ask the MIS" button in the corner. It answers one question at a time in plain words, and every answer ends with a link to the report page that carries the figures it quoted. The conversation stays on screen when the reader follows a source link or moves between reports, survives a reload of the same tab, and ends when the tab closes or the reader presses "New chat"; it lives in the browser's session storage and is never sent anywhere.

The panel is grounded, not free-running. Each question is matched against the division roll-up, plus at most one vertical file and one engineer file when the question names one of them by name or slug. The rules the model must follow, the wording it must use, and the page-naming convention all live in one system prompt in `server/grounding.ts`, so the behaviour is code, not a scattered set of instructions. The field guide handed to the model alongside the data is `data/schema.ts` itself: the same TypeScript interfaces the application reads from, so the model and the reader are told the same story. The whole context, rules plus field guide plus data, is held under a cap of about 60,000 tokens, estimated at 2.15 characters a token; a file that would push the total over the cap is dropped and the answer says so.

The answer service, `server/ask.ts`, listens on the Unix socket `run/ask.sock`, never on a TCP port, and nginx proxies `/api/ask` to it on the live site. It allows at most 3 questions in flight at once, 12 model calls in any sixty-second window (a retry spends a slot), and gives each call up to 40 seconds before it times out. A question the browser abandons kills its model call, so nothing bills after the reader has gone. Every call is written to `run/ask.log.jsonl` with a GST timestamp, the provider, the latency and the length of the question in characters, but never the question's own text.

The model is reached through a provider switch. `ASK_PROVIDER=subscription`, the default the service ships with, runs the `claude` command line on the principal's own subscription, the same pattern the CareerOps assessor uses. `ASK_PROVIDER=api` sends the same request to the Messages API using a metered key read from `ANTHROPIC_API_KEY`; that path is written and ready but has never been exercised, because no key has been supplied for it. The installed unit runs on `subscription` and carries no key at all.

A figure the data does not hold as one published value, such as a sum of two verticals, a difference, a share or a run-rate projection, may be given only as a derived figure: the model cites every input, writes the result with the word "derived", and adds a `Derive: <result> | <expression>` line; the service evaluates the expression with its own small parser (no `eval`), requires every literal to be a cited published figure or a whole-number constant such as a month count, and withholds any result the expression does not reproduce. The panel shows the working under the answer.

Every answer passes three checks before it reaches the reader, all in `server/grounding.ts`. A draft that revises itself midway (a "wait" or a "correction" inside the prose) is never shown. Every figure the model quotes must carry a Cite line naming its path in the data, such as `rollup.sales.rows[mechanical-systems].dRevenue`; the service resolves each path and the value must match exactly, the sentence carrying the figure must name that row and no other, a "which is highest" question must cite a row that is the extreme of its field across the table, and a direction word such as "ahead of budget" must agree with the sign of the value. Finally, any number in the reply must exist verbatim in the published JSON of the context it was given; years and small counts up to 31 without a unit are allowed because they read as periods and counts, not figures. A draft that fails any check is tried once more on the same cached context and, if it fails again, withheld: the panel says so plainly and offers the nearest report, rather than showing a figure nobody can trace back to its row.

Before every push, `bash deploy/scan-staged.sh` reads the staged diff and refuses a commit that carries a credential shape, an em or en dash, an attribution line, a private Mac path or a reference label from the real client; the commit chain is `git add -A && bash deploy/scan-staged.sh && git commit`.

To install or re-install the service, run `bash deploy/install-ask.sh` on the host. It is idempotent: it creates and permissions the `run/` directory, writes the systemd user unit and restarts it, writes the nginx location block between its own markers, and reloads nginx, printing a health check at the end. It asks for `sudo` twice, once to put `run/` in the `www-data` group with the setgid bit so nginx can reach the socket, and once to edit the nginx site file. Re-run it after any change to `server/`, to the unit file, or to the nginx snippet.

To run it locally: `bun run ask` starts the service, `bun run preview` proxies `/api/ask` to its socket the same way the live site's nginx does, `bun run ask:test` runs the unit tests against the grounding module, and `bun run ask:regression --base <origin> [--insecure]` runs the full 33-question gate against a served build, failing below 31 passes or flagging a 95th-percentile latency past 12 seconds.

Regenerating the data with `bun run data` does not refresh what the panel can see on its own. The service reads the roll-up, the index, the field guide and every vertical and engineer file once, at start, so a data regeneration needs a service restart (`bash deploy/install-ask.sh`, or `systemctl --user restart kinetics-ask.service` on its own) before the panel will answer from the new figures.

## Regenerating

To build a different but still internally coherent business, change `SEED` near the top of `scripts/generate_demo_data.ts` and rerun `bun run data`, then `bun run reconcile`. To change vertical names, budgets, performance factors, product lines or the engineer roster, edit the `VERTICALS` array in the same file, then regenerate the same way.

If a figure on screen is wrong, the fix belongs in the generator or in `data/schema.ts`. It never belongs in a component. A component only sorts, filters and formats what the generator has already computed.

## Stack

Vite 8, React 19, TypeScript in strict mode, Tailwind v4 through its Vite plugin, Motion, d3-scale, d3-shape and d3-array, React Router, and Bun as the runtime and package manager. Fonts are self-hosted through Fontsource: Archivo Black and JetBrains Mono.

## Deploying

The build output is a static `dist` folder. Any static host that falls back to `index.html` for unknown paths works, since the app is a single-page application.

## MIS refinement review (15 September 2026)

The overview keeps its analytical sections while promoting four headline figures and three data-backed management priorities. Order book and working capital remain visible in a secondary band. Precise comparisons, netting, source definitions, loss-making businesses, receivables concentration and all chart views remain available. No financial fixture or answer-service changes are included.

The masthead provides persistent report navigation, module access, section jumps and Parchment, Light and Dark themes. Theme choice persists on this origin when browser storage is available. Section jumps support delayed route/data loading and keyboard focus at the destination heading. Existing motion and reduced-motion behavior remain in place.

Verification additions:

- `bun scripts/refinement.ts --base <preview-origin> --out <evidence-directory>` checks theme rendering/persistence, storage failure, retained analytical values, sticky navigation, keyboard section jumps, responsive layouts and Ask overlay order without calling the answer service.
- `bun scripts/interactions.ts --base <preview-origin> --out <evidence-directory> --mock-ask` runs the inherited interaction gate with a deterministic Ask UI response. This mode does not verify model/backend integration. Omitting the flag retains the existing live-service test.
- `bun run contrast` now checks all three theme palettes, including tooltip text and hovered chart bands.

Use `docs/mis-refinement-plan.md` for scope and design rationale. The isolated review branch must be assessed before replacing the demo's currently served build.
