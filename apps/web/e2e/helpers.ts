import { expect, type Page } from '@playwright/test'

/**
 * Opens one of mock mode's screens (src/mock/screens.ts): its situation is set up (who is signed
 * in, with which data and role), then its page loads. Waits until the app runs on it.
 */
export async function openScreen(page: Page, id: string) {
  await page.goto(`/__screens/go/${id}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/__screens'))
  await ready(page)
}

/** Waits until the page is running: hydrated, and any screen set-up behind the splash is done. */
export async function ready(page: Page) {
  await page.waitForFunction(() => !('$_TSR' in window))
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
  // Mock mode's toolbar sits over the bottom right corner; it is not part of the app.
  await page.addStyleTag({ content: '#mock-toolbar { display: none !important }' })
}

/** Opens a page of the app directly (after a screen set the situation up). */
export async function goto(page: Page, path: string) {
  await page.goto(path)
  await ready(page)
}

/** Nobody signed in on this browser (mock mode otherwise starts signed in as Alex, in Acme). */
export async function signedOut(page: Page) {
  await openScreen(page, 'login')
}
