import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMeigenClient, type MeigenClient } from '../lib/meigen-api.js'

export async function buildListModelsResult(
  client: MeigenClient,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const models = await client.listModels()
    return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `meigen list-models error: ${(err as Error).message}` }],
      isError: true,
    }
  }
}

export function registerListModels(server: McpServer, opts: { token: string }) {
  const client = createMeigenClient({ token: opts.token })
  server.tool(
    'list_models',
    'PAID-tier companion (requires MEIGEN_API_TOKEN). List the image/video models available on the meigen.ai API, with their ids, supported ratios, and reference-image limits. Read-only; does not spend generation credits.',
    {},
    { readOnlyHint: true },
    async () => buildListModelsResult(client),
  )
}
