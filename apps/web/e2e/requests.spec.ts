import { expect, test } from '@playwright/test'
import { openScreen } from './helpers'

// Suggestions: what waits for a space's admins, and what each person sent.

test.describe('as a reviewer', () => {
  test.beforeEach(async ({ page }) => openScreen(page, 'requests'))

  test('lists what waits for you, with where each would go, and what you sent', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Suggestions' })).toBeVisible()
    await expect(page.getByText('Waiting for you')).toBeVisible()
    await expect(page.getByText('Sent by you')).toBeVisible()
    const jira = page.getByRole('article').filter({ hasText: 'Jira board' })
    await expect(jira).toContainText('Development')
    await expect(jira).toContainText('CI / CD')
    await expect(jira).toContainText('Priya Nair')
  })

  test('a suggestion for a folder says which one', async ({ page }) => {
    await expect(page.getByRole('article').filter({ hasText: 'Table owners' })).toContainText('Documentation / Pipelines / Warehouse')
    await expect(page.getByRole('article').filter({ hasText: 'Late data runbook' })).toContainText('Documentation / Runbooks')
  })

  test('approving a suggestion for a folder puts it in that folder', async ({ page }) => {
    await page.getByRole('article').filter({ hasText: 'Late data runbook' }).getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('article').filter({ hasText: 'Late data runbook' })).toHaveCount(0)
    await page.goto('/acme/data')
    const docs = page.getByRole('region', { name: 'Documentation' })
    await expect(docs.getByRole('group', { name: 'Runbooks' }).getByRole('link', { name: 'Late data runbook' })).toBeVisible()
  })

  test('editing a suggestion for a folder opens the form with that folder chosen', async ({ page }) => {
    await page.getByRole('article').filter({ hasText: 'Table owners' }).getByRole('button', { name: 'Edit before approving' }).click()
    await expect(page.getByRole('dialog').getByLabel('Folder')).toHaveValue('Pipelines / Warehouse')
  })

  test('a suggestion for a new group says so', async ({ page }) => {
    await expect(page.getByRole('article').filter({ hasText: 'Postman' })).toContainText('(new)')
  })

  test('approving puts it on the board', async ({ page }) => {
    await page.getByRole('article').filter({ hasText: 'Jira board' }).getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('article').filter({ hasText: 'Jira board' })).toHaveCount(0)
    await page.goto('/acme/development')
    await expect(page.getByRole('region', { name: 'CI / CD' }).getByRole('link', { name: 'Jira board' })).toBeVisible()
  })

  test('approving all at once', async ({ page }) => {
    await page.getByRole('button', { name: /Approve all/ }).click()
    await expect(page.getByText(/links approved\./)).toBeVisible()
    await expect(page.getByText('Waiting for you')).toHaveCount(0)
  })

  test('rejecting, with a reason the sender sees', async ({ page }) => {
    const jira = page.getByRole('article').filter({ hasText: 'Jira board' })
    await jira.getByRole('button', { name: 'Reject' }).click()
    await page.getByLabel('Reason (optional)').fill('We use Linear now.')
    await page.getByRole('button', { name: 'Reject suggestion' }).click()
    await expect(jira).toHaveCount(0)
  })

  test('editing before approving opens it in the link form', async ({ page }) => {
    await page.getByRole('article').filter({ hasText: 'Jira board' }).getByRole('button', { name: 'Edit before approving' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').getByLabel('Name')).toHaveValue('Jira board')
  })
})

test.describe('as a member', () => {
  test('sees only what they sent, and can withdraw it or remove a rejected one', async ({ page }) => {
    await openScreen(page, 'requests-member')
    await expect(page.getByText('Waiting for you')).toHaveCount(0)
    const rejected = page.getByRole('article').filter({ hasText: 'Old dashboards' })
    await expect(rejected).toContainText('Rejected: We moved everything to Metabase.')
    await rejected.getByRole('button', { name: 'Remove' }).click()
    await expect(rejected).toHaveCount(0)
    const waiting = page.getByRole('article').filter({ hasText: 'Brand kit' })
    await waiting.getByRole('button', { name: 'Withdraw' }).click()
    await expect(waiting).toHaveCount(0)
  })
})
