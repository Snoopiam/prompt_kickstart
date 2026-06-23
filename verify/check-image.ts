import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { loadImageContent } from '../src/lib/image.js'

await mkdir('verify/tmp', { recursive: true })
const small = 'verify/tmp/small.png'
const large = 'verify/tmp/large.png'
await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toFile(small)
await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 0, g: 0, b: 255 } } }).png().toFile(large)

const s = await loadImageContent({ imagePath: small })
const l = await loadImageContent({ imagePath: large })
const none = await loadImageContent({})

const sMeta = await sharp(Buffer.from(s!.data, 'base64')).metadata()
const lMeta = await sharp(Buffer.from(l!.data, 'base64')).metadata()

console.log('small ->', sMeta.width, 'x', sMeta.height, s!.mimeType)   // expect 200 x 200 image/png
console.log('large ->', lMeta.width, 'x', lMeta.height, l!.mimeType)   // expect 1568 x 1045 image/png
console.log('none  ->', none)                                          // expect null

const pass =
  sMeta.width === 200 && sMeta.height === 200 &&
  Math.max(lMeta.width!, lMeta.height!) === 1568 && lMeta.width === 1568 &&
  none === null
console.log(pass ? 'PASS' : 'FAIL')
