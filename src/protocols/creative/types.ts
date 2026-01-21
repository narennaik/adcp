/**
 * AdCP Creative Protocol Types
 *
 * Type definitions for the Creative Protocol.
 */

import type {
  BaseResponse,
  FormatId,
  ErrorDetail,
  Dimensions,
  CreativeAgentInfo,
} from '../../core/types.js';
import type {
  CreativeManifest,
  CreativeFormat,
  FormatSpecification,
  PreviewInput,
  PreviewResult,
  PreviewRender,
} from '../../core/creative-manifest.js';

// ============================================================================
// list_creative_formats Request/Response (Creative Agent)
// ============================================================================

export interface CreativeListFormatsRequest {
  /** Return specific format IDs */
  format_ids?: FormatId[];

  /** Filter by channel type (audio, video, display, dooh) */
  type?: string;

  /** Filter by format types */
  format_types?: string[];

  /** Filter by channels */
  channels?: string[];

  /** Filter by accepted asset types (OR logic) */
  asset_types?: string[];

  /** Maximum width (matches if ANY render fits) */
  max_width?: number;

  /** Maximum height (matches if ANY render fits) */
  max_height?: number;

  /** Minimum width */
  min_width?: number;

  /** Minimum height */
  min_height?: number;

  /** Filter responsive formats only */
  is_responsive?: boolean;

  /** Case-insensitive partial name matching */
  name_search?: string;

  /** Include full specifications */
  include_specs?: boolean;

  /** Session context identifier */
  context_id?: string;
}

export interface CreativeListFormatsResponse extends BaseResponse {
  /** Available formats */
  formats: CreativeFormatInfo[];

  /** Full specifications (if requested) */
  specifications?: FormatSpecification[];

  /** Other creative agents providing additional formats */
  creative_agents?: CreativeAgentReference[];

  /** Session context identifier */
  context_id: string;
}

export interface CreativeAgentReference {
  /** Agent URL */
  agent_url: string;

  /** Agent name */
  agent_name: string;

  /** Description */
  description?: string;
}

export interface CreativeFormatInfo extends CreativeFormat {
  /** Whether this agent provides authoritative specs */
  is_authoritative: boolean;

  /** Supported capabilities for this format */
  capabilities: CreativeFormatCapability[];

  /** Render specifications summary */
  renders?: FormatRenderSummary[];
}

export interface FormatRenderSummary {
  /** Render role */
  role: 'primary' | 'companion';

  /** Dimensions */
  dimensions: Dimensions;

  /** Whether responsive */
  responsive?: boolean;
}

export type CreativeFormatCapability =
  | 'validation'
  | 'assembly'
  | 'preview'
  | 'generation';

// ============================================================================
// build_creative Request/Response
// ============================================================================

export interface BuildCreativeRequest {
  /** Natural language instructions */
  message?: string;

  /** Source manifest to transform */
  creative_manifest?: Partial<CreativeManifest>;

  /** Target format specification */
  target_format_id: FormatId;

  /** Session context identifier */
  context_id?: string;
}

export interface BuildCreativeResponse extends BaseResponse {
  /** Generated/transformed creative manifest */
  creative_manifest: CreativeManifest;

  /** Product/service being advertised */
  promoted_offering?: string;

  /** Warnings during generation */
  warnings?: string[];

  /** Session context identifier */
  context_id: string;
}

// ============================================================================
// preview_creative Request/Response
// ============================================================================

export interface PreviewCreativeRequest {
  /** Request type */
  request_type: 'single' | 'batch';

  /** Format specification (single mode) */
  format_id?: FormatId;

  /** Creative manifest to preview (single mode) */
  creative_manifest?: CreativeManifest;

  /** Input variations (single mode) */
  inputs?: PreviewInput[];

  /** Output format preference */
  output_format?: 'url' | 'html' | 'both';

  /** Batch requests (batch mode) */
  requests?: SinglePreviewRequest[];

  /** Session context identifier */
  context_id?: string;
}

export interface SinglePreviewRequest {
  /** Format specification */
  format_id: FormatId;

  /** Creative manifest to preview */
  creative_manifest: CreativeManifest;

  /** Input variations */
  inputs?: PreviewInput[];

  /** Output format preference */
  output_format?: 'url' | 'html' | 'both';
}

export interface PreviewCreativeResponse extends BaseResponse {
  /** Response type matching request */
  response_type: 'single' | 'batch';

  /** Preview results (single mode) */
  previews?: PreviewResult[];

  /** Batch results */
  results?: BatchPreviewResult[];

  /** Interactive testing page URL */
  interactive_url?: string;

  /** Preview expiration */
  expires_at: string;

  /** Session context identifier */
  context_id: string;
}

export interface BatchPreviewResult {
  /** Whether preview succeeded */
  success: boolean;

  /** Single preview response (on success) */
  response?: {
    previews: PreviewResult[];
    expires_at: string;
  };

  /** Error details (on failure) */
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// validate_creative Request/Response
// ============================================================================

export interface ValidateCreativeRequest {
  /** Format specification */
  format_id: FormatId;

  /** Creative manifest to validate */
  creative_manifest: CreativeManifest;

  /** Validation strictness */
  validation_mode?: 'strict' | 'lenient';

  /** Session context identifier */
  context_id?: string;
}

export interface ValidateCreativeResponse extends BaseResponse {
  /** Whether manifest is valid */
  valid: boolean;

  /** Validation errors */
  errors?: CreativeValidationError[];

  /** Validation warnings */
  warnings?: string[];

  /** Session context identifier */
  context_id: string;
}

export interface CreativeValidationError {
  /** Asset that failed validation */
  asset_id?: string;

  /** Error code */
  code: string;

  /** Error message */
  message: string;
}
