import { expect, test } from '@playwright/test'
import { openScreen } from './helpers'

// Outside any one organization: the list of the organizations signed in on this browser, joining
// one by email domain, being refused one, and creating one.

test.describe('your organizations', () => {
  test('nobody’s organization yet: a welcome, and the two ways in', async ({ page }) => {
    await openScreen(page, 'welcome')
    await expect(page.getByRole('heading', { name: 'Welcome to Teamshelf' })).toBeVisible()
    await page.getByRole('link', { name: /Create an organization/ }).click()
    await expect(page).toHaveURL(/\/signup$/)
  })

  test('signing in to another organization starts at /login, for joining', async ({ page }) => {
    await openScreen(page, 'welcome')
    await page.getByRole('link', { name: /Sign in to an organization/ }).click()
    await expect(page).toHaveURL(/\/login\?intent=join$/)
  })

  test('going to create one and back keeps the page: the list is there at once, without loading again', async ({ page }) => {
    await openScreen(page, 'orgs')
    // A mark on the page, gone if it loads again.
    await page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true))
    await page.getByRole('link', { name: /Create an organization/ }).click()
    await expect(page.getByRole('heading', { name: 'Create an organization' })).toBeVisible()
    await page.getByRole('button', { name: 'Your organizations' }).click()
    await expect(page.getByRole('link', { name: /Lumen Labs/ })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true)
  })

  test('from creating one, signing in is for another organization', async ({ page }) => {
    await openScreen(page, 'orgs')
    await page.getByRole('link', { name: /Create an organization/ }).click()
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login\?intent=join$/)
    await expect(page.getByRole('button', { name: 'Your organizations' })).toBeVisible()
  })

  test('lists each organization signed in, with its email', async ({ page }) => {
    await openScreen(page, 'orgs')
    await expect(page.getByRole('heading', { name: 'Your organizations' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Acme/ })).toContainText('alex@acme.com')
    await expect(page.getByRole('link', { name: /Lumen Labs/ })).toContainText('alex.morgan@lumenlabs.dev')
    await expect(page.getByRole('button', { name: 'Sign out of all' })).toBeVisible()
  })

  test('an organization the open email may join by its domain is offered to join', async ({ page }) => {
    await openScreen(page, 'orgs-joinable')
    await expect(page.getByText('Available to join')).toBeVisible()
    await expect(page.getByText('Orbit')).toBeVisible()
    await expect(page.getByRole('button', { name: /Join/ })).toBeVisible()
  })

  test('opening an organization goes to its address', async ({ page }) => {
    await openScreen(page, 'orgs')
    await page.getByRole('link', { name: /Acme/ }).click()
    await expect(page).toHaveURL(/\/acme(\/|$)/)
  })
})

test.describe('joining and being refused', () => {
  test('an email at a domain the organization lets in joins with one click', async ({ page }) => {
    await openScreen(page, 'join-domain')
    await expect(page.getByRole('heading', { name: 'Join Orbit?' })).toBeVisible()
    await expect(page.getByText('@lumenlabs.dev')).toBeVisible()
    await page.getByRole('button', { name: 'Join Orbit' }).click()
    await expect(page.getByRole('heading', { name: 'Join Orbit?' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/orbit/)
  })

  test('an organization this email can’t open offers another email', async ({ page }) => {
    await openScreen(page, 'no-access')
    await expect(page.getByRole('heading', { name: "Can't open this organization" })).toBeVisible()
    await page.getByRole('button', { name: 'Sign in with another email' }).click()
    await expect(page).toHaveURL(/\/login\?intent=join&redirect=%2Forbit$/)
  })

  test('both offer a way back to your organizations', async ({ page }) => {
    await openScreen(page, 'no-access')
    await page.getByRole('link', { name: 'Back to your organizations' }).click()
    await expect(page).toHaveURL(/\/organizations$/)
  })
})

test.describe('creating an organization', () => {
  test.beforeEach(async ({ page }) => openScreen(page, 'create'))

  test('the URL follows the name until it is typed itself', async ({ page }) => {
    await page.getByLabel('Name').fill('Blue Owl Studio!')
    await expect(page.getByLabel('URL')).toHaveValue('blue-owl-studio')
    await page.getByLabel('URL').fill('owls')
    await page.getByLabel('Name').fill('Blue Owl')
    await expect(page.getByLabel('URL')).toHaveValue('owls')
  })

  test('the URL keeps only lower-case letters, digits and dashes', async ({ page }) => {
    await page.getByLabel('URL').fill('My Team_42!')
    await expect(page.getByLabel('URL')).toHaveValue('myteam42')
  })

  test('a name is needed', async ({ page }) => {
    await page.getByRole('button', { name: 'Create organization' }).click()
    await expect(page.getByText('Give it a name.')).toBeVisible()
  })

  for (const reserved of ['signup', 'login', 'open', 'organizations']) {
    test(`“${reserved}” can’t be an address: it is a page of Teamshelf`, async ({ page }) => {
      await page.getByLabel('Name').fill('Something')
      await page.getByLabel('URL').fill(reserved)
      await page.getByRole('button', { name: 'Create organization' }).click()
      await expect(page.getByText('That address is used by Teamshelf itself.')).toBeVisible()
    })
  }

  test('an address of one character is too short', async ({ page }) => {
    await page.getByLabel('Name').fill('X')
    await page.getByLabel('URL').fill('x')
    await page.getByRole('button', { name: 'Create organization' }).click()
    await expect(page.getByText('Use at least 2 characters.')).toBeVisible()
  })

  test('an address another organization has is refused', async ({ page }) => {
    await page.getByLabel('Name').fill('Acme again')
    await page.getByLabel('URL').fill('acme')
    await page.getByRole('button', { name: 'Create organization' }).click()
    await expect(page.getByText(/taken/i)).toBeVisible()
  })

  test('creating it opens the new organization', async ({ page }) => {
    await page.getByLabel('Name').fill('Blue Owl')
    await page.getByRole('button', { name: 'Create organization' }).click()
    await expect(page).toHaveURL(/\/blue-owl(\/|$)/)
  })
})

test('an organization without spaces offers to create one', async ({ page }) => {
  await openScreen(page, 'empty-org')
  await expect(page.getByRole('button', { name: /New space/ }).first()).toBeVisible()
})
