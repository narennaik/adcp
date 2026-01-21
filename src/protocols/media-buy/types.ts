/**
 * AdCP Media Buy Protocol Types
 *
 * Type definitions for the Media Buy Protocol.
 */

import type {
  BaseResponse,
  FormatId,
  PricingOption,
  BudgetRange,
  DeliveryType,
  DeliveryMeasurement,
  DeliveryStatus,
  PacingStrategy,
  TargetingOverlay,
  Channel,
  FormatType,
  ErrorDetail,
  WarningDetail,
  PublisherProperty,
  DeliveryMetrics,
  PackageDelivery,
  ReportingWebhook,
  CreativeAgentInfo,
  MeasurementPeriod,
  MetricType,
  FeedbackSource,
} from '../../core/types.js';
import type { BrandManifestRef } from '../../core/brand-manifest.js';
import type {
  CreativeManifest,
  CreativeFormat,
  SyncCreative,
  SyncCreativeResult,
  CreativeAssignment,
} from '../../core/creative-manifest.js';

// ============================================================================
// get_products Request/Response
// ============================================================================

export interface GetProductsRequest {
  /** Natural language campaign description */
  brief?: string;

  /** Brand information */
  brand_manifest?: BrandManifestRef;

  /** Structured filtering options */
  filters?: ProductFilters;

  /** Session context identifier */
  context_id?: string;
}

export interface ProductFilters {
  /** Filter by delivery type */
  delivery_type?: DeliveryType;

  /** Filter by pricing model */
  is_fixed_price?: boolean;

  /** Filter by format types */
  format_types?: FormatType[];

  /** Filter by specific format IDs */
  format_ids?: FormatId[];

  /** IAB standard formats only */
  standard_formats_only?: boolean;

  /** Minimum measurement exposures */
  min_exposures?: number;

  /** Campaign start date */
  start_date?: string;

  /** Campaign end date */
  end_date?: string;

  /** Budget range filter */
  budget_range?: BudgetRange;

  /** Geographic filter (ISO country codes) */
  countries?: string[];

  /** Channel filter */
  channels?: Channel[];
}

export interface GetProductsResponse extends BaseResponse {
  /** Array of available products */
  products: Product[];

  /** Session context identifier */
  context_id: string;
}

export interface Product {
  /** Unique identifier */
  product_id: string;

  /** Human-readable name */
  name: string;

  /** Detailed description */
  description: string;

  /** Publisher properties included */
  publisher_properties: PublisherProperty[];

  /** Supported creative formats */
  format_ids: FormatId[];

  /** Delivery type */
  delivery_type: DeliveryType;

  /** Measurement approach */
  delivery_measurement: DeliveryMeasurement;

  /** Available pricing options */
  pricing_options: PricingOption[];

  /** Relevance explanation (when brief provided) */
  brief_relevance?: string;

  /** Minimum budget required */
  min_budget?: number;

  /** Currency for min_budget */
  currency?: string;

  /** Available inventory volume */
  available_impressions?: number;

  /** Geographic availability */
  countries?: string[];
}

// ============================================================================
// list_creative_formats Request/Response
// ============================================================================

export interface ListCreativeFormatsRequest {
  /** Filter by format types */
  format_types?: FormatType[];

  /** Filter by channels */
  channels?: Channel[];

  /** Session context identifier */
  context_id?: string;
}

export interface ListCreativeFormatsResponse extends BaseResponse {
  /** Available formats */
  formats: CreativeFormat[];

  /** Creative agents for authoritative specs */
  creative_agents: CreativeAgentInfo[];

  /** Session context identifier */
  context_id: string;
}

// ============================================================================
// list_authorized_properties Request/Response
// ============================================================================

export interface ListAuthorizedPropertiesRequest {
  /** Filter results to specific publisher domains */
  publisher_domains?: string[];

  /** Session context identifier */
  context_id?: string;
}

export interface ListAuthorizedPropertiesResponse extends BaseResponse {
  /** Array of publisher domains this agent represents */
  publisher_domains: string[];

  /** Primary advertising channels */
  primary_channels?: Channel[];

  /** Primary countries (ISO 3166-1 alpha-2 codes) */
  primary_countries?: string[];

  /** Markdown description of portfolio capabilities */
  portfolio_description?: string;

  /** Cache validation timestamp */
  last_updated?: string;

  /** Session context identifier */
  context_id: string;
}

/** Extended property info (from adagents.json fetch) */
export interface AuthorizedProperty extends PublisherProperty {
  /** Authorization source */
  authorization_source: 'adagents_json' | 'direct' | 'network';

  /** Authorization expiry */
  authorization_expires?: string;
}

// ============================================================================
// create_media_buy Request/Response
// ============================================================================

export interface CreateMediaBuyRequest {
  /** Your tracking identifier */
  buyer_ref: string;

  /** Brand information */
  brand_manifest: BrandManifestRef;

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

  /** Session context identifier */
  context_id?: string;
}

export interface PackageConfig {
  /** Your package reference */
  buyer_ref: string;

  /** Product ID from get_products */
  product_id: string;

  /** Pricing option ID */
  pricing_option_id: string;

