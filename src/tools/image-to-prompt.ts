import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSystemPrompt, type PromptStyle } from '../lib/prompts.js'
import { loadImageContent } from '../lib/image.js'

export const imageToPromptSchema = {
  imagePath: z.string().optional()
    .describe('Local file path to the image to analyze.'),
  imageUrl: z.string().optional()
    .describe('Public remote URL of the image to analyze.'),
  style: z.enum(['realistic', 'anime', 'illustration']).optional().default('realistic')
    .describe('Target visual style for the resulting kickstart prompt.'),
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export async function buildImageToPromptResult(
  args: { imagePath?: string; imageUrl?: string; style?: PromptStyle },
): Promise<{ content: ContentBlock[]; isError?: boolean }> {
  const style: PromptStyle = args.style ?? 'realistic'
  const systemPrompt = getSystemPrompt(style)

  let image
  try {
    image = await loadImageContent({ imagePath: args.imagePath, imageUrl: args.imageUrl })
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Could not load the image: ${(err as Error).message}` }],
      isError: true,
    }
  }

  if (image) {
    return {
      content: [
        { type: 'image', data: image.data, mimeType: image.mimeType },
        {
          type: 'text',
          text: `Analyze the image above and reverse-engineer a generation-ready "kickstart" prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nOutput the kickstart prompt now. Then ask the user whether they'd like to refine it with enhance_prompt or use it to generate an image.`,
        },
      ],
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Analyze the image the user shared in this conversation and reverse-engineer a generation-ready "kickstart" prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nIf no image was shared, ask the user to paste one or pass imagePath/imageUrl. Otherwise output the kickstart prompt now, then offer to refine it with enhance_prompt or generate an image from it.`,
    }],
  }
}

export function registerImageToPrompt(server: McpServer) {
  server.tool(
    'image_to_prompt',
    'Turn an image into a generation-ready "kickstart" prompt. Accepts a local imagePath, a public imageUrl, or (if neither) the image already shared in the conversation. Free, no API key needed.',
    imageToPromptSchema,
    { readOnlyHint: true },
    async ({ imagePath, imageUrl, style }) =>
      buildImageToPromptResult({ imagePath, imageUrl, style: style as PromptStyle }),
  )
}
