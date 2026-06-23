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
