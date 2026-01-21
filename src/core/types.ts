/**
 * AdCP Core Types
 * Version: 2.6
 *
 * Core type definitions used across all AdCP protocols
 */

// ============================================================================
// Common Status Types
// ============================================================================

export type TaskStatus =
  | 'completed'
  | 'working'
  | 'submitted'
  | 'input-required'
  | 'failed'
  | 'canceled'
  | 'rejected'
  | 'auth-required'
  | 'unknown';

export interface BaseResponse {
  message: string;
  context_id?: string;
  status?: TaskStatus;
  task_id?: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface WarningDetail {
  code: string;
  message: string;
  field?: string;
}

// ============================================================================
// Format Identification
// ============================================================================

export interface FormatId {
  agent_url: string;
  id: string;
}

// ============================================================================
// Deployment/Destination Types (for Signals Protocol)
// ============================================================================

export type DestinationType = 'platform' | 'agent';

export interface PlatformDestination {
  type: 'platform';
  platform: string;
  account?: string;
}

export interface AgentDestination {
  type: 'agent';
  agent_url: string;
  account?: string;
}

export type Destination = PlatformDestination | AgentDestination;

export interface DeliverTo {
  deployments: Destination[];
  countries: string[];
}

// ============================================================================
// Activation Key Types
// ============================================================================

export interface SegmentIdActivationKey {
  type: 'segment_id';
  segment_id: string;
}

export interface KeyValueActivationKey {
  type: 'key_value';
  key: string;
  value: string;
}

export type ActivationKey = SegmentIdActivationKey | KeyValueActivationKey;

// ============================================================================
// Pricing Types
// ============================================================================

export type PricingModel =
  | 'cpm'
  | 'vcpm'
  | 'cpcv'
  | 'cpp'
  | 'cpc'
  | 'cpv'
  | 'grp'
  | 'flat_fee'
  | 'flat_rate'
  | 'share_of_voice';

export interface Pricing {
  cpm?: number;
  vcpm?: number;
  cpcv?: number;
  cpp?: number;
  cpc?: number;
  cpv?: number;
  flat_fee?: number;
  flat_rate?: number;
  currency: string;
}

export interface PricingOption {
  pricing_option_id: string;
  model: PricingModel;
  price: number;
  currency: string;
  minimum_spend?: number;
  volume_discounts?: VolumeDiscount[];
}

export interface VolumeDiscount {
  threshold: number;
  discount_percentage: number;
}

// ============================================================================
// Budget Types
// ============================================================================

export interface BudgetRange {
  currency: string;
  min?: number;
  max?: number;
}

// ============================================================================
// Date/Time Types
// ============================================================================

export interface DateRange {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export interface MeasurementPeriod {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

// ============================================================================
// Geographic Types
// ============================================================================

export interface GeoTarget {
  type: 'country' | 'region' | 'city' | 'dma' | 'postal_code' | 'polygon';
  value: string | GeoPolygon;
  include: boolean;
}

export interface GeoPolygon {
  coordinates: Array<[number, number]>;
}

// ============================================================================
// Targeting Types
// ============================================================================

export interface TargetingOverlay {
  geo_targets?: GeoTarget[];
  frequency_cap?: FrequencyCap;
  dayparting?: Dayparting;
  device_types?: DeviceType[];
  brand_safety?: BrandSafetyRule[];
  audience_segments?: AudienceSegment[];
}

export interface FrequencyCap {
  max_impressions: number;
  time_window_hours: number;
  scope: 'user' | 'household' | 'device';
}

export interface Dayparting {
  timezone: string;
  schedule: DaypartingSchedule[];
}

export interface DaypartingSchedule {
  days: DayOfWeek[];
  start_hour: number;
  end_hour: number;
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type DeviceType =
  | 'desktop'
  | 'mobile'
  | 'tablet'
  | 'ctv'
  | 'game_console'
  | 'dooh';

export interface BrandSafetyRule {
  type: 'block' | 'allow';
  category: string;
}

export interface AudienceSegment {
  segment_id: string;
  provider?: string;
}

// ============================================================================
// Delivery Types
// ============================================================================

export type DeliveryType = 'guaranteed' | 'non_guaranteed';

export type PacingStrategy = 'even' | 'asap' | 'front_loaded';

export interface DeliveryMeasurement {
  type: 'impressions' | 'viewable_impressions' | 'completed_views' | 'clicks';
  viewability_standard?: string;
}

export type DeliveryStatus =
  | 'delivering'
  | 'under_delivering'
  | 'over_delivering'
  | 'paused'
  | 'budget_exhausted'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'flight_ended'
  | 'goal_met';

// ============================================================================
// Channel Types
// ============================================================================

export type Channel =
  | 'display'
  | 'video'
  | 'ctv'
  | 'audio'
  | 'native'
  | 'dooh'
  | 'social'
  | 'podcast'
  | 'retail';

export type FormatType =
  | 'display'
  | 'video'
  | 'audio'
  | 'native'
  | 'dooh'
  | 'carousel'
  | 'rich_media';

// ============================================================================
// Principal Types (Authentication)
// ============================================================================

export type PrincipalType =
  | 'advertiser'
  | 'agency'
  | 'retail_media_network'
  | 'curator'
  | 'publisher'
  | 'sales_house'
  | 'rep_firm'
  | 'ssp'
  | 'ad_network';

export interface Principal {
  id: string;
  type: PrincipalType;
  name: string;
  authorized_properties?: string[];
}

// ============================================================================
// Webhook Configuration
// ============================================================================

export interface WebhookConfig {
  url: string;
  authentication: WebhookAuthentication;
}

export interface WebhookAuthentication {
  type: 'bearer' | 'hmac';
  credentials: string;
  header_name?: string;
}

export interface ReportingWebhook extends WebhookConfig {
  reporting_frequency: 'hourly' | 'daily' | 'weekly';
  requested_metrics: string[];
}

// ============================================================================
// Push Notification Config (MCP)
// ============================================================================

export interface PushNotificationConfig {
  url: string;
  authentication: WebhookAuthentication;
}

// ============================================================================
// Asset Types
// ============================================================================

export type AssetType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'url'
  | 'html'
  | 'css'
  | 'javascript'
  | 'vast'
  | 'daast'
  | 'webhook'
  | 'promoted_offerings';

export interface Asset {
  asset_id: string;
  asset_type: AssetType;
  url?: string;
  content?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  file_size_bytes?: number;
  format?: string;
  mime_type?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AssetRequirement {
  asset_id: string;
  asset_type: AssetType;
  required: boolean;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  aspect_ratios?: string[];
  min_duration_seconds?: number;
  max_duration_seconds?: number;
  max_file_size_bytes?: number;
  allowed_formats?: string[];
  allowed_mime_types?: string[];
  description?: string;
}

// ============================================================================
// Render Types
// ============================================================================

export interface Render {
  render_id: string;
  role: 'primary' | 'companion';
  dimensions: Dimensions;
  responsive?: boolean;
  min_dimensions?: Dimensions;
  max_dimensions?: Dimensions;
}

export interface Dimensions {
  width: number;
  height: number;
}

// ============================================================================
// Metric Types
// ============================================================================

export interface DeliveryMetrics {
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

export interface PackageDelivery {
  package_id: string;
  buyer_ref?: string;
  status: DeliveryStatus;
  paused: boolean;
  pacing_index: number;
  /** Effective pricing rate */
  rate?: number;
  /** Billing model used */
  pricing_model?: PricingModel;
  totals: DeliveryMetrics;
  daily_breakdown?: DailyMetrics[];
}

export interface DailyMetrics {
  date: string;
  impressions: number;
  spend: number;
  clicks?: number;
  video_completions?: number;
}

// ============================================================================
// Performance Feedback Types
// ============================================================================

export type MetricType =
  | 'overall_performance'
  | 'conversion_rate'
  | 'brand_lift'
  | 'click_through_rate'
  | 'completion_rate'
  | 'viewability'
  | 'brand_safety'
  | 'cost_efficiency';

export type FeedbackSource =
  | 'buyer_attribution'
  | 'third_party_measurement'
  | 'platform_analytics'
  | 'verification_partner';

// ============================================================================
// Creative Agent Capability Types
// ============================================================================

export type CreativeAgentCapability =
  | 'validation'
  | 'assembly'
  | 'preview'
  | 'generation';

export interface CreativeAgentInfo {
  agent_url: string;
  agent_name: string;
  capabilities: CreativeAgentCapability[];
}

// ============================================================================
// Publisher Property Types
// ============================================================================

export interface PublisherProperty {
  property_id: string;
  name: string;
  domain?: string;
  app_bundle?: string;
  property_tags?: string[];
  channels?: Channel[];
}

// ============================================================================
// Context Management
// ============================================================================

export interface SessionContext {
  context_id: string;
  created_at: string;
  expires_at: string;
  principal?: Principal;
  metadata?: Record<string, unknown>;
}
