import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTranslateResult } from '../src/tools/translate-prompt.js'
import { TRANSLATE_PROMPT } from '../src/lib/prompts.js'

test('TRANSLATE_PROMPT is intact with role + token-preservation rule', () => {
  assert.ok(TRANSLATE_PROMPT.length > 200)
  assert.ok(TRANSLATE_PROMPT.includes('# Role'))
  assert.ok(TRANSLATE_PROMPT.includes('Image-Prompt Translator'))
  assert.ok(/\[subject\]/.test(TRANSLATE_PROMPT))   // preserves bracketed tags
  assert.ok(/already in the target language/i.test(TRANSLATE_PROMPT))
})

test('embeds the prompt and the translate system prompt', () => {
  const r = buildTranslateResult({ prompt: 'un gato en un jardín' })
  assert.equal(r.content.length, 1)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].text.includes('un gato en un jardín'))
  assert.ok(r.content[0].text.includes(TRANSLATE_PROMPT))
})

test('defaults the target language to English', () => {
  const r = buildTranslateResult({ prompt: 'un chat' })
  assert.ok(/into "en"/.test(r.content[0].text))
})

test('threads a custom target language', () => {
  const r = buildTranslateResult({ prompt: 'a cat', targetLang: 'ja' })
  assert.ok(/into "ja"/.test(r.content[0].text))
  assert.ok(/already in ja/.test(r.content[0].text))
})
