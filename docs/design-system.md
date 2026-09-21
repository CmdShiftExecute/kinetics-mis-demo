# Design system

The interface implements a system called Swiss Industrial Print, chosen deliberately against the generic AI-dashboard aesthetic: no card grids, no gradient text, no icon-above-heading pattern, and zero border radius anywhere in the interface, with one declared exception.

## Design intent

Swiss Industrial Print pairs a rigid, ruled, print-shop-catalogue layout language with a light paper substrate and a single hazard-red accent that is earned, never decorative: it appears only for negative variance, overdue risk, or a failed check. Two typefaces, both self-hosted rather than loaded from a CDN, so the app has no external font-loading dependency and renders identically offline.

## Typography

- **Display**: a single-weight, extra-bold, condensed grotesque, used only for the wordmark, page titles, section headings and the question panel's title, always uppercase with tightened letter spacing.
- **Body and numerals**: a monospaced face set on the whole document, so every paragraph, label and numeral is monospaced by default, with tabular figures enabled globally so every column of numbers aligns on its digit grid regardless of which individual digits appear.

Uppercase treatment is applied selectively, never as a blanket transform, and always paired with positive letter spacing: labels, table headers, navigation, breadcrumbs and status tags. Body prose and the leading column of every table are deliberately not uppercased, so row identity reads like a heading rather than a data cell.

## Palette and the two reds

All colour is defined as CSS custom properties, so every consumer references a named token rather than a literal hex value. Two distinct reds exist for one measurable reason: one is used for non-text marks (bars, borders, tags), judged against the WCAG 3 to 1 non-text floor, and a separately, deliberately darker red is used exclusively for text, judged against the stricter 4.5 to 1 text floor. Using one red for both purposes would either make text fail contrast or make marks unnecessarily dark. A second print ink drives the primary series on the four report charts (sales bullets, the profit bridge, receivables aging, working-capital composition), with a darker tint for the secondary segment on each.

## Three named themes

Parchment (the default paper-and-ink palette), Light (the same system on white) and Dark (the same system on charcoal) are three independently measured token sets, not one palette inverted. The theme is chosen before the first paint by an inline script that reads a stored preference, so the page never flashes the wrong palette on load; a corrupted or missing stored value resolves safely to Parchment, and a browser that throws on storage access, which private browsing does, still renders Parchment rather than an unstyled page. The choice persists per origin.

## Zero-radius rule, with one exception

A single global rule removes every rounded corner in the interface, including anything a utility class might otherwise contribute. The one declared exception is the two circular masthead icon menus and the theme swatches, which beat the reset with an equally explicit rule written directly beneath a comment naming it as deliberate.

## Layout

A single maximum-width page wrapper, centred with responsive side padding, is the only shared grid; individual layout patterns (the masthead, the profit ladder's table-plus-rail grid, the headline strip) are each purpose-built rather than drawn from a conventional twelve-column system, matching the catalogue and ledger metaphor of the rest of the interface. Tables are the dominant content pattern throughout: header cells are right-aligned and uppercase with a solid bottom rule; total and subtotal rows get a heavier top rule, the way a printed ledger marks a sum; product sub-rows indent and mute rather than nesting a second table; wide tables pin their first column so row identity survives horizontal scrolling.

## View switches

Every chart in the application carries a view switch: a segmented control, styled like the rest of the print system, offering two or three distinct readings of the same underlying data. The chosen view is remembered per chart and survives a reload.

## Motion

Motion, not CSS keyframe animation, drives almost every animated element. Five patterns:

1. **Load hierarchy**: page titles and headline figures rise in once on mount, not on scroll.
2. **Scroll sequence**: sections and table rows fade and rise into view once as the reader scrolls, with a per-row stagger capped so a long table does not take seconds to finish revealing.
3. **Chart draw-in**: lines and bars grow in via a genuine path or scale animation rather than a CSS transition, so the animation library's own written state and the browser's computed rendering can be checked against each other.
4. **Hover and press feedback**: a shared tactile press class scales interactive elements down slightly on press; navigation underlines and section links carry their own hover transitions.
5. **State-change transitions**: table row hover, disclosure open and close, and the question panel's own slide-in entrance each carry a short, deliberate transition.

Every one of these checks `prefers-reduced-motion` and renders content at its resting state, with no transform, rather than waiting on a scroll trigger that will never fire.

## Accessibility contract

- All measured contrast pairs clear their WCAG floors (4.5 to 1 text, 3 to 1 non-text), verified mechanically by reading the live stylesheet rather than asserted by design intent.
- Pointer shape is declared, never inherited: a default cursor over tables and chart chrome, an explicit pointer over every clickable element, a crosshair over both chart canvases.
- Every chart discloses a full table of its exact underlying values behind a keyboard-accessible control, so no information is available only as an SVG shape.
- A visually hidden, live-announcing element mirrors a chart's hovered or keyboard-selected data point, so keyboard and screen-reader users get the same readout a sighted mouse user sees.
- Table headers carry proper scope attributes, including column-group scope for multi-tier headers.
- Four genuinely different error and empty states (loading, missing data, malformed data, invalid route) are each rendered distinctly, so a reader or an automated check can always tell which condition it is looking at.
- Every focusable element carries a visible focus ring rendered globally, so no interactive element can lose it by omission; the question panel implements a manual focus trap and returns focus to its launcher on close.

## Phone pass

Every chart's scroll-triggered entry is driven from its HTML wrapper rather than the SVG element itself, because a browser engine's intersection observer can report an SVG target once and then never again, which otherwise leaves a chart's marks permanently stuck at their invisible entry state on a phone while the identical chart draws correctly on desktop. Touch targets across sort buttons, links and disclosure summaries are held to a minimum height under a coarse pointer, bound to the pointer type rather than the viewport width, so the print layout is unaffected with a mouse.
