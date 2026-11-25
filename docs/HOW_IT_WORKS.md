# How Teamshelf works

What the app does in detail, who may do what, and how it is put together. To set it up, see
[SETUP.md](../SETUP.md).

## What it does

- **Front page.** `/` is a landing page for everyone, with screenshots from mock mode (`apps/web/src/features/landing/shots/`, light and dark; the build names each by a hash of its content, so a new one is never hidden behind a cached copy). Signed out it offers signing in and creating an organization; signed in on this browser, opening the app at the organization used last.
- **Organizations.** Only emails listed in the database can create one (see [Who can create organizations](#who-can-create-organizations)). Everything of an organization lives under its address, `/<org>/`, and a space's board under `/<org>/<space>`. One sign-in covers every organization an email is in.
- **A sidebar per organization.** Inside an organization there are only its spaces (the ones you can see), its pages (Suggestions, Team, Organization settings) and, at the bottom, the organization switcher: the organizations signed in on this browser, your theme, and signing out of this organization.
- **Sign-in by email link.** No passwords.
- **Several organizations at once, with any emails.** The Organizations page lists every organization signed in on this browser, each with its email, and offers two things that don't depend on where you came from: signing in to an organization (with the email you use there) and creating one (with the email that will own it). There are no accounts to switch: signing out leaves one organization, and the others stay signed in.
- **Joining.** An organization can name email domains whose people join on their own. Admins can invite anyone else, at any domain.
- **Spaces.** A new organization has none: its people create the ones they need. Each has its own admins, members, logo and color. A space is open to the whole organization, or private to its members.
- **Suggestions.** Anyone who sees a space can suggest a link or a file. It waits until an admin of that space approves or rejects it.
- **Folders.** A group can hold folders, and folders can hold folders, up to 6 deep, so one long group (all of a team's documentation, say) stays one group and is easy to look through. A card lists its folders first, A to Z, each with how many links it holds; a folder opens in place, and stays open in that browser. A space's admins create, rename, move and delete folders from the card's menus, and move a link to another folder from its menu or its form; deleting a folder moves what is in it up a level. Someone suggesting a link can choose one of the group's folders for it. Search shows where a link is (Documentation / Pipelines / Warehouse). Names are unique per folder.
- **Strict names.** Link names follow fixed rules (extra detail in brackets, like “Payments API (v2)”, a capital first, no “ - ” or “_”…), checked in the form and again in the database.
- **Files.** Uploaded to Cloudflare R2, up to 25 MB each. Clicking one opens it inside Teamshelf: pictures, PDFs, sound and video are shown, Markdown documents are shown with their formatting, and text of any kind (notes, data, code, a web page's source) as it is written. Anything else offers its download. Outside the app a file is only ever saved to disk, never opened as a page.
- **Documents.** "Add" has a third choice next to a web address and a file: a document, written in Teamshelf with headings, lists and checklists, quotes, links, tables and code, and kept as a Markdown file (or, without formatting, as a plain text file), under a file name you can change. A space's admins edit documents the same way, and text files as plain text; the new contents replace the file's, under the same link.
- **Restricted links.** A link can be visible to everyone who sees the space, to its admins only, or to chosen people.
- **Your own view.** Hide groups and links you don't need. Only you are affected.
- **Layout.** Everyone arranges their own board: drag a card to any column and place, drag a link within its group, drag a card's bottom edge to change its height or a side edge to change its column's width. It is yours alone and wins over the space's default, until you reset your changes from the layout button beside "Add" (which can be undone). A dot on that button marks a board you changed. What you hid stays hidden.
- **Default layout.** A space's admins build the layout everyone starts from on the board itself ("Edit default layout…" in the layout button's menu, not on a phone), with a dock at the bottom to save or discard. An admin who has rearranged the board for themselves can also make that arrangement the default ("Save as default layout…"): the same dragging and resizing, and sorting a group's links A to Z, on a draft that nobody sees until "Save for everyone". Saving doesn't touch what people arranged themselves: they keep it until they reset.
- **Search.** The search at the top shows the links you opened lately and finds any link of the space (“/” or ⌘K).

## Who can do what

An organization has admins and members. Each space has its own admins and members, who are people of the organization.

| | Member of the organization | Member of a space | Admin of a space | Admin of the organization |
| --- | :-: | :-: | :-: | :-: |
| See the spaces open to the organization, suggest links in them | ✓ | ✓ | ✓ | ✓ |
| See a private space | | that space | that space | if in it |
| Create a space (and become its admin) | private only | private only | private only | ✓ |
| Open a space to the whole organization | | | | ✓ |
| Add links straight away, review suggestions, edit and delete links, manage groups, their folders and the default layout, the space's settings and visibility, delete it | | | that space | spaces they run |
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

## Who sees the back office

Only emails in the `super_admins` table. `back_office_report()` checks it in the database and
gives everyone else nothing. Change it with SQL:

```sql
insert into super_admins (email) values ('someone@example.com');
```

The report has numbers, and the names of organizations and spaces. It never has a link, a file,
or anyone's email except the one that created an organization.

## How it is built

There is no backend server. The browser talks to Neon directly:

- **Neon Auth** (Managed Better Auth) signs people in with a magic link. Its requests go through this site (`/api/auth/<org>/…`, `packages/auth-proxy`), so each organization's session is a cookie kept under its own path, and organizations of different emails can be signed in at once. A page uses the session of the organization in its address; switching to an organization of another email loads the page again. Signing out of an organization forgets its cookie only; the session ends at Neon Auth when its email's last organization is signed out. A new sign-in starts at `/api/auth/_new` and is then copied to each of the account's organizations (`apps/web/src/lib/accounts.ts`).
- **Neon Data API** reads and writes the tables, as the signed-in person.
- **Row-level security** in Postgres decides what each person can read and change. Every rule above is enforced there (`db/migrations`), so the checks in the app only decide what to show.

Stack: React, TypeScript, Vite, TanStack Router and Query, Tailwind, shadcn components on Base UI, `@neondatabase/neon-js`.

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

### Mock mode

`pnpm dev:mock` (port 3012) runs the real app with made-up data in the browser: nothing reaches Neon, R2 or the icon lookup, and no email is sent. A toolbar in the corner, which only exists in this mode, lists every screen: search one, or step through them with its arrows (Alt+[ and Alt+]). Each screen is set up with what it needs and has an address of its own (`/__screens/go/<screen>`). The toolbar also changes your role, opens the sign-in link that would have been emailed, and resets the data.

- `apps/web/vite.config.ts` swaps `@neondatabase/neon-js` for `apps/web/src/mock/neon-client.ts` in this mode, so the app's code runs unchanged.
- `apps/web/src/mock/fetch.ts` answers the sign-in proxy and the server functions; `apps/web/src/mock/backend.ts` answers queries and database functions from `apps/web/src/mock/fixtures.ts`.
- The data stays in localStorage across reloads, until the toolbar resets it.
- Access rules are only imitated, roughly: mock mode tests the screens, not the rules in `db/migrations`.
- A production build leaves all of it out.

### Loading and errors

Data hooks come in two kinds. `useGroups()` suspends until the data is there, and is used inside a `<Section>`, which shows a skeleton while loading and, if loading fails, the problem and a Reload button for that part only. `useGroupsIfLoaded()` returns nothing while loading, for the parts of a page that are always there (the top bar, dialogs).

When the app opens, the splash screen stays until everything the organization's pages show has loaded. After that, moving around shows pages at once, with skeletons where data is missing.

### Pages and search engines

The app is built with TanStack Start in SPA mode (`apps/web/vite.config.ts`, `apps/web/src/router.tsx`, `apps/web/src/routes/__root.tsx`):

- **The public pages** (`/`, `/login`, `/signup`) are drawn at build time into plain HTML (`PUBLIC_PAGES` in `apps/web/vite.config.ts`). They show at once, read fully without scripts, and carry their own title, description, canonical address, link preview tags, and (the front page) structured data (`apps/web/src/lib/site.ts`, each route's `head`).
- **The app's pages** (an organization's spaces and settings, `/organizations`, `/new`, `/file`) say `ssr: false` and `noindex`: they are drawn in the browser from one shared shell, `_shell.html`.
- The build writes `sitemap.xml` with the public pages, and `robots.txt` pointing at it.
- Creating an organization has its own address, `/signup`, so it can be found on its own. `/login?intent=create` still works and goes there.

Code that runs while those pages are drawn at build time must not need a browser: `window`, `localStorage` and the like only inside effects and event handlers, or behind `typeof window` checks (`apps/web/src/lib/accounts.ts`, `apps/web/src/lib/theme.ts`).

## Limits

Every request can be made by hand, so nothing relies on the app's screens:

- **Who may read and change what** is decided in Postgres (`db/migrations`), for each row.
- **How much one person can store** is too: 1000 links and files and 200 groups per space, 20 suggestions of yours waiting at once, 200 people per organization (50 of them waiting for approval), 50 uploads a day per person, and 250 MB of files per space, 1 GB per organization.
- **A file belongs to one link.** An upload is recorded when it starts (`start_upload()`), a file link must name an upload its author made, and an upload that never became a link (the form was closed before saving) has no link to be deleted with, so the daily cleanup deletes it after a day. Storage only ever hands a file out as plain bytes to save: an uploaded web page or SVG never opens as a page. Inside the app a file is shown as the harmless kind its name stands for (`apps/web/src/features/files/file-kind.ts`), a document is drawn from its structure by the editor (Tiptap), which is never given HTML: a document that has any in it is read and edited as plain text (`apps/web/src/features/files/markdown-safety.ts`). Links in a document go to the web or to mail only and open without saying where they came from, a picture from another site is fetched only when the reader asks for it, and everything else is text.
- **How often** the server functions answer one address (IP), counted by Netlify: 40 a minute for the costly ones (sending a sign-in email, an icon lookup, starting an upload: `apps/web/netlify/functions/actions.mjs`), 600 a minute for the rest (`apps/web/netlify/functions/api.mjs`). After that, 429 until the minute is over. Netlify allows two such limits per site below its Pro plan, which is why there are two functions.

Neon Auth and the Data API are also reachable at their own addresses (they are in the page's code), where Neon's own limits apply, not these.

## Link icons

Icons are loaded from the linked site itself, never through an icon service, so internal addresses stay private. When a link is saved, a small Netlify function (`apps/web/netlify/lib/icon-api.mjs`, at `/api/icon`) reads the page and stores the address of the icon it declares. A browser can't do that across sites. The function only answers signed-in people and refuses addresses inside private networks. For pages it can't reach (internal tools), the app tries the usual icon locations itself, and a link without a loadable icon shows its first letter.
