/**
 * AdCP Creative Protocol Handler
 *
 * Implementation of the Creative Protocol tasks.
 */

import { v4 as uuid } from 'uuid';
import type {
  CreativeListFormatsRequest,
  CreativeListFormatsResponse,
  BuildCreativeRequest,
  BuildCreativeResponse,
  PreviewCreativeRequest,
  PreviewCreativeResponse,
  ValidateCreativeRequest,
  ValidateCreativeResponse,
  BatchPreviewResult,
  CreativeValidationError,
} from './types.js';
import type { TaskStatus, Principal, FormatId } from '../../core/types.js';
import type {
  CreativeManifest,
  FormatSpecification,
  PreviewResult,
  PreviewRender,
} from '../../core/creative-manifest.js';
import { validateCreativeManifest } from '../../core/creative-manifest.js';
import { AdcpError } from '../../core/errors.js';
import type { CreativeDatabase } from '../../database/creative.js';

// ============================================================================
// Creative Protocol Handler
// ============================================================================

export interface CreativeHandlerConfig {
  database: CreativeDatabase;
  agentUrl: string;
  agentName: string;
  previewExpirationMinutes?: number;
}

export class CreativeHandler {
  private db: CreativeDatabase;
  private agentUrl: string;
  private agentName: string;
  private previewExpirationMinutes: number;

  constructor(config: CreativeHandlerConfig) {
    this.db = config.database;
    this.agentUrl = config.agentUrl;
    this.agentName = config.agentName;
    this.previewExpirationMinutes = config.previewExpirationMinutes || 60;
  }

  // ============================================================================
  // list_creative_formats
  // ============================================================================

