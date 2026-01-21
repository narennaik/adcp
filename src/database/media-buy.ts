/**
 * Media Buy Database Interface & Mock Implementation
 *
 * Database abstraction for Media Buy Protocol operations.
 */

import { v4 as uuid } from 'uuid';
import type {
  FormatId,
  DeliveryStatus,
  DeliveryMetrics,
  ErrorDetail,
  Channel,
  FormatType,
  MeasurementPeriod,
  MetricType,
  FeedbackSource,
  CreativeAgentInfo,
} from '../core/types.js';
import type { BrandManifestRef } from '../core/brand-manifest.js';
import type {
  CreativeFormat,
  SyncCreative,
  SyncCreativeResult,
  CreativeAssignment,
} from '../core/creative-manifest.js';
import type {
  Product,
  ProductFilters,
  AuthorizedProperty,
  PackageConfig,
  CreatedPackage,
  UpdatedPackage,
  PackageUpdate,
  MediaBuyDelivery,
  AggregatedDeliveryMetrics,
  StoredCreative,
  DeliveryStatusFilter,
} from '../protocols/media-buy/types.js';
import type { ReportingWebhook } from '../core/types.js';

// ============================================================================
// Media Buy Database Interface
// ============================================================================

export interface MediaBuyDatabase {
  // Product Discovery
  searchProducts(params: SearchProductsParams): Promise<Product[]>;
  getProduct(productId: string): Promise<Product | null>;

  // Creative Formats
  getCreativeFormats(params: GetFormatsParams): Promise<{
    formats: CreativeFormat[];
    creativeAgents: CreativeAgentInfo[];
  }>;

  // Authorized Properties
  getAuthorizedProperties(
    params: GetPropertiesParams
  ): Promise<GetPropertiesResult>;

  // Media Buy CRUD
  createMediaBuy(params: CreateMediaBuyParams): Promise<CreateMediaBuyResult>;
  getMediaBuy(
    mediaBuyId?: string,
    buyerRef?: string
  ): Promise<MediaBuyRecord | null>;
  updateMediaBuy(params: UpdateMediaBuyParams): Promise<UpdateMediaBuyResult>;

  // Delivery Reporting
  getMediaBuyDelivery(
    params: GetDeliveryParams
  ): Promise<GetDeliveryResult>;

  // Creatives
  listCreatives(params: ListCreativesParams): Promise<ListCreativesResult>;
  syncCreative(params: SyncCreativeParams): Promise<SyncCreativeResult>;
  deleteUnlistedCreatives(
    listedIds: string[],
    principalId?: string
  ): Promise<SyncCreativeResult[]>;

  // Performance Feedback
  storePerformanceFeedback(params: StoreFeedbackParams): Promise<void>;
}

// ============================================================================
// Parameter Types
// ============================================================================

export interface SearchProductsParams {
  brief?: string;
  filters?: ProductFilters;
  principalId?: string;
}

export interface GetFormatsParams {
  formatTypes?: FormatType[];
  channels?: Channel[];
  principalId?: string;
}

export interface GetPropertiesParams {
  publisherDomains?: string[];
  principalId?: string;
}

export interface GetPropertiesResult {
  publisherDomains: string[];
  primaryChannels?: Channel[];
  primaryCountries?: string[];
  portfolioDescription?: string;
  lastUpdated?: string;
}

export interface CreateMediaBuyParams {
  buyerRef: string;
  brandManifest: BrandManifestRef;
  startTime: string;
  endTime: string;
  packages: PackageConfig[];
  reportingWebhook?: ReportingWebhook;
  principalId?: string;
}

export interface CreateMediaBuyResult {
  mediaBuyId: string;
  packages: CreatedPackage[];
  creativeDeadline?: string;
  requiresApproval?: boolean;
  taskId?: string;
}

export interface UpdateMediaBuyParams {
  mediaBuyId: string;
  startTime?: string;
  endTime?: string;
  paused?: boolean;
  packages?: PackageUpdate[];
  creatives?: SyncCreative[];
  creativeAssignments?: CreativeAssignment[];
  principalId?: string;
}

