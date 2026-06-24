import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TEMPLATIZE_PROMPT } from '../lib/prompts.js'

export const templatizePromptSchema = {
  prompt: z.string()
    .describe('The image prompt to convert into a reusable template with editable [placeholder] tags.'),
}

export function buildTemplatizeResult(args: { prompt: string }) {
  return {
    content: [{
      type: 'text' as const,
      text: `Please convert the following prompt into a reusable template using these guidelines:\n\n---\n${TEMPLATIZE_PROMPT}\n---\n\nPrompt to templatize:\n"${args.prompt}"\n\nOutput the templated prompt with [tags] inline plus the Variables list, then ask the user which tags they'd like to swap.`,
    }],
  }
}

export function registerTemplatizePrompt(server: McpServer) {
  server.tool(
    'templatize_prompt',
    'Rewrite a prompt into a reusable template with editable [placeholder] tags (e.g. [subject], [style], [color palette]) so the user can spin variations by swapping tag values. Free, no API key needed.',
    templatizePromptSchema,
    { readOnlyHint: true },
    async ({ prompt }) => buildTemplatizeResult({ prompt }),
  )
}
