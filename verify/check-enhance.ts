import { buildEnhanceResult } from '../src/tools/enhance-prompt.js'

const r = buildEnhanceResult({ prompt: 'a cat in a garden', style: 'anime' })
const text = r.content[0].text
const hasUserPrompt = text.includes('a cat in a garden')
const hasSystemPrompt = text.includes('Anime Prompt Director') // from ANIME_SYSTEM_PROMPT
const oneBlock = r.content.length === 1 && r.content[0].type === 'text'

console.log('hasUserPrompt:', hasUserPrompt)
console.log('hasSystemPrompt:', hasSystemPrompt)
console.log('singleTextBlock:', oneBlock)
const pass = hasUserPrompt && hasSystemPrompt && oneBlock
console.log(pass ? 'PASS' : 'FAIL')
if (!pass) process.exit(1)
