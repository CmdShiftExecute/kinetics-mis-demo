# Contributing

## Run it locally

1. `bun install`
2. `bun run data` generates the JSON tables under `public/data/`.
3. `bun run dev` starts the Vite dev server, or `bun run preview` serves a production build.
4. `bun run ask` starts the Ask the MIS answer service on its own socket if you want the question panel to answer for real.

## Gates that must pass before a change is done

- `bun run check` chains the generator, reconcile, typecheck, lint, motion, the Ask unit tests, the production build and the contrast check.
- `bun run interactions --base <origin>` drives a real served build with Playwright: structure, sort and keyboard behaviour, chart interaction, cross-page redirects and error resilience.

Run both against your change before opening a pull request and paste their last lines into the PR description.

## Data is generated, never edited

Every figure in `public/data/` comes from `scripts/generate_demo_data.ts`. If a number on screen is wrong, fix the generator and re-run `bun run data && bun run reconcile`, never hand-edit a JSON file under `public/data/`.

## No em dashes

`deploy/scan-staged.sh` refuses any staged diff containing an em or en dash, an attribution line, a credential-shaped string or a private path. Run it before committing:

```
git add -A && bash deploy/scan-staged.sh && git commit -m "..."
```

## Opening an issue or a pull request

Open an issue for a bug or a data-accuracy question with the page and the exact figure. For a pull request, keep the diff scoped to one change, make sure both gates above pass, and describe what you verified.
