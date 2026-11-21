// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { needsPlainText } from './markdown-safety.ts'

test('ordinary documents open in the editor', () => {
  for (const markdown of [
    '# Title\n\nSome **bold** and *italic* text, a [link](https://example.com).',
    '- [x] done\n- [ ] not yet\n\n1. one\n2. two',
    '> a quote\n\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
    'Compare 1 < 2 and 3 > 2, or a <- b.',
    '',
  ]) {
    assert.equal(needsPlainText(markdown), false, markdown)
  }
})

test('HTML written as code is code, not HTML', () => {
  assert.equal(needsPlainText('Use `<script>` sparingly.'), false)
  assert.equal(needsPlainText('```html\n<script>alert(1)</script>\n```'), false)
  assert.equal(needsPlainText('    <div>indented code</div>'), false)
})

test('a document with any HTML in it is plain text', () => {
  for (const markdown of [
    '<script>alert(1)</script>',
    'Hello <b>there</b>',
    'An image: <img src=x onerror=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '- item with <a href="javascript:alert(1)">a tag</a>',
    '> quoted <span onclick="x()">tag</span>',
    '| A |\n| --- |\n| <u>cell</u> |',
    '# Heading <em>tag</em>',
    '<!-- a comment -->',
    'text\n\n<details><summary>More</summary>hidden</details>',
    '**bold <svg onload=alert(1)>**',
  ]) {
    assert.equal(needsPlainText(markdown), true, markdown)
  }
})
