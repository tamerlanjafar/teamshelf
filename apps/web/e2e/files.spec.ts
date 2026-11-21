import { expect, test, type Page } from '@playwright/test'
import { openScreen } from './helpers'

// Files open inside the app: a document with its formatting, text as text, a picture, a PDF.
// A space's admins edit text and documents, and anyone writes a new document. Whatever a file
// holds, nothing in it runs.

/** Opens a file of the board, and returns the viewer it opens in. */
async function openFile(page: Page, name: string) {
  await page.getByRole('link', { name }).click()
  const viewer = page.getByRole('dialog', { name, exact: true })
  await expect(viewer).toBeVisible()
  return viewer
}

test.describe('opening a file', () => {
  test('a document is shown with its formatting: headings, a checklist, a table', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Deploy runbook')
    await expect(viewer.getByRole('heading', { name: 'Before you start' })).toBeVisible()
    await expect(viewer.getByRole('checkbox', { name: 'The release notes are written' })).toBeChecked()
    await expect(viewer.getByRole('cell', { name: 'Staging', exact: true })).toBeVisible()
    await expect(viewer).toContainText('runbook.md')
    // Opened for reading, and it stays that way: no toolbar, nothing to save.
    await expect(viewer.getByRole('button', { name: 'Edit' })).toBeVisible()
    await viewer.getByRole('heading', { name: 'Before you start' }).click()
    await expect(viewer.getByRole('toolbar')).toHaveCount(0)
    await expect(viewer.getByRole('button', { name: 'Save' })).toHaveCount(0)
  })

  test('a text file is shown as it is written', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'On-call notes')
    await expect(viewer).toContainText('Tue: the queue backed up around noon')
  })

  test('a picture is shown', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'System diagram')
    const picture = viewer.getByRole('img', { name: 'System diagram' })
    await expect(picture).toBeVisible()
    expect(await picture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  })

  test('a PDF is shown in a frame of its own', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Architecture')
    await expect(viewer.locator('iframe[title="Architecture"]')).toHaveAttribute('src', /^blob:/)
  })

  test('a file that can’t be shown offers its download', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Budget')
    await expect(viewer.getByRole('heading', { name: 'No preview for this file' })).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Download' }).first()).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  })

  test('Escape and the X close the viewer', async ({ page }) => {
    await openScreen(page, 'files')
    let viewer = await openFile(page, 'On-call notes')
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    viewer = await openFile(page, 'On-call notes')
    await viewer.getByRole('button', { name: 'Close' }).click()
    await expect(viewer).toHaveCount(0)
  })

  test('the menu of a file opens it, too', async ({ page }) => {
    await openScreen(page, 'files')
    await page.getByRole('button', { name: 'More for On-call notes' }).click()
    await page.getByRole('menuitem', { name: 'Open' }).click()
    await expect(page.getByRole('dialog', { name: 'On-call notes' })).toContainText('Mon: quiet.')
  })
})

test.describe('taking a file out', () => {
  test('a download is saved under the file’s own name', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Deploy runbook')
    const [download] = await Promise.all([page.waitForEvent('download'), viewer.getByRole('button', { name: 'Download' }).click()])
    expect(download.suggestedFilename()).toBe('runbook.md')
  })

  test('text is copied as it is written', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'On-call notes')
    await viewer.getByRole('button', { name: 'Copy' }).click()
    await expect(page.getByText('Text copied')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Tue: the queue backed up around noon')
  })

  test('a picture can be copied, a file that can’t be shown can’t', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openScreen(page, 'files')
    let viewer = await openFile(page, 'System diagram')
    await viewer.getByRole('button', { name: 'Copy' }).click()
    await expect(page.getByText('Picture copied')).toBeVisible()
    await viewer.getByRole('button', { name: 'Close' }).click()
    viewer = await openFile(page, 'Budget')
    await expect(viewer.getByRole('button', { name: 'Copy' })).toHaveCount(0)
  })
})

