// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { documentFileName, extensionOf, fileNameFromTitle, isEditable, MAX_TEXT_BYTES, previewKind, safeHref, shownType } from './file-kind.ts'

const file = (file_name: string, file_size = 1000) => ({ file_name, file_size })

test('a file is shown by the ending of its name', () => {
  assert.equal(previewKind(file('Diagram.PNG')), 'image')
  assert.equal(previewKind(file('plan.final.pdf')), 'pdf')
  assert.equal(previewKind(file('standup.mp3')), 'audio')
  assert.equal(previewKind(file('demo.mp4')), 'video')
  assert.equal(previewKind(file('README.md')), 'markdown')
  assert.equal(previewKind(file('notes.txt')), 'text')
  assert.equal(previewKind(file('config.yaml')), 'text')
  assert.equal(previewKind(file('budget.xlsx')), 'none')
  assert.equal(previewKind(file('archive')), 'none')
  assert.equal(extensionOf('a.b.TAR'), 'tar')
})

test('a page or a drawing made of markup is only ever its source', () => {
  for (const name of ['page.html', 'page.htm', 'logo.svg', 'script.js', 'feed.xml']) {
    assert.equal(previewKind(file(name)), 'text', name)
    assert.equal(shownType(name), 'application/octet-stream', name)
  }
})

test('nothing is handed to the browser as a type that can run a script', () => {
  for (const name of ['a.png', 'a.jpg', 'a.gif', 'a.webp', 'a.pdf', 'a.mp3', 'a.mp4', 'a.md', 'a.html', 'a.svg', 'a.xhtml', 'a.exe', 'a']) {
    assert.doesNotMatch(shownType(name), /html|svg|xml|javascript|ecmascript/, name)
  }
})

test('text that is too long to read into the page is downloaded instead', () => {
  assert.equal(previewKind(file('big.log', MAX_TEXT_BYTES + 1)), 'none')
  assert.equal(previewKind(file('big.md', MAX_TEXT_BYTES + 1)), 'none')
  assert.equal(previewKind(file('big.png', 20_000_000)), 'image')
})

test('text and Markdown can be edited, nothing else', () => {
  assert.equal(isEditable('text'), true)
  assert.equal(isEditable('markdown'), true)
  for (const kind of ['image', 'pdf', 'audio', 'video', 'none'] as const) assert.equal(isEditable(kind), false)
})

test('a document gets a plain file name', () => {
  assert.equal(fileNameFromTitle('Release plan (Q3)'), 'release-plan-q3')
  assert.equal(fileNameFromTitle('???'), '')
  assert.equal(documentFileName('release-plan-q3'), 'release-plan-q3.md')
  assert.equal(documentFileName('On-call Notes 2026', 'txt'), 'On-call Notes 2026.txt')
  // An ending typed by hand doesn't decide: the format does.
  assert.equal(documentFileName('notes.txt', 'md'), 'notes.md')
  assert.equal(documentFileName('  ../../etc/passwd  '), 'etc-passwd.md')
  assert.equal(documentFileName('a<script>b'), 'a-script-b.md')
  assert.equal(documentFileName(''), 'document.md')
})

test('a link in a document points to the web or to mail, nothing else', () => {
  assert.equal(safeHref('https://example.com/a?b=1'), 'https://example.com/a?b=1')
  assert.equal(safeHref('mailto:sam@example.com'), 'mailto:sam@example.com')
  for (const address of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd', 'blob:https://teamshelf.app/x', '/relative', '']) {
    assert.equal(safeHref(address), null, address)
  }
})
