# prompt-kickstart-mcp

A tiny standalone MCP server that reproduces the meigen.ai "Generate" workflow as
two **free** tools — no API key, no credits. The host LLM (e.g. Claude) does the
vision and writing.

## Tools

- **`image_to_prompt`** — turn an uploaded image into a generation-ready prompt
  ("Describe Image"). Input: `imagePath` (local file), or none to analyze the
  image already pasted in the conversation. The visual style is **inferred** from
  the image; the prompt covers subject & composition, art style & technique,
  lighting/color/mood, and camera angle. Oversized images are auto-downscaled
  (longest edge ≤ 1568px).
- **`enhance_prompt`** — expand a brief text prompt into a detailed one.
  Inputs: `prompt`, optional `mode` — `polish` (default; preserves intent, adds
  composition/lighting/materials) or `expand` (Midjourney V8.1; rewrites to
  Midjourney-optimized language, auto-translates non-English) — and an optional
  `model` hint. Works best on prompts under ~30 words.

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
