# Executive Ask MIS and Precision Design

## Objective

Make the MIS readable without hiding financially meaningful differences, and make Ask MIS behave like a grounded executive analyst rather than a lookup-only FAQ bot.

## Display precision

Money remains stored as integer AED thousands. Presentation uses:

- below AED 1m: whole thousands, such as `785k`;
- AED 1m to below AED 10m: up to two decimal places, such as `5.05m` and `4.98m`;
- AED 10m and above: up to one decimal place, such as `59.1m` and `211.9m`;
- AED 1bn and above: up to one decimal place in billions.

This is the first option in the supplied comparison. It preserves headline readability while allowing a reader to reconcile mid-sized actual, budget and variance figures.

## Analyst behaviour

Ask MIS must answer management questions by comparing, ranking and calculating from the MIS. It must not refuse merely because the dataset does not contain a pre-written label such as “best performer.”

For an ambiguous request such as “best salesperson,” it defaults to year-to-date revenue, names that choice, and also gives gross-margin amount, gross-margin percentage and performance against budget. For “best vertical,” it defaults to revenue variance against budget for the requested period. It may calculate sums, differences, percentages, ranks and period-on-period changes when the source figures exist.

Every published or calculated number remains mechanically checked. Published numbers cite their exact source path. Calculated values include their inputs and expression; the server recomputes the expression before display. A model response that invents a number, attributes it to the wrong row, uses unreadable large-thousands wording or contradicts a variance sign is retried and then withheld.

## Analytical context

The normal division roll-up remains the primary context. A small deterministic analysis document is built by the server from the same published JSON and added to every question. It contains:

- a company-wide engineer leaderboard with vertical, YTD revenue, YTD gross margin, GM percentage, budget and variance;
- the top revenue engineer within every vertical;
- monthly actual, budget and forecast by vertical;
- comparable quarterly actual, budget, variance and variance percentage by vertical;
- the identity of the latest actual month and the last completed quarter.

Named vertical and engineer questions still receive their detailed source file. The analysis document exists to make cross-company and cross-period questions possible without loading every detailed page into the model.

## Missing information

When source data is genuinely absent, Ask MIS names the missing field or period in plain language and then provides the closest supported analysis. It must not invent an answer, and it must not stop at the generic sentence “The published data does not carry that.”

Examples:

- If asked for a completed quarter that exists, calculate and answer it.
- If asked for a future quarter, state that actuals do not exist, then give the published forecast or latest completed-quarter result when relevant.
- If asked for a personnel fact outside the MIS, state that the MIS contains performance data rather than that fact and point to the closest report.

## Interface copy

The panel description says that Ask MIS analyses and checks the MIS. The footer explains that published figures are checked and calculations are recomputed. Suggested questions demonstrate rankings, quarterly performance and monthly changes.

## Acceptance criteria

1. AED 5.048m and AED 4.982m display as `5.05m` and `4.98m`; AED 135m and AED 211.9m remain unchanged.
2. Chart axes, chart readouts, cards and tables use the same precision rule.
3. Ask MIS can identify the top company engineer by YTD revenue and report revenue, GM amount, GM percentage and budget variance.
4. Ask MIS can identify the revenue leader in each vertical.
5. Ask MIS can compare verticals for the last completed quarter using revenue variance against budget.
6. Ask MIS can state the last three month-on-month changes for a named vertical.
7. Calculations, citations, sign checks and compact-money checks still fail closed.
8. A genuinely unavailable question gets a specific limitation plus the closest useful supported answer.
9. Existing reports remain responsive at 390px, 1024px and 1440px with no console errors.
