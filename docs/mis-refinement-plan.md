# MIS refinement · 15 September 2026

Scope: refine the existing MIS only; preserve technical identity, financial data, analytical detail, route structure and motion. Worktree branch isolates the live demo.

## Design decisions

- Four prominent questions: revenue so far, year-end revenue, year-end profit, cash overdue. Each shows one comparator. Order book and working capital remain visible directly beneath, with open versus expected orders distinguished.
- Three management priorities link to evidence: collection exposure, revenue shortfalls by business, and forecast losses. Derived from existing rollup data; no fabricated urgency, owners or targets.
- Keep all sales rows, sorting, total/netting reconciliation, monthly actual/forecast/budget chart with its three modes, complete profit comparison, loss makers, absent YTD profit-budget caveat, concentration denominator, aging, provisions and working-capital components.
- Cut duplicate introductory arithmetic. Retain units/period once near headings, precise values in tables, methods/source in existing disclosures. No collapsed primary analytical blocks.
- Keep top navigation persistent. Add module access, page-section selection and three named themes using native keyboard controls. Preserve Ask the MIS and its state model.
- Parchment retains current palette; Light uses white; Dark uses charcoal with separately checked inks, hazard and chart colors. Storage failure must not block rendering. Reduced-motion behavior retained.

## Implementation and checks

1. Record baseline source/dist archives and hashes (done, under artifact baseline/; retain pending approval).
2. Implement shared theme/navigation and overview hierarchy; no financial fixture or backend changes.
3. Run reconciliation, types, lint, Ask unit tests, production build, theme contrast, existing interaction/motion gates. Add targeted browser verification for themes, persistence, keyboard, anchors, responsive layouts and analytical preservation.
4. Inspect screenshots at desktop, laptop, mobile and all themes; fix concrete defects. Verify original live dist and fixture hashes remain unchanged.
5. Commit reviewable branch; provide private preview, evidence and restore instructions. Prepare/validate ledger handoff to Claude for read-only technical and analytical completeness review. No aesthetic redesign debate.

## Alternatives considered

A sidebar/white enterprise reskin would alter the accepted identity and cost content width. Keeping six equally weighted KPIs preserves overload. Hiding existing analysis behind new tabs adds navigation friction. Chosen approach changes hierarchy while retaining the analytical page.

## Design references consulted

IBM Carbon dashboard guidance: https://carbondesignsystem.com/data-visualization/dashboards/
Nielsen Norman Group complex application guidance: https://www.nngroup.com/articles/complex-application-design/
These inform progressive detail and emphasis; the existing industrial language remains the design basis.
