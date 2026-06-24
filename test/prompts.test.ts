import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getSystemPrompt,
  REALISTIC_SYSTEM_PROMPT,
  ANIME_SYSTEM_PROMPT,
  ILLUSTRATION_SYSTEM_PROMPT,
  type PromptStyle,
} from '../src/lib/prompts.js'

// Copy-paste integrity: the three system prompts must have survived the copy
// intact — non-empty, well above a sane minimum length, and each carrying its
// own distinctive marker so they can never silently collapse into one another.
const CASES: Array<{ style: PromptStyle; body: string; marker: string }> = [
  { style: 'realistic', body: REALISTIC_SYSTEM_PROMPT, marker: 'Senior Visual Logic Analyst' },
  { style: 'anime', body: ANIME_SYSTEM_PROMPT, marker: 'Anime Prompt Director' },
  { style: 'illustration', body: ILLUSTRATION_SYSTEM_PROMPT, marker: 'Senior Illustration Prompt Engineer' },
]

for (const { style, body, marker } of CASES) {
  test(`${style} prompt is intact and non-truncated`, () => {
    assert.ok(body.length > 300, `${style} prompt looks truncated (len=${body.length})`)
    assert.ok(body.includes(marker), `${style} prompt missing its marker "${marker}"`)
    assert.ok(body.includes('# Role'), `${style} prompt missing its "# Role" header`)
  })

  test(`getSystemPrompt('${style}') returns the matching body`, () => {
    assert.equal(getSystemPrompt(style), body)
  })
}

test('the three prompts are distinct from one another', () => {
  const bodies = new Set([REALISTIC_SYSTEM_PROMPT, ANIME_SYSTEM_PROMPT, ILLUSTRATION_SYSTEM_PROMPT])
  assert.equal(bodies.size, 3)
})

test('getSystemPrompt falls back to realistic for an unknown style', () => {
  // Defensive: exercises the default branch even if an out-of-enum value slips through.
  assert.equal(getSystemPrompt('nonsense' as PromptStyle), REALISTIC_SYSTEM_PROMPT)
})
