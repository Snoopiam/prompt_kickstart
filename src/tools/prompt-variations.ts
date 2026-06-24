import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { VARIATIONS_PROMPT } from '../lib/prompts.js'

export const promptVariationsSchema = {
  prompt: z.string()
    .describe('The base image prompt to create variations of (e.g., "a cat in a garden").'),
  count: z.number().int().min(1).max(10).optional().default(3)
    .describe('How many distinct variations to generate (1-10). Default 3.'),
}

export function buildVariationsResult(args: { prompt: string; count?: number }) {
  const count = args.count ?? 3
  return {
    content: [{
      type: 'text' as const,
      text: `Please create ${count} distinct variations of the following prompt using these guidelines:\n\n---\n${VARIATIONS_PROMPT}\n---\n\nBase prompt:\n"${args.prompt}"\n\nGenerate exactly ${count} variation(s) as a numbered list, keeping the core subject recognizable in each. Then ask the user which one they'd like to enhance or generate.`,
    }],
  }
}

export function registerPromptVariations(server: McpServer) {
  server.tool(
    'prompt_variations',
    'Generate several distinct, generation-ready variations of a base prompt — keeping the core subject while varying mood, lighting, composition, palette, or style. Free, no API key needed.',
    promptVariationsSchema,
    { readOnlyHint: true },
    async ({ prompt, count }) => buildVariationsResult({ prompt, count }),
  )
}
