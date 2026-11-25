import { expect, test, type Locator, type Page } from '@playwright/test'
import { goto, openScreen } from './helpers'

// Folders inside a group, and inside each other: Data's Documentation. Pipelines holds
// Warehouse (2 files) and Transform (1) and a file of its own; Metrics holds Finance; Archive is
// empty; Glossary is at the top of the group. Folders are open unless someone closed them.

const docs = (page: Page) => page.getByRole('region', { name: 'Documentation' })
const folder = (page: Page, name: string) => docs(page).getByRole('button', { name: new RegExp(`^${name}\\b`) })
const inside = (page: Page, name: string) => docs(page).getByRole('group', { name })
/** The folders of the card, as they are listed (each followed by those inside it). A folder is named with what it holds ("Pipelines 4 links"). */
const folderNames = async (page: Page) => (await docs(page).getByRole('button', { name: /\d+ links?$/ }).allTextContents()).map((text) => text.replace(/\d+ links?$/, '').trim())

async function folderMenu(page: Page, name: string, item: string) {
  await folder(page, name).hover()
  await docs(page).getByRole('button', { name: `More for ${name}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** A tall window: more of the card in view at once. */
const TALL = { width: 1280, height: 1400 }

/** Picks a line up with the mouse and holds it over `target` (the button stays pressed). */
async function dragTo(page: Page, line: Locator, target: Locator) {
  // As a person would: scrolled to it first (a card scrolls once its list is long).
  await line.scrollIntoViewIfNeeded()
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

  test('folders come first, A to Z, open, each with how many links it holds', async ({ page }) => {
    expect(await folderNames(page)).toEqual(['Archive', 'Metrics', 'Finance', 'Onboarding', 'Pipelines', 'Transform', 'Warehouse', 'Runbooks'])
    await expect(folder(page, 'Pipelines')).toContainText('4')
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'true')
    await expect(inside(page, 'Warehouse').getByRole('link', { name: 'Warehouse schema' })).toBeVisible()
    await expect(docs(page).getByRole('link', { name: 'Glossary' })).toBeVisible()
  })

  test('closing a folder folds what is in it away, and it stays closed when the page is opened again', async ({ page }) => {
    await folder(page, 'Pipelines').click()
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'false')
    await expect(inside(page, 'Pipelines')).toHaveCount(0)
    await page.reload()
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'false')
    await expect(docs(page).getByRole('link', { name: 'Pipeline overview' })).toHaveCount(0)
    await folder(page, 'Pipelines').click()
    await expect(inside(page, 'Pipelines').getByRole('link', { name: 'Pipeline overview' })).toBeVisible()
  })

  test('an empty folder shows for an admin, and says it is empty', async ({ page }) => {
    await expect(inside(page, 'Archive').getByText('Empty folder')).toBeVisible()
  })

  test('a new folder from the group’s menu takes its place by name', async ({ page }) => {
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await page.getByRole('menuitem', { name: 'New folder…' }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await dialog.getByLabel('Name').fill('Contracts')
    await dialog.getByRole('button', { name: 'Create folder' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await folderNames(page)).toEqual(['Archive', 'Contracts', 'Metrics', 'Finance', 'Onboarding', 'Pipelines', 'Transform', 'Warehouse', 'Runbooks'])
    // A new folder is open, like the rest.
    await expect(folder(page, 'Contracts')).toHaveAttribute('aria-expanded', 'true')
  })

  test('saving a new folder never says its own name is taken', async ({ page }) => {
    // The folders are loaded again before the dialog closes: the new one must not count against itself.
    await page.evaluate(() => {
      const seen = { taken: false }
      ;(window as unknown as { seen: typeof seen }).seen = seen
      new MutationObserver(() => {
        if (document.body.textContent?.includes('already has a folder called')) seen.taken = true
      }).observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await page.getByRole('menuitem', { name: 'New folder…' }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await dialog.getByLabel('Name').fill('Contracts')
    await dialog.getByRole('button', { name: 'Create folder' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(folder(page, 'Contracts')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { seen: { taken: boolean } }).seen.taken)).toBe(false)
  })

  test('a folder inside a folder, from that folder’s menu', async ({ page }) => {
    await folderMenu(page, 'Runbooks', 'New folder inside…')
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await expect(dialog.getByText('In Runbooks')).toBeVisible()
    await dialog.getByLabel('Name').fill('On call')
    await dialog.getByRole('button', { name: 'Create folder' }).click()
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
    await expect(inside(page, 'Onboarding').getByRole('link', { name: 'Glossary' })).toBeVisible()
    await expect(glossary).toHaveCount(1)
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
    await page.setViewportSize(TALL)
    await dragTo(page, docs(page).getByRole('link', { name: 'Glossary' }), folder(page, 'Runbooks'))
    await page.mouse.up()
    await expect(folder(page, 'Runbooks')).toContainText('3')
    await expect(inside(page, 'Runbooks').getByRole('link', { name: 'Glossary' })).toBeVisible()
  })

  test('held over a closed folder, it opens, to drop further in', async ({ page }) => {
    await page.setViewportSize(TALL)
    await folder(page, 'Pipelines').click()
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'false')
    await dragTo(page, docs(page).getByRole('link', { name: 'Glossary' }), folder(page, 'Pipelines'))
    await expect(folder(page, 'Pipelines')).toHaveAttribute('aria-expanded', 'true')
    await dragOn(page, folder(page, 'Warehouse'))
    await page.mouse.up()
    await expect(folder(page, 'Warehouse')).toContainText('3')
  })

  test('a link dropped on the card’s header goes to the top of the group', async ({ page }) => {
    await page.setViewportSize(TALL)
    await dragTo(page, inside(page, 'Runbooks').getByRole('link', { name: 'Backfill runbook' }), docs(page).getByRole('heading', { name: 'Documentation' }))
    await page.mouse.up()
    await expect(folder(page, 'Runbooks')).toContainText('1')
    await expect(docs(page).getByRole('link', { name: 'Backfill runbook' })).toBeVisible()
  })

  test('a card says it has more below while its open folders run past its end, and stops when they close', async ({ page }) => {
    // A short window: the card stops growing at a part of it, and its list scrolls.
    await page.setViewportSize({ width: 1280, height: 560 })
    const more = docs(page).getByRole('button', { name: /^Scroll down: \d+ more in Documentation$/ })
    await expect(more).toBeVisible()
    // The card's size stops changing once it is full: what changes is its list.
    for (const name of ['Metrics', 'Onboarding', 'Pipelines', 'Runbooks']) await folder(page, name).click()
    await expect(more).toHaveCount(0)
    for (const name of ['Metrics', 'Onboarding', 'Pipelines', 'Runbooks']) await folder(page, name).click()
    await expect(more).toBeVisible()
  })

  test('while a card’s list scrolls, the lines of the folders scrolled through stay at its top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 })
    // Down to Pipelines' files: Archive, Metrics and Onboarding have gone by.
    await inside(page, 'Warehouse').getByRole('link', { name: 'Naming rules' }).scrollIntoViewIfNeeded()
    await docs(page).getByRole('link', { name: 'Naming rules' }).hover()
    await page.mouse.wheel(0, 120)
    await expect(folder(page, 'Archive')).not.toBeInViewport()
    // Pipelines sits right under the card's header, Warehouse right under Pipelines.
    const below = async (upper: Locator, lower: Locator) => (await lower.boundingBox())!.y - ((await upper.boundingBox())!.y + (await upper.boundingBox())!.height)
    await expect.poll(() => below(docs(page).getByRole('heading', { name: 'Documentation' }), folder(page, 'Pipelines'))).toBeLessThan(30)
    await expect.poll(() => below(folder(page, 'Pipelines'), folder(page, 'Warehouse'))).toBeLessThan(16)
  })

  test('a card resized by hand keeps its height when its folders open and close, until Auto height', async ({ page }) => {
    await expect(inside(page, 'Pipelines').getByRole('link', { name: 'Pipeline overview' })).toBeVisible()
    // One step shorter than it is: a height of its own.
    const before = (await docs(page).boundingBox())!.height
    await page.getByRole('separator', { name: 'Height of Documentation' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect.poll(async () => (await docs(page).boundingBox())!.height).toBeLessThan(before)
    const resized = (await docs(page).boundingBox())!.height
    await folder(page, 'Pipelines').click()
    await expect(inside(page, 'Pipelines')).toHaveCount(0)
    expect((await docs(page).boundingBox())!.height).toBe(resized)
    // Back to as tall as what is open in it: shorter, with Pipelines closed.
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await page.getByRole('menuitem', { name: 'Auto height' }).click()
    await expect.poll(async () => (await docs(page).boundingBox())!.height).toBeLessThan(resized)
  })

  test('a space’s default height is only a limit: with a folder closed, the card is shorter', async ({ page }) => {
    await page.getByRole('button', { name: /^Space layout/ }).click()
    await page.getByRole('menuitem', { name: 'Edit default layout…' }).click()
    const before = (await docs(page).boundingBox())!.height
    await page.getByRole('separator', { name: 'Height of Documentation' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect.poll(async () => (await docs(page).boundingBox())!.height).toBeLessThan(before)
    await page.getByRole('button', { name: 'Save for everyone' }).click()
    await expect(page.getByRole('region', { name: 'Space layout editor' })).toHaveCount(0)
    const withDefault = (await docs(page).boundingBox())!.height
    await folder(page, 'Pipelines').click()
    await expect.poll(async () => (await docs(page).boundingBox())!.height).toBeLessThan(withDefault)
    // Nothing of their own to undo.
    await docs(page).getByRole('button', { name: 'More for Documentation' }).click()
    await expect(page.getByRole('menuitem', { name: 'Auto height' })).toHaveCount(0)
  })

  test('a folder’s links can be sorted A to Z while editing the space’s layout, and only that folder’s', async ({ page }) => {
    await page.getByRole('button', { name: /^Space layout/ }).click()
    await page.getByRole('menuitem', { name: 'Edit default layout…' }).click()
    await expect(page.getByRole('region', { name: 'Space layout editor' })).toBeVisible()
    // Onboarding has First week before Access requests.
    await expect(inside(page, 'Onboarding').getByRole('link')).toHaveText([/^First week/, /^Access requests/])
    await folderMenu(page, 'Onboarding', 'Sort links A to Z')
    await expect(inside(page, 'Onboarding').getByRole('link')).toHaveText([/^Access requests/, /^First week/])
    // Only that folder: Runbooks keeps its order.
    await expect(inside(page, 'Runbooks').getByRole('link')).toHaveText([/^Backfill runbook/, /^Incident runbook/])
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

  test('sorting a folder A to Z on the board is for themselves only', async ({ page }) => {
    // Onboarding has First week before Access requests.
    await folder(page, 'Onboarding').hover()
    await docs(page).getByRole('button', { name: 'More for Onboarding' }).click()
    await page.getByRole('menuitem', { name: 'Sort links A to Z' }).click()
    await expect(inside(page, 'Onboarding').getByRole('link')).toHaveText([/^Access requests/, /^First week/])
    await expect(page.getByRole('button', { name: /^Space layout/ })).toHaveAccessibleName('Space layout: changed by you')
  })

  test('empty folders don’t show', async ({ page }) => {
    await expect(folder(page, 'Archive')).toHaveCount(0)
    await expect(folder(page, 'Pipelines')).toBeVisible()
  })

  test('a folder’s menu only offers to suggest into it (and to sort it for themselves), and the suggestion says which folder', async ({ page, context }) => {
    await context.route('https://handbook.example.com/**', (route) => route.fulfill({ body: 'Handbook' }))
    await folder(page, 'Runbooks').hover()
    await docs(page).getByRole('button', { name: 'More for Runbooks' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Suggest for this folder…', 'Sort links A to Z'])
    await page.getByRole('menuitem', { name: 'Suggest for this folder…' }).click()
    const dialog = page.getByRole('dialog', { name: /Suggest a link/ })
    await dialog.getByLabel('Name').fill('On call handbook')
    await dialog.getByLabel('Address').fill('https://handbook.example.com')
    await dialog.getByRole('button', { name: 'Send for review' }).click()
    await expect(page.getByText(/Sent for review/)).toBeVisible()
    await goto(page, '/acme/requests')
    await expect(page.getByRole('article').filter({ hasText: 'On call handbook' })).toContainText('Documentation / Runbooks')
  })
})
