# API Reference

Complete API reference for all AdCP protocols and endpoints.

## Table of Contents

- [Common Types](#common-types)
- [Signals Protocol](#signals-protocol)
- [Media Buy Protocol](#media-buy-protocol)
- [Creative Protocol](#creative-protocol)
- [Error Handling](#error-handling)

---

## Common Types

### TaskStatus

```typescript
type TaskStatus =
  | 'completed'      // Task finished successfully
  | 'working'        // Task in progress
  | 'submitted'      // Task queued for processing
  | 'input-required' // Awaiting user input
  | 'failed'         // Task failed
  | 'canceled'       // Task was canceled
  | 'rejected'       // Task was rejected
  | 'auth-required'  // Authentication needed
  | 'unknown';       // Unknown state
```

### FormatId

Unique identifier for creative formats.

```typescript
interface FormatId {
  agent_url: string;  // URL of authoritative agent
  id: string;         // Format identifier
}
```

### BaseResponse

All responses include these fields:

```typescript
interface BaseResponse {
  message: string;      // Human-readable status message
  context_id?: string;  // Request correlation ID
  status?: TaskStatus;  // Current task status
  task_id?: string;     // Async task ID (if applicable)
}
```

### ErrorDetail

```typescript
interface ErrorDetail {
  code: string;        // Error code
  message: string;     // Error message
  field?: string;      // Field that caused error
  suggestion?: string; // Suggested fix
}
```

---

## Signals Protocol

### get_signals

Discover signals based on natural language descriptions.

#### Request

```typescript
interface GetSignalsRequest {
  /** Natural language description of desired signals */
  signal_spec: string;

  /** Deployment targets for signal activation */
  deliver_to: {
    deployments: Destination[];
    countries: string[];  // ISO 3166-1 alpha-2
  };

  /** Optional filters */
  filters?: {
    catalog_types?: ('marketplace' | 'custom' | 'owned')[];
    data_providers?: string[];
    max_cpm?: number;
    min_coverage_percentage?: number;
  };

  /** Maximum results to return */
  max_results?: number;

  /** Session context identifier */
  context_id?: string;
}
```

#### Response

```typescript
interface GetSignalsResponse extends BaseResponse {
  signals: Signal[];
  context_id: string;
}

interface Signal {
  signal_agent_segment_id: string;
  name: string;
  description: string;
  signal_type: 'marketplace' | 'custom' | 'owned';
  data_provider: string;
  coverage_percentage?: number;
  deployments: SignalDeployment[];
  pricing?: Pricing;
  metadata?: Record<string, unknown>;
}

interface SignalDeployment {
  type: 'platform' | 'agent';
  platform?: string;
  agent_url?: string;
  account?: string;
  is_live: boolean;
  activation_key?: ActivationKey;
  estimated_activation_duration_minutes?: number;
  scope?: 'platform-wide' | 'account-specific';
  decisioning_platform_segment_id?: string;
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/get_signals \
  -H "Content-Type: application/json" \
  -d '{
    "signal_spec": "luxury automotive intenders with high income",
    "deliver_to": {
      "deployments": [
        {"type": "platform", "platform": "dv360", "account": "12345"}
      ],
      "countries": ["US", "CA"]
    },
    "filters": {
      "catalog_types": ["marketplace"],
      "max_cpm": 5.0
    },
    "max_results": 10
  }'
```

---

### activate_signal

Deploy a signal to specific platforms or sales agents.

#### Request

```typescript
interface ActivateSignalRequest {
  /** Universal identifier for the signal */
  signal_agent_segment_id: string;

  /** Target deployment(s) for activation */
  deployments: Destination[];

  /** Session context identifier */
  context_id?: string;
}

type Destination = PlatformDestination | AgentDestination;

interface PlatformDestination {
  type: 'platform';
  platform: string;  // e.g., 'dv360', 'ttd', 'xandr'
  account?: string;
}

interface AgentDestination {
  type: 'agent';
  agent_url: string;
  account?: string;
}
```

#### Response

```typescript
interface ActivateSignalResponse extends BaseResponse {
  deployments: ActivationDeployment[];
  errors?: ErrorDetail[];
  context_id: string;
}

interface ActivationDeployment {
  type: 'platform' | 'agent';
  platform?: string;
  agent_url?: string;
  account?: string;
  activation_key?: ActivationKey;
  estimated_activation_duration_minutes?: number;
  deployed_at?: string;
  is_live: boolean;
}

type ActivationKey =
  | { type: 'segment_id'; segment_id: string }
  | { type: 'key_value'; key: string; value: string };
```

#### Example

```bash
curl -X POST http://localhost:3000/call/activate_signal \
  -H "Content-Type: application/json" \
  -d '{
    "signal_agent_segment_id": "luxury_auto_intenders",
    "deployments": [
      {"type": "platform", "platform": "dv360", "account": "advertiser123"},
      {"type": "platform", "platform": "ttd", "account": "advertiser456"}
    ]
  }'
```

---

## Media Buy Protocol

### get_products

Discover advertising inventory based on campaign requirements.

#### Request

```typescript
interface GetProductsRequest {
  /** Natural language campaign description */
  brief?: string;

  /** Brand information */
  brand_manifest?: BrandManifest | string;

  /** Structured filtering options */
  filters?: {
    delivery_type?: 'guaranteed' | 'non_guaranteed';
    is_fixed_price?: boolean;
    format_types?: FormatType[];
    format_ids?: FormatId[];
    standard_formats_only?: boolean;
    min_exposures?: number;
    start_date?: string;
    end_date?: string;
    budget_range?: { currency: string; min?: number; max?: number };
    countries?: string[];
    channels?: Channel[];
  };

  context_id?: string;
}

type Channel = 'display' | 'video' | 'ctv' | 'audio' | 'native' | 'dooh' | 'social' | 'podcast' | 'retail';
type FormatType = 'display' | 'video' | 'audio' | 'native' | 'dooh' | 'carousel' | 'rich_media';
```

#### Response

```typescript
interface GetProductsResponse extends BaseResponse {
  products: Product[];
  context_id: string;
}

interface Product {
  product_id: string;
  name: string;
  description: string;
  publisher_properties: PublisherProperty[];
  format_ids: FormatId[];
  delivery_type: 'guaranteed' | 'non_guaranteed';
  delivery_measurement: DeliveryMeasurement;
  pricing_options: PricingOption[];
  brief_relevance?: string;
  min_budget?: number;
  currency?: string;
  available_impressions?: number;
  countries?: string[];
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/get_products \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Premium video inventory for automotive brand targeting sports enthusiasts",
    "filters": {
      "channels": ["video", "ctv"],
      "budget_range": {"currency": "USD", "min": 10000, "max": 100000},
      "countries": ["US"]
    }
  }'
```

---

### list_creative_formats

Discover creative formats supported by the sales agent.

#### Request

```typescript
interface ListCreativeFormatsRequest {
  format_types?: FormatType[];
  channels?: Channel[];
  context_id?: string;
}
```

#### Response

```typescript
interface ListCreativeFormatsResponse extends BaseResponse {
  formats: CreativeFormat[];
  creative_agents: CreativeAgentInfo[];
  context_id: string;
}

interface CreativeFormat {
  format_id: FormatId;
  name: string;
  type: FormatType;
  channel?: Channel;
  description?: string;
  is_authoritative?: boolean;
}

interface CreativeAgentInfo {
  agent_url: string;
  agent_name: string;
  capabilities: ('validation' | 'assembly' | 'preview' | 'generation')[];
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/list_creative_formats \
  -H "Content-Type: application/json" \
  -d '{
    "format_types": ["video"],
    "channels": ["video", "ctv"]
  }'
```

---

### list_authorized_properties

Get all properties the sales agent is authorized to represent.

#### Request

```typescript
interface ListAuthorizedPropertiesRequest {
  publisher_domains?: string[];
  context_id?: string;
}
```

#### Response

```typescript
interface ListAuthorizedPropertiesResponse extends BaseResponse {
  publisher_domains: string[];
  primary_channels?: Channel[];
  primary_countries?: string[];
  portfolio_description?: string;
  last_updated?: string;
  context_id: string;
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/list_authorized_properties \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### create_media_buy

Create advertising campaigns from selected packages.

#### Request

```typescript
interface CreateMediaBuyRequest {
  /** Your tracking identifier */
  buyer_ref: string;

  /** Brand information */
  brand_manifest: BrandManifest | string;

  /** Campaign start time ('asap' or ISO 8601) */
  start_time: string;

  /** Campaign end time (ISO 8601) */
  end_time: string;

  /** Package configurations */
  packages: PackageConfig[];

  /** Purchase order number */
  po_number?: string;

  /** Webhook configuration */
  reporting_webhook?: ReportingWebhook;

  context_id?: string;
}

interface PackageConfig {
  buyer_ref: string;
  product_id: string;
  pricing_option_id: string;
  format_ids: FormatId[];
  budget: number;
  currency?: string;
  bid_price?: number;
  impressions?: number;
  paused?: boolean;
  pacing?: 'even' | 'asap' | 'front_loaded';
  targeting_overlay?: TargetingOverlay;
  creative_ids?: string[];
  creatives?: SyncCreative[];
}
```

#### Response

```typescript
interface CreateMediaBuyResponse extends BaseResponse {
  media_buy_id: string;
  buyer_ref: string;
  creative_deadline?: string;
  packages: CreatedPackage[];
  errors?: ErrorDetail[];
  context_id: string;
}

interface CreatedPackage {
  package_id: string;
  buyer_ref: string;
  product_id: string;
  pricing_option_id: string;
  budget: number;
  currency: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed';
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/create_media_buy \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_ref": "campaign-2024-001",
    "brand_manifest": {
      "name": "Acme Corporation",
      "url": "https://acme.example.com",
      "logos": [{"url": "https://acme.example.com/logo.png", "tags": ["primary"]}]
    },
    "start_time": "2024-02-01T00:00:00Z",
    "end_time": "2024-02-28T23:59:59Z",
    "packages": [
      {
        "buyer_ref": "pkg-video-001",
        "product_id": "video_everywhere",
        "pricing_option_id": "cpm_standard",
        "format_ids": [{"agent_url": "https://creative.example.com", "id": "video_15s"}],
        "budget": 50000,
        "currency": "USD",
        "pacing": "even"
      }
    ],
    "po_number": "PO-2024-12345"
  }'
```

---

### update_media_buy

Modify existing media buys using PATCH semantics.

#### Request

```typescript
interface UpdateMediaBuyRequest {
  /** Publisher's media buy identifier */
  media_buy_id?: string;

  /** Your reference for the media buy */
  buyer_ref?: string;

  /** Updated campaign start time */
  start_time?: string;

  /** Updated campaign end time */
  end_time?: string;

  /** Pause/resume entire media buy */
  paused?: boolean;

  /** Package-level updates */
  packages?: PackageUpdate[];

  /** Upload new creative assets */
  creatives?: SyncCreative[];

  /** Update creative assignments */
  creative_assignments?: CreativeAssignment[];

  context_id?: string;
}

interface PackageUpdate {
  package_id?: string;
  buyer_ref?: string;
  paused?: boolean;
  budget?: number;
  impressions?: number;
  pacing?: PacingStrategy;
  bid_price?: number;
  targeting_overlay?: TargetingOverlay;
  creative_ids?: string[];
}
```

#### Response

```typescript
interface UpdateMediaBuyResponse extends BaseResponse {
  media_buy_id: string;
  buyer_ref: string;
  implementation_date: string | null;
  affected_packages: UpdatedPackage[];
  errors?: ErrorDetail[];
  context_id: string;
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/update_media_buy \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_ref": "campaign-2024-001",
    "packages": [
      {
        "buyer_ref": "pkg-video-001",
        "budget": 75000,
        "paused": false
      }
    ]
  }'
```

---

### get_media_buy_delivery

Retrieve delivery metrics and performance data.

#### Request

```typescript
interface GetMediaBuyDeliveryRequest {
  media_buy_ids?: string[];
  buyer_refs?: string[];
  status_filter?: DeliveryStatusFilter | DeliveryStatusFilter[];
  start_date?: string;  // YYYY-MM-DD
  end_date?: string;    // YYYY-MM-DD
  context_id?: string;
}

type DeliveryStatusFilter = 'active' | 'pending' | 'paused' | 'completed' | 'failed' | 'all';
```

#### Response

```typescript
interface GetMediaBuyDeliveryResponse extends BaseResponse {
  reporting_period: { start: string; end: string };
  currency: string;
  aggregated_totals: AggregatedDeliveryMetrics;
  media_buy_deliveries: MediaBuyDelivery[];
  context_id: string;
}

interface MediaBuyDelivery {
  media_buy_id: string;
  buyer_ref?: string;
  status: DeliveryStatus;
  start_time: string;
  end_time: string;
  totals: DeliveryMetrics;
  by_package: PackageDelivery[];
  daily_breakdown?: DailyMetrics[];
}

interface DeliveryMetrics {
  impressions: number;
  spend: number;
  clicks?: number;
  ctr?: number;
  video_starts?: number;
  video_completions?: number;
  completion_rate?: number;
  viewable_impressions?: number;
  viewability_rate?: number;
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/get_media_buy_delivery \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_refs": ["campaign-2024-001"],
    "status_filter": "active",
    "start_date": "2024-02-01",
    "end_date": "2024-02-15"
  }'
```

---

### list_creatives

List creative assets with filtering and pagination.

#### Request

```typescript
interface ListCreativesRequest {
  filters?: {
    format?: string;
    formats?: string[];
    format_ids?: FormatId[];
    status?: CreativeApprovalStatus | CreativeApprovalStatus[];
    tags?: string[];
    tags_any?: string[];
    name_contains?: string;
    creative_ids?: string[];
    created_after?: string;
    created_before?: string;
    assigned_to_package?: string;
    unassigned?: boolean;
  };
  sort?: { field: CreativeSortField; direction: 'asc' | 'desc' };
  pagination?: { limit?: number; offset?: number };
  include_assignments?: boolean;
  include_performance?: boolean;
  context_id?: string;
}

type CreativeApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_required';
type CreativeSortField = 'created_date' | 'updated_date' | 'name' | 'status';
```

#### Response

```typescript
interface ListCreativesResponse extends BaseResponse {
  query_summary: { total_matching: number; returned: number; filters_applied: string[] };
  pagination: { limit: number; offset: number; has_more: boolean; total_pages: number };
  creatives: StoredCreative[];
  format_summary?: Record<string, number>;
  status_summary?: Record<string, number>;
  context_id: string;
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/list_creatives \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "status": "approved",
      "formats": ["display_300x250", "display_728x90"]
    },
    "pagination": {"limit": 20, "offset": 0},
    "include_assignments": true
  }'
```

---

### sync_creatives

Upload and manage creative assets.

#### Request

```typescript
interface SyncCreativesRequest {
  creatives: SyncCreative[];
  assignments?: Record<string, string[]>;  // creative_id -> package_ids
  dry_run?: boolean;
  validation_mode?: 'strict' | 'lenient';
  delete_missing?: boolean;
  context_id?: string;
}

interface SyncCreative {
  creative_id: string;
  name?: string;
  format_id?: FormatId;
  assets?: Record<string, CreativeAsset>;
  tracking_pixels?: TrackingPixel[];
  click_actions?: ClickAction[];
  tags?: string[];
}
```

#### Response

```typescript
interface SyncCreativesResponse extends BaseResponse {
  creatives: SyncCreativeResult[];
  dry_run?: boolean;
  errors?: ErrorDetail[];
  warnings?: WarningDetail[];
  context_id: string;
}

interface SyncCreativeResult {
  creative_id: string;
  platform_id?: string;
  action: 'created' | 'updated' | 'unchanged' | 'deleted' | 'failed';
  errors?: ErrorDetail[];
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/sync_creatives \
  -H "Content-Type: application/json" \
  -d '{
    "creatives": [
      {
        "creative_id": "banner-summer-2024",
        "name": "Summer Sale Banner",
        "format_id": {"agent_url": "https://creative.example.com", "id": "display_300x250"},
        "assets": {
          "banner_image": {
            "url": "https://cdn.example.com/banners/summer-2024.jpg",
            "width": 300,
            "height": 250,
            "format": "jpg"
          },
          "clickthrough_url": {
            "url": "https://shop.example.com/summer-sale"
          }
        },
        "tags": ["summer", "sale", "2024"]
      }
    ],
    "dry_run": false
  }'
```

---

### provide_performance_feedback

Share campaign performance outcomes with publishers.

#### Request

```typescript
interface ProvidePerformanceFeedbackRequest {
  media_buy_id: string;
  measurement_period: { start_date: string; end_date: string };
  performance_index: number;  // 0.0 to 1.0
  package_id?: string;
  creative_id?: string;
  metric_type?: MetricType;
  feedback_source?: FeedbackSource;
  context_id?: string;
}

type MetricType = 'overall_performance' | 'conversion_rate' | 'brand_lift' | 'click_through_rate' | 'completion_rate' | 'viewability' | 'brand_safety' | 'cost_efficiency';
type FeedbackSource = 'buyer_attribution' | 'third_party_measurement' | 'platform_analytics' | 'verification_partner';
```

#### Response

```typescript
interface ProvidePerformanceFeedbackResponse extends BaseResponse {
  success: boolean;
  context_id: string;
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/provide_performance_feedback \
  -H "Content-Type: application/json" \
  -d '{
    "media_buy_id": "mb-123456",
    "measurement_period": {
      "start_date": "2024-02-01",
      "end_date": "2024-02-14"
    },
    "performance_index": 0.85,
    "metric_type": "conversion_rate",
    "feedback_source": "buyer_attribution"
  }'
```

---

## Creative Protocol

### build_creative

Transform or generate creative manifests.

#### Request

```typescript
interface BuildCreativeRequest {
  /** Natural language instructions */
  message?: string;

  /** Source manifest to transform */
  creative_manifest?: Partial<CreativeManifest>;

  /** Target format specification */
  target_format_id: FormatId;

  /** Brand information for generation */
  brand_manifest?: BrandManifest | string;

  context_id?: string;
}
```

#### Response

```typescript
interface BuildCreativeResponse extends BaseResponse {
  creative_manifest: CreativeManifest;
  warnings?: string[];
  context_id: string;
}

interface CreativeManifest {
  format_id: FormatId;
  promoted_offering?: PromotedOffering;
  assets: Record<string, CreativeAsset>;
  tracking_pixels?: TrackingPixel[];
  click_actions?: ClickAction[];
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/build_creative \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a summer sale banner with bright colors",
    "target_format_id": {"agent_url": "https://creative.example.com", "id": "display_300x250"},
    "brand_manifest": {
      "name": "Acme Corp",
      "url": "https://acme.example.com",
      "colors": {"primary": "#FF6B00", "secondary": "#FFFFFF"},
      "tagline": "Quality Products, Great Prices"
    }
  }'
```

---

### preview_creative

Generate preview renderings of creative manifests.

#### Request

```typescript
interface PreviewCreativeRequest {
  request_type: 'single' | 'batch';

  // For single requests:
  format_id?: FormatId;
  creative_manifest?: CreativeManifest;
  inputs?: PreviewInput[];
  output_format?: 'url' | 'html' | 'both';

  // For batch requests:
  requests?: BatchPreviewRequest[];

  context_id?: string;
}

interface PreviewInput {
  name?: string;
  [key: string]: unknown;
}

interface BatchPreviewRequest {
  format_id: FormatId;
  creative_manifest: CreativeManifest;
  inputs?: PreviewInput[];
  output_format?: 'url' | 'html' | 'both';
}
```

#### Response

```typescript
interface PreviewCreativeResponse extends BaseResponse {
  response_type: 'single' | 'batch';

  // For single responses:
  previews?: PreviewResult[];

  // For batch responses:
  results?: BatchPreviewResult[];

  expires_at: string;
  context_id: string;
}

interface PreviewResult {
  preview_id: string;
  renders: PreviewRender[];
  input?: PreviewInput;
}

interface PreviewRender {
  render_id: string;
  output_format: 'url' | 'html' | 'both';
  preview_url?: string;
  preview_html?: string;
  role: 'primary' | 'companion';
  dimensions: { width: number; height: number };
}
```

#### Example

```bash
curl -X POST http://localhost:3000/call/preview_creative \
  -H "Content-Type: application/json" \
  -d '{
    "request_type": "single",
    "format_id": {"agent_url": "https://creative.example.com", "id": "display_300x250"},
    "creative_manifest": {
      "format_id": {"agent_url": "https://creative.example.com", "id": "display_300x250"},
      "assets": {
        "banner_image": {"url": "https://example.com/banner.jpg", "width": 300, "height": 250},
        "headline": {"content": "Summer Sale!"},
        "clickthrough_url": {"url": "https://example.com/sale"}
      }
    },
    "output_format": "both",
    "inputs": [
      {"name": "variant-a", "headline": "Summer Sale - 50% Off!"},
      {"name": "variant-b", "headline": "Limited Time Offer!"}
    ]
  }'
```

---

### validate_creative

Validate creative manifest against format specification.

#### Request

```typescript
interface ValidateCreativeRequest {
  format_id: FormatId;
  creative_manifest: CreativeManifest;
  validation_mode?: 'strict' | 'lenient';
  context_id?: string;
}
```

#### Response

```typescript
interface ValidateCreativeResponse extends BaseResponse {
  valid: boolean;
  errors?: CreativeValidationError[];
  warnings?: string[];
  context_id: string;
}

interface CreativeValidationError {
  asset_id?: string;
  code: string;
  message: string;
}
```

**Error Codes**:

| Code | Description |
|------|-------------|
| `MISSING_FORMAT_ID` | Manifest missing format_id |
| `FORMAT_MISMATCH` | Manifest format doesn't match specification |
| `MISSING_REQUIRED_ASSET` | Required asset not provided |
| `INVALID_ASSET_TYPE` | Asset type doesn't match requirement |
| `INVALID_DIMENSIONS` | Asset dimensions out of range |
| `INVALID_DURATION` | Video/audio duration out of range |
| `FILE_TOO_LARGE` | Asset exceeds size limit |
| `INVALID_FORMAT` | Asset format not allowed |

#### Example

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
    },
    "validation_mode": "strict"
  }'
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (check response for task status) |
| 400 | Invalid request |
| 401 | Authentication required |
| 403 | Forbidden |
| 404 | Resource not found |
| 500 | Internal server error |

### Error Response Format

```typescript
interface ErrorResponse {
  status: 'failed';
  message: string;
  context_id: string;
  errors: ErrorDetail[];
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request validation failed |
| `MISSING_REQUIRED_FIELD` | Required field not provided |
| `NOT_FOUND` | Requested resource not found |
| `PRODUCT_NOT_FOUND` | Product ID not found |
| `FORMAT_NOT_FOUND` | Creative format not found |
| `SIGNAL_NOT_FOUND` | Signal ID not found |
| `MEDIA_BUY_NOT_FOUND` | Media buy not found |
| `UNAUTHORIZED` | Not authorized for operation |
| `CONTEXT_REQUIRED` | Context ID or other identifier required |
| `INTERNAL_ERROR` | Internal server error |

### Error Response Example

```json
{
  "status": "failed",
  "message": "Media buy creation failed due to validation errors",
  "context_id": "ctx-abc123",
  "errors": [
    {
      "code": "PRODUCT_NOT_FOUND",
      "message": "Product 'invalid_product' not found",
      "field": "packages.pkg-001.product_id"
    },
    {
      "code": "INVALID_BUDGET",
      "message": "Budget must be at least $1000 for this product",
      "field": "packages.pkg-002.budget",
      "suggestion": "Increase budget to meet minimum requirement"
    }
  ]
}
```
