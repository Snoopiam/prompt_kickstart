import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { loadImageContent } from '../src/lib/image.js'

let dir: string
let smallPng: string
let largePng: string
let smallJpg: string

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pk-image-'))
  smallPng = join(dir, 'small.png')
  largePng = join(dir, 'large.png')
  smallJpg = join(dir, 'small.jpg')
  await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toFile(smallPng)
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 0, g: 0, b: 255 } } }).png().toFile(largePng)
  await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } } }).jpeg().toFile(smallJpg)
})

after(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function dimsOf(base64: string) {
  const meta = await sharp(Buffer.from(base64, 'base64')).metadata()
  return { width: meta.width!, height: meta.height! }
}

test('a small image is returned untouched (no upscaling)', async () => {
  const out = await loadImageContent({ imagePath: smallPng })
  assert.ok(out)
  assert.equal(out!.mimeType, 'image/png')
  const { width, height } = await dimsOf(out!.data)
  assert.equal(width, 200)
  assert.equal(height, 200)
})

test('an oversized image is downscaled so the longest edge is exactly 1568', async () => {
  const out = await loadImageContent({ imagePath: largePng })
  assert.ok(out)
  const { width, height } = await dimsOf(out!.data)
  assert.equal(Math.max(width, height), 1568)
  assert.equal(width, 1568)        // 3000x2000 -> 1568x1045
  assert.equal(height, 1045)
  // aspect ratio preserved within rounding
  assert.ok(Math.abs(width / height - 3000 / 2000) < 0.01)
})

test('mime type is derived correctly for jpeg', async () => {
  const out = await loadImageContent({ imagePath: smallJpg })
  assert.equal(out!.mimeType, 'image/jpeg')
})

test('no source returns null', async () => {
  assert.equal(await loadImageContent({}), null)
})

test('a missing file path rejects (so callers can surface it as an error)', async () => {
  await assert.rejects(() => loadImageContent({ imagePath: join(dir, 'nope.png') }))
})

test('the base64 payload carries no data: URI prefix', async () => {
  const out = await loadImageContent({ imagePath: smallPng })
  assert.ok(!out!.data.startsWith('data:'))
})
