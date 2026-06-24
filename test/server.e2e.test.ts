import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../src/server.js'

// Spin up the ACTUAL server (real server.tool registration) wired to a real
// MCP client over an in-memory transport. This is the guardrail the verify
// scripts skip: it proves the tools are registered, named, schema-validated,
// and callable over the genuine protocol — not just that the builders work.

let dir: string
let png: string
let client: Client

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pk-e2e-'))
  png = join(dir, 'pic.png')
  await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toFile(png)

  const server = createServer()
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'e2e-test-client', version: '1.0.0' })
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])
})

after(async () => {
  await client?.close()
  await rm(dir, { recursive: true, force: true })
})

test('listTools exposes exactly the three expected tools', async () => {
  const { tools } = await client.listTools()
  const names = tools.map((t) => t.name).sort()
  assert.deepEqual(names, ['enhance_prompt', 'image_to_prompt', 'storyboard_prompt'])
  for (const t of tools) {
    assert.ok(t.description && t.description.length > 0, `${t.name} missing description`)
    assert.ok(t.inputSchema, `${t.name} missing inputSchema`)
  }
})

test('enhance_prompt is callable end-to-end and returns wrapped guidance', async () => {
  const res: any = await client.callTool({
    name: 'enhance_prompt',
    arguments: { prompt: 'a fox in snow', mode: 'polish' },
  })
  assert.ok(!res.isError)
  assert.equal(res.content[0].type, 'text')
  assert.ok(res.content[0].text.includes('a fox in snow'))
  assert.ok(res.content[0].text.includes('Senior Visual Logic Analyst'))
})

test('enhance_prompt applies its default (polish) mode when none is supplied', async () => {
  const res: any = await client.callTool({
    name: 'enhance_prompt',
    arguments: { prompt: 'a fox' },
  })
  assert.ok(res.content[0].text.includes('Senior Visual Logic Analyst'))
})

test('enhance_prompt mode=expand selects the Midjourney expansion prompt', async () => {
  const res: any = await client.callTool({
    name: 'enhance_prompt',
    arguments: { prompt: 'a fox', mode: 'expand' },
  })
  assert.ok(!res.isError)
  assert.ok(res.content[0].text.includes('Midjourney Prompt Director'))
})

test('enhance_prompt rejects a call with no prompt (schema guardrail)', async () => {
  // The SDK surfaces input-validation failures as an error result (isError +
  // an MCP -32602 message), not a thrown exception. Assert that real contract.
  const res: any = await client.callTool({ name: 'enhance_prompt', arguments: {} })
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /Input validation error/)
})

test('enhance_prompt rejects an out-of-enum mode (schema guardrail)', async () => {
  const res: any = await client.callTool({
    name: 'enhance_prompt',
    arguments: { prompt: 'x', mode: 'cyberpunk' },
  })
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /Input validation error/)
})

test('image_to_prompt with a local path returns an image + instruction over the wire', async () => {
  const res: any = await client.callTool({
    name: 'image_to_prompt',
    arguments: { imagePath: png },
  })
  assert.ok(!res.isError)
  assert.deepEqual(res.content.map((c: any) => c.type), ['image', 'text'])
  assert.ok(res.content[0].data.length > 0)
  assert.equal(res.content[0].mimeType, 'image/png')
})

test('image_to_prompt with no source returns the "use the pasted image" guidance', async () => {
  const res: any = await client.callTool({ name: 'image_to_prompt', arguments: {} })
  assert.ok(!res.isError)
  assert.equal(res.content.length, 1)
  assert.ok(res.content[0].text.includes('shared in this conversation'))
})

test('image_to_prompt surfaces a load failure as a tool error, not a protocol crash', async () => {
  const res: any = await client.callTool({
    name: 'image_to_prompt',
    arguments: { imagePath: join(dir, 'missing.png') },
  })
  assert.equal(res.isError, true)
  assert.ok(res.content[0].text.includes('Could not load the image'))
})

test('storyboard_prompt is callable end-to-end and wraps the storyboard guidance', async () => {
  const res: any = await client.callTool({
    name: 'storyboard_prompt',
    arguments: { idea: 'a barista making latte art in a cozy cafe', durationSeconds: 8 },
  })
  assert.ok(!res.isError)
  assert.equal(res.content[0].type, 'text')
  assert.ok(res.content[0].text.includes('a barista making latte art in a cozy cafe'))
  assert.ok(res.content[0].text.includes('Video Storyboard Director'))
  assert.ok(/0s to 8s/.test(res.content[0].text))
})

test('storyboard_prompt defaults its duration when none is supplied', async () => {
  const res: any = await client.callTool({
    name: 'storyboard_prompt',
    arguments: { idea: 'sunrise over a city' },
  })
  assert.ok(!res.isError)
  assert.ok(/0s to 8s/.test(res.content[0].text))
})

test('storyboard_prompt rejects a call with no idea (schema guardrail)', async () => {
  const res: any = await client.callTool({ name: 'storyboard_prompt', arguments: {} })
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /Input validation error/)
})

test('calling an unknown tool returns a "not found" error result', async () => {
  const res: any = await client.callTool({ name: 'no_such_tool', arguments: {} })
  assert.equal(res.isError, true)
  assert.match(res.content[0].text, /not found/)
})
