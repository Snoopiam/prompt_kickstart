import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { buildImageToPromptResult } from '../src/tools/image-to-prompt.js'

await mkdir('verify/tmp', { recursive: true })
const small = 'verify/tmp/small.png'
await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toFile(small)

// Case A: with a local image -> image block + text block
const withImg = await buildImageToPromptResult({ imagePath: small, style: 'realistic' })
const types = withImg.content.map(c => c.type).join(',')
const hasReverseEng = withImg.content.some(c => c.type === 'text' && c.text.includes('reverse-engineer'))
console.log('withImage types:', types, '| hasReverseEng:', hasReverseEng)   // expect image,text

// Case B: no source -> single text block telling host to analyze the pasted image
const noImg = await buildImageToPromptResult({})
const noImgOk = noImg.content.length === 1 && noImg.content[0].type === 'text' &&
  noImg.content[0].text.includes('shared in this conversation')
console.log('noSource ok:', noImgOk)

// Case C: bad path -> isError
const bad = await buildImageToPromptResult({ imagePath: 'verify/tmp/does-not-exist.png' })
const badOk = bad.isError === true
console.log('badPath isError:', badOk)

const pass = types === 'image,text' && hasReverseEng && noImgOk && badOk
console.log(pass ? 'PASS' : 'FAIL')
if (!pass) process.exit(1)
