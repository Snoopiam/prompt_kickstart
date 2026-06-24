/**
 * Tier 3 (opt-in, PAID): a minimal client for the meigen.ai REST API.
 * https://docs.meigen.ai/en/api-reference/introduction
 *
 * Unlike the free host-LLM tools, calling these endpoints spends PURCHASED
 * meigen credits and requires an API token (meigen_sk_...). The token is read
 * from the `token` option or the MEIGEN_API_TOKEN environment variable. fetch
 * and sleep are injectable so the client is fully unit-testable without network.
 */

export const MEIGEN_BASE_URL = 'https://www.meigen.ai/api'

/** meigen model ids that produce video (used to pick a longer poll timeout). */
export const VIDEO_MODEL_IDS = new Set(['seedance-2-0', 'happyhorse-1.0', 'veo-3.1'])

export interface GenerateBody {
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
  niji7Options?: Record<string, unknown>
}

export interface SubmitResponse {
  success: boolean
  generationId: string
  status: string
  creditsUsed?: number
  modelId?: string
  credits?: { daily: number; purchased: number; unlimited: boolean }
}

export interface StatusResponse {
  jobId: string
  status: 'processing' | 'completed' | 'failed' | string
  imageUrl: string | null
  imageUrls: string[] | null
  videoUrl: string | null
  mediaType: 'image' | 'video' | string
  error: string | null
  aspectRatio: string | null
}

export interface MeigenClientOptions {
  token?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  /** Sleep used between status polls; injectable for tests. */
  sleep?: (ms: number) => Promise<void>
  pollIntervalMs?: number
  /** Default poll timeout; overridable per-generation. */
  timeoutMs?: number
}

const STATUS_HINTS: Record<number, string> = {
  400: 'Bad request — check your parameters.',
  401: 'Unauthorized — the API token is missing or invalid.',
  402: 'Payment required — insufficient purchased credits.',
  404: 'Not found.',
  429: 'Rate limited — wait 10–30s and retry.',
  500: 'meigen server error — try again later.',
}

export class MeigenApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'MeigenApiError'
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export interface MeigenClient {
  submitGeneration(body: GenerateBody): Promise<SubmitResponse>
  getStatus(generationId: string): Promise<StatusResponse>
  pollGeneration(generationId: string, opts?: { timeoutMs?: number }): Promise<StatusResponse>
  generate(body: GenerateBody, opts?: { timeoutMs?: number }): Promise<{ submit: SubmitResponse; result: StatusResponse }>
  listModels(): Promise<unknown>
  isVideoModel(modelId?: string): boolean
}

export function createMeigenClient(options: MeigenClientOptions = {}): MeigenClient {
  const token = options.token ?? process.env.MEIGEN_API_TOKEN
  if (!token) {
    throw new MeigenApiError(401, 'No meigen API token. Set MEIGEN_API_TOKEN or pass { token }.')
  }
  const baseUrl = (options.baseUrl ?? MEIGEN_BASE_URL).replace(/\/$/, '')
  const doFetch = options.fetchImpl ?? globalThis.fetch
  const sleep = options.sleep ?? defaultSleep
  const pollIntervalMs = options.pollIntervalMs ?? 3000
  const defaultTimeoutMs = options.timeoutMs ?? 5 * 60 * 1000

  if (typeof doFetch !== 'function') {
    throw new MeigenApiError(500, 'No fetch implementation available (Node 18+ or pass fetchImpl).')
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      // non-JSON body
    }
    if (!res.ok) {
      const hint = STATUS_HINTS[res.status] ?? ''
      const detail = json?.error ? `: ${json.error}` : ''
      throw new MeigenApiError(res.status, `meigen API ${res.status}${detail}${hint ? ` (${hint})` : ''}`)
    }
    return json as T
  }

  const isVideoModel = (modelId?: string) => !!modelId && VIDEO_MODEL_IDS.has(modelId)

  async function submitGeneration(body: GenerateBody): Promise<SubmitResponse> {
    return request<SubmitResponse>('/generate/v2', { method: 'POST', body: JSON.stringify(body) })
  }

  async function getStatus(generationId: string): Promise<StatusResponse> {
    return request<StatusResponse>(`/generate/v2/status/${encodeURIComponent(generationId)}`)
  }

  async function pollGeneration(
    generationId: string,
    opts: { timeoutMs?: number } = {},
  ): Promise<StatusResponse> {
    const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs
    const deadline = Date.now() + timeoutMs
    // First check immediately, then on each interval.
    for (;;) {
      const status = await getStatus(generationId)
      if (status.status === 'completed' || status.status === 'failed') return status
      if (Date.now() + pollIntervalMs > deadline) {
        throw new MeigenApiError(504, `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for generation ${generationId}.`)
      }
      await sleep(pollIntervalMs)
    }
  }

  async function generate(body: GenerateBody, opts: { timeoutMs?: number } = {}) {
    const submit = await submitGeneration(body)
    const timeoutMs = opts.timeoutMs ?? (isVideoModel(body.modelId) ? 10 * 60 * 1000 : defaultTimeoutMs)
    const result = await pollGeneration(submit.generationId, { timeoutMs })
    return { submit, result }
  }

  async function listModels(): Promise<unknown> {
    return request<unknown>('/models')
  }

  return { submitGeneration, getStatus, pollGeneration, generate, listModels, isVideoModel }
}
