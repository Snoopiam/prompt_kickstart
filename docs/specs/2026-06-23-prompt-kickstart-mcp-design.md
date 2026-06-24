# prompt-kickstart-mcp — Design Spec

**Date:** 2026-06-23
**Status:** Approved design, pending implementation plan

## Summary

A standalone stdio MCP server that reproduces the meigen.ai "Generate page"
workflow — **Image → Prompt** and **Enhance Prompt** — as two free, no-API-key
tools. It is a minimal *copy* of a small slice of the `MeiGen-AI-Design-MCP`
project. The original MeiGen repo is **never modified**.

Lives at: `C:\SnoopLABS\GitHUB Cloned Apps\prompt-kickstart-mcp` (sibling folder).

## Goal / Workflow Reproduced

```
upload or point at an image
        │
        ▼
  image_to_prompt  ──►  kickstart prompt  (a generation-ready starting point)
        │
        ▼
  enhance_prompt   ──►  polished, expanded prompt
        │
        ▼
  copy into any image generator (MeiGen, ComfyUI, Midjourney, etc.)
```

This matches meigen.ai exactly: the user starts from an image, the system reads
it and returns a kickstart prompt, and a separate "enhance" action expands it.

## Why It's Free (Core Design Decision)

Both tools delegate the actual AI work to the **host LLM** (Claude, which has
vision). The tools never call a vision/text API and never need a key or credits.
This mirrors how MeiGen's existing `enhance_prompt` already works: the tool
returns a system prompt + instructions, and the host LLM produces the output.

- `enhance_prompt` → host LLM rewrites the text prompt.
- `image_to_prompt` → host LLM *sees* the image and writes the kickstart prompt.

## Tools

### 1. `image_to_prompt` (new)

**Purpose:** Turn an image into a generation-ready kickstart prompt.

**Inputs (Zod schema):**
- `imagePath?: string` — local file path. Read + base64-encode, return as an MCP
  image content block so the host LLM can see it.
- `imageUrl?: string` — remote URL. Fetch + base64-encode the same way.
- `style?: 'realistic' | 'anime' | 'illustration'` — default `realistic`.

> **Implementation note (2026-06-24):** `imageUrl` and `style` were **descoped**
> in the shipped build to match meigen.ai's live "Describe Image" behavior, which
> is uploads-only (drag-drop / paste) with the visual style **inferred** from the
> image rather than selected. The shipped tool therefore accepts only `imagePath`
> (or an image already pasted in the conversation). Remote-URL fetching can be
> re-added later if a use case requires it.

**Behavior:**
1. Resolve the image source in priority order: `imagePath` → `imageUrl` → none.
2. If a source is provided: load the bytes, **auto-resize if oversized**
   (see Image Handling), base64-encode, and return an MCP `image` content block.
3. If no source is provided: return text instructing the host LLM to analyze the
   image already pasted into the conversation.
4. Always also return a text block containing the **reverse-engineering system
   prompt** from `prompts.ts` (the "Senior Visual Logic Analyst" protocol for the
   chosen style), instructing the host to output the kickstart prompt and then
   offer to enhance it or generate from it.

### 2. `enhance_prompt` (copied verbatim from MeiGen)

**Purpose:** Expand a brief text prompt into a detailed, style-aware prompt.

**Inputs:**
- `prompt: string` — the simple prompt to enhance.
- `style?: 'realistic' | 'anime' | 'illustration'` — default `realistic`.

**Behavior:** Returns the style's system prompt + the user's prompt, for the host
LLM to rewrite. Unchanged from `MeiGen-AI-Design-MCP/src/tools/enhance-prompt.ts`.

## Shared Dependency

`src/lib/prompts.ts` — copied as-is from MeiGen. Exports
`REALISTIC_SYSTEM_PROMPT`, `ANIME_SYSTEM_PROMPT`, `ILLUSTRATION_SYSTEM_PROMPT`,
`getSystemPrompt(style)`, and the `PromptStyle` type. The "realistic" prompt is
already written as an image reverse-engineering protocol, so it serves both tools.

## Image Handling (Resize Policy)

- Resizing is **internal and automatic** — not a user-facing option.
- Downscale **only when** the longest edge exceeds ~1568px (the host vision
  model's optimal size). Preserve aspect ratio. **Never upscale.**
- Rationale: oversized images are downsampled by the client anyway and waste
  context tokens; resizing to the optimal size improves prompt quality and cuts
  cost. This is the "resize only if it makes the prompt better" requirement.
- Implemented with `sharp` (same lib MeiGen uses). Used solely for this downscale.
- MIME type inferred from file extension / fetched content-type.

## Project Structure

```
prompt-kickstart-mcp/
├── package.json          # name: prompt-kickstart-mcp
│                         # deps: @modelcontextprotocol/sdk, zod, sharp
├── tsconfig.json         # copied from MeiGen
├── bin/
│   └── prompt-kickstart-mcp.js   # stdio launcher (node shebang → dist/index.js)
├── src/
│   ├── index.ts          # entry: createServer() + StdioServerTransport
│   ├── server.ts         # McpServer; registers ONLY the 2 tools
│   ├── lib/
│   │   ├── prompts.ts        # copied from MeiGen
│   │   └── image.ts          # new: load/fetch + resize + base64 helper
│   └── tools/
│       ├── enhance-prompt.ts     # copied from MeiGen
│       └── image-to-prompt.ts    # new
├── docs/
│   └── specs/
│       └── 2026-06-23-prompt-kickstart-mcp-design.md   # this file
└── README.md             # install + MCP client config snippet
```

## Deliberately Dropped (YAGNI)

From the MeiGen project, the following are **not** copied because two host-vision
tools don't need them:
- MeiGen API client (`meigen-api.ts`), config/env loading, API tokens.
- `search_gallery`, `get_inspiration`, `list_models`, `manage_preferences`.
- `generate_image`, `generate_video`, ComfyUI workflow tools.

## Build & Run

- `npm install && npm run build` (`tsc`) → `dist/`.
- Dev: `npm run dev` (`tsx src/index.ts`).
- Registered in an MCP client (e.g. Claude Code) via the `bin` entry, same shape
  as MeiGen's config.

## Out of Scope

- No changes to `MeiGen-AI-Design-MCP`.
