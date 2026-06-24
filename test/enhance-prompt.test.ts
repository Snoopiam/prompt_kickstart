import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEnhanceResult } from '../src/tools/enhance-prompt.js'
import { POLISH_SYSTEM_PROMPT, EXPAND_SYSTEM_PROMPT } from '../src/lib/prompts.js'

test('embeds the user prompt and the polish system prompt by default', () => {
  const r = buildEnhanceResult({ prompt: 'a cat in a garden' })
  assert.equal(r.content.length, 1)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].text.includes('a cat in a garden'))
  assert.ok(r.content[0].text.includes(POLISH_SYSTEM_PROMPT))
})

test('selects the expand system prompt when mode=expand', () => {
  const r = buildEnhanceResult({ prompt: 'a cat', mode: 'expand' })
  assert.ok(r.content[0].text.includes(EXPAND_SYSTEM_PROMPT))
  assert.ok(!r.content[0].text.includes(POLISH_SYSTEM_PROMPT))
})

test('undefined mode falls back to polish', () => {
  const r = buildEnhanceResult({ prompt: 'a cat', mode: undefined })
  assert.ok(r.content[0].text.includes(POLISH_SYSTEM_PROMPT))
})

test('includes the brief-prompt (< ~30 words) guidance from the live tool', () => {
  const r = buildEnhanceResult({ prompt: 'sunset' })
  assert.ok(/30 words/.test(r.content[0].text))
})

test('threads an optional model hint into the instruction', () => {
  const r = buildEnhanceResult({ prompt: 'a fox', mode: 'expand', model: 'midjourney' })
  assert.ok(r.content[0].text.includes('midjourney'))
})

test('omits the model line when no model is supplied', () => {
  const r = buildEnhanceResult({ prompt: 'a fox' })
  assert.ok(!r.content[0].text.includes('Target model:'))
})

// ---- Tier 2: model-aware presets + extra options ----

test('a known model hint injects model-aware guidance and length cap', () => {
  const r = buildEnhanceResult({ prompt: 'a fox', model: 'seedream 5.0 lite' })
  const t = r.content[0].text
  assert.ok(t.includes('Target model: seedream 5.0 lite'))
  assert.ok(t.includes('Seedream 5.0 Lite'))
  assert.ok(/2,?000 characters/.test(t))
})

test('an unknown model still appears but adds no preset guidance', () => {
  const r = buildEnhanceResult({ prompt: 'a fox', model: 'totally-made-up-model' })
  const t = r.content[0].text
  assert.ok(t.includes('Target model: totally-made-up-model'))
  assert.ok(!t.includes('Model-aware guidance'))
})

test('includeNegativePrompt adds a negative-prompt instruction', () => {
  const r = buildEnhanceResult({ prompt: 'a fox', includeNegativePrompt: true })
  assert.ok(/Negative prompt \(avoid\):/.test(r.content[0].text))
})

test('no negative-prompt instruction by default', () => {
  const r = buildEnhanceResult({ prompt: 'a fox' })
  assert.ok(!/Negative prompt \(avoid\):/.test(r.content[0].text))
})

test('colors are normalized to hex and embedded', () => {
  const r = buildEnhanceResult({ prompt: 'a shirt', colors: ['#dc143c', 'f5f5dc'] })
  const t = r.content[0].text
  assert.ok(t.includes('#dc143c'))
  assert.ok(t.includes('#f5f5dc'))   // normalized to add the leading #
})

test('references are rendered as @mentions', () => {
  const r = buildEnhanceResult({ prompt: 'a scene', references: ['image1', '@image2'] })
  const t = r.content[0].text
  assert.ok(t.includes('@image1'))
  assert.ok(t.includes('@image2'))
})

test('Tier 2 options are all absent from a plain default call', () => {
  const r = buildEnhanceResult({ prompt: 'a fox' })
  const t = r.content[0].text
  assert.ok(!t.includes('Target model:'))
  assert.ok(!t.includes('Incorporate these exact colors'))
  assert.ok(!t.includes('reference images available'))
})
