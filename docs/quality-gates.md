# Quality gates

Every check the repository runs, what it proves, and the counts as measured against the live source.

## `bun run reconcile`

Re-reads the written JSON files, independently of the generator's own in-memory checks, and asserts that every figure published in more than one place ties exactly. Result: **527 of 527 assertions pass**, written to `public/data/reconciliation.json`, which is what the Data basis page renders. The script is idempotent and does not rewrite the file when a re-run finds nothing changed.

## `bun run typecheck`

Runs the TypeScript compiler across the whole project in strict mode and fails on any type error, with no emitted output.

## `bun run lint`

Runs oxlint across the source.

## `bun run contrast`

Reads the color tokens directly out of `src/styles/index.css`, so it cannot drift from what actually ships, and fails if any text pair falls below a 4.5 to 1 contrast ratio or any non-text mark falls below 3 to 1. It parses all three named themes (Parchment, Light and Dark), resolving token aliases with a cycle guard and rejecting any token that does not resolve to a six-digit hex value; a missing theme block fails the gate rather than silently falling back to a base token. Result: **75 pairs measured** across the three themes, including tooltip text and the hovered chart bands.

## `bun run interactions --base <origin>`

Drives a real, served production build with Playwright and checks structure, keyboard behaviour and resilience end to end. Result: **165 checks**, each printing a pass or fail line with its own evidence, not just a boolean. By category:

- **Structural and layout correctness**: the overview does not overflow its stated width; the vertical page renders exactly six blocks; the engineer page renders exactly four sections; sticky first-column tables keep row identity through a horizontal scroll; every route renders the expected heading.
- **Sort and interaction correctness**: the overview sales table's default sort is verified to actually be ascending by variance; clicking a column header is verified to flip the sort and update the accessible sort attribute.
- **Disclosure behaviour**: the netting calculation and the monthly-values table both open by keyboard, and their expanded content is not visually clipped.
- **Chart interaction, with negative controls**: the crosshair is driven by real arrow-key presses and a real pointer move, and the read-out text is checked against the expected value; every chart mark is checked for a real, finite, non-degenerate geometry after its entrance animation settles, catching a chart that looks right as an SVG shape but is silently drawing nothing.
- **Column alignment, with a negative control**: the gate removes a cell from a live table in browser memory and confirms the alignment check actually reports the break, before trusting the same check when nothing is broken.
- **Cross-page redirect correctness**: an engineer URL opened under the wrong vertical is checked to redirect to that engineer's canonical URL, with the resulting breadcrumb naming the correct vertical.
- **Empty, error, malformed and invalid-route resilience**: a missing vertical file produces a readable "no such vertical" error; a malformed file produces a readable shape error naming the exact problem; the catch-all page renders for an unmatched path.
- **Reduced-motion behaviour**: with reduced motion requested, the gate asserts zero running animations and that every section is already at full opacity, both on page load and on opening the question panel.
- **The four report charts** (sales bullets, the profit and loss bridge, receivables aging, working-capital composition): checked against the published data itself, never a constant, so a zero-value segment is correctly never drawn; each answers a plain pointer move with a readout, a keyboard walk, and a pointer-events negative control; the profit bridge ties its net-profit readout to the ladder's own cell.
- **The chart draw-in itself**: for every animated line, the dash pattern the browser actually computed is checked against the pattern the animation library wrote as an attribute, because a stylesheet rule can silently win and leave a line pre-drawn and solid; and a forecast segment must be revealed only after the actual line finishes, measured as distinct rendered frames, with the reveal mechanism deliberately defeated as the negative control.
- **View switches**: every chart's view switch is checked to offer its declared views, that each view's marks actually enter with a real box and full opacity, that a chosen view survives a reload, and that a composition ring's arcs sum to the whole circle.
- **Phone pass**: every route is additionally checked at a 390-pixel phone width, with the same animation and chart-entry assertions, because an in-view trigger placed on an SVG element rather than its HTML wrapper silently never fires a second time on WebKit, which is how a chart drew correctly in every desktop browser and drew nothing at all on an iPhone.
- **Console-error-free**: the entire run asserts zero unexpected console errors, with an explicit, counted allowance only for the errors the gate itself deliberately provokes.

## `bun run motion`

Refuses a scroll-triggered animation (`whileInView`) on anything outside the shared reveal component, and proves itself on a planted offender before trusting a clean result. This closes the specific failure where a chart mark whose entry state collapses its own bounding box can never fire its own in-view trigger and stays invisible forever.

## `bun run ask:test`

Unit tests for the grounding module behind Ask the MIS, run in isolation from the browser: which files a question selects, the token cap, how a page link is resolved, and the figure audit that decides whether a number may be shown at all.

## `bun run ask:regression --base <origin>`

Drives the live answer service with 33 real questions (19 roll-up, 3 vertical, 2 engineer, 5 unanswerable, 4 derived) and checks every reply against the published data itself, never a stored expectation, so the gate stays valid after the seed changes. Passes at **31 of 33 or better**, and separately flags a finding if the 95th-percentile latency runs past 12 seconds.

## `bun run screenshots`

Captures every route at desktop, laptop and phone widths with a real Chromium, waits for fonts to load and animation to settle, and fails the run on any console error.

## `bun run check`

Chains `data`, `reconcile`, `typecheck`, `lint`, `motion`, `ask:test`, `build` and `contrast`, in that order, so a single command proves the whole chain from data generation through a production build.

## `deploy/scan-staged.sh`

Reads the staged diff before every commit and refuses one that carries an em or en dash, an attribution line, a credential shape, a private machine path, or a reference label naming the real client this demo is built for.
