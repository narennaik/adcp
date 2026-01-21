/**
 * MCP Transport Types
 *
 * Type definitions for MCP (Model Context Protocol) transport layer.
 */

import type { TaskStatus, WebhookAuthentication, PushNotificationConfig } from '../../core/types.js';

// ============================================================================
// MCP Tool Call Types
// ============================================================================

export interface McpToolCall {
  /** Tool name (task name) */
  tool: string;

  /** Tool arguments */
  arguments: Record<string, unknown>;

  /** Optional context ID for session continuity */
  context_id?: string;
}

export interface McpToolResult {
  /** Task status */
  status: TaskStatus;

  /** Human-readable message */
  message: string;

  /** Context ID for session continuity */
  context_id: string;

  /** Task ID for async operations */
  task_id?: string;

  /** Task-specific result fields (flat structure) */
  [key: string]: unknown;
}

// ============================================================================
// MCP Server Types
// ============================================================================

export interface McpServerInfo {
  /** Server name */
  name: string;

  /** Server version */
  version: string;

  /** Server description */
  description?: string;

  /** AdCP extension info */
  adcp?: McpAdcpExtension;
}

export interface McpAdcpExtension {
  /** AdCP protocol version */
  protocol_version: string;

  /** Supported protocol domains */
  supported_domains: AdcpDomain[];

  /** Agent URL */
  agent_url: string;
}

export type AdcpDomain = 'signals' | 'media_buy' | 'creative' | 'curation';

// ============================================================================
// MCP Tool Definition Types
// ============================================================================

export interface McpToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema (JSON Schema) */
  inputSchema: McpJsonSchema;

  /** AdCP protocol domain */
  domain?: AdcpDomain;
}

export interface McpJsonSchema {
  type: 'object';
  properties: Record<string, McpPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface McpPropertySchema {
  type: string;
  description?: string;
  items?: McpPropertySchema;
  properties?: Record<string, McpPropertySchema>;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
}

// ============================================================================
// MCP Async Task Types
// ============================================================================

export interface McpTaskStatusRequest {
  /** Task ID to check */
  task_id: string;
}

export interface McpTaskStatusResponse {
  /** Task ID */
  task_id: string;

  /** Current status */
  status: TaskStatus;

  /** Status message */
  message: string;

  /** Progress percentage (0-100) */
  progress?: number;

  /** Result data (when completed) */
  result?: Record<string, unknown>;

  /** Error details (when failed) */
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// MCP Webhook Types
// ============================================================================

export interface McpWebhookPayload {
  /** Task ID */
  task_id: string;

  /** Current status */
  status: TaskStatus;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Optional context message */
  message?: string;

  /** Result data */
  result?: Record<string, unknown>;

  /** Context ID for session tracking */
  context_id?: string;
}

export interface McpWebhookConfig extends PushNotificationConfig {
  /** Events to send */
  events?: McpWebhookEvent[];
}

export type McpWebhookEvent =
  | 'status_change'
  | 'completed'
  | 'failed'
  | 'input_required';

// ============================================================================
// MCP Session Types
// ============================================================================

export interface McpSession {
  /** Session ID */
  session_id: string;

  /** Context ID */
  context_id: string;

  /** Created timestamp */
  created_at: string;

  /** Expires timestamp */
  expires_at: string;

  /** Active tasks */
  active_tasks: string[];

  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MCP Request/Response Envelope
// ============================================================================

export interface McpRequest {
  /** JSON-RPC version */
  jsonrpc: '2.0';

  /** Request ID */
  id: string | number;

  /** Method name */
  method: string;

  /** Parameters */
  params?: Record<string, unknown>;
}

export interface McpResponse {
  /** JSON-RPC version */
  jsonrpc: '2.0';

  /** Request ID */
  id: string | number;

  /** Result (on success) */
  result?: unknown;

  /** Error (on failure) */
  error?: McpError;
}

export interface McpError {
  /** Error code */
  code: number;

  /** Error message */
  message: string;

  /** Additional data */
  data?: unknown;
}

// MCP Standard Error Codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom AdCP error codes
  ADCP_AUTH_ERROR: -32000,
  ADCP_VALIDATION_ERROR: -32001,
  ADCP_TASK_ERROR: -32002,
} as const;