test.describe('nothing in a file runs', () => {
  const ran = (page: Page) => page.evaluate(() => (window as unknown as { __pwned?: string }).__pwned)

  test('a document with tags and a javascript: link is shown as text', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Imported notes')
    await expect(viewer).toContainText('Plain text after it all.')
    await expect(viewer).toContainText("<script>window.__pwned = 'script tag'</script>")
    await expect(viewer.locator('script, iframe, img')).toHaveCount(0)
    await expect(viewer.locator('a[href^="javascript"]')).toHaveCount(0)
    expect(await ran(page)).toBeUndefined()
  })

  test('a web page is its source, not a page', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Old landing page')
    await expect(viewer).toContainText('<h1>Old landing page</h1>')
    await expect(viewer.getByRole('heading', { name: 'Old landing page', level: 1 })).toHaveCount(0)
    await expect(viewer.locator('script, iframe')).toHaveCount(0)
    expect(await ran(page)).toBeUndefined()
  })

  test('editing such a document is editing its text', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Imported notes')
    await viewer.getByRole('button', { name: 'Edit' }).click()
    await expect(viewer.getByRole('textbox', { name: 'Imported notes' })).toHaveValue(/<script>/)
    expect(await ran(page)).toBeUndefined()
  })
})

test.describe('nothing in a document tells on its reader', () => {
  test('a picture from another site is fetched only when asked for', async ({ page, context }) => {
    let fetched = false
    await context.route('**://pictures.example.com/**', (route) => {
      fetched = true
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') })
    })
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Deploy runbook')
    await expect(viewer.getByText('Release flow · pictures.example.com')).toBeVisible()
    await expect(viewer.getByRole('img', { name: 'Release flow' })).toHaveCount(0)
    expect(fetched).toBe(false)
    await viewer.getByRole('button', { name: 'Show picture' }).click()
    await expect(viewer.getByRole('img', { name: 'Release flow' })).toBeVisible()
    expect(fetched).toBe(true)
  })

  test('a link opens in a new tab, without saying where it came from', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Deploy runbook')
    const link = viewer.getByRole('link', { name: 'https://staging.example.com' })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('rel', /noreferrer/)
  })

  test('pasting a web page into a document keeps its words, not its scripts', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Deploy runbook')
    await viewer.getByRole('button', { name: 'Edit' }).click()
    const text = viewer.getByRole('textbox', { name: 'Deploy runbook' })
    await text.click()
    await text.evaluate((node) => {
      const data = new DataTransfer()
      data.setData('text/html', `<p>Pasted words</p><script>window.__pwned = 'pasted script'</script><img src="x" onerror="window.__pwned = 'pasted onerror'"><a href="javascript:window.__pwned='pasted link'">pasted link</a><iframe src="javascript:parent.__pwned='pasted frame'"></iframe>`)
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await expect(text).toContainText('Pasted words')
    await expect(text.locator('script, iframe, [onerror], a[href^="javascript"]')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __pwned?: string }).__pwned)).toBeUndefined()
  })
})

