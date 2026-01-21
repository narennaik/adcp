# Scope and Assumptions

This document outlines the scope of the AdCP implementation, design decisions, assumptions made, and known limitations.

## Table of Contents

- [Project Scope](#project-scope)
- [Design Decisions](#design-decisions)
- [Assumptions](#assumptions)
- [Known Limitations](#known-limitations)
- [Future Considerations](#future-considerations)

## Project Scope

### In Scope

#### Protocols Implemented

| Protocol | Status | Tasks |
|----------|--------|-------|
| **Signals Protocol** | Complete | `get_signals`, `activate_signal` |
| **Media Buy Protocol** | Complete | All 9 tasks |
| **Creative Protocol** | Complete | All 3 tasks |

#### Transport Layers

| Transport | Status | Features |
|-----------|--------|----------|
| **MCP** | Complete | JSON-RPC 2.0, tool definitions, session management |
| **A2A** | Complete | Task handling, SSE streaming types, agent cards |

#### Core Features

- Type definitions for all protocol entities
- Brand Manifest specification
- Creative Manifest specification
- Universal Macros (50+ placeholders)
- adagents.json authorization system
- Error handling framework
- Mock database implementations

### Out of Scope

The following items are intentionally not included in this implementation:

1. **Production Database Implementations**
   - Only mock/in-memory databases provided
   - Production implementations require integration with actual data stores

2. **Authentication/Authorization Middleware**
   - Principal extraction from tokens
   - OAuth/JWT validation
   - Rate limiting

3. **Actual Creative Generation**
   - AI-powered creative generation
   - Image/video manipulation
   - Real asset processing

4. **Platform Integrations**
   - DV360, TTD, Xandr connectors
   - SSP/DSP API integrations
   - Real signal activation

5. **Monitoring/Observability**
   - Metrics collection
   - Distributed tracing
   - Alerting

6. **High Availability**
   - Clustering
   - Load balancing
   - Failover handling

## Design Decisions

### 1. TypeScript-First Approach

**Decision**: Implement entirely in TypeScript with strict typing.

**Rationale**:
- Strong type safety catches errors at compile time
- Self-documenting code through type definitions
- Better IDE support and developer experience
- Easy to generate API documentation from types

**Trade-offs**:
- Requires compilation step
- Larger bundle size compared to plain JavaScript

### 2. Interface-Based Database Layer

**Decision**: Define database operations as interfaces with mock implementations.

**Rationale**:
- Enables dependency injection for testing
- Allows swapping implementations without changing business logic
- Clear contract for what operations are needed
- Mock implementations enable immediate testing

**Example**:
```typescript
interface SignalsDatabase {
  searchSignals(params: SearchSignalsParams): Promise<Signal[]>;
  // ...
}

class MockSignalsDatabase implements SignalsDatabase {
  // In-memory implementation
}

class PostgresSignalsDatabase implements SignalsDatabase {
  // Production implementation
}
```

### 3. Handler Pattern for Protocols

**Decision**: Each protocol implemented as a handler class with method-per-task.

**Rationale**:
- Clear separation of concerns
- Easy to test individual tasks
- Consistent pattern across protocols
- Handlers can be composed or extended

### 4. Factory Functions for Server Creation

**Decision**: Provide `createMcpServer()` and `createA2aServer()` factory functions.

**Rationale**:
- Simplified API for common use cases
- Sensible defaults while allowing customization
- Hides complexity of wiring handlers together

### 5. RFC 8615 for adagents.json

**Decision**: Follow RFC 8615 well-known URI convention.

**Rationale**:
- Standard location (`/.well-known/adagents.json`)
- Consistent with industry practices (robots.txt, security.txt)
- Easy to discover and validate

### 6. Immutable Response Objects

**Decision**: All response objects treated as immutable.

**Rationale**:
- Prevents accidental mutation
- Easier to reason about
- Better for caching
- Functional programming benefits

### 7. Context ID for Request Correlation

**Decision**: Every response includes a `context_id` for request correlation.

**Rationale**:
- Enables request tracing across systems
- Useful for debugging and support
- Can be provided by client or auto-generated

## Assumptions

### Protocol Assumptions

#### 1. Signal Deployment Model

**Assumption**: Signals can be deployed to either platforms (DSPs) or other sales agents.

```typescript
type Destination = PlatformDestination | AgentDestination;
```

**Implications**:
- Platform deployments require platform-specific activation
- Agent deployments may require inter-agent communication

#### 2. Creative Format Authority

**Assumption**: Creative formats are defined by authoritative agents identified by URL.

```typescript
interface FormatId {
  agent_url: string;  // Authoritative agent
  id: string;         // Format identifier
}
```

**Implications**:
- Format specifications must be fetched from authoritative agents
- Multiple agents may define the same format differently

#### 3. Authorization Hierarchy

**Assumption**: Authorization flows from publishers to sales agents.

```
Publisher → adagents.json → Sales Agent → Buyer
```

**Implications**:
- Publishers control who can sell their inventory
- Sales agents must be listed in publisher's adagents.json
- Buyers interact through authorized agents

### Technical Assumptions

#### 1. Node.js Runtime

**Assumption**: System runs in Node.js 18+ environment.

**Implications**:
- Native fetch API available
- ES modules supported
- Async/await patterns used throughout

#### 2. JSON-Based Communication

**Assumption**: All API communication uses JSON.

**Implications**:
- Binary assets referenced by URL, not embedded
- No support for Protocol Buffers or other binary formats
- Request/response bodies are JSON

#### 3. HTTP/HTTPS Transport

**Assumption**: External communication uses HTTP/HTTPS.

**Implications**:
- No WebSocket support for real-time updates (SSE used instead)
- Standard HTTP methods (GET, POST)
- RESTful principles where applicable

#### 4. UTC Timestamps

**Assumption**: All timestamps are in ISO 8601 format with UTC timezone.

```typescript
interface DateRange {
  start: string; // "2024-01-15T00:00:00Z"
  end: string;   // "2024-01-31T23:59:59Z"
}
```

**Implications**:
- No timezone conversion logic needed in core
- Clients responsible for local timezone display

#### 5. Currency Handling

**Assumption**: Currency amounts are decimals with ISO 4217 currency codes.

```typescript
interface Pricing {
  cpm?: number;     // 2.50
  currency: string; // "USD"
}
```

**Implications**:
- No currency conversion
- Floating point precision acceptable for display
- Exact calculations should use integer cents in production

### Data Assumptions

#### 1. Signal Data Structure

**Assumption**: Signals have universal IDs that are unique across providers.

```typescript
interface Signal {
  signal_agent_segment_id: string;  // Globally unique
  data_provider: string;            // Source organization
  // ...
}
```

#### 2. Product Availability

**Assumption**: Product availability can change between discovery and purchase.

**Implications**:
- Products should include freshness indicators
- Buyers should handle "product unavailable" errors
- Caching of product data should be time-limited

#### 3. Creative Asset Hosting

**Assumption**: Creative assets are hosted externally and referenced by URL.

```typescript
interface CreativeAsset {
  url?: string;  // External URL
  // ...
}
```

**Implications**:
- No asset upload/storage in this system
- URL validation but not content validation
- Asset availability is external concern

## Known Limitations

### 1. Mock Database Limitations

| Limitation | Description |
|------------|-------------|
| No persistence | Data lost on restart |
| Limited queries | Basic filtering only |
| No transactions | No ACID guarantees |
| Single instance | No clustering support |

### 2. Authentication Limitations

| Limitation | Description |
|------------|-------------|
| No token validation | Principal passed through without verification |
| No rate limiting | Unlimited requests allowed |
| No IP filtering | All sources accepted |

### 3. Creative Processing Limitations

| Limitation | Description |
|------------|-------------|
| No actual generation | Returns placeholder assets |
| No validation | Asset URLs not fetched/verified |
| No transformation | Resizing/transcoding not performed |

### 4. Signal Activation Limitations

| Limitation | Description |
|------------|-------------|
| Mock activation | No actual platform integration |
| Simulated keys | Activation keys are generated, not real |
| No real-time status | Deployment status is simulated |

### 5. Delivery Reporting Limitations

| Limitation | Description |
|------------|-------------|
| Synthetic metrics | No real impression data |
| No external feeds | No integration with ad servers |
| Static data | Metrics don't update over time |

## Future Considerations

### Short-term Improvements

1. **Input Validation**
   - Add Zod schema validation for all requests
   - Stricter type checking at runtime
   - Better error messages

2. **Testing**
   - Unit tests for all handlers
   - Integration tests for transport layers
   - End-to-end tests for common flows

3. **Documentation**
   - OpenAPI/Swagger specification
   - Interactive API documentation
   - More code examples

### Medium-term Enhancements

1. **Production Database Support**
   - PostgreSQL implementation
   - Redis caching layer
   - Connection pooling

2. **Authentication**
   - JWT validation
   - OAuth 2.0 support
   - API key management

3. **Monitoring**
   - Prometheus metrics
   - OpenTelemetry tracing
   - Health check endpoints

### Long-term Vision

1. **Platform Integrations**
   - DV360 connector
   - The Trade Desk connector
   - Meta Ads connector

2. **AI Integration**
   - LLM-powered signal discovery
   - Creative generation with DALL-E/Midjourney
   - Natural language campaign optimization

3. **Multi-tenancy**
   - Workspace isolation
   - Per-tenant configuration
   - Usage billing

## Compatibility Notes

### Protocol Version

This implementation targets **AdCP Protocol Version 2.6**.

### Breaking Changes from Earlier Versions

If upgrading from earlier versions, note these changes:

1. **adagents.json location changed** to `/.well-known/adagents.json` (RFC 8615)
2. **Authorization types renamed**: `inline` → `inline_properties`, `publisher` → `publisher_properties`
3. **New required fields**: `is_live` in `ActivationDeployment`

### Forward Compatibility

The implementation is designed for forward compatibility:

- Unknown fields in requests are ignored
- Responses may include additional fields
- New optional parameters can be added without breaking existing integrations
