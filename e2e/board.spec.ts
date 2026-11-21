import { expect, test } from '@playwright/test'
import { openScreen } from './helpers'

// A space's board: what each role sees and can do, quick find, adding and suggesting links, and
// each person's own view (hiding).

test.describe('what each role sees', () => {
  test('an Org Admin adds links, and sees links restricted to admins', async ({ page }) => {
    await openScreen(page, 'board')
    await expect(page.getByRole('button', { name: 'Add link' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin console' })).toBeVisible()
    await expect(page.getByLabel('Only some people see this').first()).toBeVisible()
  })

  test('a member suggests instead of adding, and doesn’t see links for admins', async ({ page }) => {
    await openScreen(page, 'board-member')
    await expect(page.getByRole('button', { name: 'Suggest link' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add link' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Admin console' })).toHaveCount(0)
  })

  test('a member doesn’t see private spaces they aren’t in', async ({ page }) => {
    await openScreen(page, 'board-member')
    await expect(page.getByRole('link', { name: /Leadership/ })).toHaveCount(0)
  })

  test('a private space opens for its people, marked with a lock in the sidebar', async ({ page }) => {
    await openScreen(page, 'private-space')
    const inSidebar = page.locator('aside').getByRole('link', { name: /Leadership/ })
    await expect(inSidebar).toHaveAttribute('aria-current', 'page')
    await expect(inSidebar.locator('svg.lucide-lock')).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'Plans' })).toBeVisible()
  })

  test('only a space’s admins see its settings', async ({ page }) => {
    await openScreen(page, 'board')
    await expect(page.getByRole('link', { name: 'Development settings' })).toBeVisible()
    await openScreen(page, 'board-member')
    await expect(page.getByRole('link', { name: 'Development settings' })).toHaveCount(0)
  })

  test('every group shows its links, with how many it has', async ({ page }) => {
    await openScreen(page, 'board')
    for (const group of ['Web app', 'Monitoring', 'CI / CD', 'Docs', 'Cloud', 'Tools']) await expect(page.getByRole('region', { name: group })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Web app' }).getByRole('link')).toHaveCount(6)
  })

  test('an empty space says so and offers to add the first group', async ({ page }) => {
    await openScreen(page, 'empty-space')
    await expect(page.getByText('Nothing in Development yet')).toBeVisible()
  })
})

test.describe('quick find', () => {
  test.beforeEach(async ({ page }) => {
    await openScreen(page, 'board')
    // The board (and its keyboard shortcut) comes after the page itself.
    await expect(page.getByRole('combobox', { name: /Search/ })).toBeVisible()
    await page.locator('main').click({ position: { x: 5, y: 5 } })
  })

  test('“/” focuses it from anywhere on the board', async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.getByRole('combobox', { name: /Search/ })).toBeFocused()
  })

  test('typing lists the matching links, with their group', async ({ page }) => {
    await page.keyboard.press('/')
    await page.keyboard.type('portal')
    const list = page.getByRole('listbox')
    await expect(list.getByRole('option')).toHaveCount(2)
    await expect(list.getByRole('option').first()).toContainText('Web app')
  })

  test('words match anywhere in the name, group or address', async ({ page }) => {
    await page.keyboard.press('/')
    await page.keyboard.type('cloudflare.com')
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('option')).toContainText('Cloudflare')
  })

  test('nothing matching says so', async ({ page }) => {
    await page.keyboard.press('/')
    await page.keyboard.type('zzzz-no-such-link')
    await expect(page.getByRole('option')).toHaveCount(0)
    await expect(page.getByText('Nothing in Development has “zzzz-no-such-link” in its name, group or address.')).toBeVisible()
  })

  test('arrows move the choice, Enter opens it in a new tab', async ({ page, context }) => {
    // The made-up addresses don't exist: answer them here.
    await context.route('https://partners.example.com/**', (route) => route.fulfill({ body: 'Partner portal' }))
    await page.keyboard.press('/')
    await page.keyboard.type('portal')
    await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
    const opened = page.waitForEvent('popup')
    await page.keyboard.press('Enter')
    expect((await opened).url()).toContain('partners.example.com')
  })

  test('Escape closes it', async ({ page }) => {
    await page.keyboard.press('/')
    await page.keyboard.type('portal')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })

  test('a link opened lately is offered before typing', async ({ page }) => {
    const opened = page.waitForEvent('popup')
    await page.getByRole('link', { name: 'Grafana' }).click()
    await (await opened).close()
    await page.keyboard.press('/')
    await expect(page.getByRole('option', { name: /Grafana/ })).toBeVisible()
  })
})