test.describe('editing a file', () => {
  test('a member opens files, and can’t edit them', async ({ page }) => {
    await openScreen(page, 'files-member')
    const viewer = await openFile(page, 'Deploy runbook')
    await expect(viewer.getByRole('heading', { name: 'Before you start' })).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Download' })).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Edit' })).toHaveCount(0)
  })

  test('an admin edits a text file, and the change is there when it is opened again', async ({ page }) => {
    await openScreen(page, 'files')
    let viewer = await openFile(page, 'On-call notes')
    await viewer.getByRole('button', { name: 'Edit' }).click()
    const save = viewer.getByRole('button', { name: 'Save' })
    await expect(save).toBeDisabled()
    await viewer.getByRole('textbox', { name: 'On-call notes' }).fill('Wed: all clear.')
    await expect(viewer).toContainText('not saved yet')
    await save.click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await expect(viewer.getByRole('textbox')).toHaveCount(0)
    await expect(viewer).toContainText('Wed: all clear.')
    await viewer.getByRole('button', { name: 'Close' }).click()
    viewer = await openFile(page, 'On-call notes')
    await expect(viewer).toContainText('Wed: all clear.')
    await expect(viewer).not.toContainText('Mon: quiet.')
  })

  test('an admin edits a document with its formatting', async ({ page }) => {
    await openScreen(page, 'files')
    let viewer = await openFile(page, 'Deploy runbook')
    await expect(viewer.getByRole('toolbar')).toHaveCount(0)
    await viewer.getByRole('button', { name: 'Edit' }).click()
    await expect(viewer.getByRole('toolbar')).toBeVisible()
    // Nothing was changed yet, so there is nothing to save.
    await expect(viewer.getByRole('button', { name: 'Save' })).toBeDisabled()
    await viewer.getByRole('heading', { name: 'Deploy runbook', level: 1 }).click()
    await page.keyboard.press('End')
    await page.keyboard.type(' (v2)')
    await viewer.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await expect(viewer.getByRole('heading', { name: 'Deploy runbook (v2)', level: 1 })).toBeVisible()
    await viewer.getByRole('button', { name: 'Close' }).click()
    viewer = await openFile(page, 'Deploy runbook')
    await expect(viewer.getByRole('heading', { name: 'Deploy runbook (v2)', level: 1 })).toBeVisible()
    // The rest of the document came through the editor unharmed.
    await expect(viewer.getByRole('cell', { name: 'Staging', exact: true })).toBeVisible()
    await expect(viewer.getByRole('checkbox', { name: 'The release notes are written' })).toBeChecked()
    await expect(viewer.getByText('pnpm release --env production')).toBeVisible()
    await expect(viewer.getByText('Release flow · pictures.example.com')).toBeVisible()
  })

  test('a database’s address can be a link: a password is pointed out, and reading, a click copies it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'Deploy runbook')
    await viewer.getByRole('button', { name: 'Edit' }).click()
    await viewer.getByRole('heading', { name: 'Steps' }).dblclick()
    await viewer.getByRole('button', { name: 'Link' }).click()
    const address = 'postgres://app:secret@db.example.com:5432/main'
    await viewer.getByLabel('Link address').fill(address)
    await expect(viewer.getByText('This address includes a password.')).toBeVisible()
    await viewer.getByRole('button', { name: 'Add link' }).click()
    await viewer.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    await viewer.getByRole('link', { name: 'Steps' }).click()
    await expect(page.getByText('Connection string copied')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address)
    // Nothing tried to open it.
    expect(context.pages()).toHaveLength(1)
  })

  test('leaving with changes asks first', async ({ page }) => {
    await openScreen(page, 'files')
    const viewer = await openFile(page, 'On-call notes')
    await viewer.getByRole('button', { name: 'Edit' }).click()
    await viewer.getByRole('textbox', { name: 'On-call notes' }).fill('Never saved.')
    await viewer.getByRole('button', { name: 'Cancel' }).click()
    const question = page.getByRole('dialog', { name: 'Discard your changes?' })
    await expect(question).toContainText('On-call notes stays as it was.')
    await question.getByRole('button', { name: 'Discard changes' }).click()
    await expect(viewer).toContainText('Mon: quiet.')
    await expect(viewer).not.toContainText('Never saved.')
  })
})

