/**
 * AdCP Capability Discovery
 *
 * Implementation of adagents.json authorization system and
 * capability discovery for sales agents.
 */

import type { Channel, FormatId, PublisherProperty } from '../core/types.js';

// ============================================================================
// adagents.json Types
// ============================================================================

/**
 * adagents.json schema - placed at /.well-known/adagents.json per RFC 8615
 * e.g., https://example.com/.well-known/adagents.json
 */
export interface AdAgentsJson {
  /** JSON Schema reference */
  $schema?: string;

  /** Schema version */
  version: string;

  /** Publisher contact information */
  contact: AdAgentsContact;

  /** Property definitions */
  properties?: AdAgentsProperty[];

  /** Tag metadata for grouping properties */
  tags?: Record<string, AdAgentsTagMetadata>;

  /** Authorized sales agents */
  authorized_agents: AuthorizedAgent[];

  /** Last updated timestamp (ISO 8601) */
  last_updated?: string;

  /** URL to authoritative location (single redirect allowed) */
  authoritative_location?: string;
}

export interface AdAgentsContact {
  /** Managing entity name */
  name: string;

  /** Contact email */
  email?: string;

  /** Primary publisher domain */
  domain?: string;

  /** sellers.json seller ID */
  seller_id?: string;

  /** TAG Certified Against Fraud ID */
  tag_id?: string;
}

export interface AdAgentsProperty {
  /** Unique property identifier */
  property_id: string;

  /** Property type */
  property_type: 'website' | 'mobile_app' | 'ctv_app' | 'audio_app' | 'dooh';

  /** Human-readable name */
  name: string;

  /** Property identifiers (domain, bundle, etc.) */
  identifiers: AdAgentsPropertyIdentifier[];

  /** Grouping tags */
  tags?: string[];

  /** Domain ownership for verification */
  publisher_domain?: string;
}

export interface AdAgentsPropertyIdentifier {
  /** Identifier type */
  type: 'domain' | 'ios_bundle' | 'android_bundle' | 'roku_channel' | 'ctv_app_id';

  /** Identifier value */
  value: string;
}

export interface AdAgentsTagMetadata {
  /** Tag display name */
  name: string;

  /** Tag description */
  description?: string;
}

/** @deprecated Use AdAgentsContact instead */
export interface PublisherInfo {
  /** Publisher name */
  name: string;

  /** Publisher domain */
  domain: string;

  /** Publisher ID */
  id?: string;

  /** Contact email */
  contact_email?: string;
}

export interface AuthorizedAgent {
  /** Agent API endpoint URL */
  url: string;

  /** @deprecated Use url instead */
  agent_url?: string;

  /** Human-readable description of authorization */
  authorized_for: string;

  /** Authorization type */
  authorization_type?: AuthorizationType;

  /** Agent name */
  name?: string;

  /** Authorization scope */
  scope: AuthorizationScope;

  /** Authorization start date (ISO 8601) */
  valid_from?: string;

  /** Authorization end date (ISO 8601) */
  valid_until?: string;

  /** Property IDs authorized (when authorization_type is property_ids) */
  property_ids?: string[];

  /** Authorized property tags (when authorization_type is property_tags) */
  property_tags?: string[];

  /** Inline properties (when authorization_type is inline_properties) */
  properties?: AdAgentsProperty[];

  /** Publisher property references (when authorization_type is publisher_properties) */
  publisher_properties?: AdAgentsPublisherProperty[];

  /** Authorized channels */
  channels?: Channel[];

  /** Specific format IDs authorized */
  format_ids?: FormatId[];

  /** Commission/revenue share percentage */
  commission_percentage?: number;
}

export type AuthorizationType =
  | 'property_ids'         // Authorize specific property IDs
  | 'property_tags'        // Authorize properties matching tags
  | 'inline_properties'    // Properties defined inline in this file
  | 'publisher_properties'; // Multi-publisher property references

/** Publisher property reference for multi-publisher authorization */
export interface AdAgentsPublisherProperty {
  /** Publisher domain */
  publisher_domain: string;

  /** Selection type */
  selection_type: 'by_id' | 'by_tag';

  /** Property IDs (when selection_type is 'by_id') */
  property_ids?: string[];

  /** Property tags (when selection_type is 'by_tag') */
  property_tags?: string[];
}

export type AuthorizationScope =
  | 'full'           // All inventory
  | 'partial'        // Limited to property_tags/channels/format_ids
  | 'exclusive'      // Exclusive representation
  | 'non_exclusive'; // Non-exclusive representation

// ============================================================================
// Capability Discovery Service
// ============================================================================

export interface CapabilityDiscoveryConfig {
  /** Cache TTL in seconds */
  cacheTtlSeconds?: number;

  /** Request timeout in milliseconds */
  requestTimeoutMs?: number;

