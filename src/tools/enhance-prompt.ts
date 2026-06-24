import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getEnhanceSystemPrompt, type EnhanceMode } from '../lib/prompts.js'

export const enhancePromptSchema = {
  prompt: z.string().describe('The simple prompt to enhance (e.g., "a cat in a garden").'),
  mode: z.enum(['polish', 'expand']).optional().default('polish')
    .describe('polish (default, most models): preserve intent and add composition, lighting, and material detail. expand (Midjourney V8.1): rewrite into Midjourney-optimized language and auto-translate non-English input.'),
  model: z.string().optional()
    .describe('Optional target image model hint (e.g. "midjourney", "gpt-image-2"). For Midjourney models, prefer mode "expand".'),
}

export function buildEnhanceResult(args: { prompt: string; mode?: EnhanceMode; model?: string }) {
  const mode: EnhanceMode = args.mode ?? 'polish'
  const systemPrompt = getEnhanceSystemPrompt(mode)
  const modelNote = args.model ? `\n\nTarget model: ${args.model}.` : ''
  return {
    content: [{
      type: 'text' as const,
      text: `Please enhance the following prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nUser's prompt to enhance:\n"${args.prompt}"${modelNote}\n\nNote: enhancement works best on brief prompts (under ~30 words); if the prompt already has detailed visual descriptions, you may return it largely unchanged. Generate the enhanced prompt now. Then show it to the user and ask if they'd like to generate an image with it.`,
    }],
  }
}

export function registerEnhancePrompt(server: McpServer) {
  server.tool(
    'enhance_prompt',
    'Transform a simple idea into a professional image generation prompt. Use when the user provides a brief description and needs a detailed, high-quality prompt. Model-aware: polish (default) or expand (Midjourney). Free, no API key needed.',
    enhancePromptSchema,
    { readOnlyHint: true },
    async ({ prompt, mode, model }) => buildEnhanceResult({ prompt, mode: mode as EnhanceMode, model }),
  )
}
