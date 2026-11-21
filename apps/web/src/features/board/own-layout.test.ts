// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arrangementOf, hasOwnArrangement, withoutOwnArrangement } from './own-layout.ts'

const NONE = { group_order: [], group_layout: {}, link_order: {}, hidden_groups: [], hidden_links: [], recent_links: {}, card_sizes: {} }
const DEV = ['g1', 'g2']

test('someone who changed nothing has no arrangement of their own', () => {
  assert.equal(hasOwnArrangement(NONE, 'dev', DEV), false)
  // Hiding is not arranging, and neither are empty leftovers.
  assert.equal(hasOwnArrangement({ ...NONE, hidden_groups: ['g1'], group_layout: { dev: [] }, card_sizes: { dev: { heights: {} } }, link_order: { g1: [] } }, 'dev', DEV), false)
})

test('columns, a size, or the links of one group count, for this space only', () => {
  assert.equal(hasOwnArrangement({ ...NONE, group_layout: { dev: [['g2'], ['g1']] } }, 'dev', DEV), true)
  assert.equal(hasOwnArrangement({ ...NONE, card_sizes: { dev: { heights: { g1: 200 } } } }, 'dev', DEV), true)
  assert.equal(hasOwnArrangement({ ...NONE, card_sizes: { dev: { widths: [1, 2] } } }, 'dev', DEV), true)
  assert.equal(hasOwnArrangement({ ...NONE, link_order: { g2: ['b', 'a'] } }, 'dev', DEV), true)
  assert.equal(hasOwnArrangement({ ...NONE, group_order: ['g2', 'g1'] }, 'dev', DEV), true)

  const design = { ...NONE, group_layout: { design: [['x']] }, card_sizes: { design: { widths: [1, 2] } }, link_order: { x: ['b', 'a'] }, group_order: ['x'] }
  assert.equal(hasOwnArrangement(design, 'dev', DEV), false)
})

test('resetting a space leaves the other spaces, and what was hidden, as they were', () => {
  const prefs = {
    ...NONE,
    hidden_links: ['l1'],
    group_order: ['x', 'g1'],
    group_layout: { dev: [['g2'], ['g1']], design: [['x']] },
    link_order: { g1: ['b', 'a'], x: ['d', 'c'] },
    card_sizes: { dev: { heights: { g1: 200 } }, design: { widths: [1, 2] } },
  }
  const reset = { ...prefs, ...withoutOwnArrangement(prefs, 'dev', DEV) }
  assert.equal(hasOwnArrangement(reset, 'dev', DEV), false)
  assert.equal(hasOwnArrangement(reset, 'design', ['x']), true)
  assert.deepEqual(reset.group_layout, { design: [['x']] })
  assert.deepEqual(reset.link_order, { x: ['d', 'c'] })
  assert.deepEqual(reset.group_order, ['x'])
  assert.deepEqual(reset.hidden_links, ['l1'])
  // Undoing puts back exactly what was there.
  assert.deepEqual({ ...reset, ...arrangementOf(prefs) }, prefs)
})
