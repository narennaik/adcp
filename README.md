# AdCP - Ad Context Protocol

[![Version](https://img.shields.io/badge/version-2.6.0-blue.svg)](https://github.com/narennaik/adcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

An open standard for advertising automation that enables AI agents to interact with advertising platforms through unified interfaces. AdCP works over MCP (Model Context Protocol) and A2A (Agent-to-Agent) transport layers.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Protocols](#protocols)
- [Transport Layers](#transport-layers)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Overview

AdCP (Ad Context Protocol) is a comprehensive TypeScript implementation of the advertising automation protocol specification. It provides a standardized way for AI agents to:

- **Discover and activate audience signals** across platforms
- **Plan and execute media buys** programmatically
- **Generate, validate, and preview creative assets**
- **Monitor campaign delivery and performance**

The protocol is designed to work with both human operators and autonomous AI agents, providing natural language interfaces alongside structured APIs.

## Features

### Protocols

| Protocol | Tasks | Description |
|----------|-------|-------------|
| **Signals** | 2 | Audience signal discovery and activation |
| **Media Buy** | 9 | Complete campaign lifecycle management |
| **Creative** | 3 | Creative generation, validation, and preview |

### Transport Layers

- **MCP (Model Context Protocol)** - JSON-RPC 2.0 based communication
- **A2A (Agent-to-Agent)** - Direct agent communication with SSE streaming

### Core Capabilities

- **adagents.json Authorization** - Publisher authorization system per RFC 8615
- **Brand Manifest** - Standardized advertiser identification
- **Creative Manifest** - Asset definitions with format specifications
- **Universal Macros** - 50+ dynamic placeholders for impression-time substitution
- **Mock Databases** - Ready-to-use implementations for development and testing

## Installation

```bash
# Clone the repository
git clone https://github.com/narennaik/adcp.git
cd adcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start

### Start the Test Server

```bash
npm run server
```

The server starts at `http://localhost:3000` with all protocols enabled.

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Help and available tools |
| `/health` | GET | Health check |
| `/info` | GET | Server information |
| `/tools` | GET | List all available tools |
| `/rpc` | POST | JSON-RPC 2.0 endpoint |
| `/call/{tool}` | POST | Direct tool invocation |

### Example: Discover Signals

```bash
curl -X POST http://localhost:3000/call/get_signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal_spec": "luxury automotive intenders",
    "deliver_to": {
      "deployments": [{"type": "platform", "platform": "dv360"}],
      "countries": ["US"]
    }
  }'
```

### Example: Create Media Buy

```bash
curl -X POST http://localhost:3000/call/create_media_buy \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_ref": "campaign-001",
    "brand_manifest": {
      "name": "Acme Corp",
      "url": "https://acme.example.com"
    },
    "start_time": "2024-02-01T00:00:00Z",
    "end_time": "2024-02-28T23:59:59Z",
    "packages": [{
      "buyer_ref": "pkg-001",
      "product_id": "premium_video",
      "pricing_option_id": "cpm_standard",
      "format_ids": [{"agent_url": "https://creative.example.com", "id": "video_15s"}],
      "budget": 10000,
      "currency": "USD"
    }]
  }'
```

### Example: Validate Creative

```bash
curl -X POST http://localhost:3000/call/validate_creative \
  -H "Content-Type: application/json" \
  -d '{
    "format_id": {"agent_url": "https://creative.example.com", "id": "display_300x250"},
    "creative_manifest": {
      "format_id": {"agent_url": "https://creative.example.com", "id": "display_300x250"},
      "assets": {
        "banner_image": {
          "url": "https://example.com/banner.jpg",
          "width": 300,
          "height": 250,
          "format": "jpg"
        },
        "clickthrough_url": {
          "url": "https://example.com/landing"
        }
      }
    }
  }'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AdCP System                              │
├─────────────────────────────────────────────────────────────────┤
│  Transport Layer                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │    MCP Server       │  │    A2A Server       │               │
│  │  (JSON-RPC 2.0)     │  │  (SSE Streaming)    │               │
│  └──────────┬──────────┘  └──────────┬──────────┘               │
│             │                        │                           │
├─────────────┴────────────────────────┴───────────────────────────┤
│  Protocol Layer                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Signals   │  │  Media Buy  │  │  Creative   │              │
│  │   Handler   │  │   Handler   │  │   Handler   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
├─────────┴────────────────┴────────────────┴──────────────────────┤
│  Core Layer                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │   Types    │ │   Brand    │ │  Creative  │ │   Macros   │    │
│  │            │ │  Manifest  │ │  Manifest  │ │            │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
├──────────────────────────────────────────────────────────────────┤
│  Database Layer                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Signals   │  │  Media Buy  │  │  Creative   │              │
│  │   Database  │  │  Database   │  │  Database   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## Protocols

### Signals Protocol

Discover and activate audience signals across advertising platforms.

| Task | Description |
|------|-------------|
| `get_signals` | Search for signals using natural language |
| `activate_signal` | Deploy signals to platforms/agents |

### Media Buy Protocol

Complete campaign lifecycle management.

| Task | Description |
|------|-------------|
| `get_products` | Discover advertising inventory |
| `list_creative_formats` | Get supported creative formats |
| `list_authorized_properties` | Get authorized publisher properties |
| `create_media_buy` | Create new campaigns |
| `update_media_buy` | Modify existing campaigns |
| `get_media_buy_delivery` | Get delivery metrics |
| `list_creatives` | List creative assets |
| `sync_creatives` | Upload/update creatives |
| `provide_performance_feedback` | Share performance data |

### Creative Protocol

Generate, validate, and preview creative assets.

| Task | Description |
|------|-------------|
| `build_creative` | Generate/transform creative manifests |
| `preview_creative` | Generate visual previews |
| `validate_creative` | Validate against format specs |

See [docs/PROTOCOLS.md](docs/PROTOCOLS.md) for detailed protocol documentation.

## Transport Layers

### MCP (Model Context Protocol)

JSON-RPC 2.0 based transport for tool-based interaction.

```typescript
import { createMcpServer } from 'adcp';

const server = createMcpServer({
  name: 'My AdCP Server',
  agentUrl: 'https://my-agent.example.com',
  enableSignals: true,
  enableMediaBuy: true,
  enableCreative: true,
});

// Handle JSON-RPC request
const response = await server.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'get_signals',
    arguments: { signal_spec: 'sports fans', deliver_to: { ... } }
  }
});
```

### A2A (Agent-to-Agent)

Direct agent communication with SSE streaming support.

```typescript
import { createA2aServer } from 'adcp';

