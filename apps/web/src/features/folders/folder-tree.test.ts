import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Folder } from '../../lib/types.ts'
import { childrenOf, descendantsOf, moveTargets, pathLabel, roomInside, treeOrder } from './folder-tree.ts'

const folder = (id: string, parent_id: string | null, name = id): Folder => ({ id, parent_id, name, org_id: 'o', space_id: 's', group_id: 'g', created_at: '' })

// Pipelines / Warehouse / Tables, Pipelines / Transform, and Metrics at the top.
const FOLDERS = [folder('pipelines', null, 'Pipelines'), folder('warehouse', 'pipelines', 'Warehouse'), folder('tables', 'warehouse', 'Tables'), folder('transform', 'pipelines', 'Transform'), folder('metrics', null, 'Metrics')]

test('a folder reads as its path from the top of the group', () => {
  assert.equal(pathLabel('tables', FOLDERS), 'Pipelines / Warehouse / Tables')
  assert.equal(pathLabel(null, FOLDERS), '')
})

test('a broken chain of parents ends the path instead of looping', () => {
  const looped = [folder('a', 'b'), folder('b', 'a')]
  assert.ok(pathLabel('a', looped).length > 0)
})

test('folders side by side are listed by name', () => {
  assert.deepEqual(
    childrenOf(null, FOLDERS).map((one) => one.name),
    ['Metrics', 'Pipelines'],
  )
})

test('the tree is read top down, each folder followed by what is inside it', () => {
  assert.deepEqual(
    treeOrder(FOLDERS).map((choice) => `${choice.depth} ${choice.path}`),
    ['1 Metrics', '1 Pipelines', '2 Pipelines / Transform', '2 Pipelines / Warehouse', '3 Pipelines / Warehouse / Tables'],
  )
})

test('everything inside a folder, at any depth', () => {
  assert.deepEqual(descendantsOf('pipelines', FOLDERS).map((one) => one.id).sort(), ['tables', 'transform', 'warehouse'])
})

test('a folder can’t move into itself or into what is inside it', () => {
  assert.deepEqual(
    moveTargets(FOLDERS[0], FOLDERS).map((choice) => choice.folder.id),
    ['metrics'],
  )
})

test('a folder can’t move so deep that what is in it goes past six levels', () => {
  // A chain six deep: l1 / l2 / … / l6.
  const chain = Array.from({ length: 6 }, (_, index) => folder(`l${index + 1}`, index === 0 ? null : `l${index}`))
  const withTwo = [...chain, folder('two', null), folder('two-inside', 'two')]
  // "two" is two levels high, so it fits inside l1 to l4 only.
  assert.deepEqual(
    moveTargets(withTwo.find((one) => one.id === 'two')!, withTwo).map((choice) => choice.folder.id),
    ['l1', 'l2', 'l3', 'l4'],
  )
  assert.equal(roomInside('l5', chain), true)
  assert.equal(roomInside('l6', chain), false)
})
