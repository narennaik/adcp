/**
 * A2A Transport Types
 *
 * Type definitions for A2A (Agent-to-Agent) protocol transport layer.
 */

import type { TaskStatus, WebhookAuthentication } from '../../core/types.js';

// ============================================================================
// A2A Message Parts
// ============================================================================

export interface TextPart {
  type: 'text';
  text: string;
}

export interface DataPart {
  type: 'data';
  data: Record<string, unknown>;
  mimeType?: string;
}

export interface FilePart {
  type: 'file';
  uri: string;
  mimeType?: string;
  name?: string;
}

export type MessagePart = TextPart | DataPart | FilePart;

// ============================================================================
// A2A Messages
// ============================================================================

export interface A2aMessage {
  role: 'user' | 'agent';
  parts: MessagePart[];
  metadata?: A2aMessageMetadata;
}

export interface A2aMessageMetadata {
  timestamp?: string;
  message_id?: string;
  correlation_id?: string;
}

// ============================================================================
// A2A Artifacts
// ============================================================================

export interface A2aArtifact {
  type: 'artifact';
  name?: string;
  parts: MessagePart[];
  metadata?: A2aArtifactMetadata;
}

export interface A2aArtifactMetadata {
  artifact_id?: string;
  created_at?: string;
  version?: string;
}

// ============================================================================
// A2A Task Types
// ============================================================================

export interface A2aTask {
  id: string;
  status: A2aTaskStatus;
  messages: A2aMessage[];
  artifacts?: A2aArtifact[];
  created_at: string;
  updated_at: string;
  metadata?: A2aTaskMetadata;
}

export interface A2aTaskStatus {
  state: TaskStatus;
  message?: string;
  progress?: number;
  timestamp: string;
}

export interface A2aTaskMetadata {
  skill?: string;
  principal_id?: string;
  context_id?: string;
}

// ============================================================================
// A2A Request/Response Types
// ============================================================================

export interface A2aTaskRequest {
  /** Skill to invoke */
  skill?: string;

  /** Message parts */
  parts: MessagePart[];

  /** Task metadata */
  metadata?: A2aTaskRequestMetadata;

  /** Webhook for status updates */
  webhook?: A2aWebhookConfig;
}

export interface A2aTaskRequestMetadata {
  /** Correlation ID for tracking */
  correlation_id?: string;

  /** Context ID for session continuity */
  context_id?: string;

  /** Principal ID for authorization */
  principal_id?: string;
}

export interface A2aTaskResponse {
  /** Task ID */
  task_id: string;

  /** Current status */
  status: A2aTaskStatus;

  /** Response messages */
  messages?: A2aMessage[];

  /** Generated artifacts */
  artifacts?: A2aArtifact[];
}

// ============================================================================
// A2A Webhook Types
// ============================================================================

export interface A2aWebhookConfig {
  /** Webhook URL */
  url: string;

  /** Authentication */
  authentication?: WebhookAuthentication;

  /** Events to send */
  events?: A2aWebhookEvent[];
}

export type A2aWebhookEvent =
  | 'status_change'
  | 'completed'
  | 'failed'
  | 'input_required'
  | 'artifact_created';

export interface A2aWebhookPayload {
  /** Task ID */
  task_id: string;

  /** Event type */
  event: A2aWebhookEvent;

  /** Task status */
  status: A2aTaskStatus;

  /** Timestamp */
  timestamp: string;

  /** Event-specific data */
  data?: Record<string, unknown>;
}

/**
 * Webhook payload type enumeration per A2A spec
 */
export type A2aWebhookPayloadType = 'Task' | 'TaskStatusUpdateEvent' | 'TaskArtifactUpdateEvent';

/**
 * Task webhook payload - sent for final states (completed, failed, canceled)
 * Contains complete task with all artifacts
 */
export interface A2aTaskWebhookPayload {
  type: 'Task';
  task: A2aTaskResponse;
  timestamp: string;
}

