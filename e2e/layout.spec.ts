import { expect, test } from '@playwright/test'
import { goto, openScreen } from './helpers'

// The frame around every page: the top bar only on a board (on wide screens), titles at the same
// height on every other page, and a way back from a page under another.

const pagesBesideTheBoard = ['team', 'requests', 'org-settings', 'space-settings']

for (const width of [1024, 1440, 1920]) {
  test(`at ${width}px, only the board has a top bar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openScreen(page, 'board')
    await expect(page.locator('header').first()).toBeVisible()
    for (const id of pagesBesideTheBoard) {
      await openScreen(page, id)
      await expect(page.locator('header').first()).toBeHidden()
    }
  })
}

test('page titles start at the same height, close to the top', async ({ page }) => {
  const tops: number[] = []
  for (const id of ['team', 'requests', 'org-settings']) {
    await openScreen(page, id)
    const box = await page.getByRole('heading', { level: 1 }).boundingBox()
    tops.push(Math.round(box!.y))
  }
  expect(new Set(tops).size).toBe(1)
  expect(tops[0]).toBeLessThan(60)
})

test('a space’s settings link back to its board, above the title', async ({ page }) => {
  await openScreen(page, 'space-settings')
  await page.getByRole('link', { name: 'Development', exact: true }).first().click()
  await expect(page).toHaveURL(/\/acme\/development$/)
})

test('an Org Admin is marked next to the name', async ({ page }) => {
  await openScreen(page, 'team')
  const sam = page.getByText('Sam Lee', { exact: true }).locator('..')
  await expect(sam).toContainText('Org Admin')
})

test('a hidden tab doesn’t reload itself when nothing new was deployed', async ({ page }) => {
  await goto(page, '/')
  await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true)
})