export interface UpdateMediaBuyResult {
  affectedPackages: UpdatedPackage[];
  implementationDate: string | null;
  requiresApproval?: boolean;
  errors?: ErrorDetail[];
}

export interface GetDeliveryParams {
  mediaBuyIds?: string[];
  buyerRefs?: string[];
  statusFilter?: DeliveryStatusFilter | DeliveryStatusFilter[];
  startDate: string;
  endDate: string;
  principalId?: string;
}

export interface GetDeliveryResult {
  currency: string;
  aggregatedTotals: AggregatedDeliveryMetrics;
  deliveries: MediaBuyDelivery[];
}

export interface ListCreativesParams {
  filters?: {
    format_ids?: FormatId[];
    status?: string | string[];
    tags?: string[];
    tags_match?: 'all' | 'any';
    name_contains?: string;
    creative_ids?: string[];
    created_after?: string;
    created_before?: string;
    updated_after?: string;
    updated_before?: string;
    assigned_to_package?: string;
    assigned_to_packages?: string[];
    media_buy_ids?: string[];
    buyer_refs?: string[];
    unassigned?: boolean;
    has_performance_data?: boolean;
  };
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  offset?: number;
  includeAssignments?: boolean;
  includePerformance?: boolean;
  principalId?: string;
}

export interface ListCreativesResult {
  totalMatching: number;
  creatives: StoredCreative[];
  filtersApplied?: string[];
  formatSummary?: Record<string, number>;
  statusSummary?: Record<string, number>;
}

export interface SyncCreativeParams {
  creative: SyncCreative;
  assignments?: string[];
  dryRun?: boolean;
  validationMode?: 'strict' | 'lenient';
  principalId?: string;
}

export interface StoreFeedbackParams {
  mediaBuyId: string;
  packageId?: string;
  creativeId?: string;
  measurementPeriod: MeasurementPeriod;
  performanceIndex: number;
  metricType: MetricType;
  feedbackSource: FeedbackSource;
  principalId?: string;
}

