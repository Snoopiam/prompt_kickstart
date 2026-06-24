import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
import { registerImageToPrompt } from './tools/image-to-prompt.js'

const SERVER_INSTRUCTIONS = `prompt-kickstart-mcp — two free tools that reproduce the meigen.ai Generate workflow.

- image_to_prompt: turn an uploaded image (local path, or one already pasted in chat) into a generation-ready prompt. The visual style is inferred from the image.
- enhance_prompt: expand a brief text prompt into a detailed one. Model-aware: polish (default) or expand (Midjourney).

Both are free and require no API key: you (the host LLM) perform the vision and writing. Typical flow: image_to_prompt -> enhance_prompt -> copy into any image generator.`

export function createServer() {
  const server = new McpServer(
    { name: 'prompt-kickstart-mcp', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )
  registerEnhancePrompt(server)
  registerImageToPrompt(server)
  return server
}