test.describe('adding and suggesting', () => {
  test('an admin adds a link, and it is on the board at once', async ({ page }) => {
    await openScreen(page, 'board')
    await page.getByRole('button', { name: 'Add link' }).click()
    const dialog = page.getByRole('dialog', { name: /Add a link/ })
    await dialog.getByLabel('Group').fill('Docs')
    await page.getByRole('option', { name: 'Docs', exact: true }).click()
    await dialog.getByLabel('Name').fill('Team handbook')
    await dialog.getByLabel('Address').fill('https://handbook.example.com')
    await dialog.getByRole('button', { name: 'Add to Development' }).click()
    await expect(page.getByText('Added to Development.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Docs' }).getByRole('link', { name: 'Team handbook' })).toBeVisible()
  })

  test('a member’s suggestion waits for review and isn’t on the board yet', async ({ page }) => {
    await openScreen(page, 'board-member')
    await page.getByRole('button', { name: 'Suggest link' }).click()
    const dialog = page.getByRole('dialog', { name: /Suggest a link/ })
    await dialog.getByLabel('Group').fill('Docs')
    await page.getByRole('option', { name: 'Docs', exact: true }).click()
    await dialog.getByLabel('Name').fill('Team handbook')
    await dialog.getByLabel('Address').fill('https://handbook.example.com')
    await dialog.getByRole('button', { name: 'Send for review' }).click()
    await expect(page.getByText(/Sent for review/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Team handbook' })).toHaveCount(0)
  })

  for (const [name, message] of [
    ['Link', /doesn't say what the link opens/],
    ['Docs Handbook', /Drop “Docs” from the front/],
    ['Handbook - Prod', /Put extra detail in brackets/],
    ['Onboarding guide', /already has/],
  ] as const) {
    test(`the name “${name}” is refused with a reason`, async ({ page }) => {
      await openScreen(page, 'board')
      await page.getByRole('button', { name: 'Add link' }).click()
      const dialog = page.getByRole('dialog', { name: /Add a link/ })
      await dialog.getByLabel('Group').fill('Docs')
      await page.getByRole('option', { name: 'Docs', exact: true }).click()
      await dialog.getByLabel('Name').fill(name)
      await dialog.getByLabel('Address').fill('https://example.com/x')
      await dialog.getByRole('button', { name: 'Add to Development' }).click()
      await expect(dialog.getByText(message)).toBeVisible()
    })
  }

  test('an address is needed', async ({ page }) => {
    await openScreen(page, 'board')
    await page.getByRole('button', { name: 'Add link' }).click()
    const dialog = page.getByRole('dialog', { name: /Add a link/ })
    await dialog.getByLabel('Group').fill('Docs')
    await page.getByRole('option', { name: 'Docs', exact: true }).click()
    await dialog.getByLabel('Name').fill('Team handbook')
    await dialog.getByRole('button', { name: 'Add to Development' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Address')).toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('your own view', () => {
  test('hiding a link takes it off your board, and the hidden view brings it back', async ({ page }) => {
    await openScreen(page, 'board')
    await page.getByRole('button', { name: 'More for Grafana' }).click()
    await page.getByRole('menuitem', { name: 'Hide for me' }).click()
    await expect(page.getByRole('link', { name: 'Grafana' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Hidden by you: 1' }).click()
    await page.getByRole('button', { name: 'Show Grafana again' }).click()
    await page.getByRole('button', { name: /Hidden by you/ }).click()
    await expect(page.getByRole('link', { name: 'Grafana' })).toBeVisible()
  })

  test('copying a link’s address', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openScreen(page, 'board')
    await page.getByRole('button', { name: 'More for Grafana' }).click()
    await page.getByRole('menuitem', { name: 'Copy address' }).click()
    await expect(page.getByText('Address copied.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://grafana.com')
  })
})

test('a new space starts private, even for an Org Admin, and opens', async ({ page }) => {
  await openScreen(page, 'board')
  await page.getByRole('navigation', { name: 'Acme' }).getByRole('button', { name: 'New space' }).click()
  const dialog = page.getByRole('dialog', { name: 'New space' })
  await expect(dialog).toContainText('Only you see it until you add people or open it to everyone.')
  await dialog.getByLabel('Name').fill('Marketing')
  await dialog.getByRole('button', { name: 'Create space' }).click()
  await page.waitForURL('**/acme/marketing')
  await expect(page.getByRole('navigation', { name: 'Acme' }).getByRole('link', { name: 'Marketing' }).getByLabel('Private')).toBeVisible()
})
