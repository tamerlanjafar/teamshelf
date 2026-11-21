// node --test netlify/lib/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { findIcon, isPrivateAddress } from './icon-lookup.mjs'

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

test('an IPv4 address inside an IPv6 one is still private', () => {
  for (const address of ['::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '::7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::', 'fe80::1', 'fec0::1', 'ff02::1', '198.18.0.1', '192.0.0.8', '240.0.0.1', 'not an address']) {
    assert.equal(isPrivateAddress(address), true, address)
  }
  for (const address of ['1.1.1.1', '93.184.216.34', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:1.1.1.1']) {
    assert.equal(isPrivateAddress(address), false, address)
  }
})

test('a server on this machine is never reached, however its address is written', async () => {
  let reached = 0
  const server = createServer((request, response) => {
    reached += 1
    response.setHeader('content-type', 'text/html')
    response.end('<head><link rel="icon" href="/icon.png"></head>')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    // The second is how a URL writes ::ffff:127.0.0.1; the others are 127.0.0.1 as one number, in hex, and short.
    for (const host of ['127.0.0.1', '[::ffff:7f00:1]', '[::ffff:127.0.0.1]', 'localhost', '2130706433', '0x7f.0.0.1', '127.1']) {
      assert.equal(await findIcon(`http://${host}:${port}/`), null, host)
    }
    assert.equal(await findIcon(`http://user:secret@example.com/`), null)
    assert.equal(reached, 0)
  } finally {
    server.close()
  }
})
