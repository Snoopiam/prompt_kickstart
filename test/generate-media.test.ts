import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGenerateMediaResult } from '../src/tools/generate-media.js'
import { buildListModelsResult } from '../src/tools/list-models.js'
import type { MeigenClient } from '../src/lib/meigen-api.js'

function fakeClient(over: Partial<MeigenClient>): MeigenClient {
  return {
    submitGeneration: async () => ({ success: true, generationId: 'g', status: 'processing' }),
    getStatus: async () => ({ jobId: 'g', status: 'completed', imageUrl: null, imageUrls: null, videoUrl: null, mediaType: 'image', error: null, aspectRatio: null }),
    pollGeneration: async () => ({ jobId: 'g', status: 'completed', imageUrl: null, imageUrls: null, videoUrl: null, mediaType: 'image', error: null, aspectRatio: null }),
    generate: async () => ({ submit: { success: true, generationId: 'g', status: 'processing' }, result: { jobId: 'g', status: 'completed', imageUrl: null, imageUrls: null, videoUrl: null, mediaType: 'image', error: null, aspectRatio: null } }),
    listModels: async () => ({}),
    isVideoModel: () => false,
    ...over,
  }
}

test('generate_media returns the completed image url + credits', async () => {
  const client = fakeClient({
    generate: async () => ({
      submit: { success: true, generationId: 'g', status: 'processing', creditsUsed: 10, modelId: 'gpt-image-2' },
      result: { jobId: 'g', status: 'completed', imageUrl: 'https://images.meigen.art/x.png', imageUrls: ['https://images.meigen.art/x.png'], videoUrl: null, mediaType: 'image', error: null, aspectRatio: '1:1' },
    }),
  })
  const r = await buildGenerateMediaResult({ prompt: 'a cat' }, client)
  assert.ok(!r.isError)
  assert.match(r.content[0].text, /https:\/\/images\.meigen\.art\/x\.png/)
  assert.match(r.content[0].text, /Credits used: 10/)
})

test('generate_media returns a video url for video results', async () => {
  const client = fakeClient({
    generate: async () => ({
      submit: { success: true, generationId: 'g', status: 'processing', modelId: 'veo-3.1' },
      result: { jobId: 'g', status: 'completed', imageUrl: null, imageUrls: null, videoUrl: 'https://images.meigen.art/x.mp4', mediaType: 'video', error: null, aspectRatio: '16:9' },
    }),
  })
  const r = await buildGenerateMediaResult({ prompt: 'an eagle', modelId: 'veo-3.1', duration: 4 }, client)
  assert.ok(!r.isError)
  assert.match(r.content[0].text, /x\.mp4/)
})

test('generate_media surfaces a failed generation as an error result', async () => {
  const client = fakeClient({
    generate: async () => ({
      submit: { success: true, generationId: 'g', status: 'processing' },
      result: { jobId: 'g', status: 'failed', imageUrl: null, imageUrls: null, videoUrl: null, mediaType: 'image', error: 'Content policy violation', aspectRatio: null },
    }),
  })
  const r = await buildGenerateMediaResult({ prompt: 'x' }, client)
  assert.equal(r.isError, true)
  assert.match(r.content[0].text, /Content policy violation/)
  assert.match(r.content[0].text, /refunded/)
})

test('generate_media catches client/network errors', async () => {
  const client = fakeClient({ generate: async () => { throw new Error('boom') } })
  const r = await buildGenerateMediaResult({ prompt: 'x' }, client)
  assert.equal(r.isError, true)
  assert.match(r.content[0].text, /boom/)
})

test('list_models returns the model list as JSON text', async () => {
  const client = fakeClient({ listModels: async () => ({ models: [{ id: 'gpt-image-2' }] }) })
  const r = await buildListModelsResult(client)
  assert.ok(!r.isError)
  assert.match(r.content[0].text, /gpt-image-2/)
})
