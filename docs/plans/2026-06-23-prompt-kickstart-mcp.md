# prompt-kickstart-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone stdio MCP server exposing two free, host-LLM-vision tools — `image_to_prompt` and `enhance_prompt` — that reproduce the meigen.ai Generate-page workflow.

**Architecture:** A minimal copy of a small slice of `MeiGen-AI-Design-MCP`. Both tools delegate the actual AI work to the host LLM (no vision/text API, no key, no credits): each returns a system prompt + instructions, and for images, an MCP image content block the host can see. `image_to_prompt` auto-downscales oversized images via `sharp` so the host reads them optimally.

**Tech Stack:** TypeScript (ESM/NodeNext), `@modelcontextprotocol/sdk` ^1.12, `zod` ^3.25, `sharp` ^0.34.5, `tsx` for dev/verify. Node ≥18.

## Global Constraints

- Node `>=18.0.0`; package is ESM (`"type": "module"`); imports use `.js` extensions (NodeNext).
- **Never modify** `C:\SnoopLABS\GitHUB Cloned Apps\MeiGen-AI-Design-MCP`. All work lands in the sibling folder `C:\SnoopLABS\GitHUB Cloned Apps\prompt-kickstart-mcp`.
- Exactly **two tools**: `image_to_prompt`, `enhance_prompt`. No gallery/search/models/generate/video/ComfyUI/config/API-client code.
- Tools are **free / host-LLM vision** — no API key, no network except optional `imageUrl` fetch.
- Resize policy: downscale only when the longest edge `> 1568`px; preserve aspect ratio; **never upscale**.
- Style enum everywhere: `'realistic' | 'anime' | 'illustration'`, default `'realistic'`.
- No automated test framework in v1 (per approved spec). Verification = runnable `tsx` scripts under `verify/` that print `PASS`/`FAIL`, plus a build/start smoke check.
- Work from repo root `C:\SnoopLABS\GitHUB Cloned Apps\prompt-kickstart-mcp` for all commands.

---

