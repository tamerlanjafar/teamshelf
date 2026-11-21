import { expect, test } from '@playwright/test'
import { goto, openScreen } from './helpers'

// Organization settings (Org Admins) and a space's settings (its admins): names, who may join,
// the address, who sees a space, its people, and deleting it.

test.describe('organization settings', () => {
  test.beforeEach(async ({ page }) => openScreen(page, 'org-settings'))

  test('renaming the organization', async ({ page }) => {
    await page.getByLabel('Name').fill('Acme Corp')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()
  })

  test('adding and removing a domain whose people join on their own', async ({ page }) => {
    const domains = page.getByLabel('Email domains that can join without an invitation')
    await domains.fill('acme.dev')
    await domains.press('Enter')
    await expect(page.getByRole('button', { name: 'Remove acme.dev' })).toBeVisible()
    await page.getByRole('button', { name: 'Remove acme.dev' }).click()
    await expect(page.getByRole('button', { name: 'Remove acme.dev' })).toHaveCount(0)
  })

  test('a domain must look like one', async ({ page }) => {
    const domains = page.getByLabel('Email domains that can join without an invitation')
    await domains.fill('not a domain')
    await expect(page.getByText('Enter a valid domain, like example.com')).toBeVisible()
  })

  test('changing the URL warns that old links stop working', async ({ page }) => {
    await page.getByRole('button', { name: 'Change URL…' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Links to /acme will stop working.')
    await dialog.getByLabel('New URL').fill('acme-corp')
    await dialog.getByRole('button', { name: 'Change URL' }).click()
    await expect(page).toHaveURL(/\/acme-corp\/settings$/)
  })

  test('a URL that is taken is refused', async ({ page }) => {
    await page.getByRole('button', { name: 'Change URL…' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('New URL').fill('orbit')
    await dialog.getByRole('button', { name: 'Change URL' }).click()
    await expect(dialog.getByText(/taken/i)).toBeVisible()
  })

  test('members don’t see organization settings', async ({ page }) => {
    await openScreen(page, 'board-member')
    await expect(page.locator('aside').getByRole('link', { name: 'Organization settings' })).toHaveCount(0)
  })
})

test.describe('space settings', () => {
  test('renaming the space', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeDisabled()
    await page.getByLabel('Name', { exact: true }).fill('Engineering')
    await page.getByRole('button', { name: 'Save' }).first().click()
    await expect(page.getByText('Saved.')).toBeVisible()
  })

  test('an Org Admin can make a space private, after a warning', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await page.getByRole('radio', { name: /Only its people/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Make Development private?' })
    await expect(dialog).toContainText("won't see it anymore")
    await dialog.getByRole('button', { name: 'Make private' }).click()
    await expect(page.getByRole('radio', { name: /Only its people/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('a space admin who isn’t an Org Admin can’t open a private space to everyone', async ({ page }) => {
    await openScreen(page, 'space-settings-private-member')
    await expect(page.getByRole('radio', { name: /Everyone in Acme/ })).toBeDisabled()
    await expect(page.getByText('Only an Org Admin can open a space to everyone.')).toBeVisible()
  })

  test('…and is told that making an open space private can’t be undone by them', async ({ page }) => {
    await openScreen(page, 'space-settings-open-member')
    await page.getByRole('radio', { name: /Only its people/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Only an Org Admin can open it again.')
  })

  test('an open space lists only its admins, since everyone in the organization is in it', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await expect(page.getByRole('heading', { name: /^Admins/ })).toBeVisible()
    await expect(page.getByText('Everyone in Acme can see this space.')).toBeVisible()
    await expect(page.locator('main').getByText('sam@acme.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add people' })).toHaveCount(0)
  })

  test('adding an admin to an open space', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await page.getByRole('button', { name: 'Add admins' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add admins to Development' })
    await expect(dialog.getByRole('radiogroup', { name: 'Role in the space' })).toHaveCount(0)
    await dialog.getByRole('checkbox', { name: /Mina Park/ }).click()
    await dialog.getByRole('button', { name: 'Add 1 admin' }).click()
    await expect(page.locator('main').getByText('mina@acme.com')).toBeVisible()
  })

  test('removing an admin of an open space', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await page.getByRole('button', { name: 'More for Sam Lee' }).click()
    await page.getByRole('menuitem', { name: 'Remove as admin' }).click()
    await expect(page.locator('main').getByText('sam@acme.com')).toHaveCount(0)
  })

  test('opening a private space takes its members off the list, keeping its admins', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await goto(page, '/acme/leadership/settings')
    await expect(page.locator('main').getByText('priya@acme.com')).toBeVisible()
    await page.getByRole('radio', { name: /Everyone in Acme/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Open Leadership to everyone in Acme?' })
    await expect(dialog).toContainText('Its 2 members are taken off its list')
    await dialog.getByRole('button', { name: 'Open to everyone' }).click()
    await expect(page.getByRole('heading', { name: /^Admins/ })).toBeVisible()
    await expect(page.locator('main').getByText('priya@acme.com')).toHaveCount(0)
    await expect(page.locator('main').getByText('alex@acme.com')).toBeVisible()
  })

  test('making a space private asks who else keeps it', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await page.getByRole('radio', { name: /Only its people/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Make Development private?' })
    await dialog.getByRole('checkbox', { name: /Mina Park/ }).click()
    await dialog.getByRole('button', { name: 'Make private with 1 person' }).click()
    await expect(page.getByRole('heading', { name: /^People/ })).toBeVisible()
    await expect(page.locator('main').getByText('mina@acme.com')).toBeVisible()
  })

  test('adding a person of the organization to a private space', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await goto(page, '/acme/leadership/settings')
    await page.getByRole('button', { name: 'Add people' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add people to Leadership' })
    await dialog.getByRole('checkbox', { name: /Mina Park/ }).click()
    await expect(dialog.getByRole('button', { name: 'Add 1 person' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Add 1 person' }).click()
    await expect(page.getByText('mina@acme.com')).toBeVisible()
  })

  test('inviting someone new by email from a space', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await goto(page, '/acme/leadership/settings')
    await page.getByRole('button', { name: 'Add people' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add people to Leadership' })
    await dialog.getByPlaceholder('Search by name or email').fill('jordan@acme.com')
    await dialog.getByRole('button', { name: /Invite jordan@acme.com/ }).click()
    await dialog.getByRole('button', { name: 'Invite 1 person' }).click()
    await expect(page.getByText('jordan@acme.com')).toBeVisible()
  })

  test('the people list keeps its order while choosing', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await goto(page, '/acme/leadership/settings')
    await page.getByRole('button', { name: 'Add people' }).click()
    const options = page.getByRole('dialog').getByRole('checkbox')
    const before = await options.allTextContents()
    await options.nth(1).click()
    expect(await options.allTextContents()).toEqual(before)
  })

  test('the last admin of a space can’t leave it or stop being its admin', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await goto(page, '/acme/data/settings')
    await page.getByRole('button', { name: 'More for Alex Morgan' }).click()
    await expect(page.getByRole('menuitem', { name: 'Remove as admin' })).toBeDisabled()
    await expect(page.getByText('A space keeps at least one admin.')).toBeVisible()
  })

  test('removing someone from a private space', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await goto(page, '/acme/leadership/settings')
    await page.getByRole('button', { name: 'More for Priya Nair' }).click()
    await page.getByRole('menuitem', { name: 'Remove from Leadership' }).click()
    await expect(page.locator('main').getByText('priya@acme.com')).toHaveCount(0)
  })

  test('deleting a space asks first, saying what goes with it', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await page.getByRole('button', { name: 'Delete space…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete Development?' })
    await expect(dialog).toContainText('Every group, link and file in Development is deleted for everyone.')
    await dialog.getByRole('button', { name: 'Delete Development' }).click()
    await expect(page.locator('aside').getByRole('link', { name: 'Development' })).toHaveCount(0)
  })

  test('members can’t open a space’s settings', async ({ page }) => {
    await openScreen(page, 'board-member')
    await goto(page, '/acme/development/settings')
    await expect(page.getByRole('button', { name: 'Delete space…' })).toHaveCount(0)
  })
})