/**
 * Status update webhook payload - sent for interim transitions
 * Lightweight payload for status changes
 */
export interface A2aTaskStatusUpdateEvent {
  type: 'TaskStatusUpdateEvent';
  task_id: string;
  status: A2aTaskStatus;
  timestamp: string;
  context_id?: string;
}

/**
 * Artifact update webhook payload - sent for streaming artifact updates
 * Contains partial artifact data
 */
export interface A2aTaskArtifactUpdateEvent {
  type: 'TaskArtifactUpdateEvent';
  task_id: string;
  artifact: A2aArtifact;
  /** Whether this is the final artifact update */
  is_final: boolean;
  /** Index of the artifact (for ordering) */
  index?: number;
  timestamp: string;
}

/**
 * Union type for all A2A webhook payload types
 */
export type A2aTypedWebhookPayload =
  | A2aTaskWebhookPayload
  | A2aTaskStatusUpdateEvent
  | A2aTaskArtifactUpdateEvent;

// ============================================================================
// A2A SSE Types
// ============================================================================

export type SseEventType =
  | 'status'
  | 'message'
  | 'artifact'
  | 'progress'
  | 'error'
  | 'complete';

export interface SseEvent {
  type: SseEventType;
  data: unknown;
  timestamp: string;
}

export interface SseStatusEvent extends SseEvent {
  type: 'status';
  data: A2aTaskStatus;
}

export interface SseMessageEvent extends SseEvent {
  type: 'message';
  data: A2aMessage;
}

export interface SseArtifactEvent extends SseEvent {
  type: 'artifact';
  data: A2aArtifact;
}

export interface SseProgressEvent extends SseEvent {
  type: 'progress';
  data: {
    progress: number;
    message?: string;
  };
}

export interface SseErrorEvent extends SseEvent {
  type: 'error';
  data: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SseCompleteEvent extends SseEvent {
  type: 'complete';
  data: A2aTaskResponse;
}

// ============================================================================
// A2A Agent Card Types
// ============================================================================

export interface A2aAgentCard {
  /** Agent name */
  name: string;

  /** Agent description */
  description?: string;

  /** Agent URL */
  url: string;

  /** Agent version */
  version?: string;

  /** Supported skills */
  skills: A2aSkill[];

  /** AdCP extension */
  extensions?: {
    adcp?: A2aAdcpExtension;
  };

  /** Authentication requirements */
  authentication?: A2aAuthRequirements;
}

export interface A2aSkill {
  /** Skill name */
  name: string;

  /** Skill description */
  description: string;

  /** Example prompts */
  examples?: string[];

  /** Input schema */
  inputSchema?: Record<string, unknown>;

  /** Output schema */
  outputSchema?: Record<string, unknown>;
}

export interface A2aAdcpExtension {
  /** Protocol version */
  protocol_version: string;

  /** Supported domains */
  domains: string[];

  /** Agent type */
  agent_type: 'signal_agent' | 'sales_agent' | 'creative_agent';
}

export interface A2aAuthRequirements {
  /** Required authentication schemes */
  schemes: ('bearer' | 'oauth2' | 'api_key')[];

  /** OAuth2 configuration */
  oauth2?: {
    authorization_url: string;
    token_url: string;
    scopes: string[];
  };
}

// ============================================================================
// A2A Skill Invocation Types
// ============================================================================

export interface A2aSkillInvocation {
  /** Skill name */
  skill: string;

  /** Skill parameters (DataPart) */
  parameters: Record<string, unknown>;

  /** Natural language context (TextPart) */
  context?: string;

  /** File references (FilePart) */
  files?: Array<{
    uri: string;
    mimeType?: string;
    name?: string;
  }>;
}

// ============================================================================
// A2A Error Types
// ============================================================================

export interface A2aError {
  code: string;
  message: string;
  details?: unknown;
}

export const A2A_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
