// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arrangeColumns, mergeLayout, moveCard } from './board-layout.ts'

const cards = (spec: Record<string, number>) => Object.entries(spec).map(([id, height]) => ({ id, height }))

test('a layout for this many columns is shown exactly, even when unbalanced', () => {
  const layout = [['a', 'b', 'c'], [], ['d']]
  assert.deepEqual(arrangeColumns(cards({ a: 100, b: 100, c: 100, d: 50 }), layout, 3, 10), layout)
})

test('new cards go to the end of the shortest column', () => {
  assert.deepEqual(arrangeColumns(cards({ a: 300, b: 100, c: 50 }), [['a'], ['b']], 2, 10), [['a'], ['b', 'c']])
})

test('no layout: cards fill the shortest columns in order', () => {
  assert.deepEqual(arrangeColumns(cards({ a: 300, b: 100, c: 50, d: 50 }), [], 2, 10), [['a'], ['b', 'c', 'd']])
})

test('fewer columns: cards keep their reading order, by how far down they start', () => {
  const layout = [['a', 'c'], ['b', 'd']]
  assert.deepEqual(arrangeColumns(cards({ a: 100, b: 100, c: 100, d: 100 }), layout, 1, 10), [['a', 'b', 'c', 'd']])
})

test('more columns: the extra ones start empty, and take new cards', () => {
  assert.deepEqual(arrangeColumns(cards({ a: 100, b: 100, c: 100 }), [['a'], ['b']], 3, 10), [['a'], ['b'], ['c']])
})

test('cards that are gone are left out', () => {
  assert.deepEqual(arrangeColumns(cards({ a: 100 }), [['a', 'x'], ['y']], 2, 10), [['a'], []])
})

test('moving a card to another column, before another or at the end', () => {
  assert.deepEqual(moveCard([['a', 'b'], ['c']], 'b', 1, 'c'), [['a'], ['b', 'c']])
  assert.deepEqual(moveCard([['a', 'b'], ['c']], 'a', 1, null), [['b'], ['c', 'a']])
  assert.deepEqual(moveCard([['a', 'b'], []], 'a', 1, null), [['b'], ['a']])
})

test('hidden cards keep their column and place when the rest is rearranged', () => {
  assert.deepEqual(mergeLayout([['a', 'h', 'b'], ['c']], [['b', 'a'], ['c']]), [['b', 'h', 'a'], ['c']])
})