export interface MediaBuyRecord {
  media_buy_id: string;
  buyer_ref: string;
  brand_manifest: BrandManifestRef;
  start_time: string;
  end_time: string;
  status: DeliveryStatus;
  packages: CreatedPackage[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Mock Media Buy Database
// ============================================================================

export class MockMediaBuyDatabase implements MediaBuyDatabase {
  private products: Map<string, Product> = new Map();
  private formats: CreativeFormat[] = [];
  private properties: AuthorizedProperty[] = [];
  private mediaBuys: Map<string, MediaBuyRecord> = new Map();
  private creatives: Map<string, StoredCreative> = new Map();

  constructor() {
    this.initializeMockData();
  }

  async searchProducts(params: SearchProductsParams): Promise<Product[]> {
    let results = Array.from(this.products.values());

    // Filter by brief (simple keyword match)
    if (params.brief) {
      const briefLower = params.brief.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(briefLower) ||
          p.description.toLowerCase().includes(briefLower)
      );
    }

    // Apply filters
    if (params.filters) {
      const f = params.filters;

      if (f.delivery_type) {
        results = results.filter((p) => p.delivery_type === f.delivery_type);
      }

      if (f.channels?.length) {
        results = results.filter((p) =>
          p.publisher_properties.some((prop) =>
            prop.channels?.some((c) => f.channels!.includes(c))
          )
        );
      }

      if (f.budget_range) {
        if (f.budget_range.min !== undefined) {
          results = results.filter(
            (p) => !p.min_budget || p.min_budget <= f.budget_range!.max!
          );
        }
      }

      if (f.countries?.length) {
        results = results.filter(
          (p) =>
            !p.countries ||
            p.countries.some((c) => f.countries!.includes(c))
        );
      }
    }

    return results;
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.products.get(productId) || null;
  }

  async getCreativeFormats(params: GetFormatsParams): Promise<{
    formats: CreativeFormat[];
    creativeAgents: CreativeAgentInfo[];
  }> {
    let formats = [...this.formats];

    if (params.formatTypes?.length) {
      formats = formats.filter((f) =>
        params.formatTypes!.includes(f.type as FormatType)
      );
    }

    if (params.channels?.length) {
      formats = formats.filter(
        (f) => f.channel && params.channels!.includes(f.channel as Channel)
      );
    }

    return {
      formats,
      creativeAgents: [
        {
          agent_url: 'https://creative.adcontextprotocol.org',
          agent_name: 'AdCP Reference Creative Agent',
          capabilities: ['validation', 'assembly', 'preview', 'generation'],
        },
      ],
    };
  }

  async getAuthorizedProperties(
    params: GetPropertiesParams
  ): Promise<GetPropertiesResult> {
    let properties = [...this.properties];

    if (params.publisherDomains?.length) {
      properties = properties.filter((p) =>
        p.domain && params.publisherDomains!.includes(p.domain)
      );
    }

    // Extract unique domains
    const publisherDomains = [...new Set(
      properties
        .filter((p) => p.domain)
        .map((p) => p.domain!)
    )];

    // Extract unique channels
    const allChannels = properties.flatMap((p) => p.channels || []);
    const primaryChannels = [...new Set(allChannels)] as Channel[];

    // Extract unique countries (mock - in real implementation would come from property data)
    const primaryCountries = ['US', 'CA', 'GB'];

    return {
      publisherDomains,
      primaryChannels: primaryChannels.length > 0 ? primaryChannels : undefined,
      primaryCountries,
      portfolioDescription: `Access to ${publisherDomains.length} premium publisher properties across ${primaryChannels.length} channels.`,
      lastUpdated: new Date().toISOString(),
    };
  }

  async createMediaBuy(
    params: CreateMediaBuyParams
  ): Promise<CreateMediaBuyResult> {
    const mediaBuyId = `mb-${uuid()}`;
    const now = new Date().toISOString();

    const packages: CreatedPackage[] = params.packages.map((pkg) => ({
      package_id: `pkg-${uuid()}`,
      buyer_ref: pkg.buyer_ref,
      product_id: pkg.product_id,
      pricing_option_id: pkg.pricing_option_id,
      budget: pkg.budget,
      currency: pkg.currency || 'USD',
      status: 'pending',
    }));

    const record: MediaBuyRecord = {
      media_buy_id: mediaBuyId,
      buyer_ref: params.buyerRef,
      brand_manifest: params.brandManifest,
      start_time: params.startTime === 'asap' ? now : params.startTime,
      end_time: params.endTime,
      status: 'pending',
      packages,
      created_at: now,
      updated_at: now,
    };

    this.mediaBuys.set(mediaBuyId, record);

    // Calculate creative deadline (7 days before start)
    const startDate = new Date(record.start_time);
    const deadline = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      mediaBuyId,
      packages,
      creativeDeadline: deadline.toISOString(),
    };
  }

  async getMediaBuy(
    mediaBuyId?: string,
    buyerRef?: string
  ): Promise<MediaBuyRecord | null> {
    if (mediaBuyId) {
      return this.mediaBuys.get(mediaBuyId) || null;
    }

    if (buyerRef) {
      for (const record of this.mediaBuys.values()) {
        if (record.buyer_ref === buyerRef) {
          return record;
        }
      }
    }

    return null;
  }

  async updateMediaBuy(
    params: UpdateMediaBuyParams
  ): Promise<UpdateMediaBuyResult> {
    const record = await this.getMediaBuy(params.mediaBuyId);
    if (!record) {
      throw new Error('Media buy not found');
    }

    const now = new Date().toISOString();
    const affectedPackages: UpdatedPackage[] = [];

    // Update media buy fields
    if (params.startTime) record.start_time = params.startTime;
    if (params.endTime) record.end_time = params.endTime;
    if (params.paused !== undefined) {
      record.status = params.paused ? 'paused' : 'delivering';
    }

    // Update packages
    if (params.packages) {
      for (const update of params.packages) {
        const pkg = record.packages.find(
          (p) =>
            p.package_id === update.package_id ||
            p.buyer_ref === update.buyer_ref
        );
        if (pkg) {
          const changes: string[] = [];
          if (update.paused !== undefined) {
            pkg.status = update.paused ? 'paused' : 'active';
            changes.push('status');
          }
          if (update.budget !== undefined) {
            pkg.budget = update.budget;
            changes.push('budget');
          }
          affectedPackages.push({
            package_id: pkg.package_id,
            buyer_ref: pkg.buyer_ref,
            status: pkg.status,
            changes,
          });
        }
      }
    }

    record.updated_at = now;

    return {
      affectedPackages,
      implementationDate: now,
    };
  }

