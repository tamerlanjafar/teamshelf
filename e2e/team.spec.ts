import { expect, test } from '@playwright/test'
import { openScreen } from './helpers'

// The organization's people: inviting, approving invitations from outside, roles, removing.

test.beforeEach(async ({ page }) => openScreen(page, 'team'))

test('says who may join on their own, and lists everyone with their role', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible()
  await expect(page.getByText('Anyone with an email at @acme.com can join on their own.')).toBeVisible()
  await expect(page.locator('main').getByText('alex@acme.com', { exact: true })).toBeVisible()
  await expect(page.getByText('Org Admin').first()).toBeVisible()
  await expect(page.getByText(/Invited/).first()).toBeVisible()
})

test('an invitation from outside the allowed domains waits for approval', async ({ page }) => {
  const waiting = page.getByText('taylor@freelance.example').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
  await expect(waiting).toContainText('Invited to')
  await expect(waiting).toContainText('Design')
  await waiting.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('taylor@freelance.example is invited.')).toBeVisible()
  await expect(page.getByText('Waiting for approval')).toHaveCount(0)
})

test('turning an invitation down asks first', async ({ page }) => {
  await page.getByRole('button', { name: 'Turn down' }).click()
  await expect(page.getByRole('dialog', { name: 'Turn down taylor@freelance.example?' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn down' }).click()
  await expect(page.getByText('taylor@freelance.example')).toHaveCount(0)
})

test('inviting someone by email', async ({ page }) => {
  await page.getByRole('button', { name: 'Invite' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invite to Acme' })
  await expect(dialog.getByRole('button', { name: 'Send invite' })).toBeDisabled()
  await dialog.getByLabel('Email').fill('new.person@acme.com')
  await dialog.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText(/Invitation sent to new.person@acme.com/)).toBeVisible()
  // In the list, as invited (the toast says it too).
  await expect(page.getByText('new.person@acme.com', { exact: true })).toBeVisible()
})

test('making someone an Org Admin, and a member again', async ({ page }) => {
  await page.getByRole('button', { name: 'More for Mina Park' }).click()
  await page.getByRole('menuitem', { name: 'Make Org Admin' }).click()
  const mina = page.getByText('mina@acme.com').locator('xpath=ancestor::div[contains(@class,"px-4")][1]')
  await expect(mina).toContainText('Org Admin')
  await page.getByRole('button', { name: 'More for Mina Park' }).click()
  await page.getByRole('menuitem', { name: 'Make member' }).click()
  await expect(mina).not.toContainText('Org Admin')
})

test('removing someone asks first, and says what happens', async ({ page }) => {
  await page.getByRole('button', { name: 'More for Priya Nair' }).click()
  await page.getByRole('menuitem', { name: 'Remove…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove Priya Nair?' })
  await expect(dialog).toContainText('can no longer open Acme')
  await dialog.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('priya@acme.com')).toHaveCount(0)
})

test('your own row has no menu', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'More for Alex Morgan' })).toHaveCount(0)
})

test('a space count opens the spaces someone is in, with their role', async ({ page }) => {
  await page.getByRole('button', { name: '4 spaces' }).click()
  const dialog = page.getByRole('dialog', { name: "Alex Morgan's spaces" })
  await expect(dialog.getByRole('listitem')).toHaveCount(4)
})
