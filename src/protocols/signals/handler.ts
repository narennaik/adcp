/**
 * AdCP Signals Protocol Handler
 *
 * Implementation of the Signals Activation Protocol tasks.
 */

import { v4 as uuid } from 'uuid';
import type {
  GetSignalsRequest,
  GetSignalsResponse,
  ActivateSignalRequest,
  ActivateSignalResponse,
  Signal,
  SignalDeployment,
  ActivationDeployment,
} from './types.js';
import type { TaskStatus, ErrorDetail, Principal } from '../../core/types.js';
import {
  AdcpError,
  createErrorDetail,
  ERROR_CODES,
} from '../../core/errors.js';
import type { SignalsDatabase } from '../../database/signals.js';

// ============================================================================
// Signals Protocol Handler
// ============================================================================

export interface SignalsHandlerConfig {
  database: SignalsDatabase;
  agentUrl: string;
  agentName: string;
}

export class SignalsHandler {
  private db: SignalsDatabase;
  private agentUrl: string;
  private agentName: string;

  constructor(config: SignalsHandlerConfig) {
    this.db = config.database;
    this.agentUrl = config.agentUrl;
    this.agentName = config.agentName;
  }

  /**
   * Discovers signals based on natural language descriptions
   */
  async getSignals(
    request: GetSignalsRequest,
    principal?: Principal
  ): Promise<GetSignalsResponse> {
    const contextId = request.context_id || `ctx-signals-${uuid()}`;

    try {
      // Validate request
      this.validateGetSignalsRequest(request);

      // Search for signals matching the spec
      const signals = await this.db.searchSignals({
        query: request.signal_spec,
        catalogTypes: request.filters?.catalog_types,
        dataProviders: request.filters?.data_providers,
        maxCpm: request.filters?.max_cpm,
        minCoverage: request.filters?.min_coverage_percentage,
        maxResults: request.max_results || 10,
        principalId: principal?.id,
      });

      // Enrich with deployment status
      const enrichedSignals = await Promise.all(
        signals.map((signal) =>
          this.enrichSignalWithDeployments(signal, request.deliver_to, principal)
        )
      );

      return {
        message: this.generateGetSignalsMessage(enrichedSignals, request),
        context_id: contextId,
        status: 'completed',
        signals: enrichedSignals,
      };
    } catch (error) {
      if (error instanceof AdcpError) {
        throw error;
      }
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to search signals: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Activates a signal on specified platforms/agents
   */
  async activateSignal(
    request: ActivateSignalRequest,
    principal?: Principal
  ): Promise<ActivateSignalResponse> {
    const contextId = request.context_id || `ctx-signals-${uuid()}`;

    try {
      // Validate request
      this.validateActivateSignalRequest(request);

      // Check signal exists
      const signal = await this.db.getSignal(request.signal_agent_segment_id);
      if (!signal) {
        throw new AdcpError(
          'SIGNAL_AGENT_SEGMENT_NOT_FOUND',
          `Signal '${request.signal_agent_segment_id}' not found`,
          { field: 'signal_agent_segment_id' }
        );
      }

      // Verify authorization
      if (principal) {
        const authorized = await this.db.checkSignalAccess(
          request.signal_agent_segment_id,
          principal.id
        );
        if (!authorized) {
          throw new AdcpError(
            'AGENT_ACCESS_DENIED',
            'Principal is not authorized to activate this signal'
          );
        }
      }

      // Process activations for each deployment
      const deployments: ActivationDeployment[] = [];
      const errors: ErrorDetail[] = [];

      for (const destination of request.deployments) {
        try {
          const deployment = await this.processActivation(
            request.signal_agent_segment_id,
            destination,
            principal
          );
          deployments.push(deployment);
        } catch (error) {
          const errorDetail = createErrorDetail(
            error instanceof AdcpError ? error.code : 'ACTIVATION_FAILED',
            error instanceof Error ? error.message : 'Activation failed',
            {
              field:
                destination.type === 'platform'
                  ? destination.platform
                  : destination.agent_url,
            }
          );
          errors.push(errorDetail);
        }
      }

      const status: TaskStatus =
        errors.length === 0
          ? 'completed'
          : deployments.length > 0
            ? 'completed'
            : 'failed';

      return {
        message: this.generateActivateSignalMessage(
          deployments,
          errors,
          request
        ),
        context_id: contextId,
        status,
        deployments,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      if (error instanceof AdcpError) {
        throw error;
      }
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to activate signal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateGetSignalsRequest(request: GetSignalsRequest): void {
    if (!request.signal_spec || request.signal_spec.trim() === '') {
      throw new AdcpError('INVALID_REQUEST', 'signal_spec is required', {
        field: 'signal_spec',
      });
    }

    if (!request.deliver_to?.deployments?.length) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'At least one deployment target is required',
        { field: 'deliver_to.deployments' }
      );
    }

    if (!request.deliver_to?.countries?.length) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'At least one country is required',
        { field: 'deliver_to.countries' }
      );
    }
  }

  private validateActivateSignalRequest(request: ActivateSignalRequest): void {
    if (!request.signal_agent_segment_id) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'signal_agent_segment_id is required',
        { field: 'signal_agent_segment_id' }
      );
    }