  async getMediaBuyDelivery(
    params: GetDeliveryParams
  ): Promise<GetDeliveryResult> {
    const deliveries: MediaBuyDelivery[] = [];

    // Get relevant media buys
    const mediaBuys: MediaBuyRecord[] = [];

    if (params.mediaBuyIds?.length) {
      for (const id of params.mediaBuyIds) {
        const mb = this.mediaBuys.get(id);
        if (mb) mediaBuys.push(mb);
      }
    } else if (params.buyerRefs?.length) {
      for (const record of this.mediaBuys.values()) {
        if (params.buyerRefs.includes(record.buyer_ref)) {
          mediaBuys.push(record);
        }
      }
    }

    // Generate mock delivery data
    let totalImpressions = 0;
    let totalSpend = 0;
    let totalClicks = 0;

    for (const mb of mediaBuys) {
      const impressions = Math.floor(Math.random() * 1000000) + 10000;
      const spend = Math.floor(Math.random() * 10000) + 100;
      const clicks = Math.floor(impressions * (Math.random() * 0.02));

      totalImpressions += impressions;
      totalSpend += spend;
      totalClicks += clicks;

      deliveries.push({
        media_buy_id: mb.media_buy_id,
        buyer_ref: mb.buyer_ref,
        status: mb.status,
        start_time: mb.start_time,
        end_time: mb.end_time,
        totals: {
          impressions,
          spend,
          clicks,
          ctr: clicks / impressions,
        },
        by_package: mb.packages.map((pkg) => ({
          package_id: pkg.package_id,
          buyer_ref: pkg.buyer_ref,
          status: pkg.status === 'active' ? 'delivering' : (pkg.status as DeliveryStatus),
          paused: pkg.status === 'paused',
          pacing_index: Math.random() * 0.4 + 0.8, // 0.8 - 1.2
          totals: {
            impressions: Math.floor(impressions / mb.packages.length),
            spend: Math.floor(spend / mb.packages.length),
          },
        })),
      });
    }

    return {
      currency: 'USD',
      aggregatedTotals: {
        impressions: totalImpressions,
        spend: totalSpend,
        clicks: totalClicks,
        ctr: totalClicks / totalImpressions,
        media_buy_count: deliveries.length,
      },
      deliveries,
    };
  }

