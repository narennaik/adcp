/**
 * AdCP Media Buy Protocol Handler
 *
 * Implementation of the Media Buy Protocol tasks.
 */

import { v4 as uuid } from 'uuid';
import type {
  GetProductsRequest,
  GetProductsResponse,
  ListCreativeFormatsRequest,
  ListCreativeFormatsResponse,
  ListAuthorizedPropertiesRequest,
  ListAuthorizedPropertiesResponse,
  CreateMediaBuyRequest,
  CreateMediaBuyResponse,
  UpdateMediaBuyRequest,
  UpdateMediaBuyResponse,
  GetMediaBuyDeliveryRequest,
  GetMediaBuyDeliveryResponse,
  ListCreativesRequest,
  ListCreativesResponse,
  SyncCreativesRequest,
  SyncCreativesResponse,
  ProvidePerformanceFeedbackRequest,
  ProvidePerformanceFeedbackResponse,
  Product,
  CreatedPackage,
  UpdatedPackage,
  MediaBuyDelivery,
} from './types.js';
import type { TaskStatus, Principal, ErrorDetail } from '../../core/types.js';
import { AdcpError, createErrorDetail } from '../../core/errors.js';
import type { MediaBuyDatabase } from '../../database/media-buy.js';
import type { SyncCreativeResult } from '../../core/creative-manifest.js';

// ============================================================================
// Media Buy Protocol Handler
// ============================================================================

export interface MediaBuyHandlerConfig {
  database: MediaBuyDatabase;
  agentUrl: string;
  agentName: string;
  defaultCurrency?: string;
}

export class MediaBuyHandler {
  private db: MediaBuyDatabase;
  private agentUrl: string;
  private agentName: string;
  private defaultCurrency: string;

  constructor(config: MediaBuyHandlerConfig) {
    this.db = config.database;
    this.agentUrl = config.agentUrl;
    this.agentName = config.agentName;
    this.defaultCurrency = config.defaultCurrency || 'USD';
  }

  // ============================================================================
  // get_products
  // ============================================================================

