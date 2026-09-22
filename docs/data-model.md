# Data model

`data/schema.ts` is the one contract every screen in the application reads from. This document explains it in plain words; the file itself is the source of truth for exact field names and types.

## The shapes

- **`Meta`** carries the company name, division, fiscal year, the period label, months elapsed, the current and previous month labels, near-month and rest-of-year forecast labels, a data-as-of timestamp and label, a revision tag, currency, unit and the generator's seed. `Rollup`, `VerticalData` and `EngineerData` each embed their own `Meta`.
- **`Rollup`** is the division roll-up, the front-page data. It carries `sources`, `definitions`, `precisionPolicy` and `assumptions`, then the tables: `overview`, `sales` (with `engineerSplit`), `forecast`, `pl`, `profitability`, `receivables`, `unbilled`, `inventory`, `workingCapital` and `monthly`.
- **`VerticalData`** is one vertical's sheet: a headline, sales with engineer rows carrying product sub-rows, a sheet total and an attributed total, profit and loss, targets, inventory, unbilled work with its month bridge, production (present only for the vertical that runs a factory), receivables with customer rows and a per-engineer roll-up, and a monthly series.
- **`EngineerData`** is one sales engineer: a headline, one sales row with its product lines, a monthly series, targets, unbilled work, receivables, and a list of peers in the same vertical.
- **`VerticalIndexEntry`** lists a vertical's slug, name, file and its engineers, for `index.json`.
- **`Reconciliation`** is the shape `scripts/reconcile.ts` writes: a checked-at timestamp, the policy lines, and the list of assertions with each one's pass or fail state.

## Units and time

Every money value is an integer in AED thousands. Percentages are plain numbers to one decimal, so 21.4 means 21.4 percent. Every timestamp carries a real GST offset (plus four hours), never UTC.

## The rules the generator encodes

**Netting.** A product line sold by an engineer whose home vertical is elsewhere, but that also belongs to another vertical's own sheet (fabricated ductwork and fabricated pipe supports, sold by Cooling and Mechanical Systems engineers but shown on Fabrication's sheet too), counts once, in its home vertical, for every division-level summary. Each vertical file separately carries a sheet total (every row shown on that sheet) and an attributed total (only that vertical's own engineers).

**Precision.** Every money value is rounded exactly once, at the lowest level the generator produces: one product line, in one month. Every higher total is a sum of those already-rounded integers, so nothing above the leaf carries its own rounding and every total ties exactly with no display rounding. Gross margin is rounded once per product line and column; percentages are rounded to one decimal from the integer sums, never from other percentages. Revenue shares are allocated to one decimal by largest remainder, so a set of shares always sums to exactly 100.0.

**Receivables due-date model.** Each customer balance is modelled as invoices carrying an age and that customer's payment terms. Past due is age beyond terms. Aging buckets are age since invoice regardless of terms, so a balance can sit in a mid-range bucket while still being within terms. Net to collect is total outstanding less the provision. Every balance carries exactly one reason (internal group company, follow-up with no response, or disputes and not yet due, the third split further into disputed and simply not yet due), derived from one underlying state so the dispute flag, the reason and the remark can never disagree. The provision is half of the balance aged one to two years, all of the balance aged over two years, and a quarter of a disputed balance aged 91 to 365 days.

**Unbilled bridge and aging.** Each vertical's unbilled month bridge must reconcile exactly: previous month plus new projects, less cleared projects, plus ongoing changes, equals the current month. The generator refuses to write output if a single vertical's bridge does not balance. Aging is reported in eight bands from 60 days or under out past 730 days.

**Inventory bands and provision.** Stock is reported by age in four bands (under one year, one to two, two to three, over three years) that sum to total stock. The provision is half of stock aged two to three years plus all stock aged over three years. Free stock is total stock less whatever is mapped to a purchase order.

**Targets and budget to date.** Each product line's target equals its approved full-year budget. Achievement is compared against budget to date, the target phased by month and summed for the elapsed months, never against the full undiluted annual target.

**Production.** Only one vertical runs a factory. Its production block reports quantity delivered, invoiced value, and material and labour cost by month, and that value ties to the same vertical's own monthly revenue.

**The round-thousand guard.** A division-level total that lands on an exact round thousand would read as a placeholder rather than a real figure, so the generator throws if any headline total is an exact multiple of 1,000, forcing a change to the seed or the noise rather than shipping a figure that looks invented.

**Profit compared full year to full year.** No approved profit budget exists for the elapsed months, so every profit and loss column compares YTD actual, full-year forecast and full-year budget; no year-to-date profit attainment figure is shown anywhere.

## Reconciliation

`bun run reconcile` re-reads the written JSON files, independently of the generator's own in-memory checks, and asserts that every figure published in more than one place ties exactly: 527 of 527 assertions pass. The assertions are organised in three tiers: division level, vertical level (looped over every vertical), and per-row, one assertion for every individual customer's aging buckets and every individual unbilled project's age bands, which is why the bulk of the 527 count comes from row-level checks rather than summary-level ones. The script is idempotent: a re-run against an unchanged dataset reports the result unchanged and does not rewrite the file, so it can run safely as a verification step without ever dirtying a clean working tree.

## Regenerating

To build a different but still internally coherent business, change the seed near the top of `scripts/generate_demo_data.ts` and rerun `bun run data`, then `bun run reconcile`. If a figure on screen is wrong, the fix belongs in the generator or in `data/schema.ts`, never in a component; a component only sorts, filters and formats what the generator has already computed.
