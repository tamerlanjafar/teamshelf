// node --test netlify/lib/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { serving } from './file-serving.mjs'

test('every file is saved to disk unless a frame is asked for', () => {
  for (const name of ['plan.pdf', 'page.html', 'drawing.svg', 'notes.txt', 'archive.zip', '', null, undefined]) {
    for (const purpose of ['download', 'show', null, undefined, '', 'inline', 'pdf', 'FRAME', 'frame ']) assert.equal(serving(name, purpose), 'save', `${name} for ${purpose}`)
  }
})

test('a frame is given to a PDF, by its name', () => {
  for (const name of ['plan.pdf', 'Plan.FINAL.PDF', 'q3 report (2).pdf', 'page.html.pdf', 'plan.pdf ']) assert.equal(serving(name, 'frame'), 'pdf', name)
})

test('a frame is refused to anything that could run as a page, whatever it is called', () => {
  const names = ['page.html', 'page.htm', 'drawing.svg', 'page.xhtml', 'feed.xml', 'script.js', 'plan.pdf.html', 'plan.pdf.svg', 'plan.pdf/', 'plan.pdf?x.html', 'plan.pdf#.html', 'pdf', '.pdfx', 'plan.pd', 'plan', '', null, undefined, 42, {}]
  for (const name of names) assert.equal(serving(name, 'frame'), 'refused', String(name))
})
