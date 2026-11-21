// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safePath } from './safe-path.ts'

test('paths of this app are kept', () => {
  for (const path of ['/', '/acme', '/acme/team', '/acme/development?x=1#top', '/file?key=a%2Fb%2Fc', '/new']) assert.equal(safePath(path), path)
})

test('anything that would leave this site becomes "/"', () => {
  for (const path of [
    undefined,
    '',
    'acme',
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    '/\\/evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r\\evil.example',
    'javascript:alert(1)',
    '/..//evil.example',
    '/.//evil.example',
  ]) {
    const safe = safePath(path)
    assert.equal(new URL(safe, 'https://teamshelf.app').origin, 'https://teamshelf.app', String(path))
    assert.match(safe, /^\/(?![/\\])/, String(path))
  }
})