  async getProducts(
    request: GetProductsRequest,
    principal?: Principal
  ): Promise<GetProductsResponse> {
    const contextId = request.context_id || `ctx-products-${uuid()}`;

    try {
      const products = await this.db.searchProducts({
        brief: request.brief,
        filters: request.filters,
        principalId: principal?.id,
      });

      return {
        message: this.generateGetProductsMessage(products, request),
        context_id: contextId,
        status: 'completed',
        products,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to search products: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // list_creative_formats
  // ============================================================================

  async listCreativeFormats(
    request: ListCreativeFormatsRequest,
    principal?: Principal
  ): Promise<ListCreativeFormatsResponse> {
    const contextId = request.context_id || `ctx-formats-${uuid()}`;

    try {
      const { formats, creativeAgents } = await this.db.getCreativeFormats({
        formatTypes: request.format_types,
        channels: request.channels,
        principalId: principal?.id,
      });

      return {
        message: `Found ${formats.length} creative format${formats.length !== 1 ? 's' : ''} available.`,
        context_id: contextId,
        status: 'completed',
        formats,
        creative_agents: creativeAgents,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to list formats: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // list_authorized_properties
  // ============================================================================

  async listAuthorizedProperties(
    request: ListAuthorizedPropertiesRequest,
    principal?: Principal
  ): Promise<ListAuthorizedPropertiesResponse> {
    const contextId = request.context_id || `ctx-properties-${uuid()}`;

    try {
      const result = await this.db.getAuthorizedProperties({
        publisherDomains: request.publisher_domains,
        principalId: principal?.id,
      });

      return {
        message: `Found ${result.publisherDomains.length} authorized publisher domain${result.publisherDomains.length !== 1 ? 's' : ''}.`,
        context_id: contextId,
        status: 'completed',
        publisher_domains: result.publisherDomains,
        primary_channels: result.primaryChannels,
        primary_countries: result.primaryCountries,
        portfolio_description: result.portfolioDescription,
        last_updated: result.lastUpdated,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to list properties: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // create_media_buy
  // ============================================================================

  async createMediaBuy(
    request: CreateMediaBuyRequest,
    principal?: Principal
  ): Promise<CreateMediaBuyResponse> {
    const contextId = request.context_id || `ctx-mediabuy-${uuid()}`;

    try {
      // Validate request
      this.validateCreateMediaBuyRequest(request);

      // Validate products exist and formats are compatible
      const errors: ErrorDetail[] = [];
      for (const pkg of request.packages) {
        const product = await this.db.getProduct(pkg.product_id);
        if (!product) {
          errors.push(
            createErrorDetail(
              'PRODUCT_NOT_FOUND',
              `Product '${pkg.product_id}' not found`,
              { field: `packages.${pkg.buyer_ref}.product_id` }
            )
          );
          continue;
        }

        // Validate pricing option
        const validPricing = product.pricing_options.some(
          (p) => p.pricing_option_id === pkg.pricing_option_id
        );
        if (!validPricing) {
          errors.push(
            createErrorDetail(
              'INVALID_PRICING_OPTION',
              `Pricing option '${pkg.pricing_option_id}' not available for product`,
              { field: `packages.${pkg.buyer_ref}.pricing_option_id` }
            )
          );
        }

        // Validate minimum budget
        if (product.min_budget && pkg.budget < product.min_budget) {
          errors.push(
            createErrorDetail(
              'BUDGET_INSUFFICIENT',
              `Budget ${pkg.budget} below minimum ${product.min_budget}`,
              { field: `packages.${pkg.buyer_ref}.budget` }
            )
          );
        }
      }

      if (errors.length > 0) {
        return {
          message: 'Media buy creation failed due to validation errors',
          context_id: contextId,
          status: 'failed',
          media_buy_id: '',
          buyer_ref: request.buyer_ref,
          packages: [],
          errors,
        };
      }

      // Create media buy
      const result = await this.db.createMediaBuy({
        buyerRef: request.buyer_ref,
        brandManifest: request.brand_manifest,
        startTime: request.start_time,
        endTime: request.end_time,
        packages: request.packages,
        reportingWebhook: request.reporting_webhook,
        principalId: principal?.id,
      });

      const status: TaskStatus = result.requiresApproval ? 'submitted' : 'completed';

      return {
        message: this.generateCreateMediaBuyMessage(result, status),
        context_id: contextId,
        status,
        task_id: result.requiresApproval ? result.taskId : undefined,
        media_buy_id: result.mediaBuyId,
        buyer_ref: request.buyer_ref,
        creative_deadline: result.creativeDeadline,
        packages: result.packages,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to create media buy: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // update_media_buy
  // ============================================================================

  async updateMediaBuy(
    request: UpdateMediaBuyRequest,
    principal?: Principal
  ): Promise<UpdateMediaBuyResponse> {
    const contextId = request.context_id || `ctx-update-${uuid()}`;

    try {
      // Validate at least one identifier provided
      if (!request.media_buy_id && !request.buyer_ref) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Either media_buy_id or buyer_ref is required'
        );
      }

      // Resolve media buy
      const mediaBuy = await this.db.getMediaBuy(
        request.media_buy_id,
        request.buyer_ref
      );
      if (!mediaBuy) {
        throw new AdcpError(
          'MEDIA_BUY_NOT_FOUND',
          `Media buy not found`,
          { field: request.media_buy_id ? 'media_buy_id' : 'buyer_ref' }
        );
      }

      // Apply updates
      const result = await this.db.updateMediaBuy({
        mediaBuyId: mediaBuy.media_buy_id,
        startTime: request.start_time,
        endTime: request.end_time,
        paused: request.paused,
        packages: request.packages,
        creatives: request.creatives,
        creativeAssignments: request.creative_assignments,
        principalId: principal?.id,
      });

      const status: TaskStatus = result.requiresApproval ? 'submitted' : 'completed';

      return {
        message: this.generateUpdateMediaBuyMessage(result, status),
        context_id: contextId,
        status,
        media_buy_id: mediaBuy.media_buy_id,
        buyer_ref: mediaBuy.buyer_ref,
        implementation_date: result.implementationDate,
        affected_packages: result.affectedPackages,
        errors: result.errors?.length ? result.errors : undefined,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to update media buy: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // get_media_buy_delivery
  // ============================================================================

  async getMediaBuyDelivery(
    request: GetMediaBuyDeliveryRequest,
    principal?: Principal
  ): Promise<GetMediaBuyDeliveryResponse> {
    const contextId = request.context_id || `ctx-delivery-${uuid()}`;

    try {
      // Validate at least one identifier or context
      if (!request.media_buy_ids?.length && !request.buyer_refs?.length) {
        // Check if we have session context with previous media buys
        // For now, require explicit IDs
        throw new AdcpError(
          'CONTEXT_REQUIRED',
          'Either media_buy_ids or buyer_refs is required'
        );
      }

      // Parse date range
      const now = new Date();
      const endDate = request.end_date || now.toISOString().split('T')[0];
      const startDate =
        request.start_date ||
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

      const result = await this.db.getMediaBuyDelivery({
        mediaBuyIds: request.media_buy_ids,
        buyerRefs: request.buyer_refs,
        statusFilter: request.status_filter,
        startDate,
        endDate,
        principalId: principal?.id,
      });

      return {
        message: this.generateDeliveryMessage(result.deliveries),
        context_id: contextId,
        status: 'completed',
        reporting_period: {
          start: startDate,
          end: endDate,
        },
        currency: result.currency,
        aggregated_totals: result.aggregatedTotals,
        media_buy_deliveries: result.deliveries,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to get delivery data: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // list_creatives
  // ============================================================================

  async listCreatives(
    request: ListCreativesRequest,
    principal?: Principal
  ): Promise<ListCreativesResponse> {
    const contextId = request.context_id || `ctx-creatives-${uuid()}`;

    try {
      const limit = request.pagination?.limit || 50;
      const offset = request.pagination?.offset || 0;

      const result = await this.db.listCreatives({
        filters: request.filters,
        sort: request.sort,
        limit,
        offset,
        includeAssignments: request.include_assignments,
        includePerformance: request.include_performance,
        principalId: principal?.id,
      });

      const totalPages = Math.ceil(result.totalMatching / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        message: `Found ${result.totalMatching} creative${result.totalMatching !== 1 ? 's' : ''}${result.creatives.length < result.totalMatching ? `, returning ${result.creatives.length}` : ''}.`,
        context_id: contextId,
        status: 'completed',
        query_summary: {
          total_matching: result.totalMatching,
          returned: result.creatives.length,
          filters_applied: result.filtersApplied || [],
        },
        pagination: {
          limit,
          offset,
          has_more: offset + result.creatives.length < result.totalMatching,
          total_pages: totalPages,
          current_page: currentPage,
        },
        creatives: result.creatives,
        format_summary: result.formatSummary,
        status_summary: result.statusSummary,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to list creatives: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // sync_creatives
  // ============================================================================

  async syncCreatives(
    request: SyncCreativesRequest,
    principal?: Principal
  ): Promise<SyncCreativesResponse> {
    const contextId = request.context_id || `ctx-sync-${uuid()}`;

    try {
      // Validate creatives
      if (!request.creatives?.length) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'At least one creative is required',
          { field: 'creatives' }
        );
      }

      if (request.creatives.length > 100) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Maximum 100 creatives per sync request',
          { field: 'creatives' }
        );
      }

      const results: SyncCreativeResult[] = [];
      const errors: ErrorDetail[] = [];

      for (const creative of request.creatives) {
        try {
          const result = await this.db.syncCreative({
            creative,
            assignments: request.assignments?.[creative.creative_id],
            dryRun: request.dry_run,
            validationMode: request.validation_mode,
            principalId: principal?.id,
          });
          results.push(result);
        } catch (error) {
          results.push({
            creative_id: creative.creative_id,
            action: 'failed',
            errors: [
              {
                code: error instanceof AdcpError ? error.code : 'SYNC_FAILED',
                message: error instanceof Error ? error.message : 'Sync failed',
              },
            ],
          });
        }
      }

      // Handle delete_missing
      if (request.delete_missing && !request.dry_run) {
        const deletedResults = await this.db.deleteUnlistedCreatives(
          request.creatives.map((c) => c.creative_id),
          principal?.id
        );
        results.push(...deletedResults);
      }

      const failedCount = results.filter((r) => r.action === 'failed').length;
      const status: TaskStatus = failedCount === results.length ? 'failed' : 'completed';

      return {
        message: this.generateSyncCreativesMessage(results, request.dry_run),
        context_id: contextId,
        status,
        creatives: results,
        dry_run: request.dry_run,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to sync creatives: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // provide_performance_feedback
  // ============================================================================

  async providePerformanceFeedback(
    request: ProvidePerformanceFeedbackRequest,
    principal?: Principal
  ): Promise<ProvidePerformanceFeedbackResponse> {
    const contextId = request.context_id || `ctx-feedback-${uuid()}`;

    try {
      // Validate request
      if (!request.media_buy_id) {
        throw new AdcpError('INVALID_REQUEST', 'media_buy_id is required', {
          field: 'media_buy_id',
        });
      }

      if (
        request.performance_index < 0 ||
        !Number.isFinite(request.performance_index)
      ) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'performance_index must be a non-negative number',
          { field: 'performance_index' }
        );
      }

      // Verify media buy exists
      const mediaBuy = await this.db.getMediaBuy(request.media_buy_id);
      if (!mediaBuy) {
        throw new AdcpError('MEDIA_BUY_NOT_FOUND', 'Media buy not found', {
          field: 'media_buy_id',
        });
      }

      // Store feedback
      await this.db.storePerformanceFeedback({
        mediaBuyId: request.media_buy_id,
        packageId: request.package_id,
        creativeId: request.creative_id,
        measurementPeriod: request.measurement_period,
        performanceIndex: request.performance_index,
        metricType: request.metric_type || 'overall_performance',
        feedbackSource: request.feedback_source || 'buyer_attribution',
        principalId: principal?.id,
      });

      return {
        message: `Performance feedback recorded for media buy '${request.media_buy_id}'.`,
        context_id: contextId,
        status: 'completed',
        success: true,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to record feedback: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateCreateMediaBuyRequest(request: CreateMediaBuyRequest): void {
    if (!request.buyer_ref) {
      throw new AdcpError('INVALID_REQUEST', 'buyer_ref is required', {
        field: 'buyer_ref',
      });
    }

    if (!request.brand_manifest) {
      throw new AdcpError('INVALID_REQUEST', 'brand_manifest is required', {
        field: 'brand_manifest',
      });
    }

    if (!request.start_time) {
      throw new AdcpError('INVALID_REQUEST', 'start_time is required', {
        field: 'start_time',
      });
    }

    if (!request.end_time) {
      throw new AdcpError('INVALID_REQUEST', 'end_time is required', {
        field: 'end_time',
      });
    }

    if (!request.packages?.length) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'At least one package is required',
        { field: 'packages' }
      );
    }

    for (const pkg of request.packages) {
      if (!pkg.buyer_ref) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Package buyer_ref is required',
          { field: 'packages.buyer_ref' }
        );
      }
      if (!pkg.product_id) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Package product_id is required',
          { field: `packages.${pkg.buyer_ref}.product_id` }
        );
      }
      if (!pkg.pricing_option_id) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Package pricing_option_id is required',
          { field: `packages.${pkg.buyer_ref}.pricing_option_id` }
        );
      }
      if (!pkg.format_ids?.length) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Package format_ids is required',
          { field: `packages.${pkg.buyer_ref}.format_ids` }
        );
      }
      if (typeof pkg.budget !== 'number' || pkg.budget <= 0) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Package budget must be a positive number',
          { field: `packages.${pkg.buyer_ref}.budget` }
        );
      }
    }
  }

  private generateGetProductsMessage(
    products: Product[],
    request: GetProductsRequest
  ): string {
    if (products.length === 0) {
      if (request.brief) {
        return `No products found matching "${request.brief}". Try broadening your search criteria.`;
      }
      return 'No products found matching your criteria.';
    }

    if (request.brief) {
      return `Found ${products.length} product${products.length > 1 ? 's' : ''} matching "${request.brief}".`;
    }

    return `Found ${products.length} available product${products.length > 1 ? 's' : ''}.`;
  }

  private generateCreateMediaBuyMessage(
    result: { packages: CreatedPackage[]; requiresApproval?: boolean },
    status: TaskStatus
  ): string {
    if (status === 'submitted') {
      return `Media buy submitted for approval. ${result.packages.length} package${result.packages.length > 1 ? 's' : ''} pending review.`;
    }
    return `Media buy created successfully with ${result.packages.length} package${result.packages.length > 1 ? 's' : ''}.`;
  }

  private generateUpdateMediaBuyMessage(
    result: { affectedPackages: UpdatedPackage[]; requiresApproval?: boolean },
    status: TaskStatus
  ): string {
    if (status === 'submitted') {
      return `Media buy update submitted for approval. ${result.affectedPackages.length} package${result.affectedPackages.length > 1 ? 's' : ''} affected.`;
    }
    return `Media buy updated successfully. ${result.affectedPackages.length} package${result.affectedPackages.length > 1 ? 's' : ''} modified.`;
  }

  private generateDeliveryMessage(deliveries: MediaBuyDelivery[]): string {
    if (deliveries.length === 0) {
      return 'No delivery data found for the specified criteria.';
    }

    const totalImpressions = deliveries.reduce(
      (sum, d) => sum + d.totals.impressions,
      0
    );
    const totalSpend = deliveries.reduce((sum, d) => sum + d.totals.spend, 0);

    return `Delivery report for ${deliveries.length} campaign${deliveries.length > 1 ? 's' : ''}: ${totalImpressions.toLocaleString()} impressions, $${totalSpend.toLocaleString()} spend.`;
  }

  private generateSyncCreativesMessage(
    results: SyncCreativeResult[],
    dryRun?: boolean
  ): string {
    const created = results.filter((r) => r.action === 'created').length;
    const updated = results.filter((r) => r.action === 'updated').length;
    const unchanged = results.filter((r) => r.action === 'unchanged').length;
    const failed = results.filter((r) => r.action === 'failed').length;
    const deleted = results.filter((r) => r.action === 'deleted').length;

    const parts: string[] = [];
    if (created > 0) parts.push(`${created} created`);
    if (updated > 0) parts.push(`${updated} updated`);
    if (unchanged > 0) parts.push(`${unchanged} unchanged`);
    if (deleted > 0) parts.push(`${deleted} deleted`);
    if (failed > 0) parts.push(`${failed} failed`);

    const prefix = dryRun ? '[DRY RUN] Would have: ' : 'Sync complete: ';
    return prefix + parts.join(', ') + '.';
  }
}
