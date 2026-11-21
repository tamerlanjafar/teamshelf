# Teamshelf

Your team's links and files, in one place. An organization is split into spaces, one per team
(Development, Design, Data…). In each space, groups of links and files are cards on a board.

- **Links, files and documents.** Add a web address, upload a file, or write a document in the app. Files open inside it; text and Markdown can be edited there.
- **Suggestions.** Anyone who sees a space can suggest a link or a file. An admin of the space approves or rejects it.
- **Spaces.** Open to the whole organization or private, each with its own admins, logo and color.
- **Your own board.** Arrange and hide things for yourself. A space's admins build the default layout everyone starts from.
- **Sign-in by email link.** No passwords. Several organizations, with different emails, signed in at once.
- **Back office.** Reports over every organization, for the people who run the installation.

There is no backend server: the browser talks to [Neon](https://neon.com) (Postgres, sign-in and
a Data API), and row-level security in the database decides what each person may read and change.
Files are kept in Cloudflare R2. A few small functions on Netlify cover the rest.

## Set it up

```bash
pnpm install
pnpm cloud     # creates the database, file storage and the site on your own accounts
pnpm dev       # the app: http://localhost:3011, the back office: http://localhost:3015
```

`pnpm cloud` asks for what it can't do itself. The whole of it, step by step, is in
[SETUP.md](SETUP.md), written so that an agent can follow it too.

To look around without any account: `pnpm dev:mock` (http://localhost:3012) runs the real app on
made-up data in the browser.

## Commands

| | |
| --- | --- |
| `pnpm dev` | both apps (`pnpm dev:web`, `pnpm dev:back-office` for one) |
| `pnpm dev:mock` | the app on made-up data, with a toolbar that opens every screen |
| `pnpm build` | builds both apps |
| `pnpm preview` | serves the app's build the way Netlify does (http://localhost:3013) |
| `pnpm test` | the rules in plain code |
| `pnpm test:e2e` | end to end, in a browser, against mock mode |
| `pnpm build && pnpm test:build` | what search engines get from the build |
| `pnpm lint`, `pnpm typecheck` | |
| `pnpm db:migrate` | applies new files in `db/migrations` |

## Where things are

```
apps/web/           the app: React, TanStack Start (public pages drawn at build time), Tailwind, Base UI
  src/api/            reading and writing data (TanStack Query)
  src/features/       board, links, files, search, spaces, requests, team, settings, org, auth, landing
  src/components/     shared pieces (app/) and shadcn components on Base UI (ui/)
  src/mock/           mock mode: the real app on made-up data, in the browser
  netlify/            the server functions: sign-in proxy, icon lookup, files
  e2e/, specs/        end-to-end tests and their plan
apps/back-office/   reports over every organization, for the super admins (TanStack Router, Base UI)
packages/auth-proxy the sign-in proxy both sites serve at /api/auth
db/migrations/      the schema and every access rule
scripts/setup.mjs   `pnpm cloud`: sets all of it up on your own accounts
```

How it works, who can do what, the limits and the security model: [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md).
Working rules for changes (tests come with every change): [CLAUDE.md](CLAUDE.md).

## License

[MIT](LICENSE)
