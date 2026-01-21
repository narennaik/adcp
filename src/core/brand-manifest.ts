/**
 * AdCP Brand Manifest Types
 *
 * Standardized format for identifying advertisers and providing
 * brand context for creative generation and policy compliance.
 */

// ============================================================================
// Brand Manifest Types
// ============================================================================

export interface BrandManifest {
  /** Primary brand URL for context and asset discovery */
  url?: string;

  /** Brand or business name */
  name?: string;

  /** Brand logo assets with semantic tags */
  logos?: Logo[];

  /** Brand color palette */
  colors?: BrandColors;

  /** Typography guidelines */
  fonts?: BrandFonts;

  /** Brand voice and messaging tone */
  tone?: string;

  /** Brand tagline or slogan */
  tagline?: string;

  /** Brand asset library */
  assets?: BrandAsset[];

  /** E-commerce product information */
  product_catalog?: ProductCatalog;

  /** Legal disclaimers for creatives */
  disclaimers?: Disclaimer[];

  /** Industry or vertical */
  industry?: string;

  /** Primary audience description */
  target_audience?: string;

  /** Brand contact information */
  contact?: BrandContact;

  /** Version and update tracking */
  metadata?: BrandMetadata;
}

export type BrandManifestRef = BrandManifest | string;

// ============================================================================
// Logo Types
// ============================================================================

export type LogoTag =
  | 'dark'
  | 'light'
  | 'square'
  | 'horizontal'
  | 'vertical'
  | 'monochrome'
  | 'color'
  | 'primary'
  | 'secondary'
  | 'icon'
  | 'wordmark'
  | 'lockup';

export interface Logo {
  url: string;
  tags?: LogoTag[];
  width?: number;
  height?: number;
  format?: string;
}

// ============================================================================
// Color Types
// ============================================================================

export interface BrandColors {
  /** Primary brand color (hex) */
  primary?: string;

  /** Secondary brand color (hex) */
  secondary?: string;

  /** Accent color (hex) */
  accent?: string;

  /** Background color (hex) */
  background?: string;

  /** Text color (hex) */
  text?: string;

  /** Additional named colors */
  [key: string]: string | undefined;
}

// ============================================================================
// Font Types
// ============================================================================

export interface BrandFonts {
  /** Primary font family */
  primary?: string;

  /** Secondary font family */
  secondary?: string;

  /** Font file URLs */
  font_urls?: string[];
}

// ============================================================================
// Brand Asset Types
// ============================================================================

export type BrandAssetType = 'image' | 'video' | 'audio' | 'text' | 'document';

export interface BrandAsset {
  asset_id: string;
  asset_type: BrandAssetType;
  url: string;
  name?: string;
  description?: string;
  tags?: string[];
  width?: number;
  height?: number;
  duration_seconds?: number;
  file_size_bytes?: number;
  format?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Product Catalog Types
// ============================================================================

export type ProductFeedFormat =
  | 'google_merchant_center'
  | 'facebook_catalog'
  | 'shopify'
  | 'custom_json'
  | 'custom_xml';

export type UpdateFrequency =
  | 'realtime'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly';

export interface ProductCatalog {
  feed_url: string;
  feed_format: ProductFeedFormat;
  categories?: string[];
  last_updated?: string;
  update_frequency?: UpdateFrequency;
}

// ============================================================================
// Disclaimer Types
// ============================================================================

export type DisclaimerContext =
  | 'financial_products'
  | 'healthcare'
  | 'alcohol'
  | 'gambling'
  | 'pharmaceutical'
  | 'automotive'
  | 'general';

export interface Disclaimer {
  text: string;
  context?: DisclaimerContext;
  required?: boolean;
}

// ============================================================================
// Contact Types
// ============================================================================

export interface BrandContact {
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}

// ============================================================================
// Metadata Types
// ============================================================================

export interface BrandMetadata {
  version?: string;
  last_updated?: string;
  created_at?: string;
  updated_by?: string;
}

// ============================================================================
// Validation Utilities
// ============================================================================

export function isValidBrandManifest(manifest: unknown): manifest is BrandManifest {
  if (typeof manifest !== 'object' || manifest === null) {
    return false;
  }

  const m = manifest as BrandManifest;

  // At least url or name is required
  if (!m.url && !m.name) {
    return false;
  }

  // Validate hex colors if present
  if (m.colors) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    for (const [key, value] of Object.entries(m.colors)) {
      if (value && !hexColorRegex.test(value)) {
        return false;
      }
    }
  }

  return true;
}

export function resolveBrandManifestRef(
  ref: BrandManifestRef
): { type: 'inline'; manifest: BrandManifest } | { type: 'url'; url: string } {
  if (typeof ref === 'string') {
    return { type: 'url', url: ref };
  }
  return { type: 'inline', manifest: ref };
}
