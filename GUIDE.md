# prompt-kickstart-mcp — Detailed Guide

A deep dive into what this server is, how it works internally, how to install and configure it,
how to use it, and how to develop, test, and extend it.

> **Quick start?** See [README.md](./README.md). This guide is the long-form companion.

---

## Table of contents

1. [Philosophy & what this is](#1-philosophy--what-this-is)
2. [Core concepts](#2-core-concepts)
3. [Architecture](#3-architecture)
4. [The prompt library](#4-the-prompt-library)
5. [Tool reference: `image_to_prompt`](#5-tool-reference-image_to_prompt)
6. [Tool reference: `enhance_prompt`](#6-tool-reference-enhance_prompt)
7. [Image handling internals](#7-image-handling-internals)
8. [Installation & build](#8-installation--build)
9. [Client configuration](#9-client-configuration)
10. [End-to-end usage walkthrough](#10-end-to-end-usage-walkthrough)
11. [Development workflow](#11-development-workflow)
12. [Testing internals](#12-testing-internals)
13. [Continuous integration](#13-continuous-integration)
14. [Extending the server](#14-extending-the-server)
15. [Troubleshooting & FAQ](#15-troubleshooting--faq)
16. [Design decisions & fidelity to meigen.ai](#16-design-decisions--fidelity-to-meigenai)
17. [Security notes](#17-security-notes)

---

## 1. Philosophy & what this is

`prompt-kickstart-mcp` reproduces two features of the [meigen.ai](https://www.meigen.ai)
**Generate** page — *Describe Image* and *Enhance Prompt* — as a local MCP server.

The defining design choice: **the host LLM does all the intelligence.** Where the meigen.ai
website sends your image/prompt to a backend vision API, this server instead returns a small
package of *instructions* (and, for images, the image itself) back to the host LLM that called
the tool. The host — Claude, or any MCP-capable model — performs the actual vision analysis and
prompt writing.

Consequences of that choice:

- **Free.** No API key, no account, no credits, no billing.
- **No network.** The server never makes an outbound request (see [§17](#17-security-notes)).
- **No image generation.** This is strictly a *prompt* tool. Output is text you paste into
  whatever image generator you like.
- **Portable.** It's a stdio MCP server with three dependencies (`@modelcontextprotocol/sdk`,
  `sharp`, `zod`).

The intended workflow:

```
upload an image ──▶ image_to_prompt ──▶ a prompt ──┐
                                                    ├──▶ enhance_prompt ──▶ a polished prompt
you type a prompt ─────────────────────────────────┘
```

---

## 2. Core concepts

### Model Context Protocol (MCP)

MCP is a standard for connecting LLM hosts to external **tools**, **resources**, and **prompts**.
A host (Claude Desktop, Claude Code, etc.) launches an MCP *server* and communicates with it over
a transport. This server uses the **stdio transport**: the host spawns the process and exchanges
JSON-RPC messages over stdin/stdout. (Diagnostics go to **stderr** so they don't corrupt the
protocol stream — see `src/index.ts`.)

### Host-LLM vision

When `image_to_prompt` loads a local image, it returns an MCP **image content block**
(`{ type: "image", data: <base64>, mimeType }`). The host model receives that image in its
context and analyzes it directly. The server never "sees" the picture in any semantic sense — it
only reads bytes, optionally downsizes them, and forwards them.

### Why there's no API key

Because the "AI" steps (describe the image, rewrite the prompt) are executed by the host model,
there is nothing to authenticate against. The server is a thin orchestration layer that hands the
host the right system prompt at the right moment.

---

## 3. Architecture

```
bin/prompt-kickstart-mcp.js      # shebang launcher -> imports dist/index.js
└── src/
    ├── index.ts                 # main(): create server, connect stdio transport
    ├── server.ts                # createServer(): McpServer + instructions + register tools
    ├── lib/
    │   ├── prompts.ts           # DESCRIBE_IMAGE_PROMPT, POLISH/EXPAND, getEnhanceSystemPrompt()
    │   └── image.ts             # loadImageContent(): read local file, auto-downscale, base64
    └── tools/
        ├── image-to-prompt.ts   # schema + buildImageToPromptResult() + registerImageToPrompt()
        └── enhance-prompt.ts     # schema + buildEnhanceResult() + registerEnhancePrompt()
```

Each tool file follows the same three-part shape:

- a **Zod schema** describing the tool's inputs,
- a **pure builder function** (`buildEnhanceResult` / `buildImageToPromptResult`) that produces
  the MCP result object — this is what the tests exercise directly,
- a **`register…` function** that wires the builder into the `McpServer` via `server.tool(...)`.

Keeping the builder pure (no MCP/transport coupling) is what makes the suite fast and lets the
end-to-end test verify the wiring separately.

`createServer()` (in `src/server.ts`) sets the server name/version, attaches a human-readable
`instructions` string the host can show, and calls both `register…` functions. `main()` (in
`src/index.ts`) connects it to a `StdioServerTransport` and logs a ready line to stderr.

---

## 4. The prompt library

All system prompts live in `src/lib/prompts.ts`. There are three, plus one selector.

| Export | Used by | Role |
|--------|---------|------|
| `DESCRIBE_IMAGE_PROMPT` | `image_to_prompt` | Tells the host to analyze an image and emit a prompt covering 4 dimensions, **inferring** the style. |
| `POLISH_SYSTEM_PROMPT` | `enhance_prompt` (mode `polish`) | The "Senior Visual Logic Analyst" enhancer — preserves intent, adds composition/lighting/materials. Originates from meigen's edgeone vision-api. |
| `EXPAND_SYSTEM_PROMPT` | `enhance_prompt` (mode `expand`) | "Midjourney Prompt Director" — rewrites to Midjourney-optimized language, auto-translates non-English, forbids `--ar`. |
| `getEnhanceSystemPrompt(mode)` | `enhance_prompt` | `polish ⇒ POLISH`, `expand ⇒ EXPAND` (default `polish`). |

`DESCRIBE_IMAGE_PROMPT` enumerates the four dimensions the meigen *Describe Image* feature
documents:

1. Subject & scene composition
2. Art style & technique (**inferred** — "Do not assume a default style")
3. Lighting, color palette & mood
4. Camera angle & perspective

There is intentionally **no** `realistic`/`anime`/`illustration` style enum anymore — the live
site infers style from the image, and so does this tool. (See [§16](#16-design-decisions--fidelity-to-meigenai).)

---

## 5. Tool reference: `image_to_prompt`

**Purpose:** turn an uploaded/pasted image into a generation-ready prompt, inferring style.

### Schema

```ts
{ imagePath?: string }   // local file path; omit to use a pasted image
```

### Behavior — three outcomes

**A. `imagePath` points to a readable image** → an image block + a describe instruction:

```jsonc
{
  "content": [
    { "type": "image", "data": "<base64>", "mimeType": "image/png" },
    { "type": "text",  "text": "Analyze the image above and reverse-engineer a generation-ready prompt using these guidelines:\n\n---\n<DESCRIBE_IMAGE_PROMPT>\n---\n\nOutput the prompt now. Then ask the user whether they'd like to refine it with enhance_prompt or use it to generate an image." }
  ]
}
```

**B. No `imagePath`** (image was pasted into chat) → a single instruction telling the host to
analyze the conversation image:

```jsonc
{
  "content": [
    { "type": "text", "text": "Analyze the image the user shared in this conversation and reverse-engineer a generation-ready prompt using these guidelines:\n\n---\n<DESCRIBE_IMAGE_PROMPT>\n---\n\nIf no image was shared, ask the user to paste one or pass imagePath. Otherwise output the prompt now, then offer to refine it with enhance_prompt or generate an image from it." }
  ]
}
```

**C. `imagePath` is unreadable** (missing file, permission error) → a clean error result, never a
thrown exception / protocol crash:

```jsonc
{
  "content": [ { "type": "text", "text": "Could not load the image: <reason>" } ],
  "isError": true
}
```

### Notes

- Style is **inferred**; there is no style parameter.
- Only local uploads / pasted images are supported — **no remote URL fetching**.
- Images are auto-downscaled before being sent to the host (see [§7](#7-image-handling-internals)).

---

## 6. Tool reference: `enhance_prompt`

**Purpose:** expand a brief text prompt into a detailed one, **model-aware**.

### Schema

```ts
{
  prompt: string,                       // required
  mode?: "polish" | "expand",           // default "polish"
  model?: string                        // optional hint, e.g. "midjourney"
}
```

### Behavior

The result is always a single text block that wraps the chosen system prompt around the user's
prompt, plus the meigen "< ~30 words" guidance:

```jsonc
{
  "content": [
    { "type": "text", "text": "Please enhance the following prompt using these guidelines:\n\n---\n<POLISH or EXPAND system prompt>\n---\n\nUser's prompt to enhance:\n\"a cat in a garden\"\n\nNote: enhancement works best on brief prompts (under ~30 words); if the prompt already has detailed visual descriptions, you may return it largely unchanged. Generate the enhanced prompt now. Then show it to the user and ask if they'd like to generate an image with it." }
  ]
}
```

- **`mode: "polish"`** (default) uses `POLISH_SYSTEM_PROMPT` — best for GPT Image, Nano Banana,
  Seedream, etc.
- **`mode: "expand"`** uses `EXPAND_SYSTEM_PROMPT` — Midjourney V8.1 style, auto-translates
  non-English input, no aspect-ratio flags.
- **`model`** (optional) appends `Target model: <model>.` to the instruction so the host can
  tailor phrasing. For Midjourney models, prefer `mode: "expand"`.

---

## 7. Image handling internals

`src/lib/image.ts` exposes `loadImageContent({ imagePath })`.

- **Read:** if `imagePath` is given, the file is read with `node:fs/promises.readFile`. If it is
  omitted, the function returns `null` (the tool then emits outcome **B** above).
- **MIME detection:** from the file extension (`.jpg/.jpeg → image/jpeg`, `.png`, `.webp`, `.gif`),
  falling back to `image/png`; then refined from the actual decoded format reported by `sharp`.
- **Auto-downscale:** the image is decoded with [`sharp`](https://sharp.pixelplumbing.com/). If the
  **longest edge exceeds `MAX_EDGE = 1568` px**, it is resized to fit inside 1568×1568
  (`fit: "inside"`, `withoutEnlargement: true` — it never upscales). Otherwise the original bytes
  are used unchanged.
- **Output:** `{ data: <base64 without a data: prefix>, mimeType }`.

Why 1568? It keeps the image payload within a sensible vision token budget for host models while
preserving enough detail to describe accurately.

There is **no `fetch`** in this module — the remote-URL path was deliberately removed, so there is
no SSRF surface (see [§16](#16-design-decisions--fidelity-to-meigenai) and [§17](#17-security-notes)).

---

## 8. Installation & build

```bash
git clone https://github.com/Snoopiam/prompt_kickstart.git
cd prompt_kickstart
npm install          # installs the 3 deps + dev tooling
npm run build        # tsc -> dist/
```

- `npm run build` runs `tsc` using `tsconfig.json` (`module: NodeNext`, `target: ES2022`,
  `strict: true`), emitting JavaScript + `.d.ts` files into `dist/`.
- The published surface is just `bin/` and `dist/` (see `"files"` in `package.json`).
- `bin/prompt-kickstart-mcp.js` is the launcher: a shebang script that imports `../dist/index.js`.

**Requirements:** Node 18+ to run the built server; Node 20.6+ for development/testing (the Node
test runner and the `--import` flag).

---

## 9. Client configuration

### Claude Code (CLI)

```bash
claude mcp add prompt-kickstart -- node "C:/SnoopLABS/GitHUB Cloned Apps/prompt-kickstart-mcp/bin/prompt-kickstart-mcp.js"
```

### Claude Desktop / generic JSON

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

- Use the **absolute path** to `bin/prompt-kickstart-mcp.js` on your machine.
- Run `npm run build` first — the launcher imports `dist/`, which must exist.
- **Restart** the client after editing its config.

### Verifying it loaded

Ask the host "what MCP tools are available?" — you should see `image_to_prompt` and
`enhance_prompt`. On startup the server logs `prompt-kickstart-mcp running on stdio` to stderr;
most clients surface server stderr in a logs panel if you need to debug.

---

## 10. End-to-end usage walkthrough

A typical session with the host:

1. **You:** *paste a photo* — "Turn this into a prompt."
   The host calls `image_to_prompt` (no `imagePath`; the pasted image is in context). It returns
   outcome **B**; the host analyzes the image and writes a prompt covering the 4 dimensions.
2. **You:** "Polish that for GPT Image."
   The host calls `enhance_prompt` with the generated prompt and `mode: "polish"`. It returns the
   wrapped POLISH instruction; the host produces a richer prompt.
3. **You:** "Now give me a Midjourney version."
   The host calls `enhance_prompt` with `mode: "expand"` (and maybe `model: "midjourney"`). It
   returns the EXPAND instruction; the host rewrites it Midjourney-style.
4. **You:** copy the final text into your image generator of choice.

Or start from text: "Enhance: lonely lighthouse at dawn" → `enhance_prompt` directly.

---

## 11. Development workflow

```bash
npm run dev        # run the server from source via tsx (no build step)
npm run typecheck  # tsc --noEmit — fast type-only check
npm run build      # compile to dist/
npm test           # run the full test suite
```

- `npm run dev` is handy when iterating on tool behavior — it runs `src/index.ts` directly through
  `tsx`, so you don't need to rebuild between edits.
- Keep builder functions **pure** (no transport/IO beyond `image.ts`) so they stay unit-testable.

---

## 12. Testing internals

Tests use the **built-in Node test runner** (`node:test`) executed through `tsx` (so `.ts` runs
without a separate compile). Zero extra test dependencies.

```
test/
  prompts.test.ts          # prompt integrity + getEnhanceSystemPrompt mapping
  enhance-prompt.test.ts   # buildEnhanceResult: modes, default, model hint, guidance
  image.test.ts            # loadImageContent: small/large/none/missing, mime, no data: prefix
  image-to-prompt.test.ts  # buildImageToPromptResult: image+text, 4 dimensions, no-source, isError
  server.e2e.test.ts       # REAL MCP protocol: in-memory client <-> server
```

### The end-to-end test pattern

`server.e2e.test.ts` is the most important guardrail. It connects a real `Client` to the real
`createServer()` over an **in-memory linked transport**:

```ts
const server = createServer()
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
const client = new Client({ name: 'e2e-test-client', version: '1.0.0' })
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
```

It then asserts the genuine contract: `listTools()` returns exactly the two tools; `callTool()`
works for both; and **invalid input is surfaced as an `isError` result with an MCP `-32602`
message** (the SDK does not throw for schema violations — it returns an error result, and the test
pins that behavior).

### Running

```bash
npm test
# ℹ tests 34
# ℹ pass 34
# ℹ fail 0
```

### `verify/` scripts

`verify/check-*.ts` are standalone smoke checks (run with `npx tsx verify/check-enhance.ts`, etc.).
They print human-readable output and **exit non-zero on failure**, so they can't silently "pass."
They overlap the test suite but are convenient for eyeballing behavior quickly.

---

## 13. Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

- **Matrix:** Node **20.x, 22.x, 24.x**.
- **Steps:** `npm ci` → `npm run typecheck` → `npm run build` → `npm test`.

### A note on the test command

The `test` script lists the test files **explicitly** rather than using a glob
(`node --import tsx --test test/a.ts test/b.ts …`). This is deliberate: `node --test` only supports
glob patterns on **Node 22+**, so a glob would fail on the Node 20 matrix job. The explicit list
works on Node 20.6+ through 24.

### Publish guardrail

`package.json` defines `prepublishOnly: "npm run build && npm test"`, so `npm publish` refuses to
ship if the build or any test fails.

---

## 14. Extending the server

### Add a new enhance mode

1. Add the new system prompt constant in `src/lib/prompts.ts`.
2. Extend the `EnhanceMode` union and the `getEnhanceSystemPrompt` switch.
3. Update the `mode` enum in `enhancePromptSchema` (`src/tools/enhance-prompt.ts`).
4. Add tests in `test/enhance-prompt.test.ts` and `test/prompts.test.ts`, and a case in the e2e
   test if it should be exercised over the wire.

### Add a whole new tool

1. Create `src/tools/<tool>.ts` with a Zod schema, a pure `build…Result` function, and a
   `register…(server)` function calling `server.tool(...)`.
2. Call your `register…` in `createServer()` (`src/server.ts`).
3. Add unit tests for the builder and a case to `server.e2e.test.ts` (and update the
   "exactly two tools" assertion).
4. Add the new file to the `test` script's file list if you add a test file (no glob — see §13).

### Reuse, don't duplicate

Image loading already lives in `src/lib/image.ts`; prompt text in `src/lib/prompts.ts`. Prefer
extending those over re-implementing.

---

## 15. Troubleshooting & FAQ

**The host doesn't see the tools.**
Did you `npm run build`? The launcher imports `dist/`. Did you restart the client after editing its
config? Is the path in the config absolute and correct?

**`Could not load the image: ENOENT …`**
The `imagePath` doesn't exist or isn't readable. Check the path; on Windows, prefer forward slashes
or escaped backslashes in JSON.

**Can I pass an image URL?**
No — by design. The tool accepts a local `imagePath` or a pasted image only. Download the image and
pass its local path.

**Does it generate images?**
No. It only produces prompts. Paste the result into any image generator.

**Why is my enhanced prompt barely changed?**
Enhancement targets brief prompts (under ~30 words). If your input is already richly detailed, the
host may legitimately leave it mostly as-is.

**Animated GIFs?**
`sharp` reads the first frame for sizing/format; the tool is intended for still images.

**`npm test` fails on Node 18/early 20.**
The test runner needs Node **20.6+** (`--import`). The built server itself still runs on Node 18+.

---

## 16. Design decisions & fidelity to meigen.ai

This server was reworked to match the **documented live behavior** of meigen.ai's Generate page
(`docs.meigen.ai/en/features/generate`), not an earlier simplified port:

- **Image to Prompt infers style.** The live *Describe Image* has no style selector — it analyzes
  the upload and reports the four dimensions. So the tool **dropped its `style` parameter** and
  instructs the host to infer style. (Earlier it forced realistic/anime/illustration.)
- **Enhance is model-aware.** The live *Enhance Prompt* is *Polish* (most models) vs *Expand*
  (Midjourney V8.1). So `enhance_prompt` uses a **`mode`** parameter instead of a style enum.
- **Uploads only.** The live *Describe Image* works on uploaded/drag-dropped images. The standalone
  had an extra remote-`imageUrl` fetch that nobody in that flow used; it was **removed**, which also
  eliminated a server-side request-forgery surface.
- The unused `anime`/`illustration` system prompts from the original library were removed to keep
  the surface honest (only what the tools actually use).

The result: the two tools behave like the site they advertise.

---

## 17. Security notes

- **No network access.** The server makes no outbound requests. Image input is read from the local
  filesystem (`imagePath`) or comes from the conversation (pasted). There is no `fetch`, so there is
  no server-side request-forgery (SSRF) vector.
- **No filesystem writes.** The tools only *read* the image you point them at; they never write.
- **`readOnlyHint`.** Both tools are registered with `{ readOnlyHint: true }`, signaling to hosts
  that they have no side effects.
- **Input validation.** Inputs are validated by Zod schemas at the protocol boundary; invalid calls
  return a structured error (`isError`), not a crash.
- **Local trust boundary.** `imagePath` is read with the privileges of the process the host
  launches; only expose the server to trusted hosts, as with any local MCP server.
