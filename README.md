# Linkboard

One page with every service and tool of a team: Jenkins, Grafana, back offices, docs. Each group of links is a card, as tall as its links, in a Pinterest-style grid.

- **Organizations.** Only accounts listed in the database can create one (see [Who can create organizations](#who-can-create-organizations)). Everything of an organization lives under its address, `/<org>/`. One sign-in covers all the organizations a person is in, and the menu at the top left switches between them.
- **Sign-in by email link.** No passwords.
- **Joining.** An organization can name email domains whose people join on their own. Admins can invite anyone else, at any domain.
- **Roles and category managers.** See [Who can do what](#who-can-do-what).
- **Suggestions.** Anyone can suggest a link. It waits until someone who manages it approves or rejects it.
- **Categories.** Each organization has its own list ("Frontend", "Backend", "Infrastructure"…). A link can have one, and the board can be narrowed to one.
- **Restricted links.** A link can be visible to everyone, to admins only, or to chosen people.
- **Your own view.** Hide groups and links you don't need. Only you are affected, and "Your view" brings them back.
- **Order.** The super admin drags groups and links into the order everyone sees.

## Who can do what

Roles are per organization.

| | Member | Admin | Super admin |
| --- | --- | --- | --- |
| See links (that they are allowed to see), hide them for themselves | ✓ | ✓ | all |
| Suggest a link | ✓ | ✓ | added right away |
| See "admins only" links | | ✓ | ✓ |
| Invite and remove people, change roles (member ↔ admin), choose category managers | | ✓ | ✓ |
| Review suggestions, edit and delete links | in categories they manage | in categories they manage | ✓ |
| Restrict a link, edit groups and categories, organization settings, the order of the board | | | ✓ |

**Category managers.** Besides their role, a person can manage any number of categories (set on the Team page). In those categories they add links straight to the board, edit and delete links, and review what others suggest. They can't touch links of other categories, links without a category, or links the super admin restricted.

The super admin is whoever created the organization. Nobody can change or remove them in the app, and there is exactly one.

Someone removed from an organization can't rejoin through an allowed domain. Inviting them again lets them back in.

## Who can create organizations

Only emails in the `org_creators` table. `create_org()` checks it in the database, so the app's hidden button isn't the protection. Nobody can read or change the table through the Data API. Change it with SQL (Neon Console → SQL Editor):

```sql
insert into org_creators (email) values ('someone@example.com');  -- allow
delete from org_creators where email = 'someone@example.com';     -- stop allowing
```

## How it is built

There is no backend server. The browser talks to Neon directly:

- **Neon Auth** (Managed Better Auth) signs people in with a magic link.
- **Neon Data API** reads and writes the tables, as the signed-in person.
- **Row-level security** in Postgres decides what each person can read and change. Every rule above is enforced there (`db/migrations`), so the checks in the app only decide what to show.

Stack: React, TypeScript, Vite, TanStack Router and Query, Tailwind, shadcn components on Base UI, `@neondatabase/neon-js`.

```
db/migrations/          the schema and all access rules
src/api/                reading and writing data (TanStack Query)
src/features/board/     the board: grid, cards, rows, search, hiding, reordering
src/features/links/     the add / suggest / edit dialog
src/features/requests/  the review queue
src/features/team/      members, roles, category managers
src/features/settings/  organization settings and categories
src/features/org/       opening, joining and creating organizations, permissions
src/features/auth/      sign-in and the screens before you are in
src/components/app/     shared pieces: top bar, sections, form controls
src/components/ui/      shadcn components, as installed by its CLI
src/lib/                colors, ordering, roles, theme, feature flags, the Neon client
src/routes/             one small file per page
netlify/                the icon lookup function, and its tests (`node --test netlify/lib/`)
```

### Loading and errors

Data hooks come in two kinds. `useGroups()` suspends until the data is there, and is used inside a `<Section>`, which shows a skeleton while loading and, if loading fails, the problem and a Reload button for that part only. `useGroupsIfLoaded()` returns nothing while loading, for the parts of a page that are always there (the top bar, dialogs).

When the app opens, the splash screen stays until everything the organization's pages show has loaded. After that, moving around shows pages at once, with skeletons where data is missing.

### Feature flags

`src/lib/features.ts`. Off unless set in `.env`:

- `VITE_PERSONAL_ORDER=true`: everyone can drag groups and links into an order of their own. The super admin's order stays the default: it applies to the groups, and inside each group, that a person hasn't rearranged themselves.

## Run it

```bash
pnpm install
cp .env.example .env    # fill in the three values
pnpm dev                # http://localhost:3011
```

Other commands: `pnpm build`, `pnpm lint`, `pnpm db:migrate`.

`pnpm db:migrate` applies new files in `db/migrations`. Afterwards, refresh the Data API's copy of the schema: Neon Console → Data API → "Refresh schema cache". Until then it doesn't know new tables and functions.

## Before the team uses it

1. **Host it.** The repo is set up for Netlify (`netlify.toml`): connect the repository there and it builds and serves the site, with the two public Neon addresses already set. Any other static host works too: `pnpm build` gives the site in `dist/`, and every path must be sent to `index.html`.
2. **Trust the address.** In the Neon Console, under Auth → Configuration → Domains, add the site's address (for example `https://your-site.netlify.app`), and turn "Allow localhost" off once you no longer develop against this database. Sign-in links only return to trusted addresses.
3. **Use your own email sender.** Sign-in emails now come from Neon's shared sender, which is for development. Set an SMTP provider under Auth → Configuration → Email.

The layout of the sign-in email is Neon's and can't be edited. Only the app name in it is ours ("Linkboard"). The sender stays "Neon Auth" until you set your own email sender. A different layout means sending the email yourself: a webhook for the `send.magic_link` event, plus an email service and a domain to send from.

### Link icons

Icons are loaded from the linked site itself, never through an icon service, so internal addresses stay private. When a link is saved, a small Netlify function (`netlify/functions/icon.mjs`, at `/api/icon`) reads the page and stores the address of the icon it declares. A browser can't do that across sites. The function only answers signed-in people and refuses addresses inside private networks. For pages it can't reach (internal tools), the app tries the usual icon locations itself, and a link without a loadable icon shows its first letter.

`node db/backfill-icons.mjs` looks up icons for links that have none saved.
