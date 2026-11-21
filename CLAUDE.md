# Teamshelf

How it is set up is in SETUP.md, how it works in docs/HOW_IT_WORKS.md. This file is the working rules.

The repository holds two apps (`apps/web`, `apps/back-office`) and one shared package (`packages/auth-proxy`). The rules below are written for `apps/web`, where paths start unless they say otherwise. The back office follows the same rules on a smaller scale: its demo mode (`pnpm --filter @teamshelf/back-office dev:demo`) is its mock mode, and its tests are in `apps/back-office/e2e`.

## Tests are part of every change

Three layers, each run with one command:

| What | Where | Command |
| --- | --- | --- |
| Rules in plain code (link names, board layout, file kinds, icon lookup) | `src/**/*.test.ts`, `netlify/lib/*.test.mjs` | `pnpm test` |
| End to end, in a browser, against mock mode | `e2e/*.spec.ts`, plan in `specs/teamshelf.md` | `pnpm test:e2e` |
| What search engines get from the build | `scripts/check-build.mjs` | `pnpm build && pnpm test:build` |

### Adding or changing a feature

1. **Mock mode first.** If the feature has a state worth seeing (a role, an empty list, an error), give mock mode a screen for it in `src/mock/screens.ts` (with a scenario in `src/mock/fixtures.ts` if needed), and teach `src/mock/backend.ts` any new rule the database enforces. End-to-end tests open these screens; a state mock mode can't show can't be tested.
2. **Plan the cases** in `specs/teamshelf.md` under the area it belongs to: the main path, each role that sees it differently, and the edge cases (empty, too long, not allowed, already taken, the last one, a wrong address, signed out, on a phone).
3. **Write the tests** in the matching `e2e/<area>.spec.ts`, one `test` per case, named as a sentence about what the person sees. Use `openScreen(page, '<screen>')` from `e2e/helpers.ts` to set the situation up.
4. **Run `pnpm test:e2e`** (it starts mock mode itself on port 3014) and `pnpm test`. A change isn't done while either fails.

### Changing what the app says or how it looks

Tests find things the way people do: by role and visible name (`getByRole('button', { name: 'Approve' })`, `getByLabel('Email')`), never by CSS classes or test ids. So renaming a button or rewording a message breaks the tests that name it: update them in the same change, along with `specs/teamshelf.md`. If a test can't find a field by its label, the label isn't connected to it: fix the markup (see `Field`'s `id` in `src/components/app/form.tsx`), not the test.

### Keeping the suite healthy

- **A failing test is a finding first.** Before changing a test, check whether the app is wrong. Several real bugs were caught this way (a redirect that never ran, labels not tied to their fields, a menu drawn under the cards, events not reaching the page in mock mode).
- **No sleeps, no retries to hide flakiness.** Wait for what the person would wait for (`expect(...).toBeVisible()`, `waitForURL`). If a test is flaky, find the race and fix it in the test or the app.
- **One situation per test**, set up by a screen: tests don't depend on each other or on order, and each starts from a fresh browser.
- **Outside addresses** (link favicons, the made-up `*.example.com` links) don't exist in tests: answer them with `context.route` when a test opens one.
- **The Playwright agents** in `.claude/agents` help with this (they need the `playwright-test` MCP server from `.mcp.json`, loaded when a session starts): `playwright-test-planner` explores the app and writes plans into `specs/`, `playwright-test-generator` turns a plan into tests, and `playwright-test-healer` runs failing tests and fixes them. Review what they change like any other code, and keep their output in the style above.
- After a large change, read `specs/teamshelf.md` against the app: a feature without cases there is a gap to fill.

## Public pages and search engines

`/`, `/login` and `/signup` are drawn at build time (`PUBLIC_PAGES` in `vite.config.ts`). Code that runs while drawing them must not need a browser: `window`, `localStorage` and the like only in effects, event handlers, or behind `typeof window` checks. Every other route says `ssr: false` and gets `privateHead()` (noindex). A new public page needs: a `PUBLIC_PAGES` entry, `pageHead()` in its route, and cases in `e2e/public.spec.ts` and `scripts/check-build.mjs`.

## Other rules

- Images and other files that change go in `src/` and are imported (Vite names them by a hash of their content, served from `/assets/` with a year-long cache, see `netlify.toml`). `public/` is only for files that must keep a fixed address (favicon, `og.png`): browsers and Cloudflare may keep an old copy of a changed file there.
- Ports: 3011 dev, 3012 mock mode, 3013 build preview, 3014 end-to-end tests; the back office: 3015 dev, 3016 demo mode and its tests.
- Example data is made up (Acme, Lumen Labs, Orbit; `example.com` addresses). Never real company names or emails, in the app, tests or screenshots.
- Database changes are migrations in `db/migrations` (at the top of the repository), applied with `pnpm db:migrate` only when asked. What the database enforces is the protection; the app's checks only decide what to show.
- Nothing of one installation is written in the code: addresses and keys come from `.env` (one file, at the top) and the host's variables.
