import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TRANSLATE_PROMPT } from '../lib/prompts.js'

export const translatePromptSchema = {
  prompt: z.string()
    .describe('The image/video prompt to translate (may be in any language).'),
  targetLang: z.string().optional().default('en')
    .describe('Target language for the translation. Default "en" (English), which most image models prefer.'),
}

export function buildTranslateResult(args: { prompt: string; targetLang?: string }) {
  const targetLang = args.targetLang ?? 'en'
  return {
    content: [{
      type: 'text' as const,
      text: `Please translate the following prompt into "${targetLang}" using these guidelines:\n\n---\n${TRANSLATE_PROMPT}\n---\n\nPrompt to translate:\n"${args.prompt}"\n\nTarget language: ${targetLang}. If the prompt is already in ${targetLang}, return it unchanged. Output only the translated prompt, then ask if they'd like to enhance it or generate from it.`,
    }],
  }
}

export function registerTranslatePrompt(server: McpServer) {
  server.tool(
    'translate_prompt',
    'Translate an image/video prompt into a target language (default English, which most models prefer), preserving all visual intent and prompt tokens. Free, no API key needed.',
    translatePromptSchema,
    { readOnlyHint: true },
    async ({ prompt, targetLang }) => buildTranslateResult({ prompt, targetLang }),
  )
}
