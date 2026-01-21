/**
 * AdCP Universal Macros
 *
 * Dynamic placeholders replaced with actual values at impression time.
 * Enables buyers to include tracking data without publisher-specific implementation.
 */

// ============================================================================
// Macro Definitions
// ============================================================================

export const COMMON_MACROS = {
  // Identification
  MEDIA_BUY_ID: '{MEDIA_BUY_ID}',
  PACKAGE_ID: '{PACKAGE_ID}',
  CREATIVE_ID: '{CREATIVE_ID}',

  // Tracking
  CACHEBUSTER: '{CACHEBUSTER}',
  TIMESTAMP: '{TIMESTAMP}',
  CLICK_URL: '{CLICK_URL}',
} as const;

export const PRIVACY_MACROS = {
  // GDPR
  GDPR: '{GDPR}',
  GDPR_CONSENT: '{GDPR_CONSENT}',

  // US Privacy
  US_PRIVACY: '{US_PRIVACY}',

  // Global Privacy Platform
  GPP_STRING: '{GPP_STRING}',

  // Device-level
  LIMIT_AD_TRACKING: '{LIMIT_AD_TRACKING}',
} as const;

export const DEVICE_MACROS = {
  DEVICE_TYPE: '{DEVICE_TYPE}',
  OS: '{OS}',
  OS_VERSION: '{OS_VERSION}',
  DEVICE_MAKE: '{DEVICE_MAKE}',
  DEVICE_MODEL: '{DEVICE_MODEL}',
  USER_AGENT: '{USER_AGENT}',
  APP_BUNDLE: '{APP_BUNDLE}',
  APP_NAME: '{APP_NAME}',
} as const;

export const GEO_MACROS = {
  COUNTRY: '{COUNTRY}',
  REGION: '{REGION}',
  CITY: '{CITY}',
  ZIP: '{ZIP}',
  DMA: '{DMA}',
  LAT: '{LAT}',
  LONG: '{LONG}',
} as const;

export const IDENTITY_MACROS = {
  DEVICE_ID: '{DEVICE_ID}',
  DEVICE_ID_TYPE: '{DEVICE_ID_TYPE}',
} as const;

export const WEB_CONTEXT_MACROS = {
  DOMAIN: '{DOMAIN}',
  PAGE_URL: '{PAGE_URL}',
  REFERRER: '{REFERRER}',
  KEYWORDS: '{KEYWORDS}',
} as const;

export const PLACEMENT_MACROS = {
  PLACEMENT_ID: '{PLACEMENT_ID}',
  FOLD_POSITION: '{FOLD_POSITION}',
  AD_WIDTH: '{AD_WIDTH}',
  AD_HEIGHT: '{AD_HEIGHT}',
} as const;

export const VIDEO_CONTENT_MACROS = {
  VIDEO_ID: '{VIDEO_ID}',
  VIDEO_TITLE: '{VIDEO_TITLE}',
  VIDEO_DURATION: '{VIDEO_DURATION}',
  VIDEO_CATEGORY: '{VIDEO_CATEGORY}',
  CONTENT_GENRE: '{CONTENT_GENRE}',
  CONTENT_RATING: '{CONTENT_RATING}',
  PLAYER_WIDTH: '{PLAYER_WIDTH}',
  PLAYER_HEIGHT: '{PLAYER_HEIGHT}',
} as const;

export const VIDEO_POD_MACROS = {
  POD_POSITION: '{POD_POSITION}',
  POD_SIZE: '{POD_SIZE}',
  AD_BREAK_ID: '{AD_BREAK_ID}',
} as const;

export const DOOH_MACROS = {
  SCREEN_ID: '{SCREEN_ID}',
  VENUE_TYPE: '{VENUE_TYPE}',
  VENUE_LAT: '{VENUE_LAT}',
  VENUE_LONG: '{VENUE_LONG}',
  SCREEN_WIDTH: '{SCREEN_WIDTH}',
  SCREEN_HEIGHT: '{SCREEN_HEIGHT}',
  DWELL_TIME: '{DWELL_TIME}',
  PLAY_TIMESTAMP: '{PLAY_TIMESTAMP}',
} as const;

