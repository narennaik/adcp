# AdCP Architecture

This document describes the architecture of the AdCP (Ad Context Protocol) implementation.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Layer Descriptions](#layer-descriptions)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Design Patterns](#design-patterns)
- [Extension Points](#extension-points)
- [Security Considerations](#security-considerations)

## Overview

AdCP is designed with a layered architecture that separates concerns and enables flexibility in deployment and extension. The system consists of four primary layers:

1. **Transport Layer** - Handles communication protocols (MCP, A2A)
2. **Protocol Layer** - Implements business logic for each protocol
3. **Core Layer** - Provides shared types, utilities, and manifests
4. **Database Layer** - Abstracts data persistence

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                             │
│                    (AI Agents, DSPs, Trading Desks, etc.)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Transport Layer                                   │
│  ┌────────────────────────────┐    ┌────────────────────────────┐          │
│  │       MCP Server           │    │       A2A Server           │          │
│  │  ┌──────────────────────┐  │    │  ┌──────────────────────┐  │          │
│  │  │   JSON-RPC Router    │  │    │  │    Task Router       │  │          │
│  │  ├──────────────────────┤  │    │  ├──────────────────────┤  │          │
│  │  │   Tool Registry      │  │    │  │    Skill Registry    │  │          │
│  │  ├──────────────────────┤  │    │  ├──────────────────────┤  │          │
│  │  │   Session Manager    │  │    │  │    SSE Manager       │  │          │
│  │  └──────────────────────┘  │    │  └──────────────────────┘  │          │
│  └────────────────────────────┘    └────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Protocol Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Signals Handler │  │Media Buy Handler│  │Creative Handler │             │
│  │                 │  │                 │  │                 │             │
│  │ • get_signals   │  │ • get_products  │  │ • build_creative│             │
│  │ • activate_     │  │ • list_formats  │  │ • preview_      │             │
│  │   signal        │  │ • list_props    │  │   creative      │             │
│  │                 │  │ • create_buy    │  │ • validate_     │             │
│  │                 │  │ • update_buy    │  │   creative      │             │
│  │                 │  │ • get_delivery  │  │                 │             │
│  │                 │  │ • list_creative │  │                 │             │
│  │                 │  │ • sync_creative │  │                 │             │
│  │                 │  │ • feedback      │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Core Layer                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │    Types    │ │    Brand    │ │  Creative   │ │   Macros    │           │
│  │             │ │  Manifest   │ │  Manifest   │ │             │           │
│  │ • TaskStatus│ │ • Logo      │ │ • Assets    │ │ • Common    │           │
│  │ • FormatId  │ │ • Colors    │ │ • Renders   │ │ • Privacy   │           │
│  │ • Pricing   │ │ • Fonts     │ │ • Formats   │ │ • Device    │           │
│  │ • Targeting │ │ • Products  │ │ • Validation│ │ • Geo       │           │
│  │ • Delivery  │ │ • Disclaimr │ │             │ │ • Video     │           │
│  │ • Channel   │ │             │ │             │ │ • DOOH      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                             │
│  ┌─────────────┐ ┌─────────────────────────────────────────────┐           │
│  │   Errors    │ │          Capability Discovery               │           │
│  │             │ │                                             │           │
│  │ • AdcpError │ │ • adagents.json fetching                    │           │
│  │ • ErrorCodes│ │ • Authorization validation                  │           │
│  │             │ │ • Caching                                   │           │
│  └─────────────┘ └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Database Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │SignalsDatabase  │  │MediaBuyDatabase │  │CreativeDatabase │             │
│  │   (Interface)   │  │   (Interface)   │  │   (Interface)   │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ MockSignals     │  │ MockMediaBuy    │  │ MockCreative    │             │
│  │   Database      │  │   Database      │  │   Database      │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### Transport Layer

The transport layer handles all communication with external clients. It provides two transport implementations:

#### MCP Server (`src/transport/mcp/`)

- **Purpose**: Implements the Model Context Protocol for tool-based AI interaction
- **Protocol**: JSON-RPC 2.0
- **Key Components**:
  - `McpServer`: Main server class
  - Tool definitions and routing
  - Session management
  - Async task tracking

#### A2A Server (`src/transport/a2a/`)

- **Purpose**: Implements Agent-to-Agent protocol for direct agent communication
- **Protocol**: HTTP/SSE
- **Key Components**:
  - `A2aServer`: Main server class
  - Agent card generation
  - Skill routing
  - SSE streaming for real-time updates
  - Webhook support

### Protocol Layer

The protocol layer implements the business logic for each AdCP protocol.

#### Signals Handler (`src/protocols/signals/`)

```
SignalsHandler
├── getSignals(request, principal?)
│   ├── Validate request
│   ├── Query database
│   ├── Enrich with deployment info
│   └── Return formatted response
│
└── activateSignal(request, principal?)
    ├── Validate signal exists
    ├── Check authorization
    ├── Process each deployment
    └── Return activation keys
```

#### Media Buy Handler (`src/protocols/media-buy/`)

```
MediaBuyHandler
├── getProducts(request, principal?)
├── listCreativeFormats(request, principal?)
├── listAuthorizedProperties(request, principal?)
├── createMediaBuy(request, principal?)
├── updateMediaBuy(request, principal?)
├── getMediaBuyDelivery(request, principal?)
├── listCreatives(request, principal?)
├── syncCreatives(request, principal?)
└── providePerformanceFeedback(request, principal?)
```

#### Creative Handler (`src/protocols/creative/`)

```
CreativeHandler
├── listCreativeFormats(request, principal?)
├── buildCreative(request, principal?)
├── previewCreative(request, principal?)
│   ├── handleSinglePreview()
│   └── handleBatchPreview()
└── validateCreative(request, principal?)
```

### Core Layer

The core layer provides shared functionality used across all protocols.

#### Types (`src/core/types.ts`)

Defines common types used throughout the system:

- `TaskStatus` - Workflow states
- `FormatId` - Creative format identification
- `Pricing` / `PricingOption` - Pricing models
- `TargetingOverlay` - Targeting constraints
- `DeliveryMetrics` - Performance metrics
- `Channel` - Advertising channels
- `Principal` - Authentication context

#### Brand Manifest (`src/core/brand-manifest.ts`)

Standardized advertiser identification:

```typescript
interface BrandManifest {
  url?: string;
  name?: string;
  logos?: Logo[];
  colors?: BrandColors;
  fonts?: BrandFonts;
  tone?: string;
  tagline?: string;
  assets?: BrandAsset[];
  product_catalog?: ProductCatalog;
  disclaimers?: Disclaimer[];
}
```

#### Creative Manifest (`src/core/creative-manifest.ts`)

Asset definitions for creative execution:

```typescript
interface CreativeManifest {
  format_id: FormatId;
  promoted_offering?: PromotedOffering;
  assets: Record<string, CreativeAsset>;
  tracking_pixels?: TrackingPixel[];
  click_actions?: ClickAction[];
}
```

#### Macros (`src/core/macros.ts`)

50+ dynamic placeholders organized by category:

- **Common**: MEDIA_BUY_ID, PACKAGE_ID, CREATIVE_ID, CACHEBUSTER
- **Privacy**: GDPR, GDPR_CONSENT, US_PRIVACY, GPP_STRING
- **Device**: DEVICE_TYPE, OS, DEVICE_MAKE, DEVICE_MODEL
- **Geo**: COUNTRY, REGION, CITY, DMA, LAT, LONG
- **Identity**: DEVICE_ID, DEVICE_ID_TYPE
- **Video**: VIDEO_ID, VIDEO_DURATION, POD_POSITION
- **DOOH**: SCREEN_ID, VENUE_TYPE, PLAY_TIMESTAMP

### Database Layer

The database layer provides abstractions for data persistence with interface definitions and mock implementations.

```typescript
// Interface pattern
interface SignalsDatabase {
  searchSignals(params: SearchSignalsParams): Promise<Signal[]>;
  getSignal(signalId: string): Promise<Signal | null>;
  checkSignalAccess(signalId: string, principalId?: string): Promise<boolean>;
  getSignalDeploymentStatus(...): Promise<SignalDeployment | null>;
  activateSignal(...): Promise<ActivationResult>;
}

// Mock implementation
class MockSignalsDatabase implements SignalsDatabase {
  // In-memory implementation for testing
}
```

## Data Flow

### Request Processing Flow

```
1. Client Request
       │
       ▼
2. Transport Layer
   • Parse request
   • Validate format
   • Extract context
       │
       ▼
3. Protocol Handler
   • Validate parameters
   • Check authorization
   • Execute business logic
       │
       ▼
4. Database Layer
   • Query/mutate data
   • Return results
       │
       ▼
5. Response Formation
   • Format response
   • Add context_id
   • Return to client
```

### Signal Activation Flow

```
Client                  Transport           Signals Handler         Database
   │                        │                      │                    │
   │  activate_signal       │                      │                    │
   │───────────────────────>│                      │                    │
   │                        │  callTool()          │                    │
   │                        │─────────────────────>│                    │
   │                        │                      │  getSignal()       │
   │                        │                      │───────────────────>│
   │                        │                      │                    │
   │                        │                      │<───────────────────│
   │                        │                      │                    │
   │                        │                      │  For each deployment:
   │                        │                      │  activateSignal()  │
   │                        │                      │───────────────────>│
   │                        │                      │                    │
   │                        │                      │<───────────────────│
   │                        │                      │  activation_key    │
   │                        │<─────────────────────│                    │
   │  { deployments: [...] }│                      │                    │
   │<───────────────────────│                      │                    │
```

### Creative Validation Flow

```
Client                  Transport         Creative Handler         Database
   │                        │                     │                    │
   │  validate_creative     │                     │                    │
   │───────────────────────>│                     │                    │
   │                        │  callTool()         │                    │
   │                        │────────────────────>│                    │
   │                        │                     │  getFormatSpec()   │
   │                        │                     │───────────────────>│
   │                        │                     │                    │
   │                        │                     │<───────────────────│
   │                        │                     │  FormatSpecification
   │                        │                     │                    │
   │                        │                     │  validateCreative  │
   │                        │                     │  Manifest()        │
   │                        │                     │  (internal)        │
   │                        │                     │                    │
   │                        │<────────────────────│                    │
   │  { valid, errors }     │                     │                    │
   │<───────────────────────│                     │                    │
```

## Design Patterns

### 1. Handler Pattern

Each protocol implements a handler class that encapsulates all operations:

```typescript
class SignalsHandler {
  private db: SignalsDatabase;
  private agentUrl: string;
  private agentName: string;

  constructor(config: SignalsHandlerConfig) { ... }

  async getSignals(request, principal?): Promise<GetSignalsResponse> { ... }
  async activateSignal(request, principal?): Promise<ActivateSignalResponse> { ... }
}
```

### 2. Repository Pattern

Database interfaces abstract data access:

```typescript
interface MediaBuyDatabase {
  getProducts(params): Promise<Product[]>;
  createMediaBuy(params): Promise<CreateMediaBuyResult>;
  // ...
}
```

### 3. Factory Pattern

Server creation is simplified with factory functions:

```typescript
const mcpServer = createMcpServer({
  name: 'My Server',
  agentUrl: 'https://...',
  enableSignals: true,
  enableMediaBuy: true,
  enableCreative: true,
});
```

### 4. Strategy Pattern

Transport layers implement different communication strategies:

```typescript
// MCP uses JSON-RPC
class McpServer {
  async handleRequest(request: McpRequest): Promise<McpResponse> { ... }
}

// A2A uses task-based messaging
class A2aServer {
  async handleTask(request: A2aTaskRequest): Promise<A2aTaskResponse> { ... }
}
```

## Extension Points

### Custom Database Implementation

Replace mock databases with production implementations:

```typescript
class PostgresSignalsDatabase implements SignalsDatabase {
  constructor(private pool: Pool) {}

  async searchSignals(params: SearchSignalsParams): Promise<Signal[]> {
    const result = await this.pool.query(
      'SELECT * FROM signals WHERE ...',
      [params.query]
    );
    return result.rows.map(this.mapToSignal);
  }
  // ... implement other methods
}
```

### Custom Transport Layer

Add new transport protocols:

```typescript
class GraphQLServer {
  constructor(private handlers: { signals?, mediaBuy?, creative? }) {}

  getSchema() {
    return buildSchema(`
      type Query {
        getSignals(signalSpec: String!, deliverTo: DeliverToInput!): SignalsResponse
      }
      // ...
    `);
  }
}
```

### Middleware/Hooks

Add cross-cutting concerns:

```typescript
class InstrumentedHandler extends SignalsHandler {
  async getSignals(request, principal?) {
    const start = Date.now();
    try {
      const result = await super.getSignals(request, principal);
      metrics.record('get_signals', Date.now() - start, 'success');
      return result;
    } catch (error) {
      metrics.record('get_signals', Date.now() - start, 'error');
      throw error;
    }
  }
}
```

## Security Considerations

### Authorization Flow

```
1. Client provides principal (auth token/context)
       │
       ▼
2. Transport layer extracts principal info
       │
       ▼
3. Handler validates principal against operation
       │
       ▼
4. adagents.json checked for sales agent authorization
       │
       ▼
5. Database layer may apply additional access controls
```

### adagents.json Authorization

Publishers declare authorized agents via `/.well-known/adagents.json`:

```json
{
  "version": "1.0",
  "contact": {
    "name": "Publisher Inc",
    "email": "adops@publisher.com"
  },
  "authorized_agents": [
    {
      "url": "https://agent.example.com",
      "authorized_for": "Programmatic sales",
      "scope": "full",
      "valid_from": "2024-01-01",
      "valid_until": "2024-12-31"
    }
  ]
}
```

### Input Validation

All handlers validate inputs before processing:

```typescript
async validateCreative(request, principal?) {
  // Validate required fields
  if (!request.format_id) {
    throw new AdcpError('INVALID_REQUEST', 'format_id is required');
  }
  if (!request.creative_manifest) {
    throw new AdcpError('INVALID_REQUEST', 'creative_manifest is required');
  }
  // ... proceed with validated input
}
```

### Error Handling

Structured error responses with appropriate codes:

```typescript
class AdcpError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      ...this.details,
    };
  }
}
```

## Performance Considerations

### Caching

- adagents.json responses are cached with configurable TTL (default: 1 hour)
- Format specifications can be cached in database layer
- Session context cached for request correlation

### Async Processing

- Long-running operations support async task tracking
- Status polling via `tasks/get` endpoint
- Webhook notifications for task completion

### Connection Pooling

Database implementations should use connection pooling:

```typescript
class PostgresMediaBuyDatabase {
  constructor(private pool: Pool) {} // Shared pool

  async getProducts(params) {
    const client = await this.pool.connect();
    try {
      // ... use client
    } finally {
      client.release(); // Return to pool
    }
  }
}
```
