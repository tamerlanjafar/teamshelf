// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ago, bytes, day, share } from './format.ts'

test('sizes read in the unit that fits', () => {
  assert.equal(bytes(512), '512 B')
  assert.equal(bytes(2048), '2 KB')
  assert.equal(bytes(1.5 * 1024 ** 2), '1.5 MB')
  assert.equal(bytes(250 * 1024 ** 2), '250 MB')
  assert.equal(bytes(1024 ** 3), '1.00 GB')
})

test('a day reads as written', () => {
  assert.equal(day('2026-11-21'), '21 Nov')
  assert.equal(day('2026-01-05T23:59:00+00:00'), '5 Jan')
})

test('how long ago', () => {
  const now = new Date('2026-11-21T12:00:00Z')
  assert.equal(ago('2026-11-21T08:00:00Z', now), 'today')
  assert.equal(ago('2026-11-20T08:00:00Z', now), 'yesterday')
  assert.equal(ago('2026-11-11T08:00:00Z', now), '10 days ago')
  assert.equal(ago('2026-09-01T08:00:00Z', now), '2 months ago')
  assert.equal(ago('2024-11-01T08:00:00Z', now), '2 years ago')
})

test('a share of a limit is never rounded to empty or to full', () => {
  assert.equal(share(0, 1000), 0)
  assert.equal(share(1, 1000), 1)
  assert.equal(share(500, 1000), 50)
  assert.equal(share(999, 1000), 99)
  assert.equal(share(1000, 1000), 100)
  assert.equal(share(5000, 1000), 100)
})
