# Mock Implementations

This document describes the mock database implementations provided with AdCP for development and testing purposes.

## Table of Contents

- [Overview](#overview)
- [Mock Signals Database](#mock-signals-database)
- [Mock Media Buy Database](#mock-media-buy-database)
- [Mock Creative Database](#mock-creative-database)
- [Extending Mock Data](#extending-mock-data)
- [Creating Production Implementations](#creating-production-implementations)

## Overview

AdCP provides mock database implementations for all three protocols. These mocks:

- Store data in memory
- Include realistic sample data
- Implement full interface contracts
- Enable immediate testing without external dependencies

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Database Interfaces                     │
├─────────────────┬─────────────────┬─────────────────────┤
│ SignalsDatabase │ MediaBuyDatabase│ CreativeDatabase    │
├─────────────────┼─────────────────┼─────────────────────┤
│ MockSignals     │ MockMediaBuy    │ MockCreative        │
│ Database        │ Database        │ Database            │
└─────────────────┴─────────────────┴─────────────────────┘
```

## Mock Signals Database

**File**: `src/database/signals.ts`

### Interface

```typescript
interface SignalsDatabase {
  searchSignals(params: SearchSignalsParams): Promise<Signal[]>;
  getSignal(signalId: string): Promise<Signal | null>;
  checkSignalAccess(signalId: string, principalId?: string): Promise<boolean>;
  getSignalDeploymentStatus(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<SignalDeployment | null>;
  activateSignal(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<ActivationResult>;
}
```

### Pre-loaded Data

The mock database includes 5 sample signals:

| Signal ID | Name | Type | Provider | Coverage | CPM |
|-----------|------|------|----------|----------|-----|
| `luxury_auto_intenders` | Luxury Automotive Intenders | marketplace | Experian | 12% | $3.50 |
| `high_income_households` | High Income Households | marketplace | LiveRamp | 8% | $2.75 |
| `sports_enthusiasts` | Sports Enthusiasts | marketplace | Oracle | 25% | $1.50 |
| `travel_intenders_2024` | Travel Intenders 2024 | marketplace | Peer39 | 15% | $2.00 |
| `custom_brand_loyalists` | Brand Loyalists (Custom) | custom | First-Party | 5% | - |

### Search Behavior

The `searchSignals` method performs:

1. **Keyword matching** - Case-insensitive search in name and description
2. **Catalog type filtering** - Filter by `marketplace`, `custom`, or `owned`
3. **Provider filtering** - Filter by specific data providers
4. **CPM filtering** - Filter by maximum CPM threshold
5. **Coverage filtering** - Filter by minimum coverage percentage
6. **Result limiting** - Cap results at specified maximum

### Activation Behavior

When `activateSignal` is called:

1. Checks if signal exists
2. Creates activation record in memory
3. Generates unique activation key: `{signalId}_{type}_{timestamp}`
4. Returns immediately with `is_live: true`

### Usage Example

```typescript
import { MockSignalsDatabase } from 'adcp';

const db = new MockSignalsDatabase();

// Search for signals
const signals = await db.searchSignals({
  query: 'automotive',
  catalogTypes: ['marketplace'],
  maxCpm: 5.0,
  maxResults: 10,
});

// Activate a signal
const result = await db.activateSignal(
  'luxury_auto_intenders',
  { type: 'platform', platform: 'dv360', account: 'advertiser123' }
);

console.log(result.activation_key);
// { type: 'segment_id', segment_id: 'luxury_auto_intenders_platform_1705847293847' }
```

## Mock Media Buy Database

**File**: `src/database/media-buy.ts`

### Interface

```typescript
interface MediaBuyDatabase {
  getProducts(params: GetProductsParams): Promise<GetProductsResult>;
  getProduct(productId: string): Promise<Product | null>;
  getProperties(params: GetPropertiesParams): Promise<GetPropertiesResult>;
  getCreativeFormats(params: GetFormatsParams): Promise<GetFormatsResult>;
  createMediaBuy(params: CreateMediaBuyParams): Promise<CreateMediaBuyResult>;
  updateMediaBuy(params: UpdateMediaBuyParams): Promise<UpdateMediaBuyResult>;
  getMediaBuyDelivery(params: GetDeliveryParams): Promise<GetDeliveryResult>;
  listCreatives(params: ListCreativesParams): Promise<ListCreativesResult>;
  syncCreatives(params: SyncCreativesParams): Promise<SyncCreativesResult>;
  recordPerformanceFeedback(params: FeedbackParams): Promise<void>;
}
```

### Pre-loaded Data

#### Products (3)

| Product ID | Name | Delivery Type | Channels |
|------------|------|---------------|----------|
| `premium_display` | Premium Display Network | guaranteed | display |
| `video_everywhere` | Video Everywhere | non_guaranteed | video, ctv |
| `native_content` | Native Content Network | non_guaranteed | native |

#### Properties (2 publishers)

| Domain | Properties | Channels |
|--------|------------|----------|
| `espn.com` | ESPN Main, ESPN Fantasy | video, display |
| `cnn.com` | CNN Homepage, CNN Politics | display, video, native |

#### Creative Formats (5)

| Format ID | Name | Type | Channel |
|-----------|------|------|---------|
| `display_300x250` | Display 300x250 | display | display |
| `display_728x90` | Display 728x90 | display | display |
| `video_15s` | Video 15s | video | video |
| `video_30s` | Video 30s | video | video |
| `native_responsive` | Native Responsive | native | native |

### Media Buy Lifecycle

```
1. create_media_buy
   ├── Validate products exist
   ├── Validate pricing options
   ├── Create media buy record
   ├── Create package records
   └── Return media_buy_id

2. update_media_buy
   ├── Find existing media buy
   ├── Apply PATCH updates
   └── Return affected packages

3. get_media_buy_delivery
   ├── Find media buy(s)
   ├── Generate synthetic metrics
   └── Return delivery data
```

### Synthetic Metrics Generation

The mock generates realistic-looking delivery metrics:

```typescript
// Delivery metrics are calculated based on:
// - Budget and pricing
// - Days elapsed
// - Random variation factor

const impressions = Math.floor(budget / cpm * 1000 * Math.random());
const clicks = Math.floor(impressions * 0.002 * Math.random());
const spend = (impressions / 1000) * cpm;
```

### Usage Example

```typescript
import { MockMediaBuyDatabase } from 'adcp';

const db = new MockMediaBuyDatabase();

// Get products
const { products } = await db.getProducts({
  brief: 'video campaign for sports audience',
});

// Create media buy
const result = await db.createMediaBuy({
  buyerRef: 'my-campaign-001',
  brandManifest: { name: 'Acme Corp' },
  startTime: '2024-02-01T00:00:00Z',
  endTime: '2024-02-28T23:59:59Z',
  packages: [{
    buyerRef: 'pkg-001',
    productId: 'video_everywhere',
    pricingOptionId: 'cpm_standard',
    formatIds: [{ agent_url: '...', id: 'video_15s' }],
    budget: 10000,
  }],
});

console.log(result.mediaBuyId);
// 'mb-a1b2c3d4-e5f6-...'
```

## Mock Creative Database

**File**: `src/database/creative.ts`

### Interface

```typescript
interface CreativeDatabase {
  getFormats(params: CreativeGetFormatsParams): Promise<{
    formats: CreativeFormatInfo[];
    specifications?: FormatSpecification[];
  }>;
  getFormatSpecification(formatId: FormatId): Promise<FormatSpecification | null>;
  buildCreative(params: BuildCreativeParams): Promise<{
    manifest: CreativeManifest;
    generated?: boolean;
  }>;
  generatePreview(params: GeneratePreviewParams): Promise<PreviewResult>;
}
```

### Format Specifications

The mock includes detailed format specifications:

#### Display 300x250

```typescript
{
  format_id: { agent_url: '...', id: 'display_300x250' },
  name: 'Display 300x250',
  type: 'display',
  assets_required: [
    {
      asset_id: 'banner_image',
      asset_type: 'image',
      required: true,
      min_width: 300,
      max_width: 300,
      min_height: 250,
      max_height: 250,
      allowed_formats: ['png', 'jpg', 'gif'],
      max_file_size_bytes: 150000,
    },
    {
      asset_id: 'clickthrough_url',
      asset_type: 'url',
      required: true,
    },
  ],
  renders: [
    {
      render_id: 'primary',
      role: 'primary',
      dimensions: { width: 300, height: 250 },
    },
  ],
}
```

#### Video 15s

```typescript
{
  format_id: { agent_url: '...', id: 'video_15s' },
  name: 'Video 15s',
  type: 'video',
  assets_required: [
    {
      asset_id: 'video_file',
      asset_type: 'video',
      required: true,
      min_duration_seconds: 14,
      max_duration_seconds: 16,
      allowed_formats: ['mp4', 'webm'],
      max_file_size_bytes: 10000000,
    },
    {
      asset_id: 'companion_banner',
      asset_type: 'image',
      required: false,
    },
    {
      asset_id: 'clickthrough_url',
      asset_type: 'url',
      required: true,
    },
  ],
  renders: [
    { render_id: 'video', role: 'primary', dimensions: { width: 1920, height: 1080 } },
    { render_id: 'companion', role: 'companion', dimensions: { width: 300, height: 250 } },
  ],
}
```

### Build Creative Behavior

When `buildCreative` is called:

1. Uses source manifest assets if provided
2. Generates placeholder assets for missing required fields
3. Returns creative manifest with `generated` flag

Placeholder generation:

```typescript
// Image placeholder
{ url: 'https://placeholder.adcontextprotocol.org/image/{asset_id}', width: 300, height: 250 }

// Video placeholder
{ url: 'https://placeholder.adcontextprotocol.org/video/{asset_id}', width: 1920, height: 1080 }

// Text placeholder
{ content: 'Placeholder text for {asset_id}' }
```

### Preview Generation

Generates HTML previews with:

- Correct dimensions from render specification
- Asset URL references
- Basic styling
- Input variable interpolation

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .ad-preview {
      width: 300px;
      height: 250px;
      border: 1px solid #ccc;
      ...
    }
  </style>
</head>
<body>
  <div class="ad-preview">
    <img src="https://example.com/banner.jpg" />
    <h2>Headline text</h2>
  </div>
</body>
</html>
```

### Usage Example

```typescript
import { MockCreativeDatabase } from 'adcp';

const db = new MockCreativeDatabase();

// Get format specification
const spec = await db.getFormatSpecification({
  agent_url: 'https://creative.adcontextprotocol.org',
  id: 'display_300x250',
});

// Build creative
const { manifest, generated } = await db.buildCreative({
  message: 'Create a banner for summer sale',
  targetFormat: spec,
  sourceManifest: {
    assets: {
      banner_image: { url: 'https://example.com/summer-banner.jpg' },
    },
  },
});

// Generate preview
const preview = await db.generatePreview({
  manifest,
  formatSpec: spec,
  input: { headline: 'Summer Sale!' },
  outputFormat: 'html',
});
```

## Extending Mock Data

### Adding New Signals

```typescript
class ExtendedSignalsDatabase extends MockSignalsDatabase {
  constructor() {
    super();
    this.addSignal({
      signal_agent_segment_id: 'my_custom_signal',
      name: 'My Custom Signal',
      description: 'A custom audience segment',
      signal_type: 'custom',
      data_provider: 'My Company',
      coverage_percentage: 10,
      deployments: [],
      pricing: { cpm: 2.0, currency: 'USD' },
    });
  }

  private addSignal(signal: Signal) {
    // Access internal signals Map
    (this as any).signals.set(signal.signal_agent_segment_id, signal);
  }
}
```

### Adding New Products

```typescript
class ExtendedMediaBuyDatabase extends MockMediaBuyDatabase {
  constructor() {
    super();
    this.addProduct({
      product_id: 'ctv_premium',
      name: 'CTV Premium Package',
      description: 'Premium connected TV inventory',
      publisher_properties: [...],
      format_ids: [...],
      delivery_type: 'guaranteed',
      delivery_measurement: { type: 'impressions' },
      pricing_options: [{
        pricing_option_id: 'cpm_ctv',
        model: 'cpm',
        price: 25.00,
        currency: 'USD',
      }],
    });
  }
}
```

### Adding New Formats

```typescript
class ExtendedCreativeDatabase extends MockCreativeDatabase {
  constructor() {
    super();
    this.addFormat({
      format_id: { agent_url: '...', id: 'audio_30s' },
      name: 'Audio 30s',
      type: 'audio',
      assets_required: [
        {
          asset_id: 'audio_file',
          asset_type: 'audio',
          required: true,
          min_duration_seconds: 28,
          max_duration_seconds: 32,
          allowed_formats: ['mp3', 'wav'],
        },
      ],
      renders: [
        { render_id: 'audio', role: 'primary', dimensions: { width: 0, height: 0 } },
      ],
    });
  }
}
```

## Creating Production Implementations

### PostgreSQL Example

```typescript
import { Pool } from 'pg';
import { SignalsDatabase, SearchSignalsParams, Signal } from 'adcp';

class PostgresSignalsDatabase implements SignalsDatabase {
  constructor(private pool: Pool) {}

  async searchSignals(params: SearchSignalsParams): Promise<Signal[]> {
    const { query, catalogTypes, dataProviders, maxCpm, minCoverage, maxResults } = params;

    let sql = `
      SELECT * FROM signals
      WHERE (name ILIKE $1 OR description ILIKE $1)
    `;
    const values: any[] = [`%${query}%`];
    let paramIndex = 2;

    if (catalogTypes?.length) {
      sql += ` AND signal_type = ANY($${paramIndex})`;
      values.push(catalogTypes);
      paramIndex++;
    }

    if (dataProviders?.length) {
      sql += ` AND data_provider = ANY($${paramIndex})`;
      values.push(dataProviders);
      paramIndex++;
    }

    if (maxCpm !== undefined) {
      sql += ` AND (pricing->>'cpm')::numeric <= $${paramIndex}`;
      values.push(maxCpm);
      paramIndex++;
    }

    if (minCoverage !== undefined) {
      sql += ` AND coverage_percentage >= $${paramIndex}`;
      values.push(minCoverage);
      paramIndex++;
    }

    sql += ` ORDER BY coverage_percentage DESC`;

    if (maxResults) {
      sql += ` LIMIT $${paramIndex}`;
      values.push(maxResults);
    }

    const result = await this.pool.query(sql, values);
    return result.rows.map(this.mapRowToSignal);
  }

  async getSignal(signalId: string): Promise<Signal | null> {
    const result = await this.pool.query(
      'SELECT * FROM signals WHERE signal_agent_segment_id = $1',
      [signalId]
    );
    return result.rows[0] ? this.mapRowToSignal(result.rows[0]) : null;
  }

  async checkSignalAccess(signalId: string, principalId?: string): Promise<boolean> {
    if (!principalId) {
      // Check if signal is marketplace (public)
      const result = await this.pool.query(
        "SELECT 1 FROM signals WHERE signal_agent_segment_id = $1 AND signal_type = 'marketplace'",
        [signalId]
      );
      return result.rowCount > 0;
    }

    // Check principal access
    const result = await this.pool.query(
      `SELECT 1 FROM signal_access
       WHERE signal_id = $1 AND principal_id = $2`,
      [signalId, principalId]
    );
    return result.rowCount > 0;
  }

  async getSignalDeploymentStatus(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<SignalDeployment | null> {
    const result = await this.pool.query(
      `SELECT * FROM signal_deployments
       WHERE signal_id = $1
         AND destination_type = $2
         AND destination_id = $3
         AND (principal_id = $4 OR principal_id IS NULL)`,
      [
        signalId,
        destination.type,
        destination.type === 'platform' ? destination.platform : destination.agent_url,
        principalId,
      ]
    );
    return result.rows[0] ? this.mapRowToDeployment(result.rows[0]) : null;
  }

  async activateSignal(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<ActivationResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert deployment record
      const activationKey = {
        type: 'segment_id' as const,
        segment_id: `${signalId}_${destination.type}_${Date.now()}`,
      };

      await client.query(
        `INSERT INTO signal_deployments
         (signal_id, destination_type, destination_id, principal_id, activation_key, is_live, deployed_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW())
         ON CONFLICT (signal_id, destination_type, destination_id, principal_id)
         DO UPDATE SET activation_key = $5, is_live = true, deployed_at = NOW()`,
        [
          signalId,
          destination.type,
          destination.type === 'platform' ? destination.platform : destination.agent_url,
          principalId,
          JSON.stringify(activationKey),
        ]
      );

      await client.query('COMMIT');

      return {
        activation_key: activationKey,
        deployed_at: new Date().toISOString(),
        is_live: true,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToSignal(row: any): Signal {
    return {
      signal_agent_segment_id: row.signal_agent_segment_id,
      name: row.name,
      description: row.description,
      signal_type: row.signal_type,
      data_provider: row.data_provider,
      coverage_percentage: row.coverage_percentage,
      deployments: row.deployments || [],
      pricing: row.pricing,
      metadata: row.metadata,
    };
  }

  private mapRowToDeployment(row: any): SignalDeployment {
    return {
      type: row.destination_type,
      platform: row.destination_type === 'platform' ? row.destination_id : undefined,
      agent_url: row.destination_type === 'agent' ? row.destination_id : undefined,
      is_live: row.is_live,
      activation_key: row.activation_key,
    };
  }
}
```

### Redis Caching Layer

```typescript
import Redis from 'ioredis';
import { SignalsDatabase, Signal } from 'adcp';

class CachedSignalsDatabase implements SignalsDatabase {
  constructor(
    private delegate: SignalsDatabase,
    private redis: Redis,
    private ttlSeconds: number = 300
  ) {}

  async getSignal(signalId: string): Promise<Signal | null> {
    const cacheKey = `signal:${signalId}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from delegate
    const signal = await this.delegate.getSignal(signalId);

    // Cache result
    if (signal) {
      await this.redis.setex(cacheKey, this.ttlSeconds, JSON.stringify(signal));
    }

    return signal;
  }

  // ... implement other methods with caching
}
```

### Testing with Mocks

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockSignalsDatabase, SignalsHandler } from 'adcp';

describe('SignalsHandler', () => {
  let db: MockSignalsDatabase;
  let handler: SignalsHandler;

  beforeEach(() => {
    db = new MockSignalsDatabase();
    handler = new SignalsHandler({
      database: db,
      agentUrl: 'https://test.example.com',
      agentName: 'Test Agent',
    });
  });

  it('should find signals by keyword', async () => {
    const result = await handler.getSignals({
      signal_spec: 'automotive',
      deliver_to: {
        deployments: [{ type: 'platform', platform: 'dv360' }],
        countries: ['US'],
      },
    });

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].name).toContain('Automotive');
  });

  it('should activate a signal', async () => {
    const result = await handler.activateSignal({
      signal_agent_segment_id: 'luxury_auto_intenders',
      deployments: [{ type: 'platform', platform: 'dv360' }],
    });

    expect(result.deployments).toHaveLength(1);
    expect(result.deployments[0].is_live).toBe(true);
    expect(result.deployments[0].activation_key).toBeDefined();
  });
});
```
