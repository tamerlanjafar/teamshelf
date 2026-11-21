import { expect, test } from '@playwright/test'
import { goto, openScreen, signedOut } from './helpers'

// On a phone (the "mobile" project, playwright.config.ts): the sidebar becomes a drawer, nothing
// scrolls sideways, and the main actions fill the width.

const noSidewaysScroll = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

test('the front page fits the screen, with the actions full width', async ({ page }) => {
  await signedOut(page)
  await goto(page, '/')
  await noSidewaysScroll(page)
  const create = page.getByRole('main').getByRole('link', { name: 'Create an organization' }).first()
  const signIn = page.getByRole('main').getByRole('link', { name: 'Sign in' }).first()
  const [a, b] = [await create.boundingBox(), await signIn.boundingBox()]
  expect(Math.round(a!.width)).toBe(Math.round(b!.width))
})

for (const id of ['board', 'team', 'requests', 'space-settings', 'org-settings', 'orgs', 'login']) {
  test(`${id} doesn’t scroll sideways`, async ({ page }) => {
    await openScreen(page, id)
    await noSidewaysScroll(page)
  })
}

test('the sidebar opens as a drawer from the menu button, and closes after choosing', async ({ page }) => {
  await openScreen(page, 'board')
  await page.getByRole('button', { name: 'Spaces and pages' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('link', { name: /Design/ })).toBeVisible()
  await drawer.getByRole('link', { name: /Design/ }).click()
  await expect(page).toHaveURL(/\/acme\/design$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
