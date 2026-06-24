import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
import { registerImageToPrompt } from './tools/image-to-prompt.js'
import { registerStoryboardPrompt } from './tools/storyboard-prompt.js'
import { registerTranslatePrompt } from './tools/translate-prompt.js'
import { registerPromptVariations } from './tools/prompt-variations.js'
import { registerTemplatizePrompt } from './tools/templatize-prompt.js'
import { registerGenerateMedia } from './tools/generate-media.js'
import { registerListModels } from './tools/list-models.js'

const SERVER_INSTRUCTIONS = `prompt-kickstart-mcp — free tools that reproduce the meigen.ai Generate workflow.

Free, no API key (the host LLM does the work):
- image_to_prompt: turn an uploaded image (local path, or one already pasted in chat) into a generation-ready prompt. The visual style is inferred from the image.
- enhance_prompt: expand a brief text prompt into a detailed one. Model-aware (polish/expand + per-model presets); optional negative prompt, exact hex colors, and reference @mentions.
- storyboard_prompt: turn a one-line video idea into a timed, shot-by-shot storyboard (overview + 0s->N timeline). Keeps the input language.
- translate_prompt: translate a prompt into a target language (default English), preserving all visual intent and prompt tokens.
- prompt_variations: generate several distinct variations of a base prompt.
- templatize_prompt: rewrite a prompt into a reusable template with editable [placeholder] tags.

Optional PAID tools (only registered when MEIGEN_API_TOKEN is set; spend purchased meigen.ai credits):
- generate_media: generate a real image or video via the meigen.ai API and return the result URL(s).
- list_models: list the models available on the meigen.ai API.

Typical free image flow: image_to_prompt -> enhance_prompt -> copy into any image generator. Typical free video flow: storyboard_prompt -> copy into any video generator. With a token, you can also hand the crafted prompt to generate_media.`

export interface CreateServerOptions {
  /** meigen API token; falls back to MEIGEN_API_TOKEN. When present, the paid generation tools are registered. */
  meigenToken?: string
}

export function createServer(opts: CreateServerOptions = {}) {
  const server = new McpServer(
    { name: 'prompt-kickstart-mcp', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )

  // Free, host-LLM tools — always available.
  registerEnhancePrompt(server)
  registerImageToPrompt(server)
  registerStoryboardPrompt(server)
  registerTranslatePrompt(server)
  registerPromptVariations(server)
  registerTemplatizePrompt(server)

  // Paid, opt-in tools — only when a meigen API token is configured.
  const meigenToken = opts.meigenToken ?? process.env.MEIGEN_API_TOKEN
  if (meigenToken) {
    registerGenerateMedia(server, { token: meigenToken })
    registerListModels(server, { token: meigenToken })
  }

  return server
}