    if (!request.deployments?.length) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'At least one deployment target is required',
        { field: 'deployments' }
      );
    }

    for (const dest of request.deployments) {
      if (dest.type === 'platform' && !dest.platform) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Platform destination requires platform field',
          { field: 'deployments.platform' }
        );
      }
      if (dest.type === 'agent' && !dest.agent_url) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'Agent destination requires agent_url field',
          { field: 'deployments.agent_url' }
        );
      }
    }
  }

  private async enrichSignalWithDeployments(
    signal: Signal,
    deliverTo: GetSignalsRequest['deliver_to'],
    principal?: Principal
  ): Promise<Signal> {
    const deployments: SignalDeployment[] = [];

    for (const destination of deliverTo.deployments) {
      const deployment = await this.db.getSignalDeploymentStatus(
        signal.signal_agent_segment_id,
        destination,
        principal?.id
      );

      if (deployment) {
        deployments.push(deployment);
      } else {
        // Signal is not yet activated on this deployment
        deployments.push({
          type: destination.type,
          platform:
            destination.type === 'platform' ? destination.platform : undefined,
          agent_url:
            destination.type === 'agent' ? destination.agent_url : undefined,
          account: destination.account,
          is_live: false,
          estimated_activation_duration_minutes: 60, // Default estimate
        });
      }
    }

    return {
      ...signal,
      deployments,
    };
  }

  private async processActivation(
    signalId: string,
    destination: GetSignalsRequest['deliver_to']['deployments'][0],
    principal?: Principal
  ): Promise<ActivationDeployment> {
    // Check if already activated
    const existingDeployment = await this.db.getSignalDeploymentStatus(
      signalId,
      destination,
      principal?.id
    );

    if (existingDeployment?.is_live) {
      // Already activated - return existing key
      return {
        type: destination.type,
        platform:
          destination.type === 'platform' ? destination.platform : undefined,
        agent_url:
          destination.type === 'agent' ? destination.agent_url : undefined,
        account: destination.account,
        activation_key: existingDeployment.activation_key,
        deployed_at: new Date().toISOString(),
        is_live: true,
      };
    }

    // Process new activation
    const activationResult = await this.db.activateSignal(
      signalId,
      destination,
      principal?.id
    );

    return {
      type: destination.type,
      platform:
        destination.type === 'platform' ? destination.platform : undefined,
      agent_url:
        destination.type === 'agent' ? destination.agent_url : undefined,
      account: destination.account,
      activation_key: activationResult.activation_key,
      estimated_activation_duration_minutes:
        activationResult.estimated_duration_minutes,
      deployed_at: activationResult.deployed_at,
      is_live: activationResult.is_live ?? !!activationResult.activation_key,
    };
  }

  private generateGetSignalsMessage(
    signals: Signal[],
    request: GetSignalsRequest
  ): string {
    if (signals.length === 0) {
      return `No signals found matching "${request.signal_spec}". Try broadening your search criteria.`;
    }

    const liveCount = signals.filter((s) =>
      s.deployments.some((d) => d.is_live)
    ).length;

    if (liveCount === signals.length) {
      return `Found ${signals.length} signal${signals.length > 1 ? 's' : ''} matching your criteria. All are already activated for your deployment targets.`;
    }

    if (liveCount > 0) {
      return `Found ${signals.length} signal${signals.length > 1 ? 's' : ''} matching your criteria. ${liveCount} already activated, ${signals.length - liveCount} available for activation.`;
    }

    return `Found ${signals.length} signal${signals.length > 1 ? 's' : ''} matching "${request.signal_spec}". Use activate_signal to deploy them.`;
  }

  private generateActivateSignalMessage(
    deployments: ActivationDeployment[],
    errors: ErrorDetail[],
    request: ActivateSignalRequest
  ): string {
    const successCount = deployments.length;
    const errorCount = errors.length;

    if (errorCount === 0 && successCount > 0) {
      const withKeys = deployments.filter((d) => d.activation_key).length;
      if (withKeys === successCount) {
        return `Signal '${request.signal_agent_segment_id}' activated on ${successCount} deployment${successCount > 1 ? 's' : ''}. Activation keys provided.`;
      }
      return `Signal '${request.signal_agent_segment_id}' activation submitted for ${successCount} deployment${successCount > 1 ? 's' : ''}. Keys will be available once activation completes.`;
    }

    if (successCount === 0) {
      return `Failed to activate signal '${request.signal_agent_segment_id}' on all deployments. Check errors for details.`;
    }

    return `Signal '${request.signal_agent_segment_id}' activated on ${successCount} of ${successCount + errorCount} deployments. ${errorCount} failed.`;
  }
}
