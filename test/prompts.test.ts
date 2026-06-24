import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getEnhanceSystemPrompt,
  DESCRIBE_IMAGE_PROMPT,
  POLISH_SYSTEM_PROMPT,
  EXPAND_SYSTEM_PROMPT,
  type EnhanceMode,
} from '../src/lib/prompts.js'

// Integrity: the prompt bodies must be non-empty, well above a sane minimum,
// each carrying its own distinctive marker so they can never collapse together.
const CASES: Array<{ name: string; body: string; marker: string }> = [
  { name: 'describe', body: DESCRIBE_IMAGE_PROMPT, marker: 'Subject & scene composition' },
  { name: 'polish', body: POLISH_SYSTEM_PROMPT, marker: 'Senior Visual Logic Analyst' },
  { name: 'expand', body: EXPAND_SYSTEM_PROMPT, marker: 'Midjourney Prompt Director' },
]

for (const { name, body, marker } of CASES) {
  test(`${name} prompt is intact and non-truncated`, () => {
    assert.ok(body.length > 200, `${name} prompt looks truncated (len=${body.length})`)
    assert.ok(body.includes(marker), `${name} prompt missing its marker "${marker}"`)
    assert.ok(body.includes('# Role'), `${name} prompt missing its "# Role" header`)
  })
}

test('the three prompts are distinct from one another', () => {
  const bodies = new Set([DESCRIBE_IMAGE_PROMPT, POLISH_SYSTEM_PROMPT, EXPAND_SYSTEM_PROMPT])
  assert.equal(bodies.size, 3)
})

test('DESCRIBE_IMAGE_PROMPT covers all four documented dimensions', () => {
  assert.ok(DESCRIBE_IMAGE_PROMPT.includes('Subject & scene composition'))
  assert.ok(DESCRIBE_IMAGE_PROMPT.includes('Art style & technique'))
  assert.ok(DESCRIBE_IMAGE_PROMPT.includes('Lighting, color palette & mood'))
  assert.ok(DESCRIBE_IMAGE_PROMPT.includes('Camera angle & perspective'))
  // style must be inferred, not selected
  assert.ok(/infer/i.test(DESCRIBE_IMAGE_PROMPT))
})

test('getEnhanceSystemPrompt maps modes to the right body', () => {
  assert.equal(getEnhanceSystemPrompt('polish'), POLISH_SYSTEM_PROMPT)
  assert.equal(getEnhanceSystemPrompt('expand'), EXPAND_SYSTEM_PROMPT)
})

test('getEnhanceSystemPrompt falls back to polish for an unknown mode', () => {
  assert.equal(getEnhanceSystemPrompt('nonsense' as EnhanceMode), POLISH_SYSTEM_PROMPT)
})

test('expand prompt forbids aspect-ratio flags and handles translation', () => {
  assert.ok(EXPAND_SYSTEM_PROMPT.includes('--ar'))          // mentioned as forbidden
  assert.ok(/translate/i.test(EXPAND_SYSTEM_PROMPT))
})

// ---- Tier 2: model presets ----
import { getModelPreset } from '../src/lib/prompts.js'

test('getModelPreset resolves known model aliases to canonical ids', () => {
  assert.equal(getModelPreset('midjourney')?.id, 'midjourney-v8.1')
  assert.equal(getModelPreset('gpt image 2')?.id, 'gpt-image-2')
  assert.equal(getModelPreset('nano banana 2')?.id, 'nanobanana-2')
  assert.equal(getModelPreset('nanobanana pro')?.id, 'gemini-3-pro-image-preview')
  assert.equal(getModelPreset('seedream 4.5')?.id, 'seedream-4.5')
  assert.equal(getModelPreset('seedream 5.0 lite')?.id, 'seedream-5.0-lite')
  assert.equal(getModelPreset('flux 2 klein')?.id, 'flux2-klein')
  assert.equal(getModelPreset('z-image-turbo')?.id, 'z-image-turbo')
})

test('getModelPreset returns null for unknown or missing models', () => {
  assert.equal(getModelPreset('no-such-model'), null)
  assert.equal(getModelPreset(undefined), null)
})

test('pro Gemini wins over generic nanobanana match (ordering)', () => {
  assert.equal(getModelPreset('nanobananapro')?.id, 'gemini-3-pro-image-preview')
  assert.equal(getModelPreset('nanobanana2')?.id, 'nanobanana-2')
})
