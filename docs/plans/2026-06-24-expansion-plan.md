# prompt-kickstart-mcp — Expansion Plan

**Date:** 2026-06-24
**Status:** Proposal (no code yet)

## Guiding principle

Stay **free**. The whole project works because the *host LLM* (Claude) does the
vision and writing — no API key, no credits, no network. meigen.ai's own
prompt-side tools (Enhance, Describe, Translate, Storyboard) are described in
their docs as AI-assists that **"do not spend image/video generation credits."**
Those are precisely the features we can reproduce for free. Anything that
actually *renders* an image or video needs meigen's paid API and is therefore a
separate, opt-in track (Tier 3 below).

Source: https://docs.meigen.ai/en/features/generate

## What's shipped (Tier 0)

| Tool | meigen feature | Status |
|------|----------------|--------|
| `image_to_prompt` | Describe Image | ✅ done |
| `enhance_prompt` (polish / expand) | Prompt Enhancement | ✅ done |

## Tier 1 — free, host-LLM, high value / low effort  ✅ COMPLETE (2026-06-24)

These are pure "instructions in → text out" tools, exactly like the two already
built. Each is a new file in `src/tools/` + a system prompt in `src/lib/prompts.ts`
+ tests. No new dependencies.

1. **`storyboard_prompt`** ✅ — meigen's *Storyboard* (video prompt builder).
   Turns a one-line idea into a timed, shot-by-shot storyboard: an overview
   paragraph + a `0s–Ns` beat list with no gaps, matching a chosen duration.
   Keeps the input language. *Inputs:* `idea: string`, `durationSeconds?: number`
   (default 8). Highest-value addition — extends the project from images into video
   prompting while staying free.

2. **`translate_prompt`** ✅ — meigen's *Translate* button.
   Translate a non-English prompt to English (best model input) while preserving
   visual intent. *Inputs:* `prompt: string`, `targetLang?: string` (default "en").
   Trivial effort; also useful as an internal step inside the other tools.

3. **`prompt_variations`** ✅ — meigen's *Use Idea* / "create variations" pattern.
   Given one prompt, return N distinct variations (different mood, lighting, or
   composition) without losing the core subject. *Inputs:* `prompt: string`,
   `count?: number` (default 3).

4. **`templatize_prompt`** ✅ — meigen's *Variable Tags* (`[style]`, `[subject]`…).
   Rewrite a prompt with editable `[placeholder]` slots so the user can spin
   variations by swapping tags. *Inputs:* `prompt: string`.

## Tier 2 — free, host-LLM, enhancements to existing tools  ✅ COMPLETE (2026-06-24)

Lower-effort polish, mostly new options rather than new tools.

- **Per-model enhancement presets.** `enhance_prompt` already takes a `model`
  hint but only branches polish vs. expand. Add tuned guidance per target model
  (GPT Image 2, Nano Banana 2, Seedream 5.0, etc.) so output matches each model's
  prompting style — mirrors how meigen's selector changes enhancement behavior.
- **Negative-prompt suggestions.** Optionally return a short "avoid:" list
  alongside the enhanced prompt.
- **Color (`#hex`) + reference (`@image`) helpers.** Fold meigen's `#` color
  picker and `@` mention conventions into enhancement guidance so prompts can
  carry precise hex colors and multi-reference instructions.

## Tier 3 — PAID, opt-in (requires meigen API token + purchased credits)  ✅ SCAFFOLDED (2026-06-24)

Out of scope for the "free" goal, but the natural future expansion if you ever
want real output. meigen's API uses **purchased credits only** (daily/free
credits never apply to the API path), so this must be clearly separated from the
free tools and gated behind a user-supplied token.

- **`generate_media`** ✅ — call meigen's generation API (unified image+video endpoint) (GPT Image 2, Nano Banana,
  Seedream, Midjourney V8.1, …). Needs `MEIGEN_API_TOKEN`, model + aspect-ratio
  params, credit-cost awareness.
- **`generate_media`** also covers video (Seedance 2.0 / Veo 3.1 / Happyhorse), incl. first/last frame and Seedance reference-video continuation.
- **`list_models`** ✅ — list available API models.
- **`cutout`** — background removal to transparent PNG (not yet built; meigen exposes this only as a UI action, not a documented API endpoint).

Design rule if Tier 3 is ever built: keep it in a separate, optional module so the
server still runs and the Tier 0–2 tools stay 100% free when no token is set.
Reference: https://docs.meigen.ai/en/api-reference/introduction

## Suggested order

1. `storyboard_prompt` (biggest capability jump, still free)
2. `translate_prompt` (tiny, reused by others)
3. `prompt_variations`, `templatize_prompt`
4. Tier 2 enhancement options
5. Tier 3 only if/when paid generation is actually wanted

## Effort notes

Every Tier 1 tool follows the existing pattern exactly: a `build…Result()` pure
function + a `register…()` call + unit tests + an entry in the e2e driver. No new
runtime dependencies. The architecture (host-LLM, `readOnlyHint`, no network)
already supports all of Tier 1 and Tier 2 unchanged.