  async listCreativeFormats(
    request: CreativeListFormatsRequest,
    principal?: Principal
  ): Promise<CreativeListFormatsResponse> {
    const contextId = request.context_id || `ctx-formats-${uuid()}`;

    try {
      const { formats, specifications } = await this.db.getFormats({
        formatTypes: request.format_types,
        channels: request.channels,
        includeSpecs: request.include_specs,
        principalId: principal?.id,
      });

      return {
        message: `Found ${formats.length} creative format${formats.length !== 1 ? 's' : ''} available.`,
        context_id: contextId,
        status: 'completed',
        formats,
        specifications: request.include_specs ? specifications : undefined,
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
  // build_creative
  // ============================================================================

  async buildCreative(
    request: BuildCreativeRequest,
    principal?: Principal
  ): Promise<BuildCreativeResponse> {
    const contextId = request.context_id || `ctx-build-${uuid()}`;

    try {
      // Validate request
      if (!request.target_format_id) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'target_format_id is required',
          { field: 'target_format_id' }
        );
      }

      // Get target format specification
      const formatSpec = await this.db.getFormatSpecification(
        request.target_format_id
      );
      if (!formatSpec) {
        throw new AdcpError(
          'FORMAT_NOT_FOUND',
          `Format '${request.target_format_id.id}' not found`,
          { field: 'target_format_id' }
        );
      }

      // Build/transform the creative
      const result = await this.db.buildCreative({
        message: request.message,
        sourceManifest: request.creative_manifest,
        targetFormat: formatSpec,
        principalId: principal?.id,
      });

      // Validate the result
      const validation = validateCreativeManifest(result.manifest, formatSpec);

      return {
        message: this.generateBuildMessage(result, validation.warnings),
        context_id: contextId,
        status: 'completed',
        creative_manifest: result.manifest,
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to build creative: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // preview_creative
  // ============================================================================

  async previewCreative(
    request: PreviewCreativeRequest,
    principal?: Principal
  ): Promise<PreviewCreativeResponse> {
    const contextId = request.context_id || `ctx-preview-${uuid()}`;
    const expiresAt = new Date(
      Date.now() + this.previewExpirationMinutes * 60 * 1000
    ).toISOString();

    try {
      if (request.request_type === 'batch') {
        return await this.handleBatchPreview(request, contextId, expiresAt, principal);
      }

      return await this.handleSinglePreview(request, contextId, expiresAt, principal);
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to preview creative: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // validate_creative
  // ============================================================================

  async validateCreative(
    request: ValidateCreativeRequest,
    principal?: Principal
  ): Promise<ValidateCreativeResponse> {
    const contextId = request.context_id || `ctx-validate-${uuid()}`;

    try {
      // Validate request
      if (!request.format_id) {
        throw new AdcpError('INVALID_REQUEST', 'format_id is required', {
          field: 'format_id',
        });
      }

      if (!request.creative_manifest) {
        throw new AdcpError(
          'INVALID_REQUEST',
          'creative_manifest is required',
          { field: 'creative_manifest' }
        );
      }

      // Get format specification
      const formatSpec = await this.db.getFormatSpecification(request.format_id);
      if (!formatSpec) {
        throw new AdcpError(
          'FORMAT_NOT_FOUND',
          `Format '${request.format_id.id}' not found`,
          { field: 'format_id' }
        );
      }

      // Validate manifest against specification
      const result = validateCreativeManifest(
        request.creative_manifest,
        formatSpec
      );

      // Apply validation mode
      const errors: CreativeValidationError[] = result.errors.map((e) => ({
        asset_id: e.asset_id,
        code: e.code,
        message: e.message,
      }));

      // In lenient mode, some errors become warnings
      let effectiveErrors = errors;
      let effectiveWarnings = result.warnings;

      if (request.validation_mode === 'lenient') {
        const nonCriticalCodes = ['INVALID_DIMENSIONS', 'INVALID_DURATION'];
        const lenientErrors = errors.filter((e) =>
          nonCriticalCodes.includes(e.code)
        );
        effectiveErrors = errors.filter(
          (e) => !nonCriticalCodes.includes(e.code)
        );
        effectiveWarnings = [
          ...effectiveWarnings,
          ...lenientErrors.map((e) => e.message),
        ];
      }

      return {
        message: effectiveErrors.length === 0
          ? 'Creative manifest is valid.'
          : `Creative manifest has ${effectiveErrors.length} validation error${effectiveErrors.length !== 1 ? 's' : ''}.`,
        context_id: contextId,
        status: 'completed',
        valid: effectiveErrors.length === 0,
        errors: effectiveErrors.length > 0 ? effectiveErrors : undefined,
        warnings: effectiveWarnings.length > 0 ? effectiveWarnings : undefined,
      };
    } catch (error) {
      if (error instanceof AdcpError) throw error;
      throw new AdcpError(
        'INTERNAL_ERROR',
        `Failed to validate creative: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async handleSinglePreview(
    request: PreviewCreativeRequest,
    contextId: string,
    expiresAt: string,
    principal?: Principal
  ): Promise<PreviewCreativeResponse> {
    // Validate single mode request
    if (!request.format_id) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'format_id is required for single preview',
        { field: 'format_id' }
      );
    }

    if (!request.creative_manifest) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'creative_manifest is required for single preview',
        { field: 'creative_manifest' }
      );
    }

    // Get format specification
    const formatSpec = await this.db.getFormatSpecification(request.format_id);
    if (!formatSpec) {
      throw new AdcpError(
        'FORMAT_NOT_FOUND',
        `Format '${request.format_id.id}' not found`,
        { field: 'format_id' }
      );
    }

    // Generate previews for each input (or default)
    const inputs = request.inputs?.length ? request.inputs : [{}];
    const previews: PreviewResult[] = [];

    for (const input of inputs) {
      const preview = await this.db.generatePreview({
        manifest: request.creative_manifest,
        formatSpec,
        input,
        outputFormat: request.output_format || 'url',
        principalId: principal?.id,
      });
      previews.push(preview);
    }

    return {
      message: `Generated ${previews.length} preview${previews.length !== 1 ? 's' : ''}.`,
      context_id: contextId,
      status: 'completed',
      response_type: 'single',
      previews,
      expires_at: expiresAt,
    };
  }

  private async handleBatchPreview(
    request: PreviewCreativeRequest,
    contextId: string,
    expiresAt: string,
    principal?: Principal
  ): Promise<PreviewCreativeResponse> {
    if (!request.requests?.length) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'requests array is required for batch preview',
        { field: 'requests' }
      );
    }

    if (request.requests.length > 50) {
      throw new AdcpError(
        'INVALID_REQUEST',
        'Maximum 50 requests per batch',
        { field: 'requests' }
      );
    }

    const results: BatchPreviewResult[] = [];

    for (const req of request.requests) {
      try {
        // Get format specification
        const formatSpec = await this.db.getFormatSpecification(req.format_id);
        if (!formatSpec) {
          results.push({
            success: false,
            error: {
              code: 'FORMAT_NOT_FOUND',
              message: `Format '${req.format_id.id}' not found`,
            },
          });
          continue;
        }

        // Generate previews
        const inputs = req.inputs?.length ? req.inputs : [{}];
        const previews: PreviewResult[] = [];

        for (const input of inputs) {
          const preview = await this.db.generatePreview({
            manifest: req.creative_manifest,
            formatSpec,
            input,
            outputFormat: req.output_format || request.output_format || 'url',
            principalId: principal?.id,
          });
          previews.push(preview);
        }

        results.push({
          success: true,
          response: {
            previews,
            expires_at: expiresAt,
          },
        });
      } catch (error) {
        results.push({
          success: false,
          error: {
            code: error instanceof AdcpError ? error.code : 'PREVIEW_FAILED',
            message: error instanceof Error ? error.message : 'Preview failed',
          },
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      message: `Batch preview complete: ${successCount}/${results.length} succeeded.`,
      context_id: contextId,
      status: 'completed',
      response_type: 'batch',
      results,
      expires_at: expiresAt,
    };
  }

  private generateBuildMessage(
    result: { manifest: CreativeManifest; generated?: boolean },
    warnings: string[]
  ): string {
    const action = result.generated ? 'Generated' : 'Transformed';
    const warningNote =
      warnings.length > 0 ? ` (${warnings.length} warning${warnings.length !== 1 ? 's' : ''})` : '';
    return `${action} creative manifest for format '${result.manifest.format_id.id}'${warningNote}.`;
  }
}
