/**
 * Signals Database Interface & Mock Implementation
 *
 * Database abstraction for Signals Protocol operations.
 */

import type {
  Destination,
  ActivationKey,
  Pricing,
} from '../core/types.js';
import type {
  Signal,
  SignalDeployment,
  SignalType,
  CatalogType,
} from '../protocols/signals/types.js';

// ============================================================================
// Signals Database Interface
// ============================================================================

export interface SignalsDatabase {
  /**
   * Search for signals matching criteria
   */
  searchSignals(params: SearchSignalsParams): Promise<Signal[]>;

  /**
   * Get a specific signal by ID
   */
  getSignal(signalId: string): Promise<Signal | null>;

  /**
   * Check if principal has access to a signal
   */
  checkSignalAccess(signalId: string, principalId?: string): Promise<boolean>;

  /**
   * Get deployment status for a signal on a specific destination
   */
  getSignalDeploymentStatus(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<SignalDeployment | null>;

  /**
   * Activate a signal on a destination
   */
  activateSignal(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<ActivationResult>;
}

export interface SearchSignalsParams {
  query: string;
  catalogTypes?: CatalogType[];
  dataProviders?: string[];
  maxCpm?: number;
  minCoverage?: number;
  maxResults?: number;
  principalId?: string;
}

export interface ActivationResult {
  activation_key?: ActivationKey;
  estimated_duration_minutes?: number;
  deployed_at?: string;
  is_live?: boolean;
}

// ============================================================================
// Mock Signals Database
// ============================================================================

export class MockSignalsDatabase implements SignalsDatabase {
  private signals: Map<string, Signal> = new Map();
  private activations: Map<string, Map<string, SignalDeployment>> = new Map();

  constructor() {
    this.initializeMockData();
  }

  async searchSignals(params: SearchSignalsParams): Promise<Signal[]> {
    let results = Array.from(this.signals.values());

    // Filter by query (simple keyword match)
    const queryLower = params.query.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(queryLower) ||
        s.description.toLowerCase().includes(queryLower)
    );

    // Filter by catalog types
    if (params.catalogTypes?.length) {
      results = results.filter((s) =>
        params.catalogTypes!.includes(s.signal_type as CatalogType)
      );
    }

    // Filter by data providers
    if (params.dataProviders?.length) {
      results = results.filter((s) =>
        params.dataProviders!.includes(s.data_provider)
      );
    }

    // Filter by max CPM
    if (params.maxCpm !== undefined) {
      results = results.filter(
        (s) => !s.pricing?.cpm || s.pricing.cpm <= params.maxCpm!
      );
    }

    // Filter by min coverage
    if (params.minCoverage !== undefined) {
      results = results.filter(
        (s) =>
          s.coverage_percentage !== undefined &&
          s.coverage_percentage >= params.minCoverage!
      );
    }

    // Limit results
    if (params.maxResults) {
      results = results.slice(0, params.maxResults);
    }

    return results;
  }

  async getSignal(signalId: string): Promise<Signal | null> {
    return this.signals.get(signalId) || null;
  }

  async checkSignalAccess(
    signalId: string,
    principalId?: string
  ): Promise<boolean> {
    const signal = this.signals.get(signalId);
    if (!signal) return false;

    // Marketplace signals are accessible to all
    if (signal.signal_type === 'marketplace') return true;

    // Owned/custom signals require principal authorization
    // In mock, we'll allow all authenticated principals
    return !!principalId;
  }

  async getSignalDeploymentStatus(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<SignalDeployment | null> {
    const key = this.getActivationKey(signalId, destination);
    const activations = this.activations.get(signalId);
    return activations?.get(key) || null;
  }

  async activateSignal(
    signalId: string,
    destination: Destination,
    principalId?: string
  ): Promise<ActivationResult> {
    const signal = await this.getSignal(signalId);
    if (!signal) {
      throw new Error('Signal not found');
    }

    const key = this.getActivationKey(signalId, destination);
    const now = new Date().toISOString();

    // Create activation
    const deployment: SignalDeployment = {
      type: destination.type,
      platform:
        destination.type === 'platform' ? destination.platform : undefined,
      agent_url:
        destination.type === 'agent' ? destination.agent_url : undefined,
      account: destination.account,
      is_live: true,
      activation_key: {
        type: 'segment_id',
        segment_id: `${signalId}_${destination.type}_${Date.now()}`,
      },
    };

    // Store activation
    let activations = this.activations.get(signalId);
    if (!activations) {
      activations = new Map();
      this.activations.set(signalId, activations);
    }
    activations.set(key, deployment);

    return {
      activation_key: deployment.activation_key,
      deployed_at: now,
      is_live: true,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getActivationKey(signalId: string, destination: Destination): string {
    if (destination.type === 'platform') {
      return `${signalId}:platform:${destination.platform}:${destination.account || 'default'}`;
    }
    return `${signalId}:agent:${destination.agent_url}:${destination.account || 'default'}`;
  }

  private initializeMockData(): void {
    const mockSignals: Signal[] = [
      {
        signal_agent_segment_id: 'luxury_auto_intenders',
        name: 'Luxury Automotive Intenders',
        description:
          'High-income individuals actively researching luxury vehicles',
        signal_type: 'marketplace',
        data_provider: 'Experian',
        coverage_percentage: 12,
        deployments: [],
        pricing: { cpm: 3.5, currency: 'USD' },
      },
      {
        signal_agent_segment_id: 'high_income_households',
        name: 'High Income Households',
        description: 'Households with annual income over $150,000',
        signal_type: 'marketplace',
        data_provider: 'LiveRamp',
        coverage_percentage: 8,
        deployments: [],
        pricing: { cpm: 2.75, currency: 'USD' },
      },
      {
        signal_agent_segment_id: 'sports_enthusiasts',
        name: 'Sports Enthusiasts',
        description: 'Users who regularly engage with sports content',
        signal_type: 'marketplace',
        data_provider: 'Oracle',
        coverage_percentage: 25,
        deployments: [],
        pricing: { cpm: 1.5, currency: 'USD' },
      },
      {
        signal_agent_segment_id: 'travel_intenders_2024',
        name: 'Travel Intenders 2024',
        description: 'Users planning travel in the next 6 months',
        signal_type: 'marketplace',
        data_provider: 'Peer39',
        coverage_percentage: 15,
        deployments: [],
        pricing: { cpm: 2.0, currency: 'USD' },
      },
      {
        signal_agent_segment_id: 'custom_brand_loyalists',
        name: 'Brand Loyalists (Custom)',
        description: 'Custom segment of brand-loyal customers',
        signal_type: 'custom',
        data_provider: 'First-Party',
        coverage_percentage: 5,
        deployments: [],
      },
    ];

    for (const signal of mockSignals) {
      this.signals.set(signal.signal_agent_segment_id, signal);
    }
  }
}
