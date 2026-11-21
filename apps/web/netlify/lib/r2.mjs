// Cloudflare R2, through its S3 API. The keys are set in Netlify's environment variables:
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.

import { AwsClient } from 'aws4fetch'

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env

export const r2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET)

const client = r2Configured ? new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' }) : null

const objectUrl = (key) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`

/** An address the browser can upload one file to, for a few minutes. Only this type and size are accepted. */
export async function uploadAddress(key, { type, size }) {
  const url = new URL(objectUrl(key))
  url.searchParams.set('X-Amz-Expires', '600')
  const signed = await client.sign(url, { method: 'PUT', headers: { 'content-type': type, 'content-length': String(size) }, aws: { signQuery: true, allHeaders: true } })
  return signed.url
}

/**
 * An address the browser can download one file from, for a few minutes. Always saved to disk, as
 * plain bytes: a page or an SVG that someone uploaded never opens as a web page, with its scripts
 * running. The type the file was uploaded with (which its uploader chose) decides nothing.
 */
export async function downloadAddress(key, { name }) {
  const url = new URL(objectUrl(key))
  url.searchParams.set('X-Amz-Expires', '300')
  const filename = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${filename}`)
  url.searchParams.set('response-content-type', 'application/octet-stream')
  const signed = await client.sign(url, { method: 'GET', aws: { signQuery: true } })
  return signed.url
}

export async function deleteObject(key) {
  const response = await client.fetch(objectUrl(key), { method: 'DELETE' })
  if (!response.ok && response.status !== 404) throw new Error(`R2 delete ${response.status}`)
}
