import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
import { registerImageToPrompt } from './tools/image-to-prompt.js'
import { registerStoryboardPrompt } from './tools/storyboard-prompt.js'

const SERVER_INSTRUCTIONS = `prompt-kickstart-mcp — free tools that reproduce the meigen.ai Generate workflow.

- image_to_prompt: turn an uploaded image (local path, or one already pasted in chat) into a generation-ready prompt. The visual style is inferred from the image.
- enhance_prompt: expand a brief text prompt into a detailed one. Model-aware: polish (default) or expand (Midjourney).
- storyboard_prompt: turn a one-line video idea into a timed, shot-by-shot storyboard (overview + 0s->N timeline). The video equivalent of enhance_prompt; keeps the input language.

All are free and require no API key: you (the host LLM) perform the vision and writing. Typical image flow: image_to_prompt -> enhance_prompt -> copy into any image generator. Typical video flow: storyboard_prompt -> copy into any video generator.`

export function createServer() {
  const server = new McpServer(
    { name: 'prompt-kickstart-mcp', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )
  registerEnhancePrompt(server)
  registerImageToPrompt(server)
  registerStoryboardPrompt(server)
  return server
}
