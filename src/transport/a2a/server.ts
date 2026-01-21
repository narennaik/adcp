/**
 * A2A Transport Server
 *
 * Agent-to-Agent protocol server implementation for AdCP.
 */

import { v4 as uuid } from 'uuid';
import type {
  A2aTaskRequest,
  A2aTaskResponse,
  A2aTask,
  A2aTaskStatus,
  A2aMessage,
  A2aArtifact,
  A2aAgentCard,
  A2aSkill,
  A2aSkillInvocation,
  A2aWebhookConfig,
  A2aWebhookPayload,
  SseEvent,
  SseStatusEvent,
  SseMessageEvent,
  SseArtifactEvent,
  SseProgressEvent,
  SseCompleteEvent,
  SseErrorEvent,
  MessagePart,
  DataPart,
  TextPart,
} from './types.js';
import { A2A_ERROR_CODES } from './types.js';
import type { TaskStatus, Principal } from '../../core/types.js';
import { AdcpError } from '../../core/errors.js';
import type { SignalsHandler } from '../../protocols/signals/handler.js';
import type { MediaBuyHandler } from '../../protocols/media-buy/handler.js';
import type { CreativeHandler } from '../../protocols/creative/handler.js';

// ============================================================================
// A2A Server Configuration
// ============================================================================

export interface A2aServerConfig {
  /** Agent name */
  name: string;

  /** Agent description */
  description?: string;

  /** Agent URL */
  url: string;

  /** Agent version */
  version: string;

  /** Agent type */
  agentType: 'signal_agent' | 'sales_agent' | 'creative_agent';

  /** Protocol handlers */
  handlers: {
    signals?: SignalsHandler;
    mediaBuy?: MediaBuyHandler;
    creative?: CreativeHandler;
  };

  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;

  /** Task timeout in seconds */
  taskTimeoutSeconds?: number;
}

// ============================================================================
// A2A Server
// ============================================================================

export class A2aServer {
  private config: A2aServerConfig;
  private tasks: Map<string, A2aTask> = new Map();
  private taskListeners: Map<string, Set<SseListener>> = new Map();
  private skills: A2aSkill[] = [];

