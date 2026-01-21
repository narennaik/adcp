# AdCP Protocols

Detailed documentation for all AdCP protocols, their purpose, and implementation details.

## Table of Contents

- [Overview](#overview)
- [Signals Protocol](#signals-protocol)
- [Media Buy Protocol](#media-buy-protocol)
- [Creative Protocol](#creative-protocol)
- [Cross-Protocol Concepts](#cross-protocol-concepts)
- [Protocol Extensions](#protocol-extensions)

---

## Overview

AdCP defines three protocols that work together to enable end-to-end advertising automation:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Advertising Workflow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   Signals    │────▶│  Media Buy   │────▶│   Creative   │       │
│   │   Protocol   │     │   Protocol   │     │   Protocol   │       │
│   └──────────────┘     └──────────────┘     └──────────────┘       │
│         │                     │                     │               │
│         ▼                     ▼                     ▼               │
│   Audience        Campaign Execution      Asset Management          │
│   Discovery       & Optimization          & Validation              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Protocol Summary

| Protocol | Purpose | Tasks | Complexity |
|----------|---------|-------|------------|
| **Signals** | Audience signal discovery and activation | 2 | Low |
| **Media Buy** | Complete campaign lifecycle management | 9 | High |
| **Creative** | Creative generation and validation | 3 | Medium |

---

## Signals Protocol

The Signals Protocol enables discovery and activation of audience signals across advertising platforms.

### Purpose

- **Discovery**: Find relevant audience segments using natural language
- **Activation**: Deploy signals to DSPs and other platforms
- **Cross-Platform**: Work across multiple platforms with unified identifiers

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Signals Protocol                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────┐      ┌────────────────────┐            │
│  │    get_signals     │      │  activate_signal   │            │
│  ├────────────────────┤      ├────────────────────┤            │
│  │ • NL query parsing │      │ • Deployment mgmt  │            │
│  │ • Multi-catalog    │      │ • Key generation   │            │
│  │ • Coverage data    │      │ • Status tracking  │            │
│  │ • Pricing info     │      │ • Multi-platform   │            │
│  └────────────────────┘      └────────────────────┘            │
│                                                                  │
│  Signal Types:                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │Marketplace│  │  Custom  │  │  Owned   │                      │
│  │(3rd party)│  │(private) │  │(1st party)│                     │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Signal Types

| Type | Description | Access | Example |
|------|-------------|--------|---------|
| **marketplace** | Third-party data provider segments | Public | "Luxury Auto Intenders" from Experian |
| **custom** | Private segments shared with specific buyers | Permissioned | Custom lookalike audience |
| **owned** | First-party data segments | Private | CRM customer list |

### Deployment Model

Signals can be deployed to two destination types:

#### Platform Deployment

Direct activation on DSP platforms:

```typescript
{
  type: 'platform',
  platform: 'dv360',      // Platform identifier
  account: 'advertiser123' // Account/seat ID
}
```

Supported platforms (examples):
- `dv360` - Google Display & Video 360
- `ttd` - The Trade Desk
- `xandr` - Xandr/AppNexus
- `amazon` - Amazon DSP

#### Agent Deployment

Activation through another sales agent:

```typescript
{
  type: 'agent',
  agent_url: 'https://other-agent.example.com',
  account: 'buyer456'
}
```

### Activation Keys

When a signal is activated, an activation key is returned:

```typescript
// Segment ID based
{
  type: 'segment_id',
  segment_id: 'platform_specific_segment_12345'
}

// Key-value based
{
  type: 'key_value',
  key: 'audience',
  value: 'luxury_auto_intenders'
}
```

### Workflow Example

```
1. Buyer queries for signals:
   "Find automotive intenders with high income in the US"

2. Signal Agent returns matching signals:
   - Luxury Automotive Intenders (Experian, 12% coverage, $3.50 CPM)
   - High Income Households (LiveRamp, 8% coverage, $2.75 CPM)

3. Buyer selects and activates signal:
   activate_signal("luxury_auto_intenders", [dv360, ttd])

4. Agent returns activation keys for each platform:
   - DV360: segment_id = "exp_luxury_auto_12345"
   - TTD: segment_id = "ttd_exp_luxury_auto_67890"

5. Buyer uses keys in campaign targeting
```

---

## Media Buy Protocol

The Media Buy Protocol provides complete campaign lifecycle management, from discovery to reporting.

### Purpose

- **Discovery**: Find suitable inventory products
- **Planning**: Create and configure campaigns
- **Execution**: Manage live campaigns
- **Reporting**: Monitor delivery and performance

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Media Buy Protocol                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Discovery Phase          Execution Phase          Reporting Phase  │
│  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐ │
│  │ get_products  │       │create_media_buy│       │get_media_buy_ │ │
│  │               │       │               │       │delivery       │ │
│  │list_creative_ │       │update_media_buy│       │               │ │
│  │formats        │       │               │       │provide_perf_  │ │
│  │               │       │sync_creatives │       │feedback       │ │
│  │list_authorized│       │               │       │               │ │
│  │_properties    │       │list_creatives │       │               │ │
│  └───────────────┘       └───────────────┘       └───────────────┘ │
│                                                                      │
│  Campaign Lifecycle:                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │Planning│─▶│ Booked │─▶│ Active │─▶│Complete│─▶│Analyzed│       │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Task Categories

#### Discovery Tasks (3)

| Task | Purpose |
|------|---------|
| `get_products` | Find inventory packages matching requirements |
| `list_creative_formats` | Get supported creative specifications |
| `list_authorized_properties` | Get publisher domains the agent represents |

#### Execution Tasks (4)

| Task | Purpose |
|------|---------|
| `create_media_buy` | Create new campaign with packages |
| `update_media_buy` | Modify existing campaigns (PATCH semantics) |
| `sync_creatives` | Upload/update creative assets |
| `list_creatives` | Query creative library |

#### Reporting Tasks (2)

| Task | Purpose |
|------|---------|
| `get_media_buy_delivery` | Retrieve delivery metrics |
| `provide_performance_feedback` | Share conversion/attribution data |

### Product Model

Products represent purchasable inventory packages:

```typescript
interface Product {
  product_id: string;
  name: string;
  description: string;

  // What's included
  publisher_properties: PublisherProperty[];
  format_ids: FormatId[];

  // How it's sold
  delivery_type: 'guaranteed' | 'non_guaranteed';
  delivery_measurement: DeliveryMeasurement;
  pricing_options: PricingOption[];

  // Constraints
  min_budget?: number;
  countries?: string[];
}
```

### Delivery Types

| Type | Description | Commitment |
|------|-------------|------------|
| **guaranteed** | Fixed delivery commitment | Publisher guarantees impressions |
| **non_guaranteed** | Best-effort delivery | No delivery guarantee |

### Pricing Models

| Model | Description | Use Case |
|-------|-------------|----------|
| `cpm` | Cost per mille (1000 impressions) | Standard display/video |
| `vcpm` | Viewable CPM | Brand campaigns |
| `cpcv` | Cost per completed view | Video completion |
| `cpc` | Cost per click | Performance campaigns |
| `cpv` | Cost per view | Video views |
| `flat_fee` | Fixed cost | Sponsorships |
| `share_of_voice` | Percentage of inventory | Takeovers |

### Media Buy Structure

```
Media Buy
├── buyer_ref: "campaign-2024-001"
├── brand_manifest: {...}
├── start_time: "2024-02-01T00:00:00Z"
├── end_time: "2024-02-28T23:59:59Z"
│
├── Package 1: Video Campaign
│   ├── product_id: "video_everywhere"
│   ├── budget: $50,000
│   ├── format_ids: [video_15s, video_30s]
│   └── targeting_overlay: {geo: US, freq_cap: 3/day}
│
└── Package 2: Display Retargeting
    ├── product_id: "premium_display"
    ├── budget: $25,000
    ├── format_ids: [display_300x250]
    └── targeting_overlay: {geo: US, device: desktop}
```

### Creative Management

The protocol supports two creative management approaches:

#### 1. Inline Creatives (at creation)

```typescript
create_media_buy({
  packages: [{
    // ...
    creatives: [{
      creative_id: "banner-001",
      assets: { /* ... */ }
    }]
  }]
})
```

#### 2. Separate Sync (after creation)

```typescript
// Create media buy first
create_media_buy({ packages: [{ creative_ids: ["banner-001"] }] })

// Then sync creatives
sync_creatives({
  creatives: [{ creative_id: "banner-001", assets: { /* ... */ } }],
  assignments: { "banner-001": ["package-001"] }
})
```

### Delivery Status Flow

```
pending ──────────┐
                  │
     ┌────────────▼────────────┐
     │       delivering        │
     │    (under_delivering)   │
     │    (over_delivering)    │
     └────────────┬────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
 completed   budget_exhausted  failed
 goal_met    flight_ended      paused
```

---

## Creative Protocol

The Creative Protocol handles creative asset generation, validation, and preview.

### Purpose

- **Generation**: Create creative manifests from brand assets
- **Validation**: Ensure compliance with format specifications
- **Preview**: Generate visual renderings for approval

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Creative Protocol                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ build_creative │  │validate_creative│  │preview_creative│    │
│  ├────────────────┤  ├────────────────┤  ├────────────────┤    │
│  │ • Transform    │  │ • Schema check │  │ • URL preview  │    │
│  │ • Generate     │  │ • Asset valid. │  │ • HTML preview │    │
│  │ • Optimize     │  │ • Spec match   │  │ • Batch mode   │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                  │
│  Format Specification:                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ format_id ─────────────────────────────────────────────  │  │
│  │ assets_required ──────────────────────────────────────── │  │
│  │   └─ asset_id, asset_type, constraints (size, duration) │  │
│  │ renders ──────────────────────────────────────────────── │  │
│  │   └─ render_id, role, dimensions, responsive            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Creative Manifest

The core data structure for creative assets:

```typescript
interface CreativeManifest {
  // Format identification
  format_id: FormatId;

  // Product information (for retail/commerce)
  promoted_offering?: PromotedOffering;

  // Asset library
  assets: Record<string, CreativeAsset>;

  // Tracking and measurement
  tracking_pixels?: TrackingPixel[];

  // Click handling
  click_actions?: ClickAction[];
}
```

### Asset Types

| Type | Description | Common Properties |
|------|-------------|-------------------|
| `image` | Static images | url, width, height, format |
| `video` | Video files | url, width, height, duration, format |
| `audio` | Audio files | url, duration, format |
| `text` | Text content | content |
| `url` | URLs/links | url |
| `html` | HTML content | content |
| `vast` | VAST XML | url or content |
| `daast` | DAAST XML | url or content |

### Format Specification

Defines requirements for a creative format:

```typescript
interface FormatSpecification {
  format_id: FormatId;
  name: string;
  type: FormatType;
  description?: string;

  // Asset requirements
  assets_required: AssetRequirement[];

  // Render configurations
  renders: Render[];
}

interface AssetRequirement {
  asset_id: string;
  asset_type: AssetType;
  required: boolean;

  // Dimension constraints
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  aspect_ratios?: string[];

  // Duration constraints (video/audio)
  min_duration_seconds?: number;
  max_duration_seconds?: number;

  // File constraints
  max_file_size_bytes?: number;
  allowed_formats?: string[];
}
```

### Validation Process

```
┌─────────────────────────────────────────────────────────────┐
│                   Validation Pipeline                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Format ID Check                                          │
│     └─ Does manifest.format_id match specification?          │
│                                                              │
│  2. Required Assets Check                                    │
│     └─ Are all required assets present?                      │
│                                                              │
│  3. Asset Type Validation                                    │
│     └─ Does each asset match expected type?                  │
│                                                              │
│  4. Dimension Validation                                     │
│     └─ Are dimensions within constraints?                    │
│                                                              │
│  5. Duration Validation                                      │
│     └─ Is duration within constraints?                       │
│                                                              │
│  6. File Size Validation                                     │
│     └─ Is file size within limits?                           │
│                                                              │
│  7. Format Validation                                        │
│     └─ Is file format in allowed list?                       │
│                                                              │
│  Result: { valid: boolean, errors: [], warnings: [] }        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Validation Modes

| Mode | Behavior |
|------|----------|
| **strict** | All violations are errors |
| **lenient** | Some violations become warnings (e.g., dimensions) |

### Preview Generation

Previews can be generated in multiple formats:

| Format | Output | Use Case |
|--------|--------|----------|
| `url` | Hosted preview URL | Quick sharing |
| `html` | Inline HTML | Embedding |
| `both` | Both URL and HTML | Full flexibility |

#### Single Preview

```typescript
preview_creative({
  request_type: 'single',
  format_id: {...},
  creative_manifest: {...},
  inputs: [
    { name: 'variant-a', headline: 'Summer Sale!' },
    { name: 'variant-b', headline: 'Limited Time!' }
  ],
  output_format: 'both'
})
```

#### Batch Preview

```typescript
preview_creative({
  request_type: 'batch',
  requests: [
    { format_id: {...}, creative_manifest: {...} },
    { format_id: {...}, creative_manifest: {...} }
  ]
})
```

---

## Cross-Protocol Concepts

### Brand Manifest

Shared across protocols for consistent brand representation:

```typescript
interface BrandManifest {
  url?: string;           // Brand website
  name?: string;          // Brand name
  logos?: Logo[];         // Logo assets
  colors?: BrandColors;   // Color palette
  fonts?: BrandFonts;     // Typography
  tone?: string;          // Voice/tone description
  tagline?: string;       // Slogan
  product_catalog?: ProductCatalog;  // E-commerce feed
  disclaimers?: Disclaimer[];        // Legal text
}
```

### Format ID

Universal creative format identification:

```typescript
interface FormatId {
  agent_url: string;  // Authoritative agent URL
  id: string;         // Format identifier
}

// Example
{
  agent_url: "https://creative.adcontextprotocol.org",
  id: "display_300x250"
}
```

### Context ID

Request correlation across protocol calls:

```typescript
// Response includes context_id
{
  message: "Found 5 products",
  context_id: "ctx-abc123",
  products: [...]
}

// Can be passed to subsequent requests
{
  context_id: "ctx-abc123",  // Continue context
  // ...
}
```

### Universal Macros

Dynamic placeholders replaced at impression time:

```typescript
// Tracking URL with macros
"https://track.example.com?cb={CACHEBUSTER}&gdpr={GDPR}&consent={GDPR_CONSENT}"

// Click URL with macros
"https://click.example.com?creative={CREATIVE_ID}&campaign={MEDIA_BUY_ID}"
```

See [macros documentation](../src/core/macros.ts) for full list.

---

## Protocol Extensions

### adagents.json

Publisher authorization file at `/.well-known/adagents.json`:

```json
{
  "version": "1.0",
  "contact": {
    "name": "Publisher Inc",
    "email": "adops@publisher.com",
    "domain": "publisher.com"
  },
  "properties": [
    {
      "property_id": "main-site",
      "property_type": "website",
      "name": "Main Website",
      "identifiers": [
        {"type": "domain", "value": "publisher.com"}
      ]
    }
  ],
  "authorized_agents": [
    {
      "url": "https://agent.example.com",
      "authorized_for": "Programmatic display and video sales",
      "scope": "full",
      "valid_from": "2024-01-01",
      "valid_until": "2024-12-31",
      "channels": ["display", "video"]
    }
  ]
}
```

### Authorization Scopes

| Scope | Description |
|-------|-------------|
| `full` | All inventory authorized |
| `partial` | Limited to specified channels/properties |
| `exclusive` | Exclusive representation |
| `non_exclusive` | Non-exclusive representation |

### Authorization Types

| Type | Description |
|------|-------------|
| `property_ids` | Specific property IDs listed |
| `property_tags` | Properties matching tags |
| `inline_properties` | Properties defined inline |
| `publisher_properties` | Multi-publisher references |

### MCP Extension

AdCP extends MCP with advertising-specific metadata:

```typescript
interface McpServerInfo {
  name: string;
  version: string;
  description?: string;

  // AdCP extension
  adcp?: {
    protocol_version: string;
    supported_domains: ('signals' | 'media_buy' | 'creative')[];
    agent_url: string;
  };
}
```

### A2A Extension

AdCP extends A2A agent cards:

```typescript
interface A2aAgentCard {
  name: string;
  description?: string;
  url: string;
  skills: A2aSkill[];

  // AdCP extension
  extensions?: {
    adcp?: {
      protocol_version: string;
      domains: string[];
      agent_type: 'signal_agent' | 'sales_agent' | 'creative_agent';
    };
  };
}
```
