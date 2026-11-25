import { expect, test, type Locator, type Page } from '@playwright/test'
import { openScreen } from './helpers'

// Folders inside a group, and inside each other: Data's Documentation. Pipelines holds
// Warehouse (2 files) and Transform (1) and a file of its own; Metrics holds Finance; Archive is
// empty; Glossary is at the top of the group.

const docs = (page: Page) => page.getByRole('region', { name: 'Documentation' })
const folder = (page: Page, name: string) => docs(page).getByRole('button', { name: new RegExp(`^${name}\\b`) })
const inside = (page: Page, name: string) => docs(page).getByRole('group', { name })
/** The closed folders at the top of the card, as they are listed. A folder is named with what it holds ("Pipelines 4 links"). */
const folderNames = async (page: Page) =>
  (await docs(page).getByRole('button', { expanded: false, name: /\d+ links?$/ }).allTextContents()).map((text) => text.replace(/\d+ links?$/, '').trim())

async function folderMenu(page: Page, name: string, item: string) {
  await folder(page, name).hover()
  await docs(page).getByRole('button', { name: `More for ${name}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** Picks a line up with the mouse and holds it over `target` (the button stays pressed). */
async function dragTo(page: Page, line: Locator, target: Locator) {
  const from = (await line.boundingBox())!
  await page.mouse.move(from.x + 40, from.y + from.height / 2)
  await page.mouse.down()
  // Past the few pixels that start a drag, then to the target.
  await page.mouse.move(from.x + 40, from.y + from.height / 2 + 12, { steps: 4 })
  await dragOn(page, target)
}

/** Moves what is held over `target`. */
async function dragOn(page: Page, target: Locator) {
  const to = (await target.boundingBox())!
  await page.mouse.move(to.x + 40, to.y + to.height / 2, { steps: 12 })
}

test.describe('as an admin of the space', () => {
  test.beforeEach(async ({ page }) => {
    await openScreen(page, 'board-folders')
    await expect(docs(page)).toBeVisible()
  })

  test('folders come first, A to Z, closed, each with how many links it holds', async ({ page }) => {
    expect(await folderNames(page)).toEqual(['Archive', 'Metrics', 'Onboarding', 'Pipelines', 'Runbooks'])
    await expect(folder(page, 'Pipelines')).toContainText('4')
    await expect(docs(page).getByRole('link', { name: 'Warehouse schema' })).toHaveCount(0)
    await expect(docs(page).getByRole('link', { name: 'Glossary' })).toBeVisible()
  })

  test('opening a folder shows what is in it, and it stays open when the page is opened again', async ({ page }) => {
    await folder(page, 'Pipelines').click()
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'true')
    await expect(inside(page, 'Pipelines').getByRole('link', { name: 'Pipeline overview' })).toBeVisible()
    await folder(page, 'Warehouse').click()
    await expect(inside(page, 'Warehouse').getByRole('link', { name: 'Warehouse schema' })).toBeVisible()
    await page.reload()
    await expect(inside(page, 'Warehouse').getByRole('link', { name: 'Naming rules' })).toBeVisible()
  })

  test('an empty folder shows for an admin, and says it is empty', async ({ page }) => {
    await folder(page, 'Archive').click()
    await expect(inside(page, 'Archive').getByText('Empty folder')).toBeVisible()
  })

  test('a new folder from the group’s menu takes its place by name', async ({ page }) => {
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await page.getByRole('menuitem', { name: 'New folder…' }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await dialog.getByLabel('Name').fill('Contracts')
    await dialog.getByRole('button', { name: 'Create folder' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await folderNames(page)).toEqual(['Archive', 'Contracts', 'Metrics', 'Onboarding', 'Pipelines', 'Runbooks'])
  })

  test('a folder inside a folder, from that folder’s menu', async ({ page }) => {
    await folderMenu(page, 'Runbooks', 'New folder inside…')
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await expect(dialog.getByText('In Runbooks')).toBeVisible()
    await dialog.getByLabel('Name').fill('On call')
    await dialog.getByRole('button', { name: 'Create folder' }).click()
    await folder(page, 'Runbooks').click()
    await expect(inside(page, 'Runbooks').getByRole('button', { name: /^On call\b/ })).toBeVisible()
  })

  test('a name already used beside it is refused, with the reason', async ({ page }) => {
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await page.getByRole('menuitem', { name: 'New folder…' }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await dialog.getByLabel('Name').fill('metrics')
    await expect(dialog.getByText('Documentation already has a folder called metrics.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Create folder' }).click()
    await expect(dialog).toBeVisible()
  })

  test('renaming a folder', async ({ page }) => {
    await folderMenu(page, 'Onboarding', 'Rename…')
    const dialog = page.getByRole('dialog', { name: 'Rename folder' })
    await dialog.getByLabel('Name').fill('New joiners')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(folder(page, 'New joiners')).toBeVisible()
    await expect(folder(page, 'Onboarding')).toHaveCount(0)
  })

  test('adding to a folder from its menu puts the link in it', async ({ page, context }) => {
    await context.route('https://handbook.example.com/**', (route) => route.fulfill({ body: 'Handbook' }))
    await folderMenu(page, 'Runbooks', 'Add to this folder…')
    const dialog = page.getByRole('dialog', { name: /Add a link/ })
    await expect(dialog.getByLabel('Folder')).toHaveValue('Runbooks')
    await dialog.getByLabel('Name').fill('On call handbook')
    await dialog.getByLabel('Address').fill('https://handbook.example.com')
    await dialog.getByRole('button', { name: 'Add to Data' }).click()
    await folder(page, 'Runbooks').click()
    await expect(inside(page, 'Runbooks').getByRole('link', { name: 'On call handbook' })).toBeVisible()
  })

  test('the form lists the group’s folders as a tree, finds one by its path, and shows the path once chosen', async ({ page }) => {
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await page.getByRole('menuitem', { name: 'Add to this group…' }).click()
    const field = page.getByRole('dialog').getByLabel('Folder')
    await expect(field).toHaveValue('Top of Documentation')
    await field.click()
    await expect(page.getByRole('option')).toHaveText(['Top of Documentation', 'Archive', 'Metrics', 'Finance', 'Onboarding', 'Pipelines', 'Transform', 'Warehouse', 'Runbooks'])
    await field.fill('ware')
    await expect(page.getByRole('option')).toHaveText(['Warehouse'])
    await page.getByRole('option', { name: 'Warehouse' }).click()
    await expect(field).toHaveValue('Pipelines / Warehouse')
  })

  test('a group without folders doesn’t ask for one', async ({ page }) => {
    await page.getByRole('region', { name: 'Dashboards' }).getByRole('button', { name: 'More for Dashboards' }).click()
    await page.getByRole('menuitem', { name: 'Add to this group…' }).click()
    await expect(page.getByRole('dialog').getByLabel('Folder')).toHaveCount(0)
  })

  test('a link’s menu moves it to another folder', async ({ page }) => {
    const glossary = docs(page).getByRole('link', { name: 'Glossary' })
    await glossary.hover()
    await docs(page).getByRole('button', { name: 'More for Glossary' }).click()
    await page.getByRole('menuitem', { name: 'Move to folder…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Move Glossary' })
    await dialog.getByLabel('Move to').click()
    await page.getByRole('option', { name: 'Onboarding' }).click()
    await dialog.getByRole('button', { name: 'Move' }).click()
    await expect(page.getByText('Moved Glossary to Onboarding.')).toBeVisible()
    await expect(glossary).toHaveCount(0)
    await folder(page, 'Onboarding').click()
    await expect(inside(page, 'Onboarding').getByRole('link', { name: 'Glossary' })).toBeVisible()
  })

  test('a folder moves with everything in it, and never into itself', async ({ page }) => {
    await folderMenu(page, 'Pipelines', 'Move to…')
    const dialog = page.getByRole('dialog', { name: 'Move Pipelines' })
    await dialog.getByLabel('Move to').click()
    // Not into itself, nor into what is inside it.
    await expect(page.getByRole('option')).toHaveText(['Top of Documentation', 'Archive', 'Metrics', 'Finance', 'Onboarding', 'Runbooks'])
    await page.getByRole('option', { name: 'Metrics' }).click()
    await dialog.getByRole('button', { name: 'Move' }).click()
    await expect(folder(page, 'Pipelines')).toHaveCount(0)
    await expect(folder(page, 'Metrics')).toContainText('6')
    await folder(page, 'Metrics').click()
    await expect(inside(page, 'Metrics').getByRole('button', { name: /^Pipelines\b/ })).toBeVisible()
  })

  test('deleting a folder asks first, and what was in it moves up a level', async ({ page }) => {
    await folderMenu(page, 'Pipelines', 'Delete folder…')
    const dialog = page.getByRole('dialog', { name: 'Delete Pipelines?' })
    await expect(dialog).toContainText('Only the folder goes. What is in it (4 links and 2 folders) moves to the top of Documentation.')
    await dialog.getByRole('button', { name: 'Delete folder' }).click()
    await expect(folder(page, 'Pipelines')).toHaveCount(0)
    await expect(folder(page, 'Warehouse')).toBeVisible()
    await expect(folder(page, 'Transform')).toBeVisible()
    await expect(docs(page).getByRole('link', { name: 'Pipeline overview' })).toBeVisible()
  })

  test('a link dropped on a folder goes into it', async ({ page }) => {
    await dragTo(page, docs(page).getByRole('link', { name: 'Glossary' }), folder(page, 'Runbooks'))
    await page.mouse.up()
    await expect(folder(page, 'Runbooks')).toContainText('3')
    await expect(docs(page).getByRole('link', { name: 'Glossary' })).toHaveCount(0)
  })

  test('held over a closed folder, it opens, to drop further in', async ({ page }) => {
    await dragTo(page, docs(page).getByRole('link', { name: 'Glossary' }), folder(page, 'Pipelines'))
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'true')
    await dragOn(page, folder(page, 'Warehouse'))
    await page.mouse.up()
    await expect(folder(page, 'Warehouse')).toContainText('3')
  })

  test('a link dropped on the card’s header goes to the top of the group', async ({ page }) => {
    await folder(page, 'Runbooks').click()
    await dragTo(page, inside(page, 'Runbooks').getByRole('link', { name: 'Backfill runbook' }), docs(page).getByRole('heading', { name: 'Documentation' }))
    await page.mouse.up()
    await expect(folder(page, 'Runbooks')).toContainText('1')
    await expect(docs(page).getByRole('link', { name: 'Backfill runbook' })).toBeVisible()
  })

  test('search finds a link in a folder, and shows where it is', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Search links' }).fill('naming')
    await expect(page.getByRole('option', { name: /Naming rules/ })).toContainText('Documentation / Pipelines / Warehouse')
  })
})

test.describe('as a member', () => {
  test.beforeEach(async ({ page }) => {
    await openScreen(page, 'board-folders-member')
    await expect(docs(page)).toBeVisible()
  })

  test('dragging a link onto another folder doesn’t move it', async ({ page }) => {
    await dragTo(page, docs(page).getByRole('link', { name: 'Glossary' }), folder(page, 'Runbooks'))
    await page.mouse.up()
    await expect(folder(page, 'Runbooks')).toContainText('2')
    await expect(docs(page).getByRole('link', { name: 'Glossary' })).toBeVisible()
  })

  test('empty folders don’t show', async ({ page }) => {
    await expect(folder(page, 'Archive')).toHaveCount(0)
    await expect(folder(page, 'Pipelines')).toBeVisible()
  })

  test('a folder’s menu only offers to suggest into it, and the suggestion says which folder', async ({ page, context }) => {
    await context.route('https://handbook.example.com/**', (route) => route.fulfill({ body: 'Handbook' }))
    await folder(page, 'Runbooks').hover()
    await docs(page).getByRole('button', { name: 'More for Runbooks' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Suggest for this folder…'])
    await page.getByRole('menuitem', { name: 'Suggest for this folder…' }).click()
    const dialog = page.getByRole('dialog', { name: /Suggest a link/ })
    await dialog.getByLabel('Name').fill('On call handbook')
    await dialog.getByLabel('Address').fill('https://handbook.example.com')
    await dialog.getByRole('button', { name: 'Send for review' }).click()
    await expect(page.getByText(/Sent for review/)).toBeVisible()
    await page.goto('/acme/requests')
    await expect(page.getByRole('article').filter({ hasText: 'On call handbook' })).toContainText('Documentation / Runbooks')
  })
})
