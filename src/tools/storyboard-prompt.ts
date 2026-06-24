import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { STORYBOARD_PROMPT } from '../lib/prompts.js'

export const storyboardPromptSchema = {
  idea: z.string()
    .describe('A short, one-line video idea to expand into a storyboard (e.g., "a barista making latte art in a cozy café").'),
  durationSeconds: z.number().int().min(1).max(60).optional().default(8)
    .describe('Target video length in seconds; the shot-by-shot timeline spans 0s to this value. Default 8.'),
}

export function buildStoryboardResult(args: { idea: string; durationSeconds?: number }) {
  const duration = args.durationSeconds ?? 8
  return {
    content: [{
      type: 'text' as const,
      text: `Please turn the following idea into a video storyboard using these guidelines:\n\n---\n${STORYBOARD_PROMPT}\n---\n\nIdea to expand:\n"${args.idea}"\n\nTarget duration: ${duration} seconds — the shot-by-shot timeline must span 0s to ${duration}s with no gaps. Keep the idea's original language. Generate the storyboard now, then ask the user whether they'd like to refine it or use it to generate a video.`,
    }],
  }
}

export function registerStoryboardPrompt(server: McpServer) {
  server.tool(
    'storyboard_prompt',
    'Turn a one-line video idea into a complete, ready-to-shoot storyboard: an overview paragraph plus a timed, shot-by-shot timeline (0s to a chosen duration). The video equivalent of enhance_prompt. Keeps the input language. Free, no API key needed.',
    storyboardPromptSchema,
    { readOnlyHint: true },
    async ({ idea, durationSeconds }) => buildStoryboardResult({ idea, durationSeconds }),
  )
}
