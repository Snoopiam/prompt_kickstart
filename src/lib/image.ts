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

/**
 * Load a locally uploaded image and return base64 content, auto-downscaled to
 * keep the host's vision payload within token limits. Uploads only — no remote
 * fetching, matching the live "Describe Image" feature (drag-drop / pasted).
 * Returns null when no path is supplied (the host should use a pasted image).
 */
export async function loadImageContent(
  opts: { imagePath?: string },
): Promise<ImageContent | null> {
  if (opts.imagePath) {
    const buf = await readFile(opts.imagePath)
    return maybeResize(buf, mimeFromExt(opts.imagePath))
  }
  return null
}
