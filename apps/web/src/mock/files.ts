// The files of mock mode. There is no storage: a text file written or saved here is kept with the
// mock data (store.ts), and every other file is made up from its name when it is asked for.

import { getState, update } from './store'

const RUNBOOK = `# Deploy runbook

How a release goes out, step by step. Keep it short: if a step needs explaining, link to the page that explains it.

## Before you start

- [x] The release notes are written
- [ ] Nobody else is deploying (ask in the channel)
- [ ] The dashboards are open

## Steps

1. Merge the release branch
2. Wait for the build to go **green**
3. Roll out to *staging*, then to production

> If anything looks wrong, roll back first and ask questions after.

| Environment | Address | Who to tell |
| --- | --- | --- |
| Staging | https://staging.example.com | The team |
| Production | https://app.example.com | Everyone |

\`\`\`sh
pnpm release --env production
\`\`\`

![Release flow](https://pictures.example.com/release-flow.png)
`

// A document that tries what a document must never be able to do. All of it has to stay text.
const HOSTILE = `# Imported notes

<script>window.__pwned = 'script tag'</script>

<img src="x" onerror="window.__pwned = 'img onerror'">

[A link that should go nowhere](javascript:window.__pwned='javascript-link')

<iframe src="javascript:parent.__pwned='iframe'"></iframe>

Plain text after it all.
`

const NOTES = `On-call notes

Mon: quiet.
Tue: the queue backed up around noon, cleared by itself.
`

const PAGE = `<!doctype html>
<html>
  <body>
    <h1>Old landing page</h1>
    <script>window.__pwned = 'html file'</script>
  </body>
</html>
`

// The smallest PDF that says something: one page, one line.
const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 18 Tf 40 110 Td (A made-up PDF) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`

const MADE_UP: Record<string, string> = {
  'mock/runbook.md': RUNBOOK,
  'mock/imported.md': HOSTILE,
  'mock/notes.txt': NOTES,
  'mock/page.html': PAGE,
}

/** Where a file of mock mode is read from and written to. Answered by src/mock/fetch.ts, never by a server. */
export const mockFileAddress = (key: string) => `/__mock-files/${encodeURIComponent(key)}`

export const keyOfMockAddress = (pathname: string) => (pathname.startsWith('/__mock-files/') ? decodeURIComponent(pathname.slice('/__mock-files/'.length)) : null)

/** Keeps text under a key, as storage would. */
export function writeMockFile(key: string, text: string) {
  update((draft) => {
    draft.files = { ...draft.files, [key]: text }
  })
}

/** The bytes of a file, as storage would send them: always as plain bytes, whatever the file is. */
export async function readMockFile(key: string, real: typeof fetch): Promise<Response> {
  const plain = { 'content-type': 'application/octet-stream' }
  const written = getState().files?.[key] ?? MADE_UP[key]
  if (written !== undefined) return new Response(written, { headers: plain })
  if (/\.pdf$/i.test(key)) return new Response(PDF, { headers: plain })
  // A picture: one that is really there, the app's own icon.
  if (/\.(png|jpe?g|gif|webp)$/i.test(key)) return new Response(await (await real('/icon-512.png')).blob(), { headers: plain })
  return new Response('not found', { status: 404 })
}