  /** Supported creative formats */
  format_ids: FormatId[];

  /** Allocated budget */
  budget: number;

  /** Currency for budget */
  currency?: string;

  /** CPM bid (for auction pricing) */
  bid_price?: number;

  /** Impression target */
  impressions?: number;

  /** Initial paused state */
  paused?: boolean;

  /** Distribution strategy */
  pacing?: PacingStrategy;

  /** Targeting constraints */
  targeting_overlay?: TargetingOverlay;

  /** Existing creative IDs to assign */
  creative_ids?: string[];

  /** Inline creative assets */
  creatives?: SyncCreative[];
}

export interface CreateMediaBuyResponse extends BaseResponse {
  /** Publisher-assigned identifier */
  media_buy_id: string;

  /** Your reference echoed back */
  buyer_ref: string;

  /** Creative upload deadline */
  creative_deadline?: string;

  /** Created packages */
  packages: CreatedPackage[];

  /** Errors that occurred */
  errors?: ErrorDetail[];

  /** Session context identifier */
  context_id: string;
}

export interface CreatedPackage {
  /** Publisher-assigned package ID */
  package_id: string;

  /** Your package reference */
  buyer_ref: string;

  /** Product ID used */
  product_id: string;

  /** Pricing option used */
  pricing_option_id: string;

  /** Allocated budget */
  budget: number;

  /** Currency */
  currency: string;

  /** Package status */
  status: PackageStatus;
}

export type PackageStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed';

// ============================================================================
// update_media_buy Request/Response
// ============================================================================

export interface UpdateMediaBuyRequest {
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

  /** Session context identifier */
  context_id?: string;
}

export interface PackageUpdate {
  /** Publisher's package identifier */
  package_id?: string;

  /** Your package reference */
  buyer_ref?: string;

  /** Pause/resume specific package */
  paused?: boolean;

  /** Updated budget allocation */
  budget?: number;

  /** Updated impression goal */
  impressions?: number;

  /** Updated pacing strategy */
  pacing?: PacingStrategy;

  /** Updated bid price (auction only) */
  bid_price?: number;

  /** Updated targeting restrictions */
  targeting_overlay?: TargetingOverlay;

  /** Replace assigned creatives */
  creative_ids?: string[];
}

export interface UpdateMediaBuyResponse extends BaseResponse {
  /** Media buy identifier */
  media_buy_id: string;

  /** Your reference identifier */
  buyer_ref: string;

  /** Implementation timestamp (null if pending) */
  implementation_date: string | null;

  /** Packages after update */
  affected_packages: UpdatedPackage[];

  /** Errors that occurred */
  errors?: ErrorDetail[];

  /** Session context identifier */
  context_id: string;
}

export interface UpdatedPackage {
  /** Package ID */
  package_id: string;

  /** Your package reference */
  buyer_ref?: string;

  /** Update status */
  status: PackageStatus;

  /** Changed fields */
  changes?: string[];
}

// ============================================================================
// get_media_buy_delivery Request/Response
// ============================================================================

export interface GetMediaBuyDeliveryRequest {
  /** Array of media buy IDs */
  media_buy_ids?: string[];

  /** Array of buyer references */
  buyer_refs?: string[];

  /** Filter by status */
  status_filter?: DeliveryStatusFilter | DeliveryStatusFilter[];

  /** Report start date (YYYY-MM-DD) */
  start_date?: string;

  /** Report end date (YYYY-MM-DD) */
  end_date?: string;

  /** Session context identifier */
  context_id?: string;
}

export type DeliveryStatusFilter =
  | 'active'
  | 'pending'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'all';

export interface GetMediaBuyDeliveryResponse extends BaseResponse {
  /** Reporting period */
  reporting_period: {
    start: string;
    end: string;
  };

  /** Currency for spend metrics */
  currency: string;

  /** Aggregated totals across all campaigns */
  aggregated_totals: AggregatedDeliveryMetrics;

  /** Per-campaign delivery data */
  media_buy_deliveries: MediaBuyDelivery[];

  /** Session context identifier */
  context_id: string;
}

export interface AggregatedDeliveryMetrics extends DeliveryMetrics {
  /** Number of media buys */
  media_buy_count: number;
}

export interface MediaBuyDelivery {
  /** Media buy ID */
  media_buy_id: string;

  /** Buyer reference */
  buyer_ref?: string;

  /** Current status */
  status: DeliveryStatus;

  /** Campaign dates */
  start_time: string;
  end_time: string;

  /** Aggregate metrics */
  totals: DeliveryMetrics;

  /** Package-level breakdown */
  by_package: PackageDelivery[];

  /** Daily breakdown */
  daily_breakdown?: Array<{
    date: string;
    impressions: number;
    spend: number;
    clicks?: number;
    video_completions?: number;
  }>;
}

// ============================================================================
// list_creatives Request/Response
// ============================================================================

export interface ListCreativesRequest {
  /** Query filters */
  filters?: CreativeFilters;

  /** Sorting configuration */
  sort?: CreativeSort;

  /** Pagination controls */
  pagination?: CreativePagination;

  /** Include package assignment data */
  include_assignments?: boolean;

