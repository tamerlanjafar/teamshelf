import { expect, test } from '@playwright/test'
import { goto, signedOut } from './helpers'

// The pages anyone can open: the front page, signing in, creating an organization. Drawn at build
// time for search engines (vite.config.ts PUBLIC_PAGES), so their tags matter as much as their text.

test.describe('front page', () => {
  test('says what Teamshelf is and offers the way in', async ({ page }) => {
    await signedOut(page)
    await goto(page, '/')
    await expect(page).toHaveTitle("Teamshelf: your team's links and files, in one place")
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every link your team needs')
    await expect(page.getByRole('link', { name: 'Create an organization' }).first()).toHaveAttribute('href', '/signup')
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login')
  })

  test('shows the app itself, in the viewer’s theme', async ({ page }) => {
    await goto(page, '/')
    const shot = page.getByRole('img', { name: /A team's space in Teamshelf/ })
    await expect(shot).toBeVisible()
    await expect(shot).toHaveJSProperty('complete', true)
  })

  test('section links glide to their section without changing the address', async ({ page }) => {
    await goto(page, '/')
    await page.getByRole('navigation').getByRole('link', { name: 'Features' }).click()
    await expect(page.locator('#features')).toBeInViewport()
    expect(new URL(page.url()).hash).toBe('')
  })

  test('every feature is named', async ({ page }) => {
    await goto(page, '/')
    for (const feature of ['Press / and it', 'Anyone suggests, admins decide', 'The right people in every space', 'A space for every team', 'Links for a few', 'Files too', 'Several organizations', 'Your own view', 'Shape the board'])
      await expect(page.getByRole('heading', { name: new RegExp(feature) })).toHaveCount(1)
  })

  test('someone signed in on this browser is offered to open the app, at the organization used last', async ({ page }) => {
    await goto(page, '/__screens/go/board')
    await page.waitForURL('**/acme/development')
    await goto(page, '/')
    await expect(page.getByRole('link', { name: 'Open Teamshelf' }).first()).toHaveAttribute('href', '/acme')
    await expect(page.getByRole('link', { name: 'Create an organization' })).toHaveCount(0)
  })

  test('both ways in are in the page as drawn, so nothing moves when it starts', async ({ page, request }) => {
    // The page drawn on the server has both; a class set before the first paint shows one.
    const html = await (await request.get('/')).text()
    expect(html).toContain('Open Teamshelf')
    expect(html).toContain('Create an organization')
    await goto(page, '/__screens/go/board')
    await page.waitForURL('**/acme/development')
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveClass(/\bsigned-in\b/)
    await expect(page.getByRole('link', { name: 'Get started' })).toBeHidden()
  })
})

test.describe('search engines', () => {
  const pages = [
    { path: '/', title: "Teamshelf: your team's links and files, in one place" },
    { path: '/login', title: 'Sign in · Teamshelf' },
    { path: '/signup', title: 'Create an organization · Teamshelf' },
  ]
  for (const { path, title } of pages) {
    test(`${path} has its title, description, canonical address and preview tags`, async ({ page }) => {
      await goto(page, path)
      await expect(page).toHaveTitle(title)
      // .last(): the page's own tag wins over the defaults (the dev server may repeat tags; the
      // built HTML has each once, checked by scripts/check-build.mjs).
      const tag = (selector: string) => page.locator(`head ${selector}`).last()
      await expect(tag('meta[name="description"]')).toHaveAttribute('content', /.{50,}/)
      await expect(tag('meta[name="robots"]')).toHaveAttribute('content', /^index/)
      await expect(tag('link[rel="canonical"]')).toHaveAttribute('href', `https://teamshelf.app${path}`)
      await expect(tag('meta[property="og:title"]')).toHaveAttribute('content', title)
      await expect(tag('meta[property="og:url"]')).toHaveAttribute('content', `https://teamshelf.app${path}`)
      await expect(tag('meta[property="og:image"]')).toHaveAttribute('content', 'https://teamshelf.app/og.png')
      await expect(tag('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    })
  }

  test('the front page describes the product as structured data', async ({ page }) => {
    await goto(page, '/')
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) ?? '{}')
    expect(data['@graph'].map((item: { '@type': string }) => item['@type'])).toEqual(['WebSite', 'Organization', 'SoftwareApplication'])
  })

  test('the app’s own pages ask not to be listed', async ({ page }) => {
    for (const id of ['board', 'team', 'orgs']) {
      await page.goto(`/__screens/go/${id}`)
      await page.waitForURL((url) => !url.pathname.startsWith('/__screens'))
      await expect(page.locator('meta[name="robots"]').last()).toHaveAttribute('content', 'noindex, nofollow')
    }
  })

  test('robots.txt is plain text and points at the sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.headers()['content-type']).toContain('text/plain')
    const text = await response.text()
    expect(text).toContain('User-agent: *')
    expect(text).toContain('Sitemap: https://teamshelf.app/sitemap.xml')
  })
})
