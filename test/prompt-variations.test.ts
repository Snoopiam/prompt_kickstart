import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVariationsResult } from '../src/tools/prompt-variations.js'
import { VARIATIONS_PROMPT } from '../src/lib/prompts.js'

test('VARIATIONS_PROMPT is intact with role + numbered-list protocol', () => {
  assert.ok(VARIATIONS_PROMPT.length > 200)
  assert.ok(VARIATIONS_PROMPT.includes('# Role'))
  assert.ok(VARIATIONS_PROMPT.includes('Prompt Variation Generator'))
  assert.ok(/CORE SUBJECT/.test(VARIATIONS_PROMPT))
  assert.ok(/numbered list/i.test(VARIATIONS_PROMPT))
})

test('embeds the prompt and the variations system prompt', () => {
  const r = buildVariationsResult({ prompt: 'a cat in a garden' })
  assert.equal(r.content.length, 1)
  assert.ok(r.content[0].text.includes('a cat in a garden'))
  assert.ok(r.content[0].text.includes(VARIATIONS_PROMPT))
})

test('defaults to 3 variations', () => {
  const r = buildVariationsResult({ prompt: 'a fox' })
  assert.ok(/create 3 distinct variations/.test(r.content[0].text))
  assert.ok(/exactly 3 variation/.test(r.content[0].text))
})

test('threads a custom count', () => {
  const r = buildVariationsResult({ prompt: 'a fox', count: 5 })
  assert.ok(/create 5 distinct variations/.test(r.content[0].text))
  assert.ok(/exactly 5 variation/.test(r.content[0].text))
})
