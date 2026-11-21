# Contributing

Thanks for wanting to help. Issues and pull requests are welcome.

1. **Run it without any account:** `pnpm install && pnpm dev:mock` opens the real app on made-up
   data (http://localhost:3012), with a toolbar that opens every screen.
2. **Make the change with its tests.** Every change comes with them; the rules are in
   [CLAUDE.md](CLAUDE.md) (written for coding agents, and just as true for people): mock mode
   first, cases in `apps/web/specs/teamshelf.md`, then end-to-end tests that find things the way
   people do.
3. **Check it:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
4. **Database changes** are new files in `db/migrations`. Rules about who may do what belong
   there, not only in the app.

Example data stays made up (Acme, Lumen Labs, Orbit; `example.com` addresses). Security problems
go through [SECURITY.md](SECURITY.md), not public issues.
