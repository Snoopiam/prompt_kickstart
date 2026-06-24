import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMeigenClient, MeigenApiError } from '../src/lib/meigen-api.js'

// A scripted fetch: returns queued responses in order, recording calls.
function scriptedFetch(responses: Array<{ ok?: boolean; status?: number; json: any }>) {
  const calls: Array<{ url: string; init?: any }> = []
  let i = 0
  const fn = async (url: any, init?: any) => {
    calls.push({ url: String(url), init })
    const r = responses[Math.min(i, responses.length - 1)]
    i++
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
    } as any
  }
  return { fn: fn as unknown as typeof fetch, calls }
}

const noSleep = async () => {}

test('createMeigenClient throws without a token', () => {
  assert.throws(() => createMeigenClient({ token: undefined, fetchImpl: (async () => {}) as any }), MeigenApiError)
})

test('submit sends bearer auth + JSON body to /generate/v2', async () => {
  const { fn, calls } = scriptedFetch([{ json: { success: true, generationId: 'g1', status: 'processing', creditsUsed: 5, modelId: 'gpt-image-2' } }])
  const c = createMeigenClient({ token: 'meigen_sk_x', fetchImpl: fn })
  const r = await c.submitGeneration({ prompt: 'a cat' })
  assert.equal(r.generationId, 'g1')
  assert.match(calls[0].url, /\/generate\/v2$/)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer meigen_sk_x')
  assert.equal(JSON.parse(calls[0].init.body).prompt, 'a cat')
})

test('generate polls until completed and returns the image url', async () => {
  const { fn, calls } = scriptedFetch([
    { json: { success: true, generationId: 'g2', status: 'processing', creditsUsed: 10, modelId: 'gpt-image-2' } },
    { json: { jobId: 'g2', status: 'processing', imageUrl: null, imageUrls: null, videoUrl: null, mediaType: 'image', error: null, aspectRatio: '1:1' } },
    { json: { jobId: 'g2', status: 'completed', imageUrl: 'https://images.meigen.art/x.png', imageUrls: ['https://images.meigen.art/x.png'], videoUrl: null, mediaType: 'image', error: null, aspectRatio: '1:1' } },
  ])
  const c = createMeigenClient({ token: 'meigen_sk_x', fetchImpl: fn, sleep: noSleep, pollIntervalMs: 1 })
  const { submit, result } = await c.generate({ prompt: 'a cat' })
  assert.equal(submit.creditsUsed, 10)
  assert.equal(result.status, 'completed')
  assert.equal(result.imageUrl, 'https://images.meigen.art/x.png')
  assert.equal(calls.length, 3) // 1 submit + 2 status
})

test('non-2xx responses map to MeigenApiError with the documented hint', async () => {
  const { fn } = scriptedFetch([{ ok: false, status: 402, json: { error: 'insufficient credits' } }])
  const c = createMeigenClient({ token: 'meigen_sk_x', fetchImpl: fn })
  await assert.rejects(() => c.submitGeneration({ prompt: 'x' }), (e: any) => {
    assert.ok(e instanceof MeigenApiError)
    assert.equal(e.status, 402)
    assert.match(e.message, /402/)
    assert.match(e.message, /insufficient credits/)
    return true
  })
})

test('isVideoModel recognises video model ids', () => {
  const c = createMeigenClient({ token: 'meigen_sk_x', fetchImpl: (async () => {}) as any })
  assert.equal(c.isVideoModel('veo-3.1'), true)
  assert.equal(c.isVideoModel('seedance-2-0'), true)
  assert.equal(c.isVideoModel('gpt-image-2'), false)
  assert.equal(c.isVideoModel(undefined), false)
})

test('poll times out when the job never finishes', async () => {
  const { fn } = scriptedFetch([
    { json: { success: true, generationId: 'g3', status: 'processing' } },
    { json: { jobId: 'g3', status: 'processing', imageUrl: null, imageUrls: null, videoUrl: null, mediaType: 'image', error: null, aspectRatio: null } },
  ])
  const c = createMeigenClient({ token: 'meigen_sk_x', fetchImpl: fn, sleep: noSleep, pollIntervalMs: 1000 })
  await assert.rejects(() => c.pollGeneration('g3', { timeoutMs: 0 }), /Timed out/)
})