  /** Custom fetch function (for testing) */
  fetchFn?: typeof fetch;
}

export class CapabilityDiscoveryService {
  private cache: Map<string, CacheEntry<AdAgentsJson>> = new Map();
  private config: Required<CapabilityDiscoveryConfig>;

  constructor(config: CapabilityDiscoveryConfig = {}) {
    this.config = {
      cacheTtlSeconds: config.cacheTtlSeconds ?? 3600, // 1 hour default
      requestTimeoutMs: config.requestTimeoutMs ?? 10000, // 10 seconds
      fetchFn: config.fetchFn ?? fetch,
    };
  }

  /**
   * Fetch and parse adagents.json from a publisher domain
   * Per RFC 8615, the file is located at /.well-known/adagents.json
   */
  async getAdAgentsJson(domain: string): Promise<AdAgentsJson | null> {
    // Check cache first
    const cached = this.cache.get(domain);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const url = `https://${domain}/.well-known/adagents.json`;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.requestTimeoutMs
      );

      const response = await this.config.fetchFn(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as AdAgentsJson;

      // Validate basic structure
      if (!this.isValidAdAgentsJson(data)) {
        return null;
      }

      // Cache the result
      this.cache.set(domain, {
        data,
        expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
      });

      return data;
    } catch {
      // Return null on any error (network, timeout, parse, etc.)
      return null;
    }
  }

  /**
   * Check if an agent is authorized for a specific domain
   */
  async isAgentAuthorized(
    agentUrl: string,
    domain: string
  ): Promise<AuthorizationResult> {
    const adAgentsJson = await this.getAdAgentsJson(domain);

    if (!adAgentsJson) {
      return {
        authorized: false,
        reason: 'adagents.json not found or invalid',
      };
    }

    const agent = adAgentsJson.authorized_agents.find(
      (a) => this.normalizeUrl(a.url || a.agent_url || '') === this.normalizeUrl(agentUrl)
    );

    if (!agent) {
      return {
        authorized: false,
        reason: 'Agent not listed in adagents.json',
      };
    }

    // Check validity period
    const now = new Date();
    if (agent.valid_from) {
      const validFrom = new Date(agent.valid_from);
      if (now < validFrom) {
        return {
          authorized: false,
          reason: 'Authorization not yet valid',
          validFrom: agent.valid_from,
        };
      }
    }

    if (agent.valid_until) {
      const validUntil = new Date(agent.valid_until);
      if (now > validUntil) {
        return {
          authorized: false,
          reason: 'Authorization expired',
          validUntil: agent.valid_until,
        };
      }
    }

    return {
      authorized: true,
      scope: agent.scope,
      propertyTags: agent.property_tags,
      channels: agent.channels,
      formatIds: agent.format_ids,
      commissionPercentage: agent.commission_percentage,
    };
  }

  /**
   * Get all authorized agents for a domain
   */
  async getAuthorizedAgents(domain: string): Promise<AuthorizedAgent[]> {
    const adAgentsJson = await this.getAdAgentsJson(domain);
    if (!adAgentsJson) return [];

    const now = new Date();
    return adAgentsJson.authorized_agents.filter((agent) => {
      if (agent.valid_from && new Date(agent.valid_from) > now) return false;
      if (agent.valid_until && new Date(agent.valid_until) < now) return false;
      return true;
    });
  }

  /**
   * Validate authorization for specific inventory
   */
  async validateInventoryAuthorization(
    agentUrl: string,
    domain: string,
    options: {
      propertyTag?: string;
      channel?: Channel;
      formatId?: FormatId;
    }
  ): Promise<AuthorizationResult> {
    const authResult = await this.isAgentAuthorized(agentUrl, domain);

    if (!authResult.authorized) {
      return authResult;
    }

    // Full scope means all inventory is authorized
    if (authResult.scope === 'full' || authResult.scope === 'exclusive') {
      return authResult;
    }

    // Check property tag
    if (
      options.propertyTag &&
      authResult.propertyTags &&
      !authResult.propertyTags.includes(options.propertyTag)
    ) {
      return {
        authorized: false,
        reason: `Property tag '${options.propertyTag}' not in authorized scope`,
      };
    }

    // Check channel
    if (
      options.channel &&
      authResult.channels &&
      !authResult.channels.includes(options.channel)
    ) {
      return {
        authorized: false,
        reason: `Channel '${options.channel}' not in authorized scope`,
      };
    }

    // Check format ID
    if (options.formatId && authResult.formatIds) {
      const formatMatch = authResult.formatIds.some(
        (f) =>
          f.agent_url === options.formatId!.agent_url &&
          f.id === options.formatId!.id
      );
      if (!formatMatch) {
        return {
          authorized: false,
          reason: 'Format not in authorized scope',
        };
      }
    }

    return authResult;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific domain
   */
  clearDomainCache(domain: string): void {
    this.cache.delete(domain);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private isValidAdAgentsJson(data: unknown): data is AdAgentsJson {
    if (typeof data !== 'object' || data === null) return false;

    const json = data as Record<string, unknown>;

    if (typeof json.version !== 'string') return false;
    if (!Array.isArray(json.authorized_agents)) return false;

    // Support both 'contact' (new spec) and 'publisher' (legacy)
    const contact = (json.contact || json.publisher) as Record<string, unknown> | null;
    if (typeof contact !== 'object' || contact === null) return false;
    if (typeof contact.name !== 'string') return false;

    for (const agent of json.authorized_agents as unknown[]) {
      if (typeof agent !== 'object' || agent === null) return false;
      const a = agent as Record<string, unknown>;
      // Support both 'url' (new spec) and 'agent_url' (legacy)
      if (typeof a.url !== 'string' && typeof a.agent_url !== 'string') return false;
      if (typeof a.authorized_for !== 'string' && typeof a.name !== 'string') return false;
      if (typeof a.scope !== 'string') return false;
    }

    return true;
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash and normalize to lowercase
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(
        /\/$/,
        ''
      ).toLowerCase();
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }
}

// ============================================================================
// Authorization Result Types
// ============================================================================

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  scope?: AuthorizationScope;
  propertyTags?: string[];
  channels?: Channel[];
  formatIds?: FormatId[];
  commissionPercentage?: number;
  validFrom?: string;
  validUntil?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate an adagents.json file for a publisher
 */
export function generateAdAgentsJson(
  contact: AdAgentsContact,
  authorizedAgents: AuthorizedAgent[],
  options?: {
    properties?: AdAgentsProperty[];
    tags?: Record<string, AdAgentsTagMetadata>;
    schemaUrl?: string;
  }
): AdAgentsJson {
  return {
    $schema: options?.schemaUrl,
    version: '1.0',
    contact,
    properties: options?.properties,
    tags: options?.tags,
    authorized_agents: authorizedAgents,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Validate an adagents.json structure
 */
export function validateAdAgentsJson(
  data: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Root must be an object'] };
  }

  const json = data as Record<string, unknown>;

  if (typeof json.version !== 'string') {
    errors.push('Missing or invalid version field');
  }

  // Validate contact (new spec) or publisher (legacy)
  const contact = (json.contact || json.publisher) as Record<string, unknown> | null;
  if (typeof contact !== 'object' || contact === null) {
    errors.push('Missing or invalid contact field');
  } else {
    if (typeof contact.name !== 'string') {
      errors.push('Missing contact.name');
    }
  }

  // Validate properties if present
  if (json.properties !== undefined) {
    if (!Array.isArray(json.properties)) {
      errors.push('properties must be an array');
    } else {
      json.properties.forEach((prop: unknown, index: number) => {
        if (typeof prop !== 'object' || prop === null) {
          errors.push(`properties[${index}] must be an object`);
          return;
        }
        const p = prop as Record<string, unknown>;
        if (typeof p.property_id !== 'string') {
          errors.push(`properties[${index}].property_id is required`);
        }
        if (typeof p.property_type !== 'string') {
          errors.push(`properties[${index}].property_type is required`);
        }
        if (typeof p.name !== 'string') {
          errors.push(`properties[${index}].name is required`);
        }
      });
    }
  }

  if (!Array.isArray(json.authorized_agents)) {
    errors.push('Missing or invalid authorized_agents array');
  } else {
    json.authorized_agents.forEach((agent, index) => {
      if (typeof agent !== 'object' || agent === null) {
        errors.push(`authorized_agents[${index}] must be an object`);
        return;
      }
      const a = agent as Record<string, unknown>;
      // Support both 'url' (new spec) and 'agent_url' (legacy)
      if (typeof a.url !== 'string' && typeof a.agent_url !== 'string') {
        errors.push(`authorized_agents[${index}].url is required`);
      }
      if (typeof a.authorized_for !== 'string') {
        errors.push(`authorized_agents[${index}].authorized_for is required`);
      }
      if (typeof a.scope !== 'string') {
        errors.push(`authorized_agents[${index}].scope is required`);
      } else if (
        !['full', 'partial', 'exclusive', 'non_exclusive'].includes(a.scope as string)
      ) {
        errors.push(
          `authorized_agents[${index}].scope must be one of: full, partial, exclusive, non_exclusive`
        );
      }
      // Validate authorization_type if present
      if (a.authorization_type !== undefined) {
        if (!['property_ids', 'property_tags', 'inline', 'publisher'].includes(a.authorization_type as string)) {
          errors.push(
            `authorized_agents[${index}].authorization_type must be one of: property_ids, property_tags, inline, publisher`
          );
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
