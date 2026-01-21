#!/usr/bin/env node
/**
 * AdCP Stdio Server
 *
 * Stdio transport for Claude Desktop integration.
 * Reads JSON-RPC messages from stdin and writes responses to stdout.
 */

import * as readline from 'readline';
import { createMcpServer } from './index.js';

// Create MCP server with all protocols enabled
const mcpServer = createMcpServer({
  name: 'AdCP Server',
  version: '2.6.0',
  agentUrl: 'stdio://localhost',
  enableSignals: true,
  enableMediaBuy: true,
  enableCreative: true,
});

// Set up readline interface for stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// Process each line as a JSON-RPC request
rl.on('line', async (line: string) => {
  if (!line.trim()) {
    return;
  }

  try {
    const message = JSON.parse(line);

    // Check if this is a notification (no id field)
    // Notifications don't expect a response
    if (message.id === undefined) {
      // Handle notifications silently
      process.stderr.write(`Received notification: ${message.method}\n`);
      return;
    }

    const response = await mcpServer.handleRequest(message);
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (error) {
    // Parse error - send JSON-RPC error response
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: error instanceof Error ? error.message : 'Unknown error',
      },
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

// Handle stdin close
rl.on('close', () => {
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
  const errorResponse = {
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32603,
      message: 'Internal error',
      data: error.message,
    },
  };
  process.stdout.write(JSON.stringify(errorResponse) + '\n');
});

// Log startup to stderr (not stdout, to avoid interfering with JSON-RPC)
process.stderr.write('AdCP stdio server started\n');