export const INTEGRATION_MACROS = {
  /** AXE contextual metadata blob */
  AXEM: '{AXEM}',
} as const;

// All macros combined
export const ALL_MACROS = {
  ...COMMON_MACROS,
  ...PRIVACY_MACROS,
  ...DEVICE_MACROS,
  ...GEO_MACROS,
  ...IDENTITY_MACROS,
  ...WEB_CONTEXT_MACROS,
  ...PLACEMENT_MACROS,
  ...VIDEO_CONTENT_MACROS,
  ...VIDEO_POD_MACROS,
  ...DOOH_MACROS,
  ...INTEGRATION_MACROS,
} as const;

export type MacroName = keyof typeof ALL_MACROS;
export type MacroValue = (typeof ALL_MACROS)[MacroName];

// ============================================================================
// Macro Processing
// ============================================================================

export interface MacroContext {
  // Common
  media_buy_id?: string;
  package_id?: string;
  creative_id?: string;
  timestamp?: number;

  // Privacy
  gdpr?: '0' | '1';
  gdpr_consent?: string;
  us_privacy?: string;
  gpp_string?: string;
  limit_ad_tracking?: '0' | '1';

  // Device
  device_type?: 'desktop' | 'mobile' | 'tablet' | 'ctv' | 'dooh';
  os?: string;
  os_version?: string;
  device_make?: string;
  device_model?: string;
  user_agent?: string;
  app_bundle?: string;
  app_name?: string;

  // Geo
  country?: string;
  region?: string;
  city?: string;
  zip?: string;
  dma?: string;
  lat?: number;
  long?: number;

  // Identity
  device_id?: string;
  device_id_type?: 'idfa' | 'gaid' | 'rida' | 'afai';

  // Web context
  domain?: string;
  page_url?: string;
  referrer?: string;
  keywords?: string;

  // Placement
  placement_id?: string;
  fold_position?: 'above' | 'below' | 'unknown';
  ad_width?: number;
  ad_height?: number;

  // Video content
  video_id?: string;
  video_title?: string;
  video_duration?: number;
  video_category?: string;
  content_genre?: string;
  content_rating?: string;
  player_width?: number;
  player_height?: number;

  // Video pod
  pod_position?: 'pre' | 'mid' | 'post';
  pod_size?: number;
  ad_break_id?: string;

  // DOOH
  screen_id?: string;
  venue_type?: string;
  venue_lat?: number;
  venue_long?: number;
  screen_width?: number;
  screen_height?: number;
  dwell_time?: number;
}

/**
 * Replaces macro placeholders with actual values from context
 */
