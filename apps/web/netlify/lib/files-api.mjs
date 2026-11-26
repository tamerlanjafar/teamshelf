// Files of a space, kept in Cloudflare R2. The browser never gets the storage keys: it asks here
// for an address that works for a few minutes, and this function first asks the database, as
// the caller, whether they may. Row-level security decides, the same way it does for the app.
//
// Served by netlify/functions (upload and save by actions.mjs, url by api.mjs).
//
//   POST /api/files/upload  { spaceId, name, size, type }  →  { key, uploadUrl }
//   POST /api/files/save    { key, size, type }            →  { uploadUrl }: writes over a file (editing a text file)
//   GET  /api/files/url?key=<key>                            →  { url }, which downloads the file
//   GET  /api/files/url?key=<key>&for=frame                  →  { url }, which shows a PDF (and only a PDF) in a frame

import { asCaller, DataApiError, json, verifiedToken } from './neon.mjs'
import { serving } from './file-serving.mjs'
import { downloadAddress, r2Configured, uploadAddress } from './r2.mjs'

/** Keep in step with MAX_FILE_BYTES in src/api/files.ts and links.file_size in the database. */
const MAX_BYTES = 25 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A file name that is safe as the last part of a storage key. The real name is kept in the database. */
const keyName = (name) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(-120) || 'file'

async function upload(request, token) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send the file details as JSON.' }, 400)
  }
  const { spaceId, name, size, type } = body ?? {}
  if (typeof spaceId !== 'string' || !UUID.test(spaceId)) return json({ error: 'Which space?' }, 400)
  if (typeof name !== 'string' || !name.trim() || name.length > 200) return json({ error: 'The file needs a name of up to 200 characters.' }, 400)
  if (!Number.isInteger(size) || size <= 0) return json({ error: 'This file is empty.' }, 400)
  if (size > MAX_BYTES) return json({ error: 'Files can be up to 25 MB.' }, 413)
  if (typeof type !== 'string' || type.length > 120 || !/^[\w.+-]+\/[\w.+-]+$/.test(type)) return json({ error: 'Unknown file type.' }, 400)

  // The database decides, as the caller: seeing the space is what it takes to add to it (an admin
  // publishes, everyone else suggests), and each person has so many uploads an hour. It records
  // the upload, and only a recorded upload can become a link (db/migrations/003_files_and_limits.sql).
  let key
  try {
    key = await asCaller(token, 'rpc/start_upload', { method: 'POST', body: JSON.stringify({ space: spaceId, file_name: keyName(name), size }) })
  } catch (error) {
    if (!(error instanceof DataApiError)) throw error
    // Refused by the database, in its own words (not allowed, too many uploads lately, or no room left).
    if (error.code === '42501') return json({ error: "You can't add files to this space." }, 403)
    if (error.code === 'P0001') return json({ error: error.message }, 429)
    throw error
  }
  if (typeof key !== 'string') throw new Error('start_upload gave no key')
  return json({ key, uploadUrl: await uploadAddress(key, { type, size }) })
}

/** Editing a text file: an address to write its new contents to, over the old ones. */
async function save(request, token) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send the file details as JSON.' }, 400)
  }
  const { key, size, type } = body ?? {}
  if (typeof key !== 'string' || !key || key.length > 400) return json({ error: 'Which file?' }, 400)
  if (!Number.isInteger(size) || size < 0) return json({ error: 'How big is the file?' }, 400)
  if (size > MAX_BYTES) return json({ error: 'Files can be up to 25 MB.' }, 413)
  if (typeof type !== 'string' || type.length > 120 || !/^[\w.+-]+\/[\w.+-]+$/.test(type)) return json({ error: 'Unknown file type.' }, 400)

  // The database decides, as the caller: only an admin of the file's space may change it.
  try {
    await asCaller(token, 'rpc/save_file', { method: 'POST', body: JSON.stringify({ file: key, size }) })
  } catch (error) {
    if (!(error instanceof DataApiError)) throw error
    if (error.code === '42501') return json({ error: 'Only the admins of a space can change its files.' }, 403)
    // No room left in the space or the organization, in the database's own words.
    if (error.code === 'P0001') return json({ error: error.message }, 413)
    throw error
  }
  return json({ uploadUrl: await uploadAddress(key, { type, size }) })
}

async function address(request, token) {
  const query = new URL(request.url).searchParams
  const key = query.get('key') ?? ''
  if (!key || key.length > 400) return json({ error: 'Which file?' }, 400)

  // Only a file on a link the caller can see. Row-level security leaves out every other.
  const links = await asCaller(token, `links?file_key=eq.${encodeURIComponent(key)}&select=file_name&limit=1`)
  if (links.length === 0) return json({ error: "This file isn't there, or you can't open it." }, 404)
  // What the browser asks for is only a wish: the file's name, as the database has it, decides
  // (file-serving.mjs). A frame is for a PDF, and nothing else is ever sent as anything but bytes to save.
  const how = serving(links[0].file_name, query.get('for'))
  if (how === 'refused') return json({ error: "This file can't be shown in a frame. Download it instead." }, 400)
  return json({ url: await downloadAddress(key, { name: links[0].file_name, asPdf: how === 'pdf' }) })
}

export default async function files(request) {
  if (!r2Configured) return json({ error: "File storage isn't set up yet." }, 503)
  const token = await verifiedToken(request)
  if (!token) return json({ error: 'Sign in first.' }, 401)

  const path = new URL(request.url).pathname
  try {
    if (path === '/api/files/upload' && request.method === 'POST') return await upload(request, token)
    if (path === '/api/files/save' && request.method === 'POST') return await save(request, token)
    if (path === '/api/files/url' && request.method === 'GET') return await address(request, token)
    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    console.error(error)
    return json({ error: 'Something went wrong. Try again.' }, 502)
  }
}