  constructor(config: A2aServerConfig) {
    this.config = config;
    this.initializeSkills();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get agent card (/.well-known/agent.json)
   */
  getAgentCard(): A2aAgentCard {
    const domains: string[] = [];
    if (this.config.handlers.signals) domains.push('signals');
    if (this.config.handlers.mediaBuy) domains.push('media_buy');
    if (this.config.handlers.creative) domains.push('creative');

    return {
      name: this.config.name,
      description: this.config.description,
      url: this.config.url,
      version: this.config.version,
      skills: this.skills,
      extensions: {
        adcp: {
          protocol_version: '2.6',
          domains,
          agent_type: this.config.agentType,
        },
      },
      authentication: {
        schemes: ['bearer'],
      },
    };
  }

  /**
   * Create a new task
   */
  async createTask(
    request: A2aTaskRequest,
    principal?: Principal
  ): Promise<A2aTaskResponse> {
    const taskId = `task-${uuid()}`;
    const now = new Date().toISOString();

    // Create initial task
    const task: A2aTask = {
      id: taskId,
      status: {
        state: 'working',
        message: 'Processing request',
        timestamp: now,
      },
      messages: [
        {
          role: 'user',
          parts: request.parts,
          metadata: {
            timestamp: now,
            message_id: `msg-${uuid()}`,
            correlation_id: request.metadata?.correlation_id,
          },
        },
      ],
      artifacts: [],
      created_at: now,
      updated_at: now,
      metadata: {
        skill: request.skill,
        principal_id: principal?.id,
        context_id: request.metadata?.context_id,
      },
    };

    this.tasks.set(taskId, task);

    // Start async processing
    this.processTask(task, request, principal, request.webhook);

    return {
      task_id: taskId,
      status: task.status,
    };
  }

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<A2aTaskResponse | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      task_id: task.id,
      status: task.status,
      messages: task.messages,
      artifacts: task.artifacts,
    };
  }

  /**
   * Continue a task with additional input
   */
  async continueTask(
    taskId: string,
    parts: MessagePart[],
    principal?: Principal
  ): Promise<A2aTaskResponse | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Add user message
    const now = new Date().toISOString();
    task.messages.push({
      role: 'user',
      parts,
      metadata: {
        timestamp: now,
        message_id: `msg-${uuid()}`,
      },
    });

    // Update status and resume processing
    task.status = {
      state: 'working',
      message: 'Processing additional input',
      timestamp: now,
    };
    task.updated_at = now;

    this.emitEvent(taskId, {
      type: 'status',
      data: task.status,
      timestamp: now,
    });

    // Continue processing (implementation depends on task type)
    // For now, just mark as completed
    this.completeTask(task, {
      role: 'agent',
      parts: [{ type: 'text', text: 'Acknowledged additional input.' }],
    });

    return {
      task_id: task.id,
      status: task.status,
      messages: task.messages,
      artifacts: task.artifacts,
    };
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status.state === 'completed' || task.status.state === 'failed') {
      return false;
    }

    const now = new Date().toISOString();
    task.status = {
      state: 'failed',
      message: 'Task cancelled',
      timestamp: now,
    };
    task.updated_at = now;

    this.emitEvent(taskId, {
      type: 'error',
      data: { code: 'CANCELLED', message: 'Task was cancelled' },
      timestamp: now,
    });

    return true;
  }

  /**
   * Subscribe to task events (SSE)
   */
  subscribeToTask(taskId: string, listener: SseListener): () => void {
    let listeners = this.taskListeners.get(taskId);
    if (!listeners) {
      listeners = new Set();
      this.taskListeners.set(taskId, listeners);
    }
    listeners.add(listener);

    // Send current status immediately
    const task = this.tasks.get(taskId);
    if (task) {
      listener({
        type: 'status',
        data: task.status,
        timestamp: new Date().toISOString(),
      });
    }

    // Return unsubscribe function
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        this.taskListeners.delete(taskId);
      }
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async processTask(
    task: A2aTask,
    request: A2aTaskRequest,
    principal?: Principal,
    webhook?: A2aWebhookConfig
  ): Promise<void> {
    try {
      // Parse skill invocation from request
      const invocation = this.parseSkillInvocation(request);

      // Execute the skill
      const result = await this.executeSkill(invocation, principal);

      // Create response message
      const responseMessage: A2aMessage = {
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: result.message,
          } as TextPart,
          {
            type: 'data',
            data: result.data,
          } as DataPart,
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          message_id: `msg-${uuid()}`,
        },
      };

      // Create artifact if applicable
      if (result.artifact) {
        const artifact: A2aArtifact = {
          type: 'artifact',
          name: result.artifact.name,
          parts: [
            {
              type: 'data',
              data: result.artifact.data,
            } as DataPart,
          ],
          metadata: {
            artifact_id: `artifact-${uuid()}`,
            created_at: new Date().toISOString(),
          },
        };
        task.artifacts?.push(artifact);

        this.emitEvent(task.id, {
          type: 'artifact',
          data: artifact,
          timestamp: new Date().toISOString(),
        });
      }

      // Complete task
      this.completeTask(task, responseMessage, result.status);

      // Send webhook if configured
      if (webhook) {
        await this.sendWebhook(webhook, {
          task_id: task.id,
          event: 'completed',
          status: task.status,
          timestamp: new Date().toISOString(),
          data: result.data,
        });
      }
    } catch (error) {
      this.failTask(
        task,
        error instanceof AdcpError ? error.code : 'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Send webhook if configured
      if (webhook) {
        await this.sendWebhook(webhook, {
          task_id: task.id,
          event: 'failed',
          status: task.status,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private parseSkillInvocation(request: A2aTaskRequest): A2aSkillInvocation {
    const skill = request.skill || 'default';
    let parameters: Record<string, unknown> = {};
    let context: string | undefined;
    const files: Array<{ uri: string; mimeType?: string; name?: string }> = [];

    for (const part of request.parts) {
      switch (part.type) {
        case 'text':
          context = part.text;
          break;
        case 'data':
          parameters = { ...parameters, ...part.data };
          break;
        case 'file':
          files.push({
            uri: part.uri,
            mimeType: part.mimeType,
            name: part.name,
          });
          break;
      }
    }

    return { skill, parameters, context, files: files.length > 0 ? files : undefined };
  }

  private async executeSkill(
    invocation: A2aSkillInvocation,
    principal?: Principal
  ): Promise<{
    status: TaskStatus;
    message: string;
    data: Record<string, unknown>;
    artifact?: { name: string; data: Record<string, unknown> };
  }> {
    const { skill, parameters, context } = invocation;

    // Route to appropriate handler based on skill
    switch (skill) {
      // Signals Protocol Skills
      case 'get_signals':
      case 'signals.get_signals':
        if (!this.config.handlers.signals) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Signals protocol not enabled');
        }
        const signalsResult = await this.config.handlers.signals.getSignals(
          parameters as any,
          principal
        );
        return {
          status: signalsResult.status || 'completed',
          message: signalsResult.message,
          data: { signals: signalsResult.signals },
        };

      case 'activate_signal':
      case 'signals.activate_signal':
        if (!this.config.handlers.signals) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Signals protocol not enabled');
        }
        const activateResult = await this.config.handlers.signals.activateSignal(
          parameters as any,
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

      // Media Buy Protocol Skills
      case 'get_products':
      case 'media_buy.get_products':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const productsResult = await this.config.handlers.mediaBuy.getProducts(
          parameters as any,
          principal
        );
        return {
          status: productsResult.status || 'completed',
          message: productsResult.message,
          data: { products: productsResult.products },
        };

      case 'create_media_buy':
      case 'media_buy.create_media_buy':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const createResult = await this.config.handlers.mediaBuy.createMediaBuy(
          parameters as any,
          principal
        );
        return {
          status: createResult.status || 'completed',
          message: createResult.message,
          data: {
            media_buy_id: createResult.media_buy_id,
            buyer_ref: createResult.buyer_ref,
            packages: createResult.packages,
          },
        };

      case 'update_media_buy':
      case 'media_buy.update_media_buy':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const updateResult = await this.config.handlers.mediaBuy.updateMediaBuy(
          parameters as any,
          principal
        );
        return {
          status: updateResult.status || 'completed',
          message: updateResult.message,
          data: {
            media_buy_id: updateResult.media_buy_id,
            affected_packages: updateResult.affected_packages,
          },
        };

      case 'get_media_buy_delivery':
      case 'media_buy.get_media_buy_delivery':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const deliveryResult = await this.config.handlers.mediaBuy.getMediaBuyDelivery(
          parameters as any,
          principal
        );
        return {
          status: deliveryResult.status || 'completed',
          message: deliveryResult.message,
          data: {
            reporting_period: deliveryResult.reporting_period,
            aggregated_totals: deliveryResult.aggregated_totals,
            media_buy_deliveries: deliveryResult.media_buy_deliveries,
          },
        };

      case 'sync_creatives':
      case 'media_buy.sync_creatives':
        if (!this.config.handlers.mediaBuy) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Media Buy protocol not enabled');
        }
        const syncResult = await this.config.handlers.mediaBuy.syncCreatives(
          parameters as any,
          principal
        );
        return {
          status: syncResult.status || 'completed',
          message: syncResult.message,
          data: { creatives: syncResult.creatives },
        };

      // Creative Protocol Skills
      case 'build_creative':
      case 'creative.build_creative':
        if (!this.config.handlers.creative) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Creative protocol not enabled');
        }
        const buildResult = await this.config.handlers.creative.buildCreative(
          parameters as any,
          principal
        );
        return {
          status: buildResult.status || 'completed',
          message: buildResult.message,
          data: { creative_manifest: buildResult.creative_manifest },
          artifact: {
            name: 'creative_manifest',
            data: buildResult.creative_manifest as unknown as Record<string, unknown>,
          },
        };

      case 'preview_creative':
      case 'creative.preview_creative':
        if (!this.config.handlers.creative) {
          throw new AdcpError('NOT_IMPLEMENTED', 'Creative protocol not enabled');
        }
        const previewResult = await this.config.handlers.creative.previewCreative(
          parameters as any,
          principal
        );
        return {
          status: previewResult.status || 'completed',
          message: previewResult.message,
          data: {
            response_type: previewResult.response_type,
            previews: previewResult.previews,
            results: previewResult.results,
          },
        };

      // Default/unknown skill
      default:
        // Try to handle natural language via context
        if (context) {
          return this.handleNaturalLanguageRequest(context, parameters, principal);
        }
        throw new AdcpError('NOT_IMPLEMENTED', `Unknown skill: ${skill}`);
    }
  }

  private async handleNaturalLanguageRequest(
    context: string,
    parameters: Record<string, unknown>,
    principal?: Principal
  ): Promise<{
    status: TaskStatus;
    message: string;
    data: Record<string, unknown>;
  }> {
    // Simple keyword-based routing for natural language
    const lowerContext = context.toLowerCase();

    if (
      lowerContext.includes('signal') ||
      lowerContext.includes('audience') ||
      lowerContext.includes('segment')
    ) {
      if (this.config.handlers.signals) {
        const result = await this.config.handlers.signals.getSignals(
          {
            signal_spec: context,
            deliver_to: (parameters.deliver_to as any) || {
              deployments: [],
              countries: ['US'],
            },
          },
          principal
        );
        return {
          status: 'completed',
          message: result.message,
          data: { signals: result.signals },
        };
      }
    }

    if (
      lowerContext.includes('product') ||
      lowerContext.includes('inventory') ||
      lowerContext.includes('campaign')
    ) {
      if (this.config.handlers.mediaBuy) {
        const result = await this.config.handlers.mediaBuy.getProducts(
          { brief: context, ...parameters },
          principal
        );
        return {
          status: 'completed',
          message: result.message,
          data: { products: result.products },
        };
      }
    }

    return {
      status: 'completed',
      message: 'I understood your request but could not determine the appropriate action.',
      data: { context, parameters },
    };
  }

  private completeTask(
    task: A2aTask,
    responseMessage: A2aMessage,
    status: TaskStatus = 'completed'
  ): void {
    const now = new Date().toISOString();

    task.messages.push(responseMessage);
    task.status = {
      state: status,
      message: status === 'completed' ? 'Task completed successfully' : 'Processing',
      timestamp: now,
    };
    task.updated_at = now;

    this.emitEvent(task.id, {
      type: 'message',
      data: responseMessage,
      timestamp: now,
    });

    this.emitEvent(task.id, {
      type: 'complete',
      data: {
        task_id: task.id,
        status: task.status,
        messages: task.messages,
        artifacts: task.artifacts,
      },
      timestamp: now,
    });
  }

  private failTask(task: A2aTask, code: string, message: string): void {
    const now = new Date().toISOString();

    task.status = {
      state: 'failed',
      message,
      timestamp: now,
    };
    task.updated_at = now;

    this.emitEvent(task.id, {
      type: 'error',
      data: { code, message },
      timestamp: now,
    });
  }

  private emitEvent(taskId: string, event: SseEvent): void {
    const listeners = this.taskListeners.get(taskId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  private async sendWebhook(
    config: A2aWebhookConfig,
    payload: A2aWebhookPayload
  ): Promise<void> {
    // In a real implementation, this would make an HTTP request
    // For now, we'll just log the webhook
    console.log(`[A2A Webhook] ${config.url}:`, payload);
  }

  private initializeSkills(): void {
    // Signals Protocol Skills
    if (this.config.handlers.signals) {
      this.skills.push(
        {
          name: 'get_signals',
          description: 'Discover audience signals based on natural language descriptions',
          examples: [
            'Find high-income households interested in luxury goods',
            'Get automotive intender segments for the US market',
          ],
        },
        {
          name: 'activate_signal',
          description: 'Deploy a signal to specific platforms or sales agents',
          examples: ['Activate the luxury auto segment on The Trade Desk'],
        }
      );
    }

    // Media Buy Protocol Skills
    if (this.config.handlers.mediaBuy) {
      this.skills.push(
        {
          name: 'get_products',
          description: 'Discover advertising inventory based on campaign requirements',
          examples: [
            'Find premium video inventory for a sports campaign',
            'Show me display products with $50k+ budget',
          ],
        },
        {
          name: 'create_media_buy',
          description: 'Create advertising campaigns',
          examples: ['Create a 30-day video campaign targeting millennials'],
        },
        {
          name: 'update_media_buy',
          description: 'Modify existing campaigns',
          examples: ['Pause the summer campaign', 'Increase budget by 20%'],
        },
        {
          name: 'get_media_buy_delivery',
          description: 'Get campaign performance metrics',
          examples: ['Show delivery for my active campaigns'],
        },
        {
          name: 'sync_creatives',
          description: 'Upload and manage creative assets',
          examples: ['Upload the new video creative'],
        }
      );
    }

    // Creative Protocol Skills
    if (this.config.handlers.creative) {
      this.skills.push(
        {
          name: 'build_creative',
          description: 'Generate or transform creative assets',
          examples: [
            'Create a 300x250 display ad from my brand assets',
            'Convert this video to a 15-second format',
          ],
        },
        {
          name: 'preview_creative',
          description: 'Generate preview renderings',
          examples: ['Preview the banner on desktop and mobile'],
        }
      );
    }
  }
}

// ============================================================================
// SSE Listener Type
// ============================================================================

export type SseListener = (event: SseEvent) => void;
