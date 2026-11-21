import { expect, test } from '@playwright/test'

// The back office, in demo mode: who gets in, and what each report says.

test.describe('who gets in', () => {
  test('nobody signed in: the sign-in form, and nothing of the report', async ({ page }) => {
    await page.goto('/?as=guest')
    await expect(page.getByRole('heading', { name: 'Teamshelf back office' })).toBeVisible()
    await expect(page.getByText('Organizations')).toHaveCount(0)
  })

  test('signing in asks for a real email, then says where the link went', async ({ page }) => {
    await page.goto('/?as=guest')
    await page.getByLabel('Email').fill('not an email')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.')
    await page.getByLabel('Email').fill('Admin@Example.com')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()
  })

  test('someone who isn’t a super admin is told so, and sees nothing', async ({ page }) => {
    await page.goto('/?as=member')
    await expect(page.getByRole('heading', { name: "This isn't for you" })).toBeVisible()
    await expect(page.getByText("sam@example.com isn't a super admin")).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await page.goto('/organizations')
    await expect(page.getByRole('heading', { name: "This isn't for you" })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
  })

  test('signing out goes back to the sign-in form', async ({ page }) => {
    await page.goto('/?as=admin')
    await page.getByRole('button', { name: 'Sign out' }).first().click()
    await expect(page.getByRole('heading', { name: 'Teamshelf back office' })).toBeVisible()
  })
})

test.describe('overview', () => {
  test('the numbers that matter, each with what the last month added', async ({ page }) => {
    await page.goto('/?as=admin')
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
    const main = page.getByRole('main')
    await expect(main.getByText('Organizations', { exact: true }).locator('..')).toContainText('5')
    await expect(main.getByText('People', { exact: true }).locator('..')).toContainText('75')
    await expect(main.getByText('People', { exact: true }).locator('..')).toContainText('5 invited')
    await expect(main.getByText('File storage', { exact: true }).locator('..')).toContainText('1.43 GB')
  })

  test('a day of a chart is named when pointed at, and the same numbers are there as a table', async ({ page }) => {
    await page.goto('/?as=admin')
    const chart = page.getByRole('region', { name: 'Links and files added' })
    await expect(chart).toContainText('260 links and files in 30 days')
    await chart.getByRole('button', { name: '18 Nov: 24 links and files' }).hover()
    await expect(chart).toContainText('18 Nov: 24 links and files')
    await chart.getByText('Show as a table').click()
    await expect(chart.getByRole('row', { name: '18 Nov 24' })).toBeVisible()
  })

  test('a day with one says one, not “1 links”', async ({ page }) => {
    await page.goto('/?as=admin')
    const chart = page.getByRole('region', { name: 'New organizations' })
    await expect(chart.getByRole('button', { name: '9 Nov: 1 organization' })).toBeVisible()
  })
})

test.describe('organizations', () => {
  test('all of them, the most recently active first', async ({ page }) => {
    await page.goto('/organizations?as=admin')
    const rows = page.getByRole('row')
    await expect(rows).toHaveCount(6)
    await expect(rows.nth(1)).toContainText('Acme')
    await expect(rows.nth(1)).toContainText('owner@acme.example.com')
    await expect(rows.nth(1)).toContainText('+3 invited')
  })

  test('sorting by a column, and back the other way', async ({ page }) => {
    await page.goto('/organizations?as=admin')
    await page.getByRole('button', { name: 'Organization' }).click()
    await expect(page.getByRole('row').nth(1)).toContainText('Acme')
    await page.getByRole('button', { name: 'Organization' }).click()
    await expect(page.getByRole('row').nth(1)).toContainText('Orbit')
    await page.getByRole('button', { name: 'Storage' }).click()
    await expect(page.getByRole('row').nth(1)).toContainText('986 MB')
    await expect(page.getByRole('columnheader', { name: 'Storage' })).toHaveAttribute('aria-sort', 'descending')
  })

  test('searching by name or owner, and saying so when nothing matches', async ({ page }) => {
    await page.goto('/organizations?as=admin')
    await page.getByLabel('Search organizations').fill('lumen')
    await expect(page.getByRole('row')).toHaveCount(2)
    await page.getByLabel('Search organizations').fill('owner@orbit')
    await expect(page.getByRole('row').nth(1)).toContainText('Orbit')
    await page.getByLabel('Search organizations').fill('zzz')
    await expect(page.getByText('Nothing matches “zzz”.')).toBeVisible()
  })
})

test.describe('file storage', () => {
  test('each organization against its limit, nearly full said in words', async ({ page }) => {
    await page.goto('/storage?as=admin')
    const acme = page.getByRole('meter', { name: 'Acme', exact: true })
    await expect(acme).toHaveAttribute('aria-valuetext', '986 MB of 1.00 GB')
    await expect(acme).toContainText('Nearly full')
    await expect(page.getByRole('meter', { name: 'Orbit', exact: true })).not.toContainText('Nearly full')
    // An organization without files isn't listed.
    await expect(page.getByRole('meter', { name: 'Fern', exact: true })).toHaveCount(0)
  })

  test('the fullest spaces against theirs', async ({ page }) => {
    await page.goto('/storage?as=admin')
    await expect(page.getByRole('meter', { name: 'Acme › Design' })).toHaveAttribute('aria-valuetext', '244 MB of 250 MB')
  })
})

test('the pages are reached from the sidebar, and none scrolls sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/?as=admin')
  for (const name of ['Organizations', 'File storage', 'Overview']) {
    await page.getByRole('navigation', { name: 'Reports' }).getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  }
})