const server = createA2aServer({
  name: 'My A2A Agent',
  url: 'https://my-agent.example.com',
  agentType: 'sales_agent',
  enableSignals: true,
  enableMediaBuy: true,
  enableCreative: true,
});

// Get agent card
const agentCard = server.getAgentCard();

// Handle task
const response = await server.handleTask({
  skill: 'get_signals',
  parts: [{ type: 'data', data: { signal_spec: 'sports fans', ... } }]
});
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CACHE_TTL_SECONDS` | `3600` | adagents.json cache TTL |
| `REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout |

### Server Configuration

```typescript
const server = createMcpServer({
  name: 'My Server',
  version: '1.0.0',
  agentUrl: 'https://my-agent.example.com',
  enableSignals: true,    // Enable Signals Protocol
  enableMediaBuy: true,   // Enable Media Buy Protocol
  enableCreative: true,   // Enable Creative Protocol
});
```

## API Reference

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for complete API documentation.

## Examples

### Programmatic Usage

```typescript
import {
  createMcpServer,
  MockSignalsDatabase,
  MockMediaBuyDatabase,
  MockCreativeDatabase,
  SignalsHandler,
  MediaBuyHandler,
  CreativeHandler,
} from 'adcp';

// Create with custom databases
const signalsHandler = new SignalsHandler({
  database: new MockSignalsDatabase(), // Replace with your implementation
  agentUrl: 'https://my-agent.example.com',
  agentName: 'My Agent',
});

// Direct handler usage
const result = await signalsHandler.getSignals({
  signal_spec: 'luxury automotive intenders',
  deliver_to: {
    deployments: [{ type: 'platform', platform: 'dv360' }],
    countries: ['US'],
  },
});

console.log(result.signals);
```

### Using Macros

```typescript
import { replaceMacros, ALL_MACROS } from 'adcp';

const template = 'https://track.example.com?cb={CACHEBUSTER}&gdpr={GDPR}';
const url = replaceMacros(template, {
  gdpr: '1',
  gdpr_consent: 'consent_string_here',
});
```

### Validating adagents.json

```typescript
import { CapabilityDiscoveryService } from 'adcp';

const discovery = new CapabilityDiscoveryService();

// Check if agent is authorized
const result = await discovery.isAgentAuthorized(
  'https://my-agent.example.com',
  'publisher.example.com'
);

if (result.authorized) {
  console.log('Authorized with scope:', result.scope);
}
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and design |
| [PROTOCOLS.md](docs/PROTOCOLS.md) | Protocol specifications |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | Complete API documentation |
| [SCOPE_AND_ASSUMPTIONS.md](docs/SCOPE_AND_ASSUMPTIONS.md) | Project scope and assumptions |
| [MOCK_IMPLEMENTATIONS.md](docs/MOCK_IMPLEMENTATIONS.md) | Mock database documentation |

## Project Structure

```
adcp/
├── src/
│   ├── core/                 # Core types and utilities
│   │   ├── types.ts          # Common type definitions
│   │   ├── brand-manifest.ts # Brand manifest types
│   │   ├── creative-manifest.ts # Creative manifest types
│   │   ├── macros.ts         # Universal macros
│   │   └── errors.ts         # Error handling
│   ├── protocols/            # Protocol implementations
│   │   ├── signals/          # Signals Protocol
│   │   ├── media-buy/        # Media Buy Protocol
│   │   └── creative/         # Creative Protocol
│   ├── transport/            # Transport layers
│   │   ├── mcp/              # MCP transport
│   │   └── a2a/              # A2A transport
│   ├── database/             # Database abstractions
│   │   ├── signals.ts        # Signals database
│   │   ├── media-buy.ts      # Media buy database
│   │   └── creative.ts       # Creative database
│   ├── utils/                # Utility modules
│   │   └── capability-discovery.ts # adagents.json handling
│   ├── index.ts              # Main exports
│   └── test-server.ts        # Development server
├── docs/                     # Documentation
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## References

- [AdCP Specification](https://docs.adcontextprotocol.org/docs/intro)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [A2A Protocol](https://github.com/google/a2a-protocol)
- [IAB Tech Lab](https://iabtechlab.com/)