  /** Include performance metrics */
  include_performance?: boolean;

  /** Include sub-assets for carousel/native */
  include_sub_assets?: boolean;

  /** Specific fields to return */
  fields?: string[];

  /** Session context identifier */
  context_id?: string;
}

export interface CreativeFilters {
  /** Filter by single format (string shorthand) */
  format?: string;

  /** Filter by multiple formats (string shorthand) */
  formats?: string[];

  /** Filter by format IDs (full object form) */
  format_ids?: FormatId[];

  /** Filter by single approval status */
  status?: CreativeApprovalStatus | CreativeApprovalStatus[];

  /** Filter by multiple approval statuses */
  statuses?: CreativeApprovalStatus[];

  /** Filter by tags (AND logic by default) */
  tags?: string[];

  /** Filter by tags with OR logic */
  tags_any?: string[];

  /** Tag matching mode (alternative to tags_any) */
  tags_match?: 'all' | 'any';

  /** Search by name (case-insensitive partial match) */
  name_contains?: string;

  /** Filter by specific creative IDs */
  creative_ids?: string[];

  /** Filter by creation date (after) */
  created_after?: string;

  /** Filter by creation date (before) */
  created_before?: string;

  /** Filter by update date (after) */
  updated_after?: string;

  /** Filter by update date (before) */
  updated_before?: string;

  /** Filter by package assignment */
  assigned_to_package?: string;

  /** Filter by multiple packages (OR logic) */
  assigned_to_packages?: string[];

  /** Filter by media buy IDs */
  media_buy_ids?: string[];

  /** Filter by buyer references */
  buyer_refs?: string[];

  /** Filter unassigned creatives only */
  unassigned?: boolean;

  /** Filter by performance data availability */
  has_performance_data?: boolean;
}

export interface CreativeSort {
  /** Sort field */
  field: CreativeSortField;

  /** Sort direction */
  direction: 'asc' | 'desc';
}

export type CreativeSortField =
  | 'created_date'
  | 'updated_date'
  | 'name'
  | 'status'
  | 'assignment_count'
  | 'performance_score';

export interface CreativePagination {
  /** Results per page (1-100, default 50) */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

export interface ListCreativesResponse extends BaseResponse {
  /** Query summary */
  query_summary: CreativeQuerySummary;

  /** Pagination info */
  pagination: CreativePaginationInfo;

  /** List of creatives */
  creatives: StoredCreative[];

  /** Format distribution summary */
  format_summary?: Record<string, number>;

  /** Status distribution summary */
  status_summary?: Record<string, number>;

  /** Session context identifier */
  context_id: string;
}

export interface CreativeQuerySummary {
  /** Total matching creatives */
  total_matching: number;

  /** Number returned in this response */
  returned: number;

  /** Filters that were applied */
  filters_applied: string[];
}

export interface CreativePaginationInfo {
  /** Results per page */
  limit: number;

  /** Current offset */
  offset: number;

  /** Whether more results exist */
  has_more: boolean;

  /** Total pages available */
  total_pages: number;

  /** Current page number */
  current_page: number;
}

export interface StoredCreative extends SyncCreative {
  /** Platform-assigned ID */
  platform_id: string;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Approval status */
  approval_status: CreativeApprovalStatus;

  /** Assigned packages */
  assigned_packages: string[];
}

export type CreativeApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'changes_required';

// ============================================================================
// sync_creatives Request/Response
// ============================================================================

export interface SyncCreativesRequest {
  /** Creatives to upload/update (max 100) */
  creatives: SyncCreative[];

  /** Filter scope to specific creatives */
  creative_ids?: string[];

  /** Creative to package assignments */
  assignments?: Record<string, string[]>;

  /** Preview changes without applying */
  dry_run?: boolean;

  /** Validation strictness */
  validation_mode?: 'strict' | 'lenient';

  /** Archive creatives not in sync */
  delete_missing?: boolean;

  /** Session context identifier */
  context_id?: string;
}

export interface SyncCreativesResponse extends BaseResponse {
  /** Per-creative results */
  creatives: SyncCreativeResult[];

  /** Whether this was a dry run */
  dry_run?: boolean;

  /** Errors that occurred */
  errors?: ErrorDetail[];

  /** Warnings */
  warnings?: WarningDetail[];

  /** Session context identifier */
  context_id: string;
}

// ============================================================================
// provide_performance_feedback Request/Response
// ============================================================================

export interface ProvidePerformanceFeedbackRequest {
  /** Publisher's media buy identifier */
  media_buy_id: string;

  /** Time window for measurement */
  measurement_period: MeasurementPeriod;

  /** Normalized performance score */
  performance_index: number;

  /** Specific package (optional) */
  package_id?: string;

  /** Specific creative (optional) */
  creative_id?: string;

  /** Business metric being measured */
  metric_type?: MetricType;

  /** Origin of performance data */
  feedback_source?: FeedbackSource;

  /** Session context identifier */
  context_id?: string;
}

export interface ProvidePerformanceFeedbackResponse extends BaseResponse {
  /** Whether feedback was accepted */
  success: boolean;

  /** Session context identifier */
  context_id: string;
}
