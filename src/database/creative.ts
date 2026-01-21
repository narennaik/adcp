/**
 * Creative Database Interface & Mock Implementation
 *
 * Database abstraction for Creative Protocol operations.
 */

import { v4 as uuid } from 'uuid';
import type { FormatId } from '../core/types.js';
import type {
  CreativeManifest,
  FormatSpecification,
  PreviewInput,
  PreviewResult,
  PreviewRender,
  CreativeAsset,
} from '../core/creative-manifest.js';
import type { CreativeFormatInfo } from '../protocols/creative/types.js';

// ============================================================================
// Creative Database Interface
// ============================================================================

export interface CreativeDatabase {
  /**
   * Get available formats
   */
  getFormats(params: CreativeGetFormatsParams): Promise<{
    formats: CreativeFormatInfo[];
    specifications?: FormatSpecification[];
  }>;

  /**
   * Get a specific format specification
   */
  getFormatSpecification(formatId: FormatId): Promise<FormatSpecification | null>;

  /**
   * Build/transform a creative
   */
  buildCreative(params: BuildCreativeParams): Promise<{
    manifest: CreativeManifest;
    generated?: boolean;
  }>;

  /**
   * Generate a preview
   */
  generatePreview(params: GeneratePreviewParams): Promise<PreviewResult>;
}

// ============================================================================
// Parameter Types
// ============================================================================

export interface CreativeGetFormatsParams {
  formatTypes?: string[];
  channels?: string[];
  includeSpecs?: boolean;
  principalId?: string;
}

export interface BuildCreativeParams {
  message?: string;
  sourceManifest?: Partial<CreativeManifest>;
  targetFormat: FormatSpecification;
  principalId?: string;
}

export interface GeneratePreviewParams {
  manifest: CreativeManifest;
  formatSpec: FormatSpecification;
  input: PreviewInput;
  outputFormat: 'url' | 'html' | 'both';
  principalId?: string;
}

// ============================================================================
// Mock Creative Database
// ============================================================================

export class MockCreativeDatabase implements CreativeDatabase {
  private formatSpecs: Map<string, FormatSpecification> = new Map();

  constructor() {
    this.initializeMockData();
  }

  async getFormats(params: CreativeGetFormatsParams): Promise<{
    formats: CreativeFormatInfo[];
    specifications?: FormatSpecification[];
  }> {
    let specs = Array.from(this.formatSpecs.values());

    if (params.formatTypes?.length) {
      specs = specs.filter((s) => params.formatTypes!.includes(s.type));
    }

    const formats: CreativeFormatInfo[] = specs.map((spec) => ({
      format_id: spec.format_id,
      name: spec.name,
      type: spec.type,
      description: spec.description,
      is_authoritative: true,
      capabilities: ['validation', 'assembly', 'preview', 'generation'],
    }));

    return {
      formats,
      specifications: params.includeSpecs ? specs : undefined,
    };
  }

  async getFormatSpecification(
    formatId: FormatId
  ): Promise<FormatSpecification | null> {
    const key = `${formatId.agent_url}:${formatId.id}`;
    return this.formatSpecs.get(key) || null;
  }

  async buildCreative(params: BuildCreativeParams): Promise<{
    manifest: CreativeManifest;
    generated?: boolean;
  }> {
    const { targetFormat, sourceManifest, message } = params;

    // Start with source manifest or create new
    const assets: Record<string, CreativeAsset> = {};

    // If source manifest has assets, try to use them
    if (sourceManifest?.assets) {
      for (const [key, value] of Object.entries(sourceManifest.assets)) {
        assets[key] = value;
      }
    }

    // Generate placeholder assets for any missing required assets
    for (const requirement of targetFormat.assets_required) {
      if (requirement.required && !assets[requirement.asset_id]) {
        assets[requirement.asset_id] = this.generatePlaceholderAsset(
          requirement.asset_id,
          requirement.asset_type,
          message
        );
      }
    }

    const manifest: CreativeManifest = {
      format_id: targetFormat.format_id,
      promoted_offering: sourceManifest?.promoted_offering,
      assets,
    };

    return {
      manifest,
      generated: !sourceManifest || Object.keys(sourceManifest.assets || {}).length === 0,
    };
  }

