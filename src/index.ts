/**
 * AdCP - Ad Context Protocol
 *
 * An open standard for advertising automation that works over MCP and A2A protocols,
 * enabling AI agents to interact with advertising platforms through unified interfaces.
 *
 * @version 2.6.0
 * @see https://docs.adcontextprotocol.org
 */

// Core types and utilities
export * from './core/index.js';

// Protocol implementations
export * from './protocols/index.js';

// Transport layers
export * from './transport/index.js';

// Utility modules
export * from './utils/index.js';

// Database abstractions
export * from './database/index.js';

// Version information
export const VERSION = '2.6.0';
export const PROTOCOL_VERSION = '2.6';

/**
 * Quick start factory functions
 */

import { McpServer, type McpServerConfig } from './transport/mcp/server.js';
import { A2aServer, type A2aServerConfig } from './transport/a2a/server.js';
import { SignalsHandler, type SignalsHandlerConfig } from './protocols/signals/handler.js';
import { MediaBuyHandler, type MediaBuyHandlerConfig } from './protocols/media-buy/handler.js';
import { CreativeHandler, type CreativeHandlerConfig } from './protocols/creative/handler.js';
import { MockSignalsDatabase } from './database/signals.js';
import { MockMediaBuyDatabase } from './database/media-buy.js';
import { MockCreativeDatabase } from './database/creative.js';

/**
 * Create a fully configured MCP server with all protocols enabled
 */
export function createMcpServer(config: {
  name: string;
  version?: string;
  agentUrl: string;
  enableSignals?: boolean;
  enableMediaBuy?: boolean;
  enableCreative?: boolean;
}): McpServer {
  const handlers: McpServerConfig['handlers'] = {};

  if (config.enableSignals !== false) {
    handlers.signals = new SignalsHandler({
      database: new MockSignalsDatabase(),
      agentUrl: config.agentUrl,
      agentName: config.name,
    });
  }

  if (config.enableMediaBuy !== false) {
    handlers.mediaBuy = new MediaBuyHandler({
      database: new MockMediaBuyDatabase(),
      agentUrl: config.agentUrl,
      agentName: config.name,
    });
  }

  if (config.enableCreative !== false) {
    handlers.creative = new CreativeHandler({
      database: new MockCreativeDatabase(),
      agentUrl: config.agentUrl,
      agentName: config.name,
    });
  }

  return new McpServer({
    name: config.name,
    version: config.version || VERSION,
    agentUrl: config.agentUrl,
    handlers,
  });
}

/**
 * Create a fully configured A2A server with all protocols enabled
 */
export function createA2aServer(config: {
  name: string;
  description?: string;
  url: string;
  version?: string;
  agentType: 'signal_agent' | 'sales_agent' | 'creative_agent';
  enableSignals?: boolean;
  enableMediaBuy?: boolean;
  enableCreative?: boolean;
}): A2aServer {
  const handlers: A2aServerConfig['handlers'] = {};

  if (config.enableSignals !== false) {
    handlers.signals = new SignalsHandler({
      database: new MockSignalsDatabase(),
      agentUrl: config.url,
      agentName: config.name,
    });
  }

  if (config.enableMediaBuy !== false) {
    handlers.mediaBuy = new MediaBuyHandler({
      database: new MockMediaBuyDatabase(),
      agentUrl: config.url,
      agentName: config.name,
    });
  }

  if (config.enableCreative !== false) {
    handlers.creative = new CreativeHandler({
      database: new MockCreativeDatabase(),
      agentUrl: config.url,
      agentName: config.name,
    });
  }

  return new A2aServer({
    name: config.name,
    description: config.description,
    url: config.url,
    version: config.version || VERSION,
    agentType: config.agentType,
    handlers,
  });
}
