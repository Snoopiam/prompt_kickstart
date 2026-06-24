import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DESCRIBE_IMAGE_PROMPT } from '../lib/prompts.js'
import { loadImageContent } from '../lib/image.js'

export const imageToPromptSchema = {
  imagePath: z.string().optional()
    .describe('Local file path to the uploaded image to analyze. Omit to use an image already pasted/shared in this conversation.'),
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export async function buildImageToPromptResult(
  args: { imagePath?: string },
): Promise<{ content: ContentBlock[]; isError?: boolean }> {
  let image
  try {
    image = await loadImageContent({ imagePath: args.imagePath })
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
          text: `Analyze the image above and reverse-engineer a generation-ready prompt using these guidelines:\n\n---\n${DESCRIBE_IMAGE_PROMPT}\n---\n\nOutput the prompt now. Then ask the user whether they'd like to refine it with enhance_prompt or use it to generate an image.`,
        },
      ],
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Analyze the image the user shared in this conversation and reverse-engineer a generation-ready prompt using these guidelines:\n\n---\n${DESCRIBE_IMAGE_PROMPT}\n---\n\nIf no image was shared, ask the user to paste one or pass imagePath. Otherwise output the prompt now, then offer to refine it with enhance_prompt or generate an image from it.`,
    }],
  }
}

export function registerImageToPrompt(server: McpServer) {
  server.tool(
    'image_to_prompt',
    'Turn an uploaded image into a generation-ready prompt. Accepts a local imagePath, or (if omitted) the image already shared in the conversation. The visual style is inferred from the image. Free, no API key needed.',
    imageToPromptSchema,
    { readOnlyHint: true },
    async ({ imagePath }) => buildImageToPromptResult({ imagePath }),
  )
}
