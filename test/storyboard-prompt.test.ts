import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStoryboardResult } from '../src/tools/storyboard-prompt.js'
import { STORYBOARD_PROMPT } from '../src/lib/prompts.js'

test('STORYBOARD_PROMPT is intact and carries its role + markers', () => {
  assert.ok(STORYBOARD_PROMPT.length > 200, 'storyboard prompt looks truncated')
  assert.ok(STORYBOARD_PROMPT.includes('# Role'))
  assert.ok(STORYBOARD_PROMPT.includes('Video Storyboard Director'))
  // the two-part structure and the no-gap timeline rule must survive edits
  assert.ok(/Overview paragraph/i.test(STORYBOARD_PROMPT))
  assert.ok(/Shot-by-shot timeline/i.test(STORYBOARD_PROMPT))
  assert.ok(/no gaps/i.test(STORYBOARD_PROMPT))
  // must preserve the input language, not translate
  assert.ok(/SAME language/i.test(STORYBOARD_PROMPT))
})

test('embeds the idea and the storyboard system prompt', () => {
  const r = buildStoryboardResult({ idea: 'a barista making latte art' })
  assert.equal(r.content.length, 1)
  assert.equal(r.content[0].type, 'text')
  assert.ok(r.content[0].text.includes('a barista making latte art'))
  assert.ok(r.content[0].text.includes(STORYBOARD_PROMPT))
})

test('defaults to an 8 second target when no duration is supplied', () => {
  const r = buildStoryboardResult({ idea: 'sunrise over a city' })
  assert.ok(/0s to 8s/.test(r.content[0].text))
  assert.ok(/8 seconds/.test(r.content[0].text))
})

test('threads a custom duration into the instruction', () => {
  const r = buildStoryboardResult({ idea: 'a rocket launch', durationSeconds: 15 })
  assert.ok(/0s to 15s/.test(r.content[0].text))
  assert.ok(/15 seconds/.test(r.content[0].text))
})
