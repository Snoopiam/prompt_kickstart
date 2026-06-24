import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getEnhanceSystemPrompt, getModelPreset, type EnhanceMode } from '../lib/prompts.js'

export const enhancePromptSchema = {
  prompt: z.string().describe('The simple prompt to enhance (e.g., "a cat in a garden").'),
  mode: z.enum(['polish', 'expand']).optional().default('polish')
    .describe('polish (default, most models): preserve intent and add composition, lighting, and material detail. expand (Midjourney V8.1): rewrite into Midjourney-optimized language and auto-translate non-English input.'),
  model: z.string().optional()
    .describe('Optional target image model hint (e.g. "midjourney", "gpt-image-2", "nano banana 2", "seedream"). Known models get tuned, model-aware enhancement guidance. For Midjourney models, prefer mode "expand".'),
  includeNegativePrompt: z.boolean().optional().default(false)
    .describe('When true, also produce a short "Negative prompt (avoid): ..." list of elements to exclude.'),
  colors: z.array(z.string().regex(/^#?[0-9a-fA-F]{3,8}$/, 'must be a hex color like #dc143c'))
    .optional()
    .describe('Exact hex colors to incorporate precisely (mirrors meigen.ai\'s # color picker), e.g. ["#dc143c","#f5f5dc"].'),
  references: z.array(z.string()).optional()
    .describe('Reference-image labels to weave in as @mentions (mirrors meigen.ai\'s @ image mentions), e.g. ["image1","image2"].'),
}

export interface EnhanceArgs {
  prompt: string
  mode?: EnhanceMode
  model?: string
  includeNegativePrompt?: boolean
  colors?: string[]
  references?: string[]
}

/** Normalize a color to a leading-# hex string. */
function normalizeHex(c: string): string {
  return c.startsWith('#') ? c : `#${c}`
}

export function buildEnhanceResult(args: EnhanceArgs) {
  const mode: EnhanceMode = args.mode ?? 'polish'
  const systemPrompt = getEnhanceSystemPrompt(mode)

  // Model-aware preset (Tier 2): tuned guidance + the model's length cap.
  let modelNote = ''
  if (args.model) {
    modelNote = `\n\nTarget model: ${args.model}.`
    const preset = getModelPreset(args.model)
    if (preset) {
      modelNote += ` Model-aware guidance for ${preset.label}: ${preset.guidance}`
      if (preset.maxChars) {
        modelNote += ` Keep the enhanced prompt within ~${preset.maxChars} characters.`
      }
    }
  }

  // Exact colors (meigen # color picker).
  let colorNote = ''
  if (args.colors && args.colors.length > 0) {
    const hexes = args.colors.map(normalizeHex).join(', ')
    colorNote = `\n\nIncorporate these exact colors as hex values where appropriate: ${hexes}. Reference them precisely (by hex) rather than by approximate color names.`
  }

  // Reference-image mentions (meigen @ mentions).
  let refNote = ''
  if (args.references && args.references.length > 0) {
    const mentions = args.references.map((r) => (r.startsWith('@') ? r : `@${r}`)).join(', ')
    refNote = `\n\nThe user has these reference images available: ${mentions}. Weave appropriate @mentions into the enhanced prompt to indicate how each reference should influence the result (e.g. composition from one, palette from another).`
  }

  // Negative-prompt suggestion.
  const negativeNote = args.includeNegativePrompt
    ? `\n\nAfter the enhanced prompt, output a separate line beginning "Negative prompt (avoid):" listing elements to exclude (common artifacts, unwanted styles, extra limbs, text, watermarks, etc.) tailored to this prompt.`
    : ''

  return {
    content: [{
      type: 'text' as const,
      text: `Please enhance the following prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nUser's prompt to enhance:\n"${args.prompt}"${modelNote}${colorNote}${refNote}${negativeNote}\n\nNote: enhancement works best on brief prompts (under ~30 words); if the prompt already has detailed visual descriptions, you may return it largely unchanged. Generate the enhanced prompt now. Then show it to the user and ask if they'd like to generate an image with it.`,
    }],
  }
}

export function registerEnhancePrompt(server: McpServer) {
  server.tool(
    'enhance_prompt',
    'Transform a simple idea into a professional image generation prompt. Use when the user provides a brief description and needs a detailed, high-quality prompt. Model-aware (polish/expand + per-model presets); optional negative prompt, exact hex colors, and reference @mentions. Free, no API key needed.',
    enhancePromptSchema,
    { readOnlyHint: true },
    async (a) => buildEnhanceResult(a as EnhanceArgs),
  )
}
