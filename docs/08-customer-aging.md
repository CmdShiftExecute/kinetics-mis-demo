# Customer aging

The full, drillable customer-level receivables table for one vertical, the detail sitting behind that vertical's engineer-level receivables summary. No screenshot is included in this guide; the page shares its table and strip conventions with the vertical detail page above.

## What is on the page

- A six-figure strip: total outstanding (with the customer count named beside it), provision, net to collect (with the signed change beside it), past due (with its percent of outstanding), aged over one year (with its percent), and disputed.
- **Aging by engineer and customer**: a wide table grouped by days since invoice (five buckets), balances (total outstanding, not yet due, past due, provision), net to collect (prior, current, change) and state and remarks (dispute, reason, both remarks). Rows are grouped under each engineer, an engineer summary row followed by that engineer's individual customers, with a closing total row for the whole vertical.
- **Reasons for non-collection**: this vertical's own reasons breakdown, the same shape used on the division-wide receivables page.

## How the figures are built

This page reads the same vertical data file the vertical detail page reads, using only its receivables portion. Every customer's payment terms are shown as they were generated, an unformatted string naming the term length, so a reader can see the actual due-date basis behind the aging buckets rather than a rounded figure.

## Interactions

Rows reveal with a staggered scroll animation that continues counting across the whole engineer-grouped list rather than resetting at each engineer boundary, so the motion reads as one continuous table rather than several short ones.

## See also

- [README](../README.md) for the full page index.
- [docs/07-vertical-detail.md](07-vertical-detail.md) for the vertical this page's customers belong to.
- [docs/05-receivables.md](05-receivables.md) for the division-wide receivables position this table rolls up into.
