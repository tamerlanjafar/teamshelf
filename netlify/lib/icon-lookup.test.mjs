// node --test netlify/lib/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findIcon } from './icon-lookup.mjs'

test('addresses inside private networks are never fetched', async () => {
  for (const address of ['http://127.0.0.1/', 'http://localhost:3011/', 'http://10.0.0.5/', 'http://192.168.1.1/admin', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://172.16.0.1/', 'http://0.0.0.0/', 'http://100.64.0.1/', 'http://[fd00::1]/', 'http://[::ffff:127.0.0.1]/']) {
    assert.equal(await findIcon(address), null, address)
  }
})

test('only web addresses', async () => {
  for (const address of ['file:///etc/passwd', 'ftp://example.com/', 'javascript:alert(1)', 'not a url', '']) {
    assert.equal(await findIcon(address), null, address)
  }
})
