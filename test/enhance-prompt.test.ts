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
