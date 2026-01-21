/**
 * AdCP Creative Manifest Types
 *
 * JSON structures that pair format requirements with actual asset content.
 */

import type {
  FormatId,
  Asset,
  AssetRequirement,
  Render,
  Dimensions,
  FormatType,
} from './types.js';

// ============================================================================
// Creative Manifest
// ============================================================================

export interface CreativeManifest {
  /** Format specification reference */
  format_id: FormatId;

  /** Product/offering being advertised (optional) */
  promoted_offering?: string;

  /** Map of asset IDs to asset content */
  assets: Record<string, CreativeAsset>;

  /** Metadata for tracking */
  metadata?: CreativeManifestMetadata;
}

export interface CreativeAsset {
  /** For image/video/audio assets */
  url?: string;

  /** For text assets */
  content?: string;

  /** Asset dimensions (for images/videos) */
  width?: number;
  height?: number;

  /** Duration in seconds (for video/audio) */
  duration_seconds?: number;

  /** File format */
  format?: string;

  /** MIME type */
  mime_type?: string;

  /** Additional properties */
  [key: string]: unknown;
}

export interface CreativeManifestMetadata {
  version?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

// ============================================================================
// Format Specification
// ============================================================================

export interface FormatSpecification {
  /** Format identifier */
  format_id: FormatId;

  /** Human-readable name */
  name: string;

  /** Format type category */
  type: FormatType;

  /** Detailed description */
  description?: string;

  /** Required and optional assets */
  assets_required: AssetRequirement[];

  /** Output render specifications */
  renders: Render[];

  /** Optional format card for visual representation */
  format_card?: FormatCard;

  /** Supported macros */
  supported_macros?: string[];

  /** Maximum file size for entire creative */
  max_total_size_bytes?: number;

  /** Additional validation rules */
  validation_rules?: ValidationRule[];
}

export interface FormatCard {
  /** Card image URL (300x400px standard) */
  image_url: string;

  /** Responsive variant URL */
  responsive_url?: string;
}

export interface ValidationRule {
  type: 'aspect_ratio' | 'min_duration' | 'max_duration' | 'file_size' | 'custom';
  value: string | number;
  message: string;
}

// ============================================================================
// Creative Format
// ============================================================================

export interface CreativeFormat {
  /** Format identifier */
  format_id: FormatId;

  /** Human-readable name */
  name: string;

  /** Format type */
  type: FormatType;

  /** Brief description */
  description?: string;

  /** Channel this format is for */
  channel?: string;
}

// ============================================================================
// Sync Creatives Types
// ============================================================================

export interface SyncCreative {
  /** Unique identifier */
  creative_id: string;

  /** Human-readable name */
  name: string;

  /** Format specification */
  format_id: FormatId;

  /** Assets keyed by role */
  assets: Record<string, CreativeAsset>;

  /** Organizational tags */
  tags?: string[];

  /** Creative manifest (full definition) */
  manifest?: CreativeManifest;
}

export interface CreativeAssignment {
  creative_id: string;
  package_ids: string[];
  weight?: number;
}

export type SyncAction = 'created' | 'updated' | 'unchanged' | 'failed' | 'deleted';

export interface SyncCreativeResult {
  creative_id: string;
  platform_id?: string;
  action: SyncAction;
  errors?: Array<{ code: string; message: string }>;
  warnings?: string[];
}

// ============================================================================
// Preview Types
// ============================================================================

export interface PreviewInput {
  name?: string;
  macros?: Record<string, string>;
  context_description?: string;
}

export interface PreviewRender {
  render_id: string;
  output_format: 'url' | 'html' | 'both';
  preview_url?: string;
  preview_html?: string;
  role: 'primary' | 'companion';
  dimensions: Dimensions;
}

export interface PreviewResult {
  preview_id: string;
  renders: PreviewRender[];
  input?: PreviewInput;
}

// ============================================================================
// Validation Utilities
// ============================================================================

export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestValidationError[];
  warnings: string[];
}

export interface ManifestValidationError {
  asset_id?: string;
  code: string;
  message: string;
}

export function validateCreativeManifest(
  manifest: CreativeManifest,
  format: FormatSpecification
): ManifestValidationResult {
  const errors: ManifestValidationError[] = [];
  const warnings: string[] = [];

  // Check format_id matches
  if (!manifest.format_id) {
    errors.push({
      code: 'MISSING_FORMAT_ID',
      message: 'Manifest is missing format_id',
    });
  } else if (
    manifest.format_id.agent_url !== format.format_id.agent_url ||
    manifest.format_id.id !== format.format_id.id
  ) {
    errors.push({
      code: 'FORMAT_MISMATCH',
      message: 'Manifest format_id does not match specification',
    });
  }

  // Check required assets
  for (const requirement of format.assets_required) {
    const asset = manifest.assets[requirement.asset_id];

    if (requirement.required && !asset) {
      errors.push({
        asset_id: requirement.asset_id,
        code: 'MISSING_REQUIRED_ASSET',
        message: `Required asset '${requirement.asset_id}' is missing`,
      });
      continue;
    }

    if (!asset) continue;

    // Validate asset based on type
    if (requirement.asset_type === 'image' || requirement.asset_type === 'video') {
      if (!asset.url) {
        errors.push({
          asset_id: requirement.asset_id,
          code: 'INVALID_ASSET_TYPE',
          message: `Asset '${requirement.asset_id}' requires a URL`,
        });
      }

      // Check dimensions
      if (asset.width && asset.height) {
        if (
          requirement.min_width &&
          asset.width < requirement.min_width
        ) {
          errors.push({
            asset_id: requirement.asset_id,
            code: 'INVALID_DIMENSIONS',
            message: `Asset '${requirement.asset_id}' width is below minimum (${requirement.min_width})`,
          });
        }
        if (
          requirement.max_width &&
          asset.width > requirement.max_width
        ) {
          errors.push({
            asset_id: requirement.asset_id,
            code: 'INVALID_DIMENSIONS',
            message: `Asset '${requirement.asset_id}' width exceeds maximum (${requirement.max_width})`,
          });
        }
      }

      // Check duration for video
      if (requirement.asset_type === 'video' && asset.duration_seconds) {
        if (
          requirement.min_duration_seconds &&
          asset.duration_seconds < requirement.min_duration_seconds
        ) {
          errors.push({
            asset_id: requirement.asset_id,
            code: 'INVALID_DURATION',
            message: `Asset '${requirement.asset_id}' duration is below minimum`,
          });
        }
        if (
          requirement.max_duration_seconds &&
          asset.duration_seconds > requirement.max_duration_seconds
        ) {
          errors.push({
            asset_id: requirement.asset_id,
            code: 'INVALID_DURATION',
            message: `Asset '${requirement.asset_id}' duration exceeds maximum`,
          });
        }
      }
    }

    if (requirement.asset_type === 'text') {
      if (!asset.content && !asset.url) {
        errors.push({
          asset_id: requirement.asset_id,
          code: 'INVALID_ASSET_TYPE',
          message: `Text asset '${requirement.asset_id}' requires content or URL`,
        });
      }
    }
  }

  // Check for unknown assets
  const knownAssetIds = new Set(format.assets_required.map((a) => a.asset_id));
  for (const assetId of Object.keys(manifest.assets)) {
    if (!knownAssetIds.has(assetId)) {
      warnings.push(`Unknown asset '${assetId}' will be ignored`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
