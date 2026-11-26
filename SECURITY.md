# Security

## Reporting a problem

Please don't open a public issue for a security problem. Report it privately on GitHub
(Security → Report a vulnerability), with what you found and how to reproduce it. You'll hear
back within a few days, and credit is given in the fix's notes unless you'd rather not.

## How Teamshelf is protected

- **Who may read and change what** is decided in Postgres, by row-level security
  (`db/migrations`). The app's own checks only decide what to show, so a request made by hand
  gets no further than the app would.
- **Limits** (uploads, suggestions, links, storage) are counted in the database too.
- **Files** are handed out as plain bytes to save. The one exception is a file named `.pdf`,
  which storage also sends as a PDF (and as nothing else) for the viewer's frame: the server
  decides that from the name the database holds, never from what the browser asks or the
  uploader claimed, and the site frames nothing but file storage. Inside the app a file is shown
  as the harmless kind its name stands for, documents are never given HTML, and links in them go
  to the web, to mail or to a database only.
- **The server functions** check the caller's token, ask the database as the caller, refuse
  addresses inside private networks (icon lookup), and are rate limited per address.

More detail: [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md).
