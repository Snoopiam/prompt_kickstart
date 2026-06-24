import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEnhanceResult } from '../src/tools/enhance-prompt.js'
import { REALISTIC_SYSTEM_PROMPT, ANIME_SYSTEM_PROMPT, ILLUSTRATION_SYSTEM_PROMPT } from '../src/lib/prompts.js'

test('embeds the user prompt and the realistic system prompt by default', () => {
  const r = buildEnhanceResult({ prompt: 'a cat in a garden' })
  assert.equal(r.content.length, 1)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].text.includes('a cat in a garden'))
  assert.ok(r.content[0].text.includes(REALISTIC_SYSTEM_PROMPT))
})

test('selects the anime system prompt when style=anime', () => {
  const r = buildEnhanceResult({ prompt: 'a cat', style: 'anime' })
  assert.ok(r.content[0].text.includes(ANIME_SYSTEM_PROMPT))
  assert.ok(!r.content[0].text.includes(REALISTIC_SYSTEM_PROMPT))
})

test('selects the illustration system prompt when style=illustration', () => {
  const r = buildEnhanceResult({ prompt: 'a cat', style: 'illustration' })
  assert.ok(r.content[0].text.includes(ILLUSTRATION_SYSTEM_PROMPT))
})

test('undefined style falls back to realistic', () => {
  const r = buildEnhanceResult({ prompt: 'a cat', style: undefined })
  assert.ok(r.content[0].text.includes(REALISTIC_SYSTEM_PROMPT))
})

test('the prompt is wrapped so the host LLM knows what to do with it', () => {
  const r = buildEnhanceResult({ prompt: 'sunset' })
  const text = r.content[0].text
  assert.ok(text.includes('enhance'), 'should instruct the host to enhance')
  assert.ok(text.includes('"sunset"'), 'should quote the user prompt')
})
