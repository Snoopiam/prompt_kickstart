import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMeigenClient, type MeigenClient, type GenerateBody } from '../lib/meigen-api.js'

const IMAGE_MODELS = ['gpt-image-2', 'gemini-3-pro-image-preview', 'nanobanana-2', 'seedream-5.0-lite', 'seedream-4.5', 'midjourney-v8.1', 'z-image-turbo'] as const
const VIDEO_MODELS = ['seedance-2-0', 'happyhorse-1.0', 'veo-3.1'] as const

export const generateMediaSchema = {
  prompt: z.string().describe('Text description of the image or video to generate.'),
  modelId: z.string().optional()
    .describe(`Model id. Images: ${IMAGE_MODELS.join(', ')}. Videos: ${VIDEO_MODELS.join(', ')}. Omit for the platform default (gpt-image-2).`),
  aspectRatio: z.string().optional().describe('Aspect ratio (e.g. "1:1", "16:9", "9:16"). Default "auto".'),
  resolution: z.string().optional().describe('Output resolution. Images: 1K/2K/3K/4K. Videos: 480p/720p/1080p. Model-dependent.'),
  quality: z.enum(['low', 'medium', 'high']).optional().describe('GPT Image 2.0 only.'),
  referenceImages: z.array(z.string().url()).optional().describe('Public HTTPS image URLs to use as references (per-model max).'),
  referenceType: z.enum(['content', 'style']).optional().describe('Midjourney V8.1 only: how to interpret the reference image.'),
  duration: z.number().int().min(1).max(15).optional().describe('Video duration in seconds (video models only).'),
  tier: z.enum(['fast', 'pro']).optional().describe('Quality tier for Seedance 2.0 / Veo 3.1.'),
  referenceVideo: z.string().url().optional().describe('Seedance 2.0 only: reference video URL for continuation.'),
  referenceVideoDuration: z.number().optional().describe('Seedance 2.0: duration (s) of the reference video; required when referenceVideo is set.'),
}

export type GenerateMediaArgs = {
  prompt: string
  modelId?: string
  aspectRatio?: string
  resolution?: string
  quality?: string
  referenceImages?: string[]
  referenceType?: string
  duration?: number
  tier?: string
  referenceVideo?: string
  referenceVideoDuration?: number
}

function toBody(args: GenerateMediaArgs): GenerateBody {
  const body: GenerateBody = { prompt: args.prompt }
  if (args.modelId) body.modelId = args.modelId
  if (args.aspectRatio) body.aspectRatio = args.aspectRatio
  if (args.resolution) body.resolution = args.resolution
  if (args.quality) body.quality = args.quality
  if (args.referenceImages?.length) body.referenceImages = args.referenceImages
  if (args.referenceType) body.referenceType = args.referenceType
  if (args.duration !== undefined) body.duration = args.duration
  if (args.tier) body.tier = args.tier
  if (args.referenceVideo) body.referenceVideo = args.referenceVideo
  if (args.referenceVideoDuration !== undefined) body.referenceVideoDuration = args.referenceVideoDuration
  return body
}

export async function buildGenerateMediaResult(
  args: GenerateMediaArgs,
  client: MeigenClient,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const { submit, result } = await client.generate(toBody(args))
    if (result.status === 'failed') {
      return {
        content: [{ type: 'text', text: `Generation failed: ${result.error ?? 'unknown error'}. Credits are automatically refunded on failure.` }],
        isError: true,
      }
    }
    const urls = result.mediaType === 'video'
      ? [result.videoUrl].filter(Boolean)
      : (result.imageUrls && result.imageUrls.length ? result.imageUrls : [result.imageUrl].filter(Boolean))
    const creditLine = submit.creditsUsed !== undefined ? ` Credits used: ${submit.creditsUsed}.` : ''
    const ratioLine = result.aspectRatio ? ` Aspect ratio: ${result.aspectRatio}.` : ''
    return {
      content: [{
        type: 'text',
        text: `Generated ${result.mediaType} with ${submit.modelId ?? args.modelId ?? 'default model'}.${ratioLine}${creditLine}\n\n${(urls as string[]).map((u, i) => `${urls.length > 1 ? `${i + 1}. ` : ''}${u}`).join('\n')}`,
      }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `meigen generation error: ${(err as Error).message}` }],
      isError: true,
    }
  }
}

export function registerGenerateMedia(server: McpServer, opts: { token: string }) {
  const client = createMeigenClient({ token: opts.token })
  server.tool(
    'generate_media',
    'PAID (spends purchased meigen.ai credits, requires MEIGEN_API_TOKEN). Generate a real image or video via the meigen.ai API and return the result URL(s). Submits and polls until done. Use the free image_to_prompt / enhance_prompt / storyboard_prompt tools to craft the prompt first.',
    generateMediaSchema,
    async (a) => buildGenerateMediaResult(a as GenerateMediaArgs, client),
  )
}
