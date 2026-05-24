#!/usr/bin/env node
/**
 * Lucarne MCP — stdio entrypoint.
 *
 * For local LLM clients: Claude Desktop, Cursor, Continue, Cline, etc.
 * Install: `npm i -g lucarne-mcp` then add to claude_desktop_config.json:
 *
 *   {
 *     "mcpServers": {
 *       "lucarne": { "command": "lucarne-mcp" }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server now reads/writes JSON-RPC over stdio. No console.log here — stdout is the protocol channel.
}

main().catch((err) => {
  console.error("lucarne-mcp fatal:", err);
  process.exit(1);
});
