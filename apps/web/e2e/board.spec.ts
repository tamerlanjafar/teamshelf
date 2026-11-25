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

test.describe('recent links', () => {
  // Figma, 1Password and Grafana were opened lately, newest first.
  test.beforeEach(async ({ page }) => {
    await openScreen(page, 'board-recent')
    await page.getByRole('combobox', { name: 'Search links' }).click()
    await expect(page.getByRole('listbox', { name: 'Recent links' }).getByRole('option')).toHaveCount(3)
  })

  test('a recent link’s × takes it off the list without opening it', async ({ page }) => {
    const list = page.getByRole('listbox', { name: 'Recent links' })
    await list.getByRole('option', { name: /1Password/ }).hover()
    await page.getByRole('button', { name: 'Remove 1Password from recent' }).click()
    await expect(list.getByRole('option')).toHaveCount(2)
    await expect(list.getByRole('option', { name: /1Password/ })).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Search links' })).toBeFocused()
    expect(page.context().pages()).toHaveLength(1)
  })

  test('Delete takes the chosen recent link off the list, and the next one is chosen', async ({ page }) => {
    const list = page.getByRole('listbox', { name: 'Recent links' })
    await page.keyboard.press('ArrowDown')
    await expect(list.getByRole('option', { name: /1Password/ })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Delete')
    await expect(list.getByRole('option')).toHaveCount(2)
    await expect(list.getByRole('option', { name: /Grafana/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('removing the last one closes the list', async ({ page }) => {
    for (const name of ['Figma', '1Password', 'Grafana']) await page.getByRole('button', { name: `Remove ${name} from recent` }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })

  test('“Clear” empties the list, and Undo brings it back', async ({ page }) => {
    await page.getByRole('button', { name: 'Clear recent links' }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await page.getByRole('combobox', { name: 'Search links' }).click()
    await expect(page.getByRole('listbox', { name: 'Recent links' }).getByRole('option')).toHaveCount(3)
  })

  test('search results can’t be removed, only recent links', async ({ page }) => {
    await page.keyboard.type('graf')
    await expect(page.getByRole('listbox', { name: 'Links found' }).getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('button', { name: /from recent/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Clear recent links' })).toHaveCount(0)
    await page.keyboard.press('Delete')
    await expect(page.getByRole('listbox', { name: 'Links found' }).getByRole('option')).toHaveCount(1)
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

// The layout: everyone arranges their own board and can go back to the space's default, which
// its admins build in an editor of its own.

/** The layout button beside "Add", and what its menu offers. */
const layoutMenu = (page: import('@playwright/test').Page) => ({
  button: page.getByRole('button', { name: /^Space layout/ }),
  reset: page.getByRole('menuitem', { name: 'Reset my changes' }),
  edit: page.getByRole('menuitem', { name: 'Edit default layout…' }),
})

test.describe('your own changes to a space’s layout', () => {
  test('someone who changed nothing sees the layout as shared, with nothing to reset', async ({ page }) => {
    await openScreen(page, 'board-member')
    const { button, reset } = layoutMenu(page)
    await expect(page.getByRole('main').getByRole('region').first()).toHaveAccessibleName('Web app')
    await expect(button).toHaveAccessibleName('Space layout')
    await button.click()
    await expect(page.getByText('Default', { exact: true })).toBeVisible()
    await expect(page.getByText("The layout set by this space's admins, shown to everyone.")).toBeVisible()
    await expect(reset).toHaveCount(0)
  })

  test('a board you changed is marked, resets to the space layout, and the reset can be undone', async ({ page }) => {
    await openScreen(page, 'board-own-layout')
    const firstCard = page.getByRole('main').getByRole('region').first()
    const { button, reset } = layoutMenu(page)
    await expect(firstCard).toHaveAccessibleName('Security')
    await expect(button).toHaveAccessibleName('Space layout: changed by you')
    await button.click()
    await expect(page.getByText('Changed by you')).toBeVisible()
    await reset.click()
    await expect(firstCard).toHaveAccessibleName('Web app')
    await expect(button).toHaveAccessibleName('Space layout')
    await expect(page.getByText('Default layout restored')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(firstCard).toHaveAccessibleName('Security')
    await expect(button).toHaveAccessibleName('Space layout: changed by you')
  })

  test('an admin makes their own changes the default, for everyone, after saying so', async ({ page }) => {
    await openScreen(page, 'board')
    const { button } = layoutMenu(page)
    await page.getByRole('separator', { name: 'Height of Web app' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(button).toHaveAccessibleName('Space layout: changed by you')
    await button.click()
    await page.getByRole('menuitem', { name: 'Save as default layout…' }).click()
    const question = page.getByRole('dialog', { name: 'Make this the default layout?' })
    await expect(question).toContainText("Everyone in Development who hasn't changed their own layout")
    await question.getByRole('button', { name: 'Save as default' }).click()
    await expect(page.getByText('Default layout saved')).toBeVisible()
    // It is the space's now: nothing of their own is left, and the card kept its height.
    await expect(button).toHaveAccessibleName('Space layout')
    await expect(page.getByRole('button', { name: /Scroll down: \d+ more in Web app/ })).toBeVisible()
  })

  test('someone who isn’t an admin of the space can’t make their changes the default', async ({ page }) => {
    await openScreen(page, 'board-own-layout')
    await layoutMenu(page).button.click()
    await expect(layoutMenu(page).reset).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Save as default layout…' })).toHaveCount(0)
  })

  test('resizing a card is yours alone: it says so once, and marks the layout as changed', async ({ page }) => {
    await openScreen(page, 'board-member')
    await page.getByRole('separator', { name: 'Height of Web app' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByText('Only you see this change')).toBeVisible()
    await expect(layoutMenu(page).button).toHaveAccessibleName('Space layout: changed by you')
    await page.getByRole('button', { name: 'More for Web app' }).click()
    await expect(page.getByRole('menuitem', { name: "Use the space's height" })).toBeVisible()
  })

  test('an admin’s own changes are theirs too, with the way to the editor', async ({ page }) => {
    await openScreen(page, 'board')
    await page.getByRole('separator', { name: 'Height of Web app' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(layoutMenu(page).button).toHaveAccessibleName('Space layout: changed by you')
    await page.getByRole('button', { name: 'Edit default layout' }).click()
    await expect(page.getByRole('region', { name: 'Space layout editor' })).toBeVisible()
  })
})

test.describe('editing a space’s layout for everyone', () => {
  const editor = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Space layout editor' })

  test('only a space’s admins are offered its editor', async ({ page }) => {
    await openScreen(page, 'board-member')
    await layoutMenu(page).button.click()
    await expect(page.getByText('Default', { exact: true })).toBeVisible()
    await expect(layoutMenu(page).edit).toHaveCount(0)
    await openScreen(page, 'board-space-admin')
    await layoutMenu(page).button.click()
    await expect(layoutMenu(page).edit).toBeVisible()
  })

  test('the editor says what it edits, and has nothing to save until something changes', async ({ page }) => {
    await openScreen(page, 'board-editing')
    await expect(editor(page).getByRole('heading', { name: 'Editing the layout of Development' })).toBeVisible()
    // The top bar steps back: no search, nothing to add.
    await expect(page.getByRole('button', { name: 'Add link' })).toHaveCount(0)
    await expect(editor(page).getByRole('button', { name: 'Save for everyone' })).toBeDisabled()
    // Nothing to lose yet: leaving is just "Close".
    await editor(page).getByRole('button', { name: 'Close' }).click()
    await expect(editor(page)).toHaveCount(0)
  })

  test('a change is saved for everyone, not as the admin’s own', async ({ page }) => {
    await openScreen(page, 'board-editing')
    await page.getByRole('separator', { name: 'Height of Web app' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(editor(page)).toContainText('Unsaved changes')
    await editor(page).getByRole('button', { name: 'Save for everyone' }).click()
    await expect(page.getByText('Default layout saved')).toBeVisible()
    await expect(editor(page)).toHaveCount(0)
    // It is the space's now: nothing of the admin's own to reset, and the card kept its height.
    await expect(layoutMenu(page).button).toHaveAccessibleName('Space layout')
    await expect(page.getByRole('button', { name: /Scroll down: \d+ more in Web app/ })).toBeVisible()
  })

  test('discarding asks first, and leaves the layout as it was', async ({ page }) => {
    await openScreen(page, 'board-editing')
    await page.getByRole('separator', { name: 'Height of Web app' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('button', { name: /Scroll down: \d+ more in Web app/ })).toBeVisible()
    await editor(page).getByRole('button', { name: 'Discard' }).click()
    const dialog = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(dialog).toContainText('The layout of Development stays as it was.')
    await dialog.getByRole('button', { name: 'Discard changes' }).click()
    await expect(editor(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Scroll down: \d+ more in Web app/ })).toHaveCount(0)
  })

  test('while editing, hiding for yourself is off, and a group’s links can be sorted', async ({ page }) => {
    await openScreen(page, 'board-editing')
    await expect(page.getByRole('button', { name: /Hidden by you/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'More for Tools' }).click()
    await expect(page.getByRole('menuitem', { name: 'Hide for me' })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Sort links A to Z' }).click()
    const tools = page.getByRole('region', { name: 'Tools', exact: true })
    await expect(tools.getByRole('link').first()).toHaveText('Figma')
    await expect(editor(page)).toContainText('Unsaved changes')
  })
})