  async listCreatives(params: ListCreativesParams): Promise<ListCreativesResult> {
    let results = Array.from(this.creatives.values());
    const filtersApplied: string[] = [];

    // Apply filters
    if (params.filters) {
      const f = params.filters;

      if (f.creative_ids?.length) {
        results = results.filter((c) => f.creative_ids!.includes(c.creative_id));
        filtersApplied.push('creative_ids');
      }

      if (f.tags?.length) {
        if (f.tags_match === 'all') {
          results = results.filter((c) =>
            f.tags!.every((t) => c.tags?.includes(t))
          );
        } else {
          results = results.filter((c) =>
            c.tags?.some((t) => f.tags!.includes(t))
          );
        }
        filtersApplied.push('tags');
      }

      if (f.status) {
        const statuses = Array.isArray(f.status) ? f.status : [f.status];
        results = results.filter((c) => statuses.includes(c.approval_status));
        filtersApplied.push('status');
      }

      if (f.name_contains) {
        const search = f.name_contains.toLowerCase();
        results = results.filter((c) =>
          c.name?.toLowerCase().includes(search)
        );
        filtersApplied.push('name_contains');
      }

      if (f.created_after) {
        results = results.filter((c) => c.created_at >= f.created_after!);
        filtersApplied.push('created_after');
      }

      if (f.created_before) {
        results = results.filter((c) => c.created_at <= f.created_before!);
        filtersApplied.push('created_before');
      }

      if (f.assigned_to_package) {
        results = results.filter((c) =>
          c.assigned_packages.includes(f.assigned_to_package!)
        );
        filtersApplied.push('assigned_to_package');
      }

      if (f.assigned_to_packages?.length) {
        results = results.filter((c) =>
          c.assigned_packages.some((p) => f.assigned_to_packages!.includes(p))
        );
        filtersApplied.push('assigned_to_packages');
      }

      if (f.unassigned) {
        results = results.filter((c) => c.assigned_packages.length === 0);
        filtersApplied.push('unassigned');
      }
    }

    // Calculate total before pagination
    const totalMatching = results.length;

    // Calculate summaries
    const formatSummary: Record<string, number> = {};
    const statusSummary: Record<string, number> = {};
    for (const creative of results) {
      // Format summary
      const formatKey = creative.format_id?.id || 'unknown';
      formatSummary[formatKey] = (formatSummary[formatKey] || 0) + 1;

      // Status summary
      statusSummary[creative.approval_status] =
        (statusSummary[creative.approval_status] || 0) + 1;
    }

    // Apply sorting
    if (params.sort) {
      const { field, direction } = params.sort;
      results.sort((a, b) => {
        let aVal: string | number | undefined;
        let bVal: string | number | undefined;

        switch (field) {
          case 'created_date':
            aVal = a.created_at;
            bVal = b.created_at;
            break;
          case 'updated_date':
            aVal = a.updated_at;
            bVal = b.updated_at;
            break;
          case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
          case 'status':
            aVal = a.approval_status;
            bVal = b.approval_status;
            break;
          case 'assignment_count':
            aVal = a.assigned_packages.length;
            bVal = b.assigned_packages.length;
            break;
          default:
            return 0;
        }

        if (aVal === undefined || bVal === undefined) return 0;
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    results = results.slice(offset, offset + limit);

    return {
      totalMatching,
      creatives: results,
      filtersApplied: filtersApplied.length > 0 ? filtersApplied : undefined,
      formatSummary: Object.keys(formatSummary).length > 0 ? formatSummary : undefined,
      statusSummary: Object.keys(statusSummary).length > 0 ? statusSummary : undefined,
    };
  }

  async syncCreative(params: SyncCreativeParams): Promise<SyncCreativeResult> {
    const existing = this.creatives.get(params.creative.creative_id);
    const now = new Date().toISOString();

    if (params.dryRun) {
      return {
        creative_id: params.creative.creative_id,
        action: existing ? 'updated' : 'created',
      };
    }

    const stored: StoredCreative = {
      ...params.creative,
      platform_id: existing?.platform_id || `plat-${uuid()}`,
      created_at: existing?.created_at || now,
      updated_at: now,
      approval_status: 'pending',
      assigned_packages: params.assignments || existing?.assigned_packages || [],
    };

    this.creatives.set(params.creative.creative_id, stored);

    return {
      creative_id: params.creative.creative_id,
      platform_id: stored.platform_id,
      action: existing ? 'updated' : 'created',
    };
  }

  async deleteUnlistedCreatives(
    listedIds: string[],
    principalId?: string
  ): Promise<SyncCreativeResult[]> {
    const results: SyncCreativeResult[] = [];

    for (const [id, creative] of this.creatives) {
      if (!listedIds.includes(id)) {
        this.creatives.delete(id);
        results.push({
          creative_id: id,
          platform_id: creative.platform_id,
          action: 'deleted',
        });
      }
    }

    return results;
  }

  async storePerformanceFeedback(params: StoreFeedbackParams): Promise<void> {
    // In a real implementation, this would store the feedback
    console.log('[MockDB] Performance feedback stored:', params);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeMockData(): void {
    // Initialize mock products
    const mockProducts: Product[] = [
      {
        product_id: 'premium-video-sports',
        name: 'Premium Video - Sports',
        description: 'High-quality video inventory across premium sports properties',
        publisher_properties: [
          {
            property_id: 'espn-main',
            name: 'ESPN',
            domain: 'espn.com',
            channels: ['video', 'ctv'],
          },
        ],
        format_ids: [
          { agent_url: 'https://creative.adcontextprotocol.org', id: 'video_15s' },
          { agent_url: 'https://creative.adcontextprotocol.org', id: 'video_30s' },
        ],
        delivery_type: 'guaranteed',
        delivery_measurement: { type: 'completed_views' },
        pricing_options: [
          {
            pricing_option_id: 'cpcv-standard',
            model: 'cpcv',
            price: 0.02,
            currency: 'USD',
            minimum_spend: 10000,
          },
        ],
        min_budget: 10000,
        currency: 'USD',
        countries: ['US'],
      },
      {
        product_id: 'display-ros',
        name: 'Display Run of Site',
        description: 'Standard display inventory across network properties',
        publisher_properties: [
          {
            property_id: 'network-display',
            name: 'Network Display',
            channels: ['display'],
          },
        ],
        format_ids: [
          { agent_url: 'https://creative.adcontextprotocol.org', id: 'display_300x250' },
          { agent_url: 'https://creative.adcontextprotocol.org', id: 'display_728x90' },
        ],
        delivery_type: 'non_guaranteed',
        delivery_measurement: { type: 'impressions' },
        pricing_options: [
          {
            pricing_option_id: 'cpm-standard',
            model: 'cpm',
            price: 5.0,
            currency: 'USD',
          },
        ],
        min_budget: 1000,
        currency: 'USD',
        countries: ['US', 'CA', 'GB'],
      },
      {
        product_id: 'native-premium',
        name: 'Premium Native',
        description: 'Native advertising on premium editorial content',
        publisher_properties: [
          {
            property_id: 'news-native',
            name: 'News Network',
            channels: ['native'],
          },
        ],
        format_ids: [
          { agent_url: 'https://creative.adcontextprotocol.org', id: 'native_responsive' },
        ],
        delivery_type: 'non_guaranteed',
        delivery_measurement: { type: 'impressions' },
        pricing_options: [
          {
            pricing_option_id: 'cpm-native',
            model: 'cpm',
            price: 8.0,
            currency: 'USD',
          },
        ],
        min_budget: 5000,
        currency: 'USD',
        countries: ['US'],
      },
    ];

    for (const product of mockProducts) {
      this.products.set(product.product_id, product);
    }

    // Initialize mock formats
    this.formats = [
      {
        format_id: { agent_url: 'https://creative.adcontextprotocol.org', id: 'display_300x250' },
        name: 'Display 300x250',
        type: 'display',
        channel: 'display',
      },
      {
        format_id: { agent_url: 'https://creative.adcontextprotocol.org', id: 'display_728x90' },
        name: 'Display 728x90',
        type: 'display',
        channel: 'display',
      },
      {
        format_id: { agent_url: 'https://creative.adcontextprotocol.org', id: 'video_15s' },
        name: 'Video 15s',
        type: 'video',
        channel: 'video',
      },
      {
        format_id: { agent_url: 'https://creative.adcontextprotocol.org', id: 'video_30s' },
        name: 'Video 30s',
        type: 'video',
        channel: 'video',
      },
      {
        format_id: { agent_url: 'https://creative.adcontextprotocol.org', id: 'native_responsive' },
        name: 'Native Responsive',
        type: 'native',
        channel: 'native',
      },
    ];

    // Initialize mock properties
    this.properties = [
      {
        property_id: 'espn-main',
        name: 'ESPN',
        domain: 'espn.com',
        property_tags: ['sports', 'premium'],
        channels: ['video', 'display', 'ctv'],
        authorization_source: 'adagents_json',
      },
      {
        property_id: 'cnn-main',
        name: 'CNN',
        domain: 'cnn.com',
        property_tags: ['news', 'premium'],
        channels: ['video', 'display', 'native'],
        authorization_source: 'adagents_json',
      },
    ];
  }
}
