import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTemplatizeResult } from '../src/tools/templatize-prompt.js'
import { TEMPLATIZE_PROMPT } from '../src/lib/prompts.js'

test('TEMPLATIZE_PROMPT is intact with role + tag examples', () => {
  assert.ok(TEMPLATIZE_PROMPT.length > 200)
  assert.ok(TEMPLATIZE_PROMPT.includes('# Role'))
  assert.ok(TEMPLATIZE_PROMPT.includes('Prompt Templatizer'))
  assert.ok(/\[subject\]/.test(TEMPLATIZE_PROMPT))
  assert.ok(/\[color palette\]/.test(TEMPLATIZE_PROMPT))
  assert.ok(/Variables:/.test(TEMPLATIZE_PROMPT))
})

test('embeds the prompt and the templatize system prompt', () => {
  const r = buildTemplatizeResult({ prompt: 'a red sports car on a coastal road at sunset' })
  assert.equal(r.content.length, 1)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].text.includes('a red sports car on a coastal road at sunset'))
  assert.ok(r.content[0].text.includes(TEMPLATIZE_PROMPT))
})
