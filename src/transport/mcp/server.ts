/**
 * MCP Transport Server
 *
 * MCP server implementation for AdCP protocols.
 */

import { v4 as uuid } from 'uuid';
import type {
  McpRequest,
  McpResponse,
  McpError,
  McpToolCall,
  McpToolResult,
  McpToolDefinition,
  McpServerInfo,
  McpTaskStatusRequest,
  McpTaskStatusResponse,
  McpSession,
  McpWebhookConfig,
  McpWebhookPayload,
  AdcpDomain,
} from './types.js';
import { MCP_ERROR_CODES } from './types.js';
import type { TaskStatus, Principal } from '../../core/types.js';
import { AdcpError } from '../../core/errors.js';
import type { SignalsHandler } from '../../protocols/signals/handler.js';
import type { MediaBuyHandler } from '../../protocols/media-buy/handler.js';
import type { CreativeHandler } from '../../protocols/creative/handler.js';

// ============================================================================
// MCP Server Configuration
// ============================================================================

export interface McpServerConfig {
  /** Server name */
  name: string;

  /** Server version */
  version: string;

  /** Agent URL */
  agentUrl: string;

  /** Protocol handlers */
  handlers: {
    signals?: SignalsHandler;
    mediaBuy?: MediaBuyHandler;
    creative?: CreativeHandler;
  };

  /** Session timeout in minutes */
  sessionTimeoutMinutes?: number;

  /** Webhook configuration */
  webhookConfig?: McpWebhookConfig;
}

// ============================================================================
// MCP Server
// ============================================================================

export class McpServer {
  private config: McpServerConfig;
  private sessions: Map<string, McpSession> = new Map();
  private tasks: Map<string, AsyncTask> = new Map();
  private toolDefinitions: McpToolDefinition[] = [];

