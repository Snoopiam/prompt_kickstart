import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import sharp from 'sharp'

const MAX_EDGE = 1568

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export interface ImageContent {
  data: string      // base64, no data: prefix
  mimeType: string
}

function mimeFromExt(path: string): string {
  return MIME_BY_EXT[extname(path).toLowerCase()] ?? 'image/png'
}

function mimeFromFormat(format: string | undefined, fallback: string): string {
  if (!format) return fallback
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg'
  return `image/${format}`
}

/** Downscale if the longest edge exceeds MAX_EDGE; never upscale. */
async function maybeResize(input: Buffer, fallbackMime: string): Promise<ImageContent> {
  const img = sharp(input)
  const meta = await img.metadata()
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0)
  const mimeType = mimeFromFormat(meta.format, fallbackMime)

  if (longest > MAX_EDGE) {
    const resized = await img
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    return { data: resized.toString('base64'), mimeType }
  }
  return { data: input.toString('base64'), mimeType }
}

export async function loadImageContent(
  opts: { imagePath?: string; imageUrl?: string },
): Promise<ImageContent | null> {
  if (opts.imagePath) {
    const buf = await readFile(opts.imagePath)
    return maybeResize(buf, mimeFromExt(opts.imagePath))
  }
  if (opts.imageUrl) {
    const res = await fetch(opts.imageUrl)
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const contentType = (res.headers.get('content-type') ?? 'image/png').split(';')[0].trim()
    const buf = Buffer.from(await res.arrayBuffer())
    return maybeResize(buf, contentType)
  }
  return null
}