test.describe('a new document', () => {
  async function start(page: Page) {
    await page.getByRole('button', { name: /^(Add|Suggest) link$/ }).click()
    await page.getByRole('dialog').getByText('Document', { exact: true }).click()
    const writer = page.getByRole('dialog', { name: 'New document' })
    await expect(writer.getByRole('toolbar')).toBeVisible()
    return writer
  }

  test('it needs a name, a group and something written', async ({ page }) => {
    await openScreen(page, 'files')
    const writer = await start(page)
    await writer.getByRole('button', { name: 'Add to Development' }).click()
    await expect(writer.getByText('Give the link a name.')).toBeVisible()
    await expect(writer.getByText('Choose a group, or type a name to create one.')).toBeVisible()
    await expect(writer.getByText('Write something first.')).toBeVisible()
  })

  test('an admin writes one, and it is on the board as a Markdown file', async ({ page }) => {
    await openScreen(page, 'files')
    const writer = await start(page)
    await writer.getByLabel('Name', { exact: true }).fill('Release checklist')
    await writer.getByRole('combobox', { name: 'Group' }).fill('Docs')
    await page.getByRole('option', { name: 'Docs' }).click()
    await writer.getByRole('textbox', { name: 'Document' }).click()
    await writer.getByRole('button', { name: 'Style: Text' }).click()
    await page.getByRole('menuitem', { name: 'Heading 1' }).click()
    await page.keyboard.type('Before the release')
    await page.keyboard.press('Enter')
    // Signs that format in other editors are only what was typed here.
    await page.keyboard.type('# Tell the team.')
    await writer.getByRole('button', { name: 'Add to Development' }).click()
    await expect(page.getByText('Added to Development.')).toBeVisible()
    await expect(writer).toHaveCount(0)

    const viewer = await openFile(page, 'Release checklist')
    await expect(viewer.getByRole('heading', { name: 'Before the release' })).toBeVisible()
    await expect(viewer.getByRole('heading', { name: 'Tell the team.' })).toHaveCount(0)
    await expect(viewer).toContainText('# Tell the team.')
    await expect(viewer).toContainText('release-checklist.md')
  })

  test('it can be saved as plain text instead, and opens as text', async ({ page }) => {
    await openScreen(page, 'files')
    const writer = await start(page)
    await writer.getByLabel('Name', { exact: true }).fill('Meeting notes')
    await writer.getByRole('combobox', { name: 'Group' }).fill('Docs')
    await page.getByRole('option', { name: 'Docs' }).click()
    await writer.getByRole('radio', { name: 'Plain text (.txt)' }).click()
    await expect(writer.getByRole('toolbar')).toHaveCount(0)
    // The file is named after the document, with the ending of its format.
    await expect(writer.getByLabel('File name')).toHaveValue('meeting-notes')
    await expect(writer.getByText('.txt', { exact: true })).toBeVisible()
    await writer.getByRole('textbox', { name: 'Document' }).fill('# only a line of text')
    await writer.getByRole('button', { name: 'Add to Development' }).click()
    await expect(page.getByText('Added to Development.')).toBeVisible()

    const viewer = await openFile(page, 'Meeting notes')
    await expect(viewer).toContainText('meeting-notes.txt')
    await expect(viewer).toContainText('# only a line of text')
    await expect(viewer.getByRole('heading', { name: 'only a line of text' })).toHaveCount(0)
  })

  test('the file can be given a name of its own', async ({ page }) => {
    await openScreen(page, 'files')
    const writer = await start(page)
    await writer.getByLabel('Name', { exact: true }).fill('Release logs')
    await expect(writer.getByLabel('File name')).toHaveValue('release-logs')
    await writer.getByLabel('File name').fill('logs-2026.md')
    // Named by hand, it no longer follows the document's name.
    await writer.getByLabel('Name', { exact: true }).fill('Release log')
    await expect(writer.getByLabel('File name')).toHaveValue('logs-2026.md')
    await writer.getByRole('combobox', { name: 'Group' }).fill('Docs')
    await page.getByRole('option', { name: 'Docs' }).click()
    await writer.getByRole('textbox', { name: 'Document' }).click()
    await page.keyboard.type('Nothing broke.')
    await writer.getByRole('button', { name: 'Add to Development' }).click()
    await expect(page.getByText('Added to Development.')).toBeVisible()
    const viewer = await openFile(page, 'Release log')
    await expect(viewer).toContainText('logs-2026.md')
  })

  test('a member’s document is sent for review', async ({ page }) => {
    await openScreen(page, 'files-member')
    const writer = await start(page)
    await writer.getByLabel('Name', { exact: true }).fill('Retro notes')
    await writer.getByRole('combobox', { name: 'Group' }).fill('Docs')
    await page.getByRole('option', { name: 'Docs' }).click()
    await writer.getByRole('textbox', { name: 'Document' }).click()
    await page.keyboard.type('What went well.')
    await writer.getByRole('button', { name: 'Send for review' }).click()
    await expect(page.getByText(/Sent for review/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Retro notes' })).toHaveCount(0)
  })

  test('closing with something written asks first', async ({ page }) => {
    await openScreen(page, 'files')
    const writer = await start(page)
    await writer.getByLabel('Name', { exact: true }).fill('Half an idea')
    await writer.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('dialog', { name: 'Discard this document?' }).getByRole('button', { name: 'Discard' }).click()
    await expect(writer).toHaveCount(0)
  })
})
