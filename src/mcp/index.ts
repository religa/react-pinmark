import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveConfig } from '../cli/config';
import { createCliAdapter } from '../cli/client';
import { registerTools } from './tools';

function readVersion(): string {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(dir, '../../package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

async function main() {
  const config = resolveConfig();
  const adapter = createCliAdapter(config);

  const server = new Server(
    { name: 'react-pinmark', version: readVersion() },
    { capabilities: { tools: {} } },
  );

  registerTools(server, adapter, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`react-pinmark-mcp: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
