import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSystemPrompt, type PromptStyle } from '../lib/prompts.js'

export const enhancePromptSchema = {
  prompt: z.string().describe('The simple prompt to enhance (e.g., "a cat in a garden")'),
  style: z.enum(['realistic', 'anime', 'illustration']).optional().default('realistic')
    .describe('Target visual style: realistic (photorealistic), anime (2D/Japanese), illustration (concept art).'),
}

export function buildEnhanceResult(args: { prompt: string; style?: PromptStyle }) {
  const style: PromptStyle = args.style ?? 'realistic'
  const systemPrompt = getSystemPrompt(style)
  return {
    content: [{
      type: 'text' as const,
      text: `Please enhance the following prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nUser's prompt to enhance:\n"${args.prompt}"\n\nGenerate the enhanced prompt now. Then show it to the user and ask if they'd like to generate an image with it.`,
    }],
  }
}

export function registerEnhancePrompt(server: McpServer) {
  server.tool(
    'enhance_prompt',
    'Transform a simple idea into a professional image generation prompt. Use when the user provides a brief description and needs a detailed, high-quality prompt. Free, no API key needed.',
    enhancePromptSchema,
    { readOnlyHint: true },
    async ({ prompt, style }) => buildEnhanceResult({ prompt, style: style as PromptStyle }),
  )
}