### Task 1: Project scaffolding + buildable empty server

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `bin/prompt-kickstart-mcp.js`
- Create: `src/index.ts`
- Create: `src/server.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createServer(): McpServer` from `src/server.ts`; a runnable stdio entry at `src/index.ts` / `bin/prompt-kickstart-mcp.js`. Tool registration functions are imported here in later tasks.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "prompt-kickstart-mcp",
  "version": "1.0.0",
  "description": "Standalone MCP server: image_to_prompt + enhance_prompt (free, host-LLM vision)",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "prompt-kickstart-mcp": "bin/prompt-kickstart-mcp.js"
  },
  "files": ["bin/", "dist/"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "sharp": "^0.34.5",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
dist/
verify/tmp/
```

- [ ] **Step 4: Create `bin/prompt-kickstart-mcp.js`**

```js
#!/usr/bin/env node
import '../dist/index.js'
```

- [ ] **Step 5: Create `src/server.ts`** (no tools registered yet — tools added in later tasks)

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const SERVER_INSTRUCTIONS = `prompt-kickstart-mcp — two free tools that reproduce the meigen.ai Generate workflow.

- image_to_prompt: turn an image (local path, URL, or one already shared in chat) into a generation-ready "kickstart" prompt.
- enhance_prompt: expand a brief text prompt into a detailed, style-aware prompt.

Both are free and require no API key: you (the host LLM) perform the vision and writing. Typical flow: image_to_prompt -> enhance_prompt -> copy into any image generator.`

export function createServer() {
  const server = new McpServer(
    { name: 'prompt-kickstart-mcp', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )
  // Tools are registered in later tasks:
  //   registerEnhancePrompt(server)
  //   registerImageToPrompt(server)
  return server
}
```

- [ ] **Step 6: Create `src/index.ts`**

```ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server.js'

async function main() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('prompt-kickstart-mcp running on stdio')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 7: Install deps and build**

Run: `npm install`
Then: `npm run build`
Expected: install completes (sharp downloads a prebuilt Windows binary); `tsc` exits 0; `dist/index.js`, `dist/server.js` exist.

- [ ] **Step 8: Smoke-test that the server starts**

Run: `node bin/prompt-kickstart-mcp.js`
Expected: prints `prompt-kickstart-mcp running on stdio` to stderr and waits (stdio server). Stop with Ctrl-C.

- [ ] **Step 9: Init git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold prompt-kickstart-mcp (buildable empty stdio server)"
```

---

### Task 2: Copy the shared prompt library

**Files:**
- Create: `src/lib/prompts.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `REALISTIC_SYSTEM_PROMPT`, `ANIME_SYSTEM_PROMPT`, `ILLUSTRATION_SYSTEM_PROMPT` (strings); `type PromptStyle = 'realistic' | 'anime' | 'illustration'`; `getSystemPrompt(style: PromptStyle): string`.

- [ ] **Step 1: Copy the file verbatim**

Copy `C:\SnoopLABS\GitHUB Cloned Apps\MeiGen-AI-Design-MCP\src\lib\prompts.ts` byte-for-byte to `src/lib/prompts.ts`. Do not edit its contents. It must end with exactly these exports:

```ts
export type PromptStyle = 'realistic' | 'anime' | 'illustration'

export function getSystemPrompt(style: PromptStyle): string {
  switch (style) {
    case 'anime':
      return ANIME_SYSTEM_PROMPT
    case 'illustration':
      return ILLUSTRATION_SYSTEM_PROMPT
    case 'realistic':
    default:
      return REALISTIC_SYSTEM_PROMPT
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 (no errors).

- [ ] **Step 3: Verify exports resolve**

Run: `npx tsx -e "import('./src/lib/prompts.ts').then(m => console.log(typeof m.getSystemPrompt, m.getSystemPrompt('anime').slice(0,12)))"`
Expected: prints `function` and the start of the anime prompt (`# Role`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: add shared prompt library (copied from MeiGen)"
```

---

### Task 3: `enhance_prompt` tool

**Files:**
- Create: `src/tools/enhance-prompt.ts`
- Create: `verify/check-enhance.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `getSystemPrompt`, `PromptStyle` from `../lib/prompts.js`.
- Produces: `buildEnhanceResult(args: { prompt: string; style?: PromptStyle }): { content: { type: 'text'; text: string }[] }`; `registerEnhancePrompt(server: McpServer): void`.

- [ ] **Step 1: Create `src/tools/enhance-prompt.ts`**

```ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSystemPrompt, type PromptStyle } from '../lib/prompts.js'

export const enhancePromptSchema = {
  prompt: z.string().describe('The simple prompt to enhance (e.g., "a cat in a garden")'),
  style: z.enum(['realistic', 'anime', 'illustration']).optional().default('realistic')
    .describe('Target visual style: realistic (photorealistic), anime (2D/Japanese), illustration (concept art).'),
}

export function buildEnhanceResult(args: { prompt: string; style?: PromptStyle }) {
  const style: PromptStyle = args.style ?? 'realistic'
  const systemPrompt = getSystemPrompt(style)
  return {
    content: [{
      type: 'text' as const,
      text: `Please enhance the following prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nUser's prompt to enhance:\n"${args.prompt}"\n\nGenerate the enhanced prompt now. Then show it to the user and ask if they'd like to generate an image with it.`,
    }],
  }
}

export function registerEnhancePrompt(server: McpServer) {
  server.tool(
    'enhance_prompt',
    'Transform a simple idea into a professional image generation prompt. Use when the user provides a brief description and needs a detailed, high-quality prompt. Free, no API key needed.',
    enhancePromptSchema,
    { readOnlyHint: true },
    async ({ prompt, style }) => buildEnhanceResult({ prompt, style: style as PromptStyle }),
  )
}
```

- [ ] **Step 2: Wire it into `src/server.ts`**

Add the import at the top:

```ts
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
```

Replace the registration comment block with:

```ts
  registerEnhancePrompt(server)
  // registerImageToPrompt(server)  // added in Task 5
```

- [ ] **Step 3: Create `verify/check-enhance.ts`**

```ts
import { buildEnhanceResult } from '../src/tools/enhance-prompt.js'

const r = buildEnhanceResult({ prompt: 'a cat in a garden', style: 'anime' })
const text = r.content[0].text
const hasUserPrompt = text.includes('a cat in a garden')
const hasSystemPrompt = text.includes('Anime Prompt Director') // from ANIME_SYSTEM_PROMPT
const oneBlock = r.content.length === 1 && r.content[0].type === 'text'

console.log('hasUserPrompt:', hasUserPrompt)
console.log('hasSystemPrompt:', hasSystemPrompt)
console.log('singleTextBlock:', oneBlock)
console.log(hasUserPrompt && hasSystemPrompt && oneBlock ? 'PASS' : 'FAIL')
```

- [ ] **Step 4: Run the verification**

Run: `npx tsx verify/check-enhance.ts`
Expected: three `true` lines then `PASS`.

- [ ] **Step 5: Build to confirm wiring compiles**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/tools/enhance-prompt.ts src/server.ts verify/check-enhance.ts
git commit -m "feat: add enhance_prompt tool"
```

---

### Task 4: Image load/resize helper

**Files:**
- Create: `src/lib/image.ts`
- Create: `verify/check-image.ts`

**Interfaces:**
- Consumes: `sharp`, `node:fs/promises`, `node:path`.
- Produces: `interface ImageContent { data: string; mimeType: string }`; `loadImageContent(opts: { imagePath?: string; imageUrl?: string }): Promise<ImageContent | null>` — returns base64 (no `data:` prefix) + mime; downscales when longest edge > 1568; returns `null` when neither input given; throws on read/fetch failure.

- [ ] **Step 1: Create `src/lib/image.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import sharp from 'sharp'

const MAX_EDGE = 1568

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export interface ImageContent {
  data: string      // base64, no data: prefix
  mimeType: string
}

function mimeFromExt(path: string): string {
  return MIME_BY_EXT[extname(path).toLowerCase()] ?? 'image/png'
}

function mimeFromFormat(format: string | undefined, fallback: string): string {
  if (!format) return fallback
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg'
  return `image/${format}`
}

/** Downscale if the longest edge exceeds MAX_EDGE; never upscale. */
async function maybeResize(input: Buffer, fallbackMime: string): Promise<ImageContent> {
  const img = sharp(input)
  const meta = await img.metadata()
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0)
  const mimeType = mimeFromFormat(meta.format, fallbackMime)

  if (longest > MAX_EDGE) {
    const resized = await img
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    return { data: resized.toString('base64'), mimeType }
  }
  return { data: input.toString('base64'), mimeType }
}

export async function loadImageContent(
  opts: { imagePath?: string; imageUrl?: string },
): Promise<ImageContent | null> {
  if (opts.imagePath) {
    const buf = await readFile(opts.imagePath)
    return maybeResize(buf, mimeFromExt(opts.imagePath))
  }
  if (opts.imageUrl) {
    const res = await fetch(opts.imageUrl)
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`)
    }
    const contentType = (res.headers.get('content-type') ?? 'image/png').split(';')[0].trim()
    const buf = Buffer.from(await res.arrayBuffer())
    return maybeResize(buf, contentType)
  }
  return null
}
```

- [ ] **Step 2: Create `verify/check-image.ts`** (generates its own fixtures via sharp — no binary files needed)

```ts
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
```

- [ ] **Step 3: Run the verification**

Run: `npx tsx verify/check-image.ts`
Expected: small stays `200 x 200`; large becomes `1568 x 1045` (aspect preserved, never upscaled); none is `null`; final line `PASS`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image.ts verify/check-image.ts
git commit -m "feat: add image load + auto-downscale helper"
```

---

### Task 5: `image_to_prompt` tool

**Files:**
- Create: `src/tools/image-to-prompt.ts`
- Create: `verify/check-image-to-prompt.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `getSystemPrompt`, `PromptStyle` from `../lib/prompts.js`; `loadImageContent` from `../lib/image.js`.
- Produces: `buildImageToPromptResult(args: { imagePath?: string; imageUrl?: string; style?: PromptStyle }): Promise<{ content: Array<{type:'text';text:string} | {type:'image';data:string;mimeType:string}>; isError?: boolean }>`; `registerImageToPrompt(server: McpServer): void`.

- [ ] **Step 1: Create `src/tools/image-to-prompt.ts`**

```ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSystemPrompt, type PromptStyle } from '../lib/prompts.js'
import { loadImageContent } from '../lib/image.js'

export const imageToPromptSchema = {
  imagePath: z.string().optional()
    .describe('Local file path to the image to analyze.'),
  imageUrl: z.string().optional()
    .describe('Public remote URL of the image to analyze.'),
  style: z.enum(['realistic', 'anime', 'illustration']).optional().default('realistic')
    .describe('Target visual style for the resulting kickstart prompt.'),
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

export async function buildImageToPromptResult(
  args: { imagePath?: string; imageUrl?: string; style?: PromptStyle },
): Promise<{ content: ContentBlock[]; isError?: boolean }> {
  const style: PromptStyle = args.style ?? 'realistic'
  const systemPrompt = getSystemPrompt(style)

  let image
  try {
    image = await loadImageContent({ imagePath: args.imagePath, imageUrl: args.imageUrl })
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Could not load the image: ${(err as Error).message}` }],
      isError: true,
    }
  }

  if (image) {
    return {
      content: [
        { type: 'image', data: image.data, mimeType: image.mimeType },
        {
          type: 'text',
          text: `Analyze the image above and reverse-engineer a generation-ready "kickstart" prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nOutput the kickstart prompt now. Then ask the user whether they'd like to refine it with enhance_prompt or use it to generate an image.`,
        },
      ],
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Analyze the image the user shared in this conversation and reverse-engineer a generation-ready "kickstart" prompt using these guidelines:\n\n---\n${systemPrompt}\n---\n\nIf no image was shared, ask the user to paste one or pass imagePath/imageUrl. Otherwise output the kickstart prompt now, then offer to refine it with enhance_prompt or generate an image from it.`,
    }],
  }
}

export function registerImageToPrompt(server: McpServer) {
  server.tool(
    'image_to_prompt',
    'Turn an image into a generation-ready "kickstart" prompt. Accepts a local imagePath, a public imageUrl, or (if neither) the image already shared in the conversation. Free, no API key needed.',
    imageToPromptSchema,
    { readOnlyHint: true },
    async ({ imagePath, imageUrl, style }) =>
      buildImageToPromptResult({ imagePath, imageUrl, style: style as PromptStyle }),
  )
}
```

- [ ] **Step 2: Wire it into `src/server.ts`**

Add the import at the top:

```ts
import { registerImageToPrompt } from './tools/image-to-prompt.js'
```

Replace the placeholder comment line so both tools register:

```ts
  registerEnhancePrompt(server)
  registerImageToPrompt(server)
```

- [ ] **Step 3: Create `verify/check-image-to-prompt.ts`** (depends on `verify/tmp/small.png` from Task 4; it regenerates it to be self-contained)

```ts
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
```

- [ ] **Step 4: Run the verification**

Run: `npx tsx verify/check-image-to-prompt.ts`
Expected: `withImage types: image,text | hasReverseEng: true`, `noSource ok: true`, `badPath isError: true`, final `PASS`.

- [ ] **Step 5: Build (confirms the image content block type satisfies the MCP SDK handler return type)**

Run: `npm run build`
Expected: exits 0. If `tsc` reports the returned `content` union is incompatible with the SDK's `CallToolResult`, the objects are structurally correct — add `as const` is unnecessary; instead cast the handler return: `async (...) => (await buildImageToPromptResult({...})) as { content: ContentBlock[] }` is NOT needed unless tsc errors. Only apply a cast if the build actually fails.

- [ ] **Step 6: Commit**

```bash
git add src/tools/image-to-prompt.ts src/server.ts verify/check-image-to-prompt.ts
git commit -m "feat: add image_to_prompt tool (host-vision, auto-resize)"
```

---

### Task 6: README + MCP client config + end-to-end smoke check

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the built server from Task 1; both tools from Tasks 3 & 5.
- Produces: install/run docs; an MCP client config snippet.

- [ ] **Step 1: Create `README.md`**

````markdown
# prompt-kickstart-mcp

A tiny standalone MCP server that reproduces the meigen.ai "Generate" workflow as
two **free** tools — no API key, no credits. The host LLM (e.g. Claude) does the
vision and writing.

## Tools

- **`image_to_prompt`** — turn an image into a generation-ready "kickstart" prompt.
  Inputs: `imagePath` (local file), `imageUrl` (public URL), or neither (analyzes
  the image already shared in the conversation). Optional `style`:
  `realistic` (default) | `anime` | `illustration`. Oversized images are
  auto-downscaled (longest edge ≤ 1568px) for optimal analysis.
- **`enhance_prompt`** — expand a brief text prompt into a detailed, style-aware
  prompt. Inputs: `prompt`, optional `style`.

Typical flow: `image_to_prompt` → `enhance_prompt` → paste into any image generator.

## Install

```bash
npm install
npm run build
```

## Register with Claude Code

```bash
claude mcp add prompt-kickstart -- node "C:/SnoopLABS/GitHUB Cloned Apps/prompt-kickstart-mcp/bin/prompt-kickstart-mcp.js"
```

Or add to your MCP client config JSON:

```json
{
  "mcpServers": {
    "prompt-kickstart": {
      "command": "node",
      "args": ["C:/SnoopLABS/GitHUB Cloned Apps/prompt-kickstart-mcp/bin/prompt-kickstart-mcp.js"]
    }
  }
}
```

## Develop

```bash
npm run dev        # run from source via tsx
npm run typecheck  # tsc --noEmit
```

This project is an independent copy of two tools from MeiGen-AI-Design-MCP and
does not modify or depend on that project.
````

- [ ] **Step 2: Full build from clean**

Run: `npm run build`
Expected: exits 0; `dist/` contains `index.js`, `server.js`, `lib/prompts.js`, `lib/image.js`, `tools/enhance-prompt.js`, `tools/image-to-prompt.js`.

- [ ] **Step 3: Re-run all verification scripts**

Run: `npx tsx verify/check-enhance.ts && npx tsx verify/check-image.ts && npx tsx verify/check-image-to-prompt.ts`
Expected: each ends with `PASS`.

- [ ] **Step 4: Server start smoke check**

Run: `node bin/prompt-kickstart-mcp.js`
Expected: stderr shows `prompt-kickstart-mcp running on stdio`, process waits. Stop with Ctrl-C. (Optional deeper check: register with Claude Code via Step-1 command and confirm `image_to_prompt` and `enhance_prompt` appear in the tool list.)

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with install + MCP config"
```

---

## Self-Review

**Spec coverage:**
- Standalone stdio MCP server at sibling path → Task 1. ✅
- `image_to_prompt` (new, host-vision, imagePath/imageUrl/none, style) → Task 5. ✅
- `enhance_prompt` (copied verbatim, refactored to build+register) → Task 3. ✅
- Shared `prompts.ts` copied verbatim → Task 2. ✅
- Free / host-LLM delegation (no API key/credits/network beyond optional URL) → Tasks 3 & 5 return instructions + content blocks only. ✅
- Resize policy (downscale >1568, preserve aspect, never upscale, sharp) → Task 4. ✅
- `imageUrl` fetching included → Task 4 `loadImageContent`. ✅
- Dropped MeiGen pieces (API client, gallery/search/models/generate/video/ComfyUI/config) → never created. ✅
- MeiGen repo untouched → all paths under `prompt-kickstart-mcp`. ✅
- No test framework; runnable verify scripts + smoke check → Tasks 3–6. ✅
- README + MCP config → Task 6. ✅

**Placeholder scan:** Every code step shows complete code; verify scripts have explicit expected output; the only conditional ("apply a cast only if the build fails") is a real contingency with the exact remedy, not a hand-wave. No TBD/TODO. ✅

**Type consistency:** `PromptStyle` used identically across `prompts.ts`, `enhance-prompt.ts`, `image-to-prompt.ts`. `loadImageContent` signature/return (`ImageContent | null`) matches its consumer in Task 5. `buildEnhanceResult` / `buildImageToPromptResult` names match between definition, verify scripts, and `register*` wrappers. `getSystemPrompt(style)` matches the copied `prompts.ts`. ✅
