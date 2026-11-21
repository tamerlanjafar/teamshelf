# Setting Teamshelf up

One command does almost all of it. This page says what it does, the few things only a person
can do, and how to do each step by hand if it stops.

**For an agent:** run the steps in order. Each has a check; don't go on until it passes. Never
print or commit `.env`. Ask the person only for what is marked **person**.

## 1. What you need

- Node 22 or newer, and pnpm (`corepack enable` gives you pnpm).
- Three free accounts. You don't need them beforehand: the command opens each sign-in page, and
  you can create the account there.
  - [Neon](https://console.neon.tech/signup): the database and sign-in. No card.
  - [Netlify](https://app.netlify.com/signup): the site. No card.
  - [Cloudflare](https://dash.cloudflare.com/sign-up): file storage (R2). **Optional.** R2 needs a card on file, with a free allowance. Without it Teamshelf keeps links only: adding a file or a document says that file storage isn't set up.

Nobody can create these accounts for you: each asks you to confirm an email and accept its terms.

## 2. Run it

```bash
git clone https://github.com/tamerlanjafar/teamshelf.git
cd teamshelf
pnpm install
pnpm cloud
```

`pnpm cloud` (`scripts/setup.mjs`) is safe to run again: it keeps what it made in `.env` and
picks up where it stopped. Flags: `--skip-r2`, `--skip-netlify` (set up for this machine only),
`--back-office` (also publish the back office).

What it does, and what it asks:

| Step | Done for you | **Person** |
| --- | --- | --- |
| Neon | creates the project, turns on sign-in (Neon Auth) and the Data API, creates the tables and rules (`db/migrations`), allows localhost | sign in in the browser; give the email that may create organizations and open the back office |
| R2 | creates the bucket and lets the site read and write to it (CORS) | sign in; turn R2 on in the dashboard the first time; create an API token ("Object Read & Write", this bucket) and paste its two keys |
| Netlify | creates the site, sets its variables, builds and publishes it, tells Neon to trust its address | sign in; pick a team and a site name |

**Check:** `.env` has `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL` and `DATABASE_URL`, and `pnpm db:migrate` says "Database is up to date."

## 3. Use it

```bash
pnpm dev        # the app: http://localhost:3011, the back office: http://localhost:3015
```

Open the app, sign in with the email you gave (a link arrives by email), and create your
organization. It starts with no spaces: create the first one from the sidebar.

**Check:** `pnpm test` and `pnpm test:e2e` pass (the first time: `pnpm --filter @teamshelf/web exec playwright install chromium`).

## 4. Going live

Do these before your team uses it.

1. **Your own email sender.** Sign-in emails come from Neon's shared sender, which is for
   development. Neon Console → Auth → Configuration → Email: add an SMTP provider.
2. **Turn localhost off** once you no longer develop against this database:
   `npx neonctl neon-auth domain allow-localhost disable --project-id <NEON_PROJECT_ID>`
3. **Deploy from Git** (optional): connect the repository in Netlify. The app needs no settings
   (`netlify.toml` says where it is). For the back office site, set the base directory to
   `apps/back-office`.
4. **A domain of your own**: add it in Netlify, then tell Neon to trust it:
   `npx neonctl neon-auth domain add https://your.domain --project-id <NEON_PROJECT_ID>`

## By hand

If a step of `pnpm cloud` fails, do that step here and run `pnpm cloud` again.

**Neon** (`npx neonctl auth` first)

```bash
npx neonctl projects create --name teamshelf                      # → NEON_PROJECT_ID
npx neonctl connection-string --project-id <id>                   # → DATABASE_URL
npx neonctl neon-auth enable --project-id <id>
npx neonctl neon-auth status --project-id <id> --output json      # base_url → VITE_NEON_AUTH_URL
npx neonctl data-api create --project-id <id> --database neondb --auth-provider neon_auth
npx neonctl data-api get --project-id <id> --database neondb --output json   # url → VITE_NEON_DATA_API_URL
```

In the Neon Console, Auth → Configuration: check that "Magic link" is on. Then, in the SQL
editor, create the user the file cleanup connects as, with a password of your own:

```sql
create role teamshelf_files login password '<password>';
```

Put `FILE_CLEANUP_DATABASE_URL` in `.env` (your `DATABASE_URL` with that user and password), then:

```bash
pnpm db:migrate
npx neonctl data-api refresh-schema --project-id <id> --database neondb
```

```sql
insert into org_creators (email) values ('you@example.com');   -- may create organizations
insert into super_admins (email) values ('you@example.com');   -- may open the back office
```

**R2**: create a bucket; under its Settings → CORS policy allow `GET` and `PUT` with the
`content-type` header from your site's address; create an API token (Object Read & Write) and put
`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in `.env`.

**Netlify**: create a site from the repository (no base directory: `netlify.toml` has it); set
`VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL`, the four `R2_` values and
`FILE_CLEANUP_DATABASE_URL` as its environment variables; deploy; add the site's address to
Neon (Auth → Configuration → Domains). The back office is a second site, base directory
`apps/back-office`, with the two `VITE_NEON_` variables.

## When something is wrong

| What you see | Why, and what to do |
| --- | --- |
| No sign-in email arrives | The address isn't trusted. On localhost: allow localhost (step 4.2, `enable`). On your site: add its address to Neon's trusted domains. |
| "Your account isn't ready yet" that doesn't go away | The Data API doesn't know the tables: `npx neonctl data-api refresh-schema …` |
| "This account can't create organizations" | The email isn't in `org_creators` (SQL above). |
| "This isn't for you" in the back office | The email isn't in `super_admins` (SQL above). |
| "File storage isn't set up yet" | The `R2_` variables are missing where the site runs. |
| A file won't open: "couldn't be loaded" | The bucket's CORS policy doesn't allow `GET` from the site's address. |
| The build says the Neon variables are not set | Set `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` in Netlify (Site configuration → Environment variables). |
