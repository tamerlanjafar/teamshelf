# Teamshelf

Your team's links and files, in one place, at [teamshelf.app](https://teamshelf.app). An organization is split into spaces, one per team (Development, Design, Data…). In each space, groups of links and files are cards in a Pinterest-style grid.

- **Front page.** teamshelf.app is a landing page for everyone, with screenshots from mock mode (`public/landing/`, light and dark). Signed out it offers signing in and creating an organization; signed in on this browser, opening the app (`/open`).
- **Organizations.** Only emails listed in the database can create one (see [Who can create organizations](#who-can-create-organizations)). Everything of an organization lives under its address, `/<org>/`, and a space's board under `/<org>/<space>`. One sign-in covers every organization an email is in.
- **A sidebar per organization.** Inside an organization there are only its spaces (the ones you can see), its pages (Suggestions, Team, Organization settings) and, at the bottom, the organization switcher: the organizations signed in on this browser, your theme, and signing out of this organization.
- **Sign-in by email link.** No passwords.
- **Several organizations at once, with any emails.** The Organizations page lists every organization signed in on this browser, each with its email, and offers two things that don't depend on where you came from: signing in to an organization (with the email you use there) and creating one (with the email that will own it). There are no accounts to switch: signing out leaves one organization, and the others stay signed in.
- **Joining.** An organization can name email domains whose people join on their own. Admins can invite anyone else, at any domain.
- **Spaces.** Each has its own admins, members, logo and color. A space is open to the whole organization, or private to its members.
- **Suggestions.** Anyone who sees a space can suggest a link or a file. It waits until an admin of that space approves or rejects it.
- **Strict names.** Link names follow fixed rules (extra detail in brackets, like “Payments API (v2)”, no group name in front…), checked in the form and again in the database.
- **Files.** Uploaded to Cloudflare R2, up to 25 MB each, opened through short-lived signed addresses.
- **Restricted links.** A link can be visible to everyone who sees the space, to its admins only, or to chosen people.
- **Your own view.** Hide groups and links you don't need. Only you are affected.
- **Layout.** A space's admins drag cards to any column and place, and that is the layout everyone sees.
- **Card sizes.** Drag a card's bottom edge to change its height, or its left or right edge to change its column's width (double-click to undo). A space admin's sizes are everyone's; anyone else's are their own, and win over the space's for that card or the columns.
- **Search.** The search at the top shows the links you opened lately and finds any link of the space (“/” or ⌘K).

## Who can do what

An organization has admins and members. Each space has its own admins and members, who are people of the organization.

| | Member of the organization | Member of a space | Admin of a space | Admin of the organization |
| --- | :-: | :-: | :-: | :-: |
| See the spaces open to the organization, suggest links in them | ✓ | ✓ | ✓ | ✓ |
| See a private space | | that space | that space | if in it |
| Create a space (and become its admin) | private only | private only | private only | ✓ |
| Open a space to the whole organization | | | | ✓ |
| Add links straight away, review suggestions, edit and delete links, manage groups and the layout, the space's settings and visibility, delete it | | | that space | spaces they run |
| Add people of the organization to the space, change their role in it, take them out of it (they stay in the organization) | | | that space | spaces they run |
| Invite someone to the space by email | | | that space | spaces they run |
| Approve invitations from a space for people outside what the organization lets in | | | | ✓ |
| Invite and remove people, change roles (member ↔ admin) | | | | ✓ |
| Organization settings: name, email domains that join on their own | | | | ✓ |

Admins of the organization don't run every space: only the ones they created or were made admins of.

**Inviting from a space.** Someone already in the organization is added to the space at once. Someone new is invited to the organization too: at once when their email is at a domain the organization lets in, or when an admin of the organization invites them; otherwise the invitation waits on the Team page until an admin of the organization approves it.

**Always an admin.** An organization always keeps an admin who has signed in, and a space always keeps an admin. The last one can't be demoted or removed, and the last admin of a space can't be removed from the organization until someone else runs that space.

Someone removed from an organization can't rejoin through an allowed domain. Inviting them again lets them back in.

## Who can create organizations

Only emails in the `org_creators` table. `create_org()` checks it in the database, so the app's hidden button isn't the protection. Nobody can read or change the table through the Data API. Change it with SQL (Neon Console → SQL Editor):

```sql
insert into org_creators (email) values ('someone@example.com');  -- allow
delete from org_creators where email = 'someone@example.com';     -- stop allowing
```

## How it is built

There is no backend server. The browser talks to Neon directly:

- **Neon Auth** (Managed Better Auth) signs people in with a magic link. Its requests go through this site (`/api/auth/<org>/…`, `netlify/functions/auth.mjs`), so each organization's session is a cookie kept under its own path, and organizations of different emails can be signed in at once. A page uses the session of the organization in its address; switching to an organization of another email loads the page again. Signing out of an organization forgets its cookie only; the session ends at Neon Auth when its email's last organization is signed out. A new sign-in starts at `/api/auth/_new` and is then copied to each of the account's organizations (`src/lib/accounts.ts`).
- **Neon Data API** reads and writes the tables, as the signed-in person.
- **Row-level security** in Postgres decides what each person can read and change. Every rule above is enforced there (`db/migrations`), so the checks in the app only decide what to show.

Stack: React, TypeScript, Vite, TanStack Router and Query, Tailwind, shadcn components on Base UI, `@neondatabase/neon-js`.

```
db/migrations/          the schema and all access rules
src/api/                reading and writing data (TanStack Query)
src/features/board/     the board: columns, cards, rows, hiding, dragging
src/features/links/     the add / suggest / edit dialog, the name rules
src/features/search/    the search and its recent links
src/features/spaces/    spaces: settings, logos, new space and group
src/features/requests/  the review queue
src/features/team/      members and roles
src/features/settings/  organization settings
src/features/org/       opening, joining and creating organizations, permissions
src/features/auth/      sign-in and the screens before you are in
src/components/app/     shared pieces: sidebar, org switcher, top bar, sections, form controls
src/components/ui/      shadcn components, as installed by its CLI
src/lib/                colors, ordering, roles, theme, feature flags, the Neon client
src/routes/             one small file per page
netlify/                server functions: icon lookup, file upload and download, file cleanup
```

### Mock mode

`pnpm dev:mock` (port 3012) runs the real app with made-up data in the browser: nothing reaches Neon, R2 or the icon lookup, and no email is sent. A toolbar in the corner, which only exists in this mode, lists every screen: search one, or step through them with its arrows (Alt+[ and Alt+]). Each screen is set up with what it needs and has an address of its own (`/__screens/go/<screen>`). The toolbar also changes your role, opens the sign-in link that would have been emailed, and resets the data.

- `vite.config.ts` swaps `@neondatabase/neon-js` for `src/mock/neon-client.ts` in this mode, so the app's code runs unchanged.
- `src/mock/fetch.ts` answers the sign-in proxy and the server functions; `src/mock/backend.ts` answers queries and database functions from `src/mock/fixtures.ts`.
- The data stays in localStorage across reloads, until the toolbar resets it.
- Access rules are only imitated, roughly: mock mode tests the screens, not the rules in `db/migrations`.
- A production build leaves all of it out.

### Loading and errors

Data hooks come in two kinds. `useGroups()` suspends until the data is there, and is used inside a `<Section>`, which shows a skeleton while loading and, if loading fails, the problem and a Reload button for that part only. `useGroupsIfLoaded()` returns nothing while loading, for the parts of a page that are always there (the top bar, dialogs).

When the app opens, the splash screen stays until everything the organization's pages show has loaded. After that, moving around shows pages at once, with skeletons where data is missing.

### Pages and search engines

The app is built with TanStack Start in SPA mode (`vite.config.ts`, `src/router.tsx`, `src/routes/__root.tsx`):

- **The public pages** (`/`, `/login`, `/signup`) are drawn at build time into plain HTML (`PUBLIC_PAGES` in `vite.config.ts`). They show at once, read fully without scripts, and carry their own title, description, canonical address, link preview tags, and (the front page) structured data (`src/lib/site.ts`, each route's `head`).
- **The app's pages** (an organization's spaces and settings, `/organizations`, `/new`, `/file`, `/open`) say `ssr: false` and `noindex`: they are drawn in the browser from one shared shell, `_shell.html`.
- The build writes `sitemap.xml` with the public pages, next to `public/robots.txt`.
- Creating an organization has its own address, `/signup`, so it can be found on its own. `/login?intent=create` still works and goes there.

Code that runs while those pages are drawn at build time must not need a browser: `window`, `localStorage` and the like only inside effects and event handlers, or behind `typeof window` checks (`src/lib/accounts.ts`, `src/lib/theme.ts`).

## Run it

```bash
pnpm install
cp .env.example .env    # fill in the values
pnpm dev                # http://localhost:3011
```

Other commands: `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm db:migrate`, and `pnpm preview` (http://localhost:3013), which serves the build the way Netlify does: the pages drawn at build time as files, the shell for every other address, compressed.

Tests: `pnpm test` (rules in plain code), `pnpm test:e2e` (end to end in a browser, against mock mode on port 3014, started by Playwright; plan in `specs/teamshelf.md`), and `pnpm build && pnpm test:build` (what search engines get from the build). The first time, install the browser: `pnpm exec playwright install chromium`. How tests are kept up to date as the app changes is in `CLAUDE.md`.

`pnpm db:migrate` applies new files in `db/migrations`. Afterwards, refresh the Data API's copy of the schema: Neon Console → Data API → "Refresh schema cache". Until then it doesn't know new tables and functions.

## Before the team uses it

1. **Host it.** The repo is set up for Netlify (`netlify.toml`): connect the repository there and it builds and serves the site, with the two public Neon addresses already set. Any other static host works too: `pnpm build` gives the site in `dist/client/`. Files are served as they are (`/login` is `login/index.html`), and every other path must be sent to `_shell.html`.
2. **Trust the address.** In the Neon Console, under Auth → Configuration → Domains, add the site's address (`https://teamshelf.app`), and turn "Allow localhost" off once you no longer develop against this database. Sign-in links only return to trusted addresses.
3. **Use your own email sender.** Sign-in emails now come from Neon's shared sender, which is for development. Set an SMTP provider under Auth → Configuration → Email.

The layout of the sign-in email is Neon's and can't be edited. Only the app name in it is ours ("Teamshelf"). The sender stays "Neon Auth" until you set your own email sender. A different layout means sending the email yourself: a webhook for the `send.magic_link` event, plus an email service and a domain to send from.

### Link icons

Icons are loaded from the linked site itself, never through an icon service, so internal addresses stay private. When a link is saved, a small Netlify function (`netlify/functions/icon.mjs`, at `/api/icon`) reads the page and stores the address of the icon it declares. A browser can't do that across sites. The function only answers signed-in people and refuses addresses inside private networks. For pages it can't reach (internal tools), the app tries the usual icon locations itself, and a link without a loadable icon shows its first letter.

`node db/backfill-icons.mjs` looks up icons for links that have none saved.