export function replaceMacros(template: string, context: MacroContext): string {
  let result = template;

  // Generate cachebuster
  const cachebuster = Math.floor(Math.random() * 1000000000).toString();
  const timestamp = context.timestamp || Date.now();

  // Replace common macros
  result = result.replace(/{MEDIA_BUY_ID}/g, context.media_buy_id || '');
  result = result.replace(/{PACKAGE_ID}/g, context.package_id || '');
  result = result.replace(/{CREATIVE_ID}/g, context.creative_id || '');
  result = result.replace(/{CACHEBUSTER}/g, cachebuster);
  result = result.replace(/{TIMESTAMP}/g, timestamp.toString());

  // Replace privacy macros
  result = result.replace(/{GDPR}/g, context.gdpr || '');
  result = result.replace(/{GDPR_CONSENT}/g, context.gdpr_consent || '');
  result = result.replace(/{US_PRIVACY}/g, context.us_privacy || '');
  result = result.replace(/{GPP_STRING}/g, context.gpp_string || '');
  result = result.replace(/{LIMIT_AD_TRACKING}/g, context.limit_ad_tracking || '');

  // Replace device macros
  result = result.replace(/{DEVICE_TYPE}/g, context.device_type || '');
  result = result.replace(/{OS}/g, context.os || '');
  result = result.replace(/{OS_VERSION}/g, context.os_version || '');
  result = result.replace(/{DEVICE_MAKE}/g, context.device_make || '');
  result = result.replace(/{DEVICE_MODEL}/g, context.device_model || '');
  result = result.replace(/{USER_AGENT}/g, context.user_agent || '');
  result = result.replace(/{APP_BUNDLE}/g, context.app_bundle || '');
  result = result.replace(/{APP_NAME}/g, context.app_name || '');

  // Replace geo macros
  result = result.replace(/{COUNTRY}/g, context.country || '');
  result = result.replace(/{REGION}/g, context.region || '');
  result = result.replace(/{CITY}/g, context.city || '');
  result = result.replace(/{ZIP}/g, context.zip || '');
  result = result.replace(/{DMA}/g, context.dma || '');
  result = result.replace(/{LAT}/g, context.lat?.toString() || '');
  result = result.replace(/{LONG}/g, context.long?.toString() || '');

  // Replace identity macros
  result = result.replace(/{DEVICE_ID}/g, context.device_id || '');
  result = result.replace(/{DEVICE_ID_TYPE}/g, context.device_id_type || '');

  // Replace web context macros
  result = result.replace(/{DOMAIN}/g, context.domain || '');
  result = result.replace(/{PAGE_URL}/g, context.page_url || '');
  result = result.replace(/{REFERRER}/g, context.referrer || '');
  result = result.replace(/{KEYWORDS}/g, context.keywords || '');

  // Replace placement macros
  result = result.replace(/{PLACEMENT_ID}/g, context.placement_id || '');
  result = result.replace(/{FOLD_POSITION}/g, context.fold_position || '');
  result = result.replace(/{AD_WIDTH}/g, context.ad_width?.toString() || '');
  result = result.replace(/{AD_HEIGHT}/g, context.ad_height?.toString() || '');

  // Replace video content macros
  result = result.replace(/{VIDEO_ID}/g, context.video_id || '');
  result = result.replace(/{VIDEO_TITLE}/g, context.video_title || '');
  result = result.replace(/{VIDEO_DURATION}/g, context.video_duration?.toString() || '');
  result = result.replace(/{VIDEO_CATEGORY}/g, context.video_category || '');
  result = result.replace(/{CONTENT_GENRE}/g, context.content_genre || '');
  result = result.replace(/{CONTENT_RATING}/g, context.content_rating || '');
  result = result.replace(/{PLAYER_WIDTH}/g, context.player_width?.toString() || '');
  result = result.replace(/{PLAYER_HEIGHT}/g, context.player_height?.toString() || '');

  // Replace video pod macros
  result = result.replace(/{POD_POSITION}/g, context.pod_position || '');
  result = result.replace(/{POD_SIZE}/g, context.pod_size?.toString() || '');
  result = result.replace(/{AD_BREAK_ID}/g, context.ad_break_id || '');

  // Replace DOOH macros
  result = result.replace(/{SCREEN_ID}/g, context.screen_id || '');
  result = result.replace(/{VENUE_TYPE}/g, context.venue_type || '');
  result = result.replace(/{VENUE_LAT}/g, context.venue_lat?.toString() || '');
  result = result.replace(/{VENUE_LONG}/g, context.venue_long?.toString() || '');
  result = result.replace(/{SCREEN_WIDTH}/g, context.screen_width?.toString() || '');
  result = result.replace(/{SCREEN_HEIGHT}/g, context.screen_height?.toString() || '');
  result = result.replace(/{DWELL_TIME}/g, context.dwell_time?.toString() || '');

  return result;
}

/**
 * Extracts all macro placeholders from a template string
 */
export function extractMacros(template: string): string[] {
  const macroRegex = /\{([A-Z_]+)\}/g;
  const matches = template.matchAll(macroRegex);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * Validates that all macros in a template are supported
 */
export function validateMacros(template: string): { valid: boolean; unknown: string[] } {
  const extracted = extractMacros(template);
  const allMacroNames = Object.keys(ALL_MACROS).map((k) =>
    k.toUpperCase()
  );
  const unknown = extracted.filter((m) => !allMacroNames.includes(m));
  return {
    valid: unknown.length === 0,
    unknown,
  };
}
