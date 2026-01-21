/**
 * AdCP Signals Protocol Types
 *
 * Type definitions for the Signals Activation Protocol.
 */

import type {
  BaseResponse,
  Destination,
  DeliverTo,
  ActivationKey,
  Pricing,
  ErrorDetail,
} from '../../core/types.js';

// ============================================================================
// Signal Types
// ============================================================================

export type SignalType = 'marketplace' | 'custom' | 'owned';

export type CatalogType = 'marketplace' | 'custom' | 'owned';

// ============================================================================
// get_signals Request
// ============================================================================

export interface GetSignalsRequest {
  /** Natural language description of desired signals */
  signal_spec: string;

  /** Deployment targets for signal activation */
  deliver_to: DeliverTo;

  /** Optional filters */
  filters?: GetSignalsFilters;

  /** Maximum results to return */
  max_results?: number;

  /** Session context identifier */
  context_id?: string;
}

export interface GetSignalsFilters {
  /** Filter by catalog types */
  catalog_types?: CatalogType[];

  /** Filter by specific data provider names */
  data_providers?: string[];

  /** Maximum CPM price threshold */
  max_cpm?: number;

  /** Minimum reach requirement (percentage) */
  min_coverage_percentage?: number;
}

// ============================================================================
// get_signals Response
// ============================================================================

export interface GetSignalsResponse extends BaseResponse {
  /** Array of discovered signals */
  signals: Signal[];

  /** Session context identifier */
  context_id: string;
}

export interface Signal {
  /** Universal signal identifier */
  signal_agent_segment_id: string;

  /** Human-readable name */
  name: string;

  /** Detailed description */
  description: string;

  /** Signal catalog type */
  signal_type: SignalType;

  /** Data source organization */
  data_provider: string;

  /** Estimated reach percentage */
  coverage_percentage?: number;

  /** Platform-specific activation details */
  deployments: SignalDeployment[];

  /** Pricing information */
  pricing?: Pricing;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface SignalDeployment {
  /** Deployment type */
  type: 'platform' | 'agent';

  /** DSP name (when type='platform') */
  platform?: string;

  /** Sales agent URL (when type='agent') */
  agent_url?: string;

  /** Account identifier */
  account?: string;

  /** Current activation status */
  is_live: boolean;

  /** How to use signal on deployment (only when is_live=true) */
  activation_key?: ActivationKey;

  /** Time needed to activate (when is_live=false) */
  estimated_activation_duration_minutes?: number;

  /** Scope of deployment */
  scope?: 'platform-wide' | 'account-specific';

  /** Platform-specific targeting segment ID */
  decisioning_platform_segment_id?: string;
}

// ============================================================================
// activate_signal Request
// ============================================================================

export interface ActivateSignalRequest {
  /** Universal identifier for the signal */
  signal_agent_segment_id: string;

  /** Target deployment(s) for activation */
  deployments: Destination[];

  /** Session context identifier */
  context_id?: string;
}

// ============================================================================
// activate_signal Response
// ============================================================================

export interface ActivateSignalResponse extends BaseResponse {
  /** Activation results per deployment */
  deployments: ActivationDeployment[];

  /** Errors that occurred during activation */
  errors?: ErrorDetail[];

  /** Session context identifier */
  context_id: string;
}

export interface ActivationDeployment {
  /** Deployment type */
  type: 'platform' | 'agent';

  /** DSP name (when type='platform') */
  platform?: string;

  /** Sales agent URL (when type='agent') */
  agent_url?: string;

  /** Account identifier */
  account?: string;

  /** Activation key for using the signal */
  activation_key?: ActivationKey;

  /** Estimated time to complete activation */
  estimated_activation_duration_minutes?: number;

  /** Timestamp when deployment completed */
  deployed_at?: string;

  /** Current activation status */
  is_live: boolean;
}

// ============================================================================
// Signal Agent Types
// ============================================================================

export type SignalAgentType = 'private' | 'marketplace';

export interface SignalAgentInfo {
  /** Agent URL */
  agent_url: string;

  /** Agent name */
  name: string;

  /** Agent type */
  type: SignalAgentType;

  /** Description */
  description?: string;

  /** Supported signal types */
  signal_types: SignalType[];

  /** Supported platforms for activation */
  supported_platforms: string[];
}
