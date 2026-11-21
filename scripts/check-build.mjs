// Checks the built site (dist/client) for what search engines and link previews read: each public
// page drawn at build time with its text, one of each head tag, its own canonical address, and
// the sitemap and robots.txt. Run after `pnpm build` (part of `pnpm test:build`).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const SITE = 'https://teamshelf.app'
const read = (path) => readFileSync(new URL(`../dist/client/${path}`, import.meta.url), 'utf8')
const count = (html, pattern) => (html.match(pattern) ?? []).length

const PAGES = [
  { file: 'index.html', path: '/', text: 'Every link your team needs' },
  { file: 'login/index.html', path: '/login', text: 'Welcome to Teamshelf' },
  { file: 'signup/index.html', path: '/signup', text: 'Create an organization' },
]

for (const { file, path, text } of PAGES) {
  test(`${path} is drawn at build time with its text`, () => assert.ok(read(file).includes(text)))

  test(`${path} has one of each head tag, and its own address`, () => {
    const html = read(file)
    for (const tag of [/<title>/g, /name="description"/g, /name="robots"/g, /rel="canonical"/g, /property="og:title"/g, /property="og:url"/g, /property="og:image"/g])
      assert.equal(count(html, tag), 1, `${tag} in ${file}`)
    assert.ok(html.includes(`rel="canonical" href="${SITE}${path}"`))
    assert.ok(html.includes('name="robots" content="index'))
  })
}

test('the front page has its structured data once', () => assert.equal(count(read('index.html'), /application\/ld\+json/g), 1))

test('the shell for the app’s pages asks not to be listed', () => assert.ok(read('_shell.html').includes('name="robots" content="noindex, nofollow"')))

test('the sitemap lists exactly the public pages', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(urls.sort(), PAGES.map(({ path }) => `${SITE}${path}`).sort())
})

test('robots.txt allows the site and points at the sitemap', () => {
  const robots = read('robots.txt')
  assert.match(robots, /User-agent: \*/)
  assert.match(robots, new RegExp(`Sitemap: ${SITE}/sitemap.xml`))
})
