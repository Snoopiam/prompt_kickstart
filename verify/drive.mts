/**
 * Drives the REAL built server (bin/prompt-kickstart-mcp.js) over stdio, the
 * same way an MCP host (Claude Desktop / Claude Code) would launch it.
 */
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const root = resolve(import.meta.dirname, '..')
const img = resolve(root, 'verify/tmp/test-scene.png')

await mkdir(resolve(root, 'verify/tmp'), { recursive: true })
await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 40, g: 90, b: 160 } } })
  .png().toFile(img)

function preview(res: any) {
  return res.content.map((c: any) =>
    c.type === 'image'
      ? `[image ${c.mimeType}, base64 ${c.data.length} chars]`
      : `[text] ${c.text.slice(0, 220).replace(/\n/g, ' ')}…`,
  )
}

const transport = new StdioClientTransport({
  command: 'node',
  args: [resolve(root, 'bin/prompt-kickstart-mcp.js')],
})
const client = new Client({ name: 'drive', version: '1.0.0' })

await client.connect(transport)
console.log('CONNECTED to launched server\n')

const { tools } = await client.listTools()
console.log('TOOLS:', tools.map((t) => t.name).join(', '), '\n')

console.log('— enhance_prompt (mode=expand, model=midjourney) —')
const e: any = await client.callTool({
  name: 'enhance_prompt',
  arguments: { prompt: 'lonely lighthouse at dawn', mode: 'expand', model: 'midjourney' },
})
console.log(preview(e).join('\n'), '\n')

console.log('— image_to_prompt (uploaded file) —')
const i: any = await client.callTool({ name: 'image_to_prompt', arguments: { imagePath: img } })
console.log(preview(i).join('\n'), '\n')

console.log('— image_to_prompt (no path → pasted-image guidance) —')
const p: any = await client.callTool({ name: 'image_to_prompt', arguments: {} })
console.log(preview(p).join('\n'), '\n')

console.log('— image_to_prompt (bad path → isError) —')
const b: any = await client.callTool({ name: 'image_to_prompt', arguments: { imagePath: 'nope.png' } })
console.log('isError:', b.isError, '|', preview(b).join('\n'), '\n')

await client.close()
console.log('CLOSED — server shut down cleanly')