  constructor(config: McpServerConfig) {
    this.config = config;
    this.initializeToolDefinitions();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get server information
   */
  getServerInfo(): McpServerInfo {
    const domains: AdcpDomain[] = [];
    if (this.config.handlers.signals) domains.push('signals');
    if (this.config.handlers.mediaBuy) domains.push('media_buy');
    if (this.config.handlers.creative) domains.push('creative');

    return {
      name: this.config.name,
      version: this.config.version,
      description: 'AdCP MCP Server',
      adcp: {
        protocol_version: '2.6',
        supported_domains: domains,
        agent_url: this.config.agentUrl,
      },
    };
  }

  /**
   * List available tools
   */
  listTools(): McpToolDefinition[] {
    return this.toolDefinitions;
  }

  /**
   * Handle JSON-RPC request
   */
  async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.createResponse(request.id, this.getServerInfo());

        case 'tools/list':
          return this.createResponse(request.id, { tools: this.listTools() });

        case 'tools/call':
          return await this.handleToolCall(request);

        case 'tasks/get':
          return await this.handleGetTask(request);

        case 'tasks/cancel':
          return await this.handleCancelTask(request);

        default:
          return this.createErrorResponse(
            request.id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Unknown method: ${request.method}`
          );
      }
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  /**
   * Execute a tool call directly (for programmatic use)
   */
  async callTool(
    toolCall: McpToolCall,
    principal?: Principal
  ): Promise<McpToolResult> {
    const tool = toolCall.tool;
    const args = toolCall.arguments;
    const contextId = (args.context_id as string) || `ctx-${uuid()}`;

    try {
      const result = await this.executeTask(tool, args, principal);
      return {
        status: result.status,
        message: result.message,
        context_id: contextId,
        task_id: result.task_id,
        ...result.data,
      };
    } catch (error) {
      if (error instanceof AdcpError) {
        return {
          status: 'failed',
          message: error.message,
          context_id: contextId,
          errors: [error.toErrorDetail()],
        };
      }
      throw error;
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<McpTaskStatusResponse> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        task_id: taskId,
        status: 'failed',
        message: 'Task not found',
        error: {
          code: 'TASK_NOT_FOUND',
          message: `Task '${taskId}' not found`,
        },
      };
    }

    return {
      task_id: taskId,
      status: task.status,
      message: task.message,
      progress: task.progress,
      result: task.status === 'completed' ? task.result : undefined,
      error: task.status === 'failed' ? task.error : undefined,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async handleToolCall(request: McpRequest): Promise<McpResponse> {
    const params = request.params as { name: string; arguments?: Record<string, unknown> };

    if (!params?.name) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        'Tool name is required'
      );
    }

    const toolCall: McpToolCall = {
      tool: params.name,
      arguments: params.arguments || {},
    };

    try {
      const result = await this.callTool(toolCall);
      return this.createResponse(request.id, result);
    } catch (error) {
      if (error instanceof AdcpError) {
        return this.createErrorResponse(
          request.id,
          MCP_ERROR_CODES.ADCP_TASK_ERROR,
          error.message,
          { code: error.code, details: error.details }
        );
      }
      throw error;
    }
  }

  private async handleGetTask(request: McpRequest): Promise<McpResponse> {
    const params = request.params as McpTaskStatusRequest | undefined;

    if (!params?.task_id) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        'task_id is required'
      );
    }

    const status = await this.getTaskStatus(params.task_id);
    return this.createResponse(request.id, status);
  }

  private async handleCancelTask(request: McpRequest): Promise<McpResponse> {
    const params = request.params as { task_id: string };

    if (!params?.task_id) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        'task_id is required'
      );
    }

    const task = this.tasks.get(params.task_id);
    if (!task) {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.ADCP_TASK_ERROR,
        'Task not found'
      );
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return this.createErrorResponse(
        request.id,
        MCP_ERROR_CODES.ADCP_TASK_ERROR,
        'Cannot cancel completed or failed task'
      );
    }

    task.status = 'failed';
    task.message = 'Task cancelled';
    task.error = { code: 'CANCELLED', message: 'Task was cancelled by user' };

    return this.createResponse(request.id, { success: true });
  }

  private async executeTask(
    tool: string,
    args: Record<string, unknown>,
    principal?: Principal
  ): Promise<{ status: TaskStatus; message: string; task_id?: string; data: Record<string, unknown> }> {
    // Route to appropriate handler
    switch (tool) {
      // Signals Protocol
      case 'get_signals':
        if (!this.config.handlers.signals) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Signals protocol not enabled');
        }
        const signalsResult = await this.config.handlers.signals.getSignals(
          args as any,
          principal
        );
        return {
          status: signalsResult.status || 'completed',
          message: signalsResult.message,
          data: { signals: signalsResult.signals },
        };

      case 'activate_signal':
        if (!this.config.handlers.signals) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Signals protocol not enabled');
        }
        const activateResult = await this.config.handlers.signals.activateSignal(
          args as any,
          principal
        );
        return {
          status: activateResult.status || 'completed',
          message: activateResult.message,
          data: {
            deployments: activateResult.deployments,
            errors: activateResult.errors,
          },
        };

      // Media Buy Protocol
      case 'get_products':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const productsResult = await this.config.handlers.mediaBuy.getProducts(
          args as any,
          principal
        );
        return {
          status: productsResult.status || 'completed',
          message: productsResult.message,
          data: { products: productsResult.products },
        };

      case 'list_creative_formats':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const formatsResult = await this.config.handlers.mediaBuy.listCreativeFormats(
          args as any,
          principal
        );
        return {
          status: formatsResult.status || 'completed',
          message: formatsResult.message,
          data: {
            formats: formatsResult.formats,
            creative_agents: formatsResult.creative_agents,
          },
        };

      case 'list_authorized_properties':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const propertiesResult = await this.config.handlers.mediaBuy.listAuthorizedProperties(
          args as any,
          principal
        );
        return {
          status: propertiesResult.status || 'completed',
          message: propertiesResult.message,
          data: {
            publisher_domains: propertiesResult.publisher_domains,
            primary_channels: propertiesResult.primary_channels,
            primary_countries: propertiesResult.primary_countries,
            portfolio_description: propertiesResult.portfolio_description,
            last_updated: propertiesResult.last_updated,
          },
        };

      case 'create_media_buy':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const createResult = await this.config.handlers.mediaBuy.createMediaBuy(
          args as any,
          principal
        );
        return {
          status: createResult.status || 'completed',
          message: createResult.message,
          task_id: createResult.task_id,
          data: {
            media_buy_id: createResult.media_buy_id,
            buyer_ref: createResult.buyer_ref,
            creative_deadline: createResult.creative_deadline,
            packages: createResult.packages,
            errors: createResult.errors,
          },
        };

      case 'update_media_buy':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const updateResult = await this.config.handlers.mediaBuy.updateMediaBuy(
          args as any,
          principal
        );
        return {
          status: updateResult.status || 'completed',
          message: updateResult.message,
          data: {
            media_buy_id: updateResult.media_buy_id,
            buyer_ref: updateResult.buyer_ref,
            implementation_date: updateResult.implementation_date,
            affected_packages: updateResult.affected_packages,
            errors: updateResult.errors,
          },
        };

      case 'get_media_buy_delivery':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const deliveryResult = await this.config.handlers.mediaBuy.getMediaBuyDelivery(
          args as any,
          principal
        );
        return {
          status: deliveryResult.status || 'completed',
          message: deliveryResult.message,
          data: {
            reporting_period: deliveryResult.reporting_period,
            currency: deliveryResult.currency,
            aggregated_totals: deliveryResult.aggregated_totals,
            media_buy_deliveries: deliveryResult.media_buy_deliveries,
          },
        };

      case 'list_creatives':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const listCreativesResult = await this.config.handlers.mediaBuy.listCreatives(
          args as any,
          principal
        );
        return {
          status: listCreativesResult.status || 'completed',
          message: listCreativesResult.message,
          data: { creatives: listCreativesResult.creatives },
        };

      case 'sync_creatives':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const syncResult = await this.config.handlers.mediaBuy.syncCreatives(
          args as any,
          principal
        );
        return {
          status: syncResult.status || 'completed',
          message: syncResult.message,
          data: {
            creatives: syncResult.creatives,
            dry_run: syncResult.dry_run,
            errors: syncResult.errors,
            warnings: syncResult.warnings,
          },
        };

      case 'provide_performance_feedback':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const feedbackResult = await this.config.handlers.mediaBuy.providePerformanceFeedback(
          args as any,
          principal
        );
        return {
          status: feedbackResult.status || 'completed',
          message: feedbackResult.message,
          data: { success: feedbackResult.success },
        };

      // Creative Protocol
      case 'build_creative':
        if (!this.config.handlers.creative) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Creative protocol not enabled');
        }
        const buildResult = await this.config.handlers.creative.buildCreative(
          args as any,
          principal
        );
        return {
          status: buildResult.status || 'completed',
          message: buildResult.message,
          data: {
            creative_manifest: buildResult.creative_manifest,
            warnings: buildResult.warnings,
          },
        };

      case 'preview_creative':
        if (!this.config.handlers.creative) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Creative protocol not enabled');
        }
        const previewResult = await this.config.handlers.creative.previewCreative(
          args as any,
          principal
        );
        return {
          status: previewResult.status || 'completed',
          message: previewResult.message,
          data: {
            response_type: previewResult.response_type,
            previews: previewResult.previews,
            results: previewResult.results,
            expires_at: previewResult.expires_at,
          },
        };

      case 'validate_creative':
        if (!this.config.handlers.creative) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Creative protocol not enabled');
        }
        const validateResult = await this.config.handlers.creative.validateCreative(
          args as any,
          principal
        );
        return {
          status: validateResult.status || 'completed',
          message: validateResult.message,
          data: {
            valid: validateResult.valid,
            errors: validateResult.errors,
            warnings: validateResult.warnings,
          },
        };

      default:
        throw new AdcpError('NOT_IMPLEMENTED', `Unknown tool: ${tool}`);
    }
  }

  private createResponse(id: string | number, result: unknown): McpResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: unknown
  ): McpResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
  }

  private initializeToolDefinitions(): void {
    // Signals Protocol Tools
    if (this.config.handlers.signals) {
      this.toolDefinitions.push(
        {
          name: 'get_signals',
          description: 'Discover signals based on natural language descriptions',
          domain: 'signals',
          inputSchema: {
            type: 'object',
            properties: {
              signal_spec: {
                type: 'string',
                description: 'Natural language description of desired signals',
              },
              deliver_to: {
                type: 'object',
                description: 'Deployment targets',
                properties: {
                  deployments: { type: 'array', description: 'List of deployment targets' },
                  countries: { type: 'array', description: 'ISO country codes', items: { type: 'string' } },
                },
                required: ['deployments', 'countries'],
              },
              filters: { type: 'object', description: 'Optional filters' },
              max_results: { type: 'number', description: 'Maximum results' },
            },
            required: ['signal_spec', 'deliver_to'],
          },
        },
        {
          name: 'activate_signal',
          description: 'Deploy a signal to specific platforms or sales agents',
          domain: 'signals',
          inputSchema: {
            type: 'object',
            properties: {
              signal_agent_segment_id: { type: 'string', description: 'Signal identifier' },
              deployments: { type: 'array', description: 'Target deployments' },
            },
            required: ['signal_agent_segment_id', 'deployments'],
          },
        }
      );
    }

    // Media Buy Protocol Tools
    if (this.config.handlers.mediaBuy) {
      this.toolDefinitions.push(
        {
          name: 'get_products',
          description: 'Discover advertising inventory based on campaign requirements',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              brief: { type: 'string', description: 'Natural language campaign description' },
              brand_manifest: { type: 'object', description: 'Brand information' },
              filters: { type: 'object', description: 'Structured filters' },
            },
          },
        },
        {
          name: 'list_creative_formats',
          description: 'Discover creative formats supported by the sales agent',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              format_types: { type: 'array', items: { type: 'string' } },
              channels: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        {
          name: 'list_authorized_properties',
          description: 'Get all properties the sales agent is authorized to represent',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              property_tags: { type: 'array', items: { type: 'string' } },
              channels: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        {
          name: 'create_media_buy',
          description: 'Create advertising campaigns from selected packages',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              buyer_ref: { type: 'string', description: 'Your tracking identifier' },
              brand_manifest: { type: 'object', description: 'Brand information' },
              start_time: { type: 'string', description: 'Campaign start' },
              end_time: { type: 'string', description: 'Campaign end' },
              packages: { type: 'array', description: 'Package configurations' },
            },
            required: ['buyer_ref', 'brand_manifest', 'start_time', 'end_time', 'packages'],
          },
        },
        {
          name: 'update_media_buy',
          description: 'Modify existing media buys using PATCH semantics',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              media_buy_id: { type: 'string' },
              buyer_ref: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: 'string' },
              paused: { type: 'boolean' },
              packages: { type: 'array' },
            },
          },
        },
        {
          name: 'get_media_buy_delivery',
          description: 'Retrieve delivery metrics and performance data',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              media_buy_ids: { type: 'array', items: { type: 'string' } },
              buyer_refs: { type: 'array', items: { type: 'string' } },
              status_filter: { type: 'string' },
              start_date: { type: 'string' },
              end_date: { type: 'string' },
            },
          },
        },
        {
          name: 'list_creatives',
          description: 'List creative assets',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              media_buy_id: { type: 'string' },
              buyer_ref: { type: 'string' },
              creative_ids: { type: 'array', items: { type: 'string' } },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        {
          name: 'sync_creatives',
          description: 'Upload and manage creative assets',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              creatives: { type: 'array', description: 'Creatives to sync' },
              assignments: { type: 'object' },
              dry_run: { type: 'boolean' },
              validation_mode: { type: 'string', enum: ['strict', 'lenient'] },
            },
            required: ['creatives'],
          },
        },
        {
          name: 'provide_performance_feedback',
          description: 'Share campaign performance outcomes with publishers',
          domain: 'media_buy',
          inputSchema: {
            type: 'object',
            properties: {
              media_buy_id: { type: 'string' },
              measurement_period: { type: 'object' },
              performance_index: { type: 'number' },
              package_id: { type: 'string' },
              creative_id: { type: 'string' },
              metric_type: { type: 'string' },
              feedback_source: { type: 'string' },
            },
            required: ['media_buy_id', 'measurement_period', 'performance_index'],
          },
        }
      );
    }

    // Creative Protocol Tools
    if (this.config.handlers.creative) {
      this.toolDefinitions.push(
        {
          name: 'build_creative',
          description: 'Transform or generate creative manifests',
          domain: 'creative',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Natural language instructions' },
              creative_manifest: { type: 'object', description: 'Source manifest' },
              target_format_id: { type: 'object', description: 'Target format' },
            },
            required: ['target_format_id'],
          },
        },
        {
          name: 'preview_creative',
          description: 'Generate preview renderings of creative manifests',
          domain: 'creative',
          inputSchema: {
            type: 'object',
            properties: {
              request_type: { type: 'string', enum: ['single', 'batch'] },
              format_id: { type: 'object' },
              creative_manifest: { type: 'object' },
              inputs: { type: 'array' },
              output_format: { type: 'string', enum: ['url', 'html', 'both'] },
              requests: { type: 'array' },
            },
            required: ['request_type'],
          },
        },
        {
          name: 'validate_creative',
          description: 'Validate creative manifest against format specification',
          domain: 'creative',
          inputSchema: {
            type: 'object',
            properties: {
              format_id: { type: 'object' },
              creative_manifest: { type: 'object' },
              validation_mode: { type: 'string', enum: ['strict', 'lenient'] },
            },
            required: ['format_id', 'creative_manifest'],
          },
        }
      );
    }
  }
}

// ============================================================================
// Async Task Tracking
// ============================================================================

interface AsyncTask {
  task_id: string;
  status: TaskStatus;
  message: string;
  progress?: number;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
  created_at: string;
  updated_at: string;
}