  async generatePreview(params: GeneratePreviewParams): Promise<PreviewResult> {
    const previewId = `preview-${uuid()}`;
    const { manifest, formatSpec, input, outputFormat } = params;

    const renders: PreviewRender[] = formatSpec.renders.map((render) => {
      const renderId = `render-${uuid()}`;
      const baseUrl = `https://preview.adcontextprotocol.org/${previewId}/${renderId}`;

      return {
        render_id: renderId,
        output_format: outputFormat,
        preview_url: outputFormat !== 'html' ? baseUrl : undefined,
        preview_html:
          outputFormat !== 'url'
            ? this.generatePreviewHtml(manifest, render, input)
            : undefined,
        role: render.role,
        dimensions: render.dimensions,
      };
    });

    return {
      preview_id: previewId,
      renders,
      input: Object.keys(input).length > 0 ? input : undefined,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generatePlaceholderAsset(
    assetId: string,
    assetType: string,
    message?: string
  ): CreativeAsset {
    switch (assetType) {
      case 'image':
        return {
          url: `https://placeholder.adcontextprotocol.org/image/${assetId}`,
          width: 300,
          height: 250,
          format: 'png',
        };
      case 'video':
        return {
          url: `https://placeholder.adcontextprotocol.org/video/${assetId}`,
          width: 1920,
          height: 1080,
          duration_seconds: 30,
          format: 'mp4',
        };
      case 'text':
        return {
          content: message || `Placeholder text for ${assetId}`,
        };
      case 'url':
        return {
          url: 'https://example.com',
        };
      default:
        return {
          content: `Placeholder for ${assetId}`,
        };
    }
  }

  private generatePreviewHtml(
    manifest: CreativeManifest,
    render: { dimensions: { width: number; height: number } },
    input: PreviewInput
  ): string {
    const { width, height } = render.dimensions;

    // Simple HTML preview generation
    const headlines = Object.entries(manifest.assets)
      .filter(([_, asset]) => asset.content)
      .map(([_, asset]) => asset.content)
      .slice(0, 1);

    const images = Object.entries(manifest.assets)
      .filter(([_, asset]) => asset.url && asset.format?.match(/png|jpg|jpeg|gif/i))
      .map(([_, asset]) => asset.url)
      .slice(0, 1);

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    .ad-preview {
      width: ${width}px;
      height: ${height}px;
      border: 1px solid #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      background: #f5f5f5;
    }
    .ad-preview img {
      max-width: 100%;
      max-height: 80%;
    }
    .ad-preview h2 {
      margin: 10px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="ad-preview">
    ${images[0] ? `<img src="${images[0]}" alt="Ad" />` : ''}
    ${headlines[0] ? `<h2>${headlines[0]}</h2>` : ''}
    <small>Preview${input.name ? `: ${input.name}` : ''}</small>
  </div>
</body>
</html>
    `.trim();
  }

  private initializeMockData(): void {
    const specs: FormatSpecification[] = [
      {
        format_id: {
          agent_url: 'https://creative.adcontextprotocol.org',
          id: 'display_300x250',
        },
        name: 'Display 300x250',
        type: 'display',
        description: 'Standard IAB medium rectangle display ad',
        assets_required: [
          {
            asset_id: 'banner_image',
            asset_type: 'image',
            required: true,
            min_width: 300,
            max_width: 300,
            min_height: 250,
            max_height: 250,
            allowed_formats: ['png', 'jpg', 'gif'],
            max_file_size_bytes: 150000,
          },
          {
            asset_id: 'headline',
            asset_type: 'text',
            required: false,
            description: 'Optional headline overlay',
          },
          {
            asset_id: 'clickthrough_url',
            asset_type: 'url',
            required: true,
          },
        ],
        renders: [
          {
            render_id: 'primary',
            role: 'primary',
            dimensions: { width: 300, height: 250 },
          },
        ],
      },
      {
        format_id: {
          agent_url: 'https://creative.adcontextprotocol.org',
          id: 'display_728x90',
        },
        name: 'Display 728x90',
        type: 'display',
        description: 'Standard IAB leaderboard display ad',
        assets_required: [
          {
            asset_id: 'banner_image',
            asset_type: 'image',
            required: true,
            min_width: 728,
            max_width: 728,
            min_height: 90,
            max_height: 90,
            allowed_formats: ['png', 'jpg', 'gif'],
            max_file_size_bytes: 150000,
          },
          {
            asset_id: 'clickthrough_url',
            asset_type: 'url',
            required: true,
          },
        ],
        renders: [
          {
            render_id: 'primary',
            role: 'primary',
            dimensions: { width: 728, height: 90 },
          },
        ],
      },
      {
        format_id: {
          agent_url: 'https://creative.adcontextprotocol.org',
          id: 'video_15s',
        },
        name: 'Video 15s',
        type: 'video',
        description: '15-second video ad',
        assets_required: [
          {
            asset_id: 'video_file',
            asset_type: 'video',
            required: true,
            min_duration_seconds: 14,
            max_duration_seconds: 16,
            allowed_formats: ['mp4', 'webm'],
            max_file_size_bytes: 10000000,
          },
          {
            asset_id: 'companion_banner',
            asset_type: 'image',
            required: false,
            description: 'Optional companion banner',
          },
          {
            asset_id: 'clickthrough_url',
            asset_type: 'url',
            required: true,
          },
        ],
        renders: [
          {
            render_id: 'video',
            role: 'primary',
            dimensions: { width: 1920, height: 1080 },
          },
          {
            render_id: 'companion',
            role: 'companion',
            dimensions: { width: 300, height: 250 },
          },
        ],
      },
      {
        format_id: {
          agent_url: 'https://creative.adcontextprotocol.org',
          id: 'video_30s',
        },
        name: 'Video 30s',
        type: 'video',
        description: '30-second video ad',
        assets_required: [
          {
            asset_id: 'video_file',
            asset_type: 'video',
            required: true,
            min_duration_seconds: 29,
            max_duration_seconds: 31,
            allowed_formats: ['mp4', 'webm'],
            max_file_size_bytes: 20000000,
          },
          {
            asset_id: 'clickthrough_url',
            asset_type: 'url',
            required: true,
          },
        ],
        renders: [
          {
            render_id: 'video',
            role: 'primary',
            dimensions: { width: 1920, height: 1080 },
          },
        ],
      },
      {
        format_id: {
          agent_url: 'https://creative.adcontextprotocol.org',
          id: 'native_responsive',
        },
        name: 'Native Responsive',
        type: 'native',
        description: 'Responsive native ad unit',
        assets_required: [
          {
            asset_id: 'headline',
            asset_type: 'text',
            required: true,
            description: 'Main headline (max 50 chars)',
          },
          {
            asset_id: 'description',
            asset_type: 'text',
            required: true,
            description: 'Description text (max 150 chars)',
          },
          {
            asset_id: 'main_image',
            asset_type: 'image',
            required: true,
            min_width: 1200,
            allowed_formats: ['png', 'jpg'],
          },
          {
            asset_id: 'logo',
            asset_type: 'image',
            required: false,
            description: 'Brand logo',
          },
          {
            asset_id: 'clickthrough_url',
            asset_type: 'url',
            required: true,
          },
        ],
        renders: [
          {
            render_id: 'responsive',
            role: 'primary',
            dimensions: { width: 0, height: 0 },
            responsive: true,
            min_dimensions: { width: 300, height: 250 },
            max_dimensions: { width: 728, height: 400 },
          },
        ],
      },
    ];

    for (const spec of specs) {
      const key = `${spec.format_id.agent_url}:${spec.format_id.id}`;
      this.formatSpecs.set(key, spec);
    }
  }
}
