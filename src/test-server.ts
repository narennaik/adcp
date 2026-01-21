/**
 * AdCP Test Server
 *
 * Simple HTTP server for testing the AdCP implementation.
 */

import { createServer } from 'http';
import { createMcpServer } from './index.js';

const PORT = process.env.PORT || 3000;

// Create MCP server with all protocols enabled
const mcpServer = createMcpServer({
  name: 'AdCP Test Server',
  version: '2.6.0',
  agentUrl: `http://localhost:${PORT}`,
  enableSignals: true,
  enableMediaBuy: true,
  enableCreative: true,
});

// Create HTTP server
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '2.6.0' }));
    return;
  }

  // Server info
  if (req.url === '/info' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mcpServer.getServerInfo(), null, 2));
    return;
  }

  // List tools
  if (req.url === '/tools' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: mcpServer.listTools() }, null, 2));
    return;
  }

  // JSON-RPC endpoint
  if (req.url === '/rpc' && req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await mcpServer.handleRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : 'Unknown error',
          },
        }));
      }
    });
    return;
  }

  // Simple tool call endpoint (non-RPC)
  if (req.url?.startsWith('/call/') && req.method === 'POST') {
    const toolName = req.url.replace('/call/', '');
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const args = body ? JSON.parse(body) : {};
        const result = await mcpServer.callTool({
          tool: toolName,
          arguments: args,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });
    return;
  }

  // Root - show available endpoints
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'AdCP Test Server',
      version: '2.6.0',
      endpoints: {
        '/': 'This help message',
        '/health': 'Health check',
        '/info': 'Server information',
        '/tools': 'List available tools',
        '/rpc': 'JSON-RPC endpoint (POST)',
        '/call/{tool}': 'Direct tool call (POST)',
      },
      available_tools: mcpServer.listTools().map(t => t.name),
    }, null, 2));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   AdCP Test Server                         ║
║                      v2.6.0                                ║
╠════════════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}                   ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET  /         - Help & available tools                 ║
║    GET  /health   - Health check                           ║
║    GET  /info     - Server info                            ║
║    GET  /tools    - List all tools                         ║
║    POST /rpc      - JSON-RPC endpoint                      ║
║    POST /call/:tool - Direct tool call                     ║
╠════════════════════════════════════════════════════════════╣
║  Enabled Protocols:                                        ║
║    ✓ Signals (get_signals, activate_signal)                ║
║    ✓ Media Buy (9 tasks)                                   ║
║    ✓ Creative (build, preview, validate)                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});
