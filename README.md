# prompt-kickstart-mcp

[![CI](https://github.com/Snoopiam/prompt_kickstart/actions/workflows/ci.yml/badge.svg)](https://github.com/Snoopiam/prompt_kickstart/actions/workflows/ci.yml)

A tiny, standalone [MCP](https://modelcontextprotocol.io) server that reproduces the
[meigen.ai](https://www.meigen.ai) **"Generate"** workflow as two **free** tools — no API
key, no credits, no external calls. The host LLM (e.g. Claude) does the vision and the
writing; this server just hands it the right instructions.

> 📖 For a deep dive — architecture, internals, testing, extending, troubleshooting — see
> **[GUIDE.md](./GUIDE.md)**.

There is **no image generation** here. The flow is purely about prompts:

```
upload an image ──▶ image_to_prompt ──▶ a prompt ──┐
                                                    ├──▶ enhance_prompt ──▶ a polished prompt
you type a prompt ─────────────────────────────────┘                         (paste into any
                                                                              image generator)
```

## Tools

### `image_to_prompt` — "Describe Image"

Turn an **uploaded** image into a generation-ready prompt. The visual style is **inferred
from the image** (there is no style selector), mirroring meigen.ai's *Describe Image*
feature. The resulting prompt covers four dimensions:

1. **Subject & scene composition**
2. **Art style & technique** (photorealistic, illustration, watercolor, anime, … — inferred)
3. **Lighting, color palette & mood**
4. **Camera angle & perspective**

| Input | Type | Notes |
|-------|------|-------|
| `imagePath` | `string` *(optional)* | Local file path to the uploaded image. Omit to analyze an image **already pasted** into the conversation. |

Oversized images are auto-downscaled (longest edge ≤ 1568 px) to stay within the host's
vision token budget. Only local uploads / pasted images are supported — no remote URL fetching.

### `enhance_prompt`

Expand a brief text prompt into a detailed one. **Model-aware**, mirroring meigen.ai's
*Enhance Prompt*:

| Input | Type | Notes |
|-------|------|-------|
| `prompt` | `string` *(required)* | The simple prompt to enhance, e.g. `"a cat in a garden"`. |
| `mode` | `"polish"` \| `"expand"` *(optional, default `polish`)* | **polish** (most models): preserve intent, add composition / lighting / materials. **expand** (Midjourney V8.1): rewrite into Midjourney-optimized language, auto-translate non-English. |
| `model` | `string` *(optional)* | Target model hint, e.g. `"midjourney"`, `"gpt-image-2"`. For Midjourney models, prefer `mode: "expand"`. |

Works best on brief prompts (under ~30 words); if a prompt is already richly detailed, it
may be returned largely unchanged.

**Typical flow:** `image_to_prompt` → `enhance_prompt` → paste into any image generator.

## Requirements

- **Node.js 18+** to run the built server (development & testing use the Node test runner, which needs **Node 20.6+**).
- No API key, account, or network access required.

## Install

```bash
git clone https://github.com/Snoopiam/prompt_kickstart.git
cd prompt_kickstart
npm install
npm run build
```

This produces `dist/`, which the `bin/prompt-kickstart-mcp.js` launcher runs.

## Register with an MCP client

### Claude Code (CLI)

```bash
claude mcp add prompt-kickstart -- node "C:/SnoopLABS/GitHUB Cloned Apps/prompt-kickstart-mcp/bin/prompt-kickstart-mcp.js"
```

### Claude Desktop / generic MCP config

Add to your client's MCP server config JSON (e.g. `claude_desktop_config.json`):

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

> Use the absolute path to `bin/prompt-kickstart-mcp.js` on your machine. Restart the client
> after editing the config.

## Usage examples

Once registered, ask the host LLM naturally — it will call the tools:

- *"Here's an image \[paste], turn it into a prompt."* → `image_to_prompt`
- *"Describe `C:/photos/sunset.jpg` as a prompt."* → `image_to_prompt` with `imagePath`
- *"Enhance this: a cat in a garden."* → `enhance_prompt` (polish)
- *"Make this a Midjourney prompt: lonely lighthouse at dawn."* → `enhance_prompt` with `mode: "expand"`

## How it works

The server returns **instructions plus content** (for `image_to_prompt`, the image itself
is included as an image block). The **host LLM performs the actual vision analysis and
prompt writing** — that's why it's free and needs no API key. Both tools are marked
`readOnlyHint` and never reach the network or write files.

## Development

```bash
npm run dev        # run from source via tsx
npm run typecheck  # tsc --noEmit
npm run build      # compile to dist/
npm test           # run the test suite (Node test runner + tsx)
```

### Tests & guardrails

- **Unit tests** for the prompt library, both builder functions, and image load/resize.
- **End-to-end MCP test** — spins up the real server and a real client over an in-memory
  transport, exercising `listTools` + `callTool` and schema-validation error paths.
- **CI** runs typecheck + build + test on **Node 20.x, 22.x, and 24.x** for every push and PR.
- **`prepublishOnly`** runs build + test, so a broken build can never be published.

```bash
npm test
# ℹ tests 34
# ℹ pass 34
# ℹ fail 0
```

## Project structure

```
src/
  index.ts              # stdio entrypoint
  server.ts             # McpServer + tool registration
  lib/
    prompts.ts          # describe + polish/expand system prompts
    image.ts            # local image load + auto-downscale
  tools/
    image-to-prompt.ts  # image_to_prompt tool
    enhance-prompt.ts    # enhance_prompt tool
test/                   # node:test suite (unit + e2e)
verify/                 # standalone smoke-check scripts
```

## Attribution

The prompt-enhancement system prompt originates from the
[MeiGen-AI-Design-MCP](https://github.com/jau123/MeiGen-AI-Design-MCP) project. This is an
independent reproduction of two pieces of the meigen.ai *Generate* workflow; it does not
modify, depend on, or call that project or any meigen.ai backend.

## License

No `LICENSE` file is present in this repository yet. The upstream
[MeiGen-AI-Design-MCP](https://github.com/jau123/MeiGen-AI-Design-MCP) is MIT-licensed; if you
intend to distribute this project, add a `LICENSE` file (and a `"license"` field in
`package.json`) to make the terms explicit.
