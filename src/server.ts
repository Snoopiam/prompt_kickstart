import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
import { registerImageToPrompt } from './tools/image-to-prompt.js'

const SERVER_INSTRUCTIONS = `prompt-kickstart-mcp — two free tools that reproduce the meigen.ai Generate workflow.

- image_to_prompt: turn an image (local path, URL, or one already shared in chat) into a generation-ready "kickstart" prompt.
- enhance_prompt: expand a brief text prompt into a detailed, style-aware prompt.

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
