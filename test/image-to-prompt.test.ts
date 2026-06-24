import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { buildImageToPromptResult } from '../src/tools/image-to-prompt.js'

let dir: string
let png: string

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pk-i2p-'))
  png = join(dir, 'pic.png')
  await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toFile(png)
})

after(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('with a local image: returns an image block followed by an instruction block', async () => {
  const r = await buildImageToPromptResult({ imagePath: png, style: 'realistic' })
  assert.deepEqual(r.content.map((c) => c.type), ['image', 'text'])
  assert.ok(!r.isError)
  const img = r.content[0]
  assert.ok(img.type === 'image' && img.data.length > 0 && img.mimeType === 'image/png')
  const instr = r.content[1]
  assert.ok(instr.type === 'text' && instr.text.includes('reverse-engineer'))
})

test('with no source: a single text block tells the host to use the pasted image', async () => {
  const r = await buildImageToPromptResult({})
  assert.equal(r.content.length, 1)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].type === 'text' && r.content[0].text.includes('shared in this conversation'))
  assert.ok(!r.isError)
})

test('with a bad path: returns isError and a human-readable message instead of throwing', async () => {
  const r = await buildImageToPromptResult({ imagePath: join(dir, 'does-not-exist.png') })
  assert.equal(r.isError, true)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].type === 'text' && r.content[0].text.includes('Could not load the image'))
})

test('style flows through to the embedded guidelines', async () => {
  const r = await buildImageToPromptResult({ imagePath: png, style: 'anime' })
  const instr = r.content[1]
  assert.ok(instr.type === 'text' && instr.text.includes('Anime Prompt Director'))
})
