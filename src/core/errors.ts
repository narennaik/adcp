/**
 * AdCP Error Handling
 *
 * Unified error types and error codes across all protocols.
 */

import type { ErrorDetail, WarningDetail, TaskStatus } from './types.js';

// ============================================================================
// Error Codes
// ============================================================================

// Authentication & Authorization
export const AUTH_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  PRINCIPAL_NOT_FOUND: 'PRINCIPAL_NOT_FOUND',
  DEPLOYMENT_UNAUTHORIZED: 'DEPLOYMENT_UNAUTHORIZED',
} as const;

// Signals Protocol Errors
export const SIGNALS_ERROR_CODES = {
  SIGNAL_AGENT_SEGMENT_NOT_FOUND: 'SIGNAL_AGENT_SEGMENT_NOT_FOUND',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_ACCESS_DENIED: 'AGENT_ACCESS_DENIED',
  ACTIVATION_FAILED: 'ACTIVATION_FAILED',
  ALREADY_ACTIVATED: 'ALREADY_ACTIVATED',
  INVALID_PRICING_MODEL: 'INVALID_PRICING_MODEL',
} as const;

// Signals Protocol Warnings
export const SIGNALS_WARNING_CODES = {
  PRICING_UNAVAILABLE: 'PRICING_UNAVAILABLE',
  PARTIAL_COVERAGE: 'PARTIAL_COVERAGE',
  STALE_DATA: 'STALE_DATA',
  SUBOPTIMAL_CONFIGURATION: 'SUBOPTIMAL_CONFIGURATION',
  SLOW_ACTIVATION: 'SLOW_ACTIVATION',
  FREQUENCY_CAP_RESTRICTIVE: 'FREQUENCY_CAP_RESTRICTIVE',
} as const;

// Media Buy Protocol Errors
export const MEDIA_BUY_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  FORMAT_INCOMPATIBLE: 'FORMAT_INCOMPATIBLE',
  BUDGET_INSUFFICIENT: 'BUDGET_INSUFFICIENT',
  TARGETING_TOO_NARROW: 'TARGETING_TOO_NARROW',
  POLICY_VIOLATION: 'POLICY_VIOLATION',
  INVALID_PRICING_OPTION: 'INVALID_PRICING_OPTION',
  MEDIA_BUY_NOT_FOUND: 'MEDIA_BUY_NOT_FOUND',
  PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
  CREATIVE_NOT_FOUND: 'CREATIVE_NOT_FOUND',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  CONTEXT_REQUIRED: 'CONTEXT_REQUIRED',
  INVALID_STATUS_FILTER: 'INVALID_STATUS_FILTER',
} as const;

// Creative Protocol Errors
export const CREATIVE_ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_FORMAT',
  FORMAT_NOT_FOUND: 'FORMAT_NOT_FOUND',
  ASSET_PROCESSING_FAILED: 'ASSET_PROCESSING_FAILED',
  BRAND_SAFETY_VIOLATION: 'BRAND_SAFETY_VIOLATION',
  FORMAT_MISMATCH: 'FORMAT_MISMATCH',
  MISSING_REQUIRED_ASSET: 'MISSING_REQUIRED_ASSET',
  INVALID_ASSET_TYPE: 'INVALID_ASSET_TYPE',
  ASSET_TOO_LARGE: 'ASSET_TOO_LARGE',
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',
  INVALID_DURATION: 'INVALID_DURATION',
  MANIFEST_VALIDATION_FAILED: 'MANIFEST_VALIDATION_FAILED',
} as const;

// General Errors
export const GENERAL_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

// All error codes
export const ERROR_CODES = {
  ...AUTH_ERROR_CODES,
  ...SIGNALS_ERROR_CODES,
  ...MEDIA_BUY_ERROR_CODES,
  ...CREATIVE_ERROR_CODES,
  ...GENERAL_ERROR_CODES,
} as const;

export const WARNING_CODES = {
  ...SIGNALS_WARNING_CODES,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export type WarningCode = (typeof WARNING_CODES)[keyof typeof WARNING_CODES];

// ============================================================================
// Error Classes
// ============================================================================

export class AdcpError extends Error {
  public readonly code: ErrorCode;
  public readonly field?: string;
  public readonly suggestion?: string;
  public readonly details?: ErrorDetail[];

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      field?: string;
      suggestion?: string;
      details?: ErrorDetail[];
    }
  ) {
    super(message);
    this.name = 'AdcpError';
    this.code = code;
    this.field = options?.field;
    this.suggestion = options?.suggestion;
    this.details = options?.details;
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      field: this.field,
      suggestion: this.suggestion,
    };
  }

  static fromErrorDetail(detail: ErrorDetail): AdcpError {
    return new AdcpError(detail.code as ErrorCode, detail.message, {
      field: detail.field,
      suggestion: detail.suggestion,
    });
  }
}

export class AuthenticationError extends AdcpError {
  constructor(message: string, options?: { field?: string; suggestion?: string }) {
    super('AUTH_REQUIRED', message, options);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AdcpError {
  constructor(message: string, options?: { field?: string; suggestion?: string }) {
    super('UNAUTHORIZED', message, options);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends AdcpError {
  constructor(
    message: string,
    field?: string,
    options?: { suggestion?: string; details?: ErrorDetail[] }
  ) {
    super('INVALID_REQUEST', message, { field, ...options });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AdcpError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { field?: string; suggestion?: string }
  ) {
    super(code, message, options);
    this.name = 'NotFoundError';
  }
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  status: 'failed';
  message: string;
  errors: ErrorDetail[];
  context_id?: string;
  task_id?: string;
}

export interface PartialSuccessResponse<T> {
  status: TaskStatus;
  message: string;
  data: T;
  errors?: ErrorDetail[];
  warnings?: WarningDetail[];
  context_id?: string;
  task_id?: string;
}

// ============================================================================
// Error Utilities
// ============================================================================

export function createErrorDetail(
  code: ErrorCode | string,
  message: string,
  options?: { field?: string; suggestion?: string }
): ErrorDetail {
  return {
    code,
    message,
    field: options?.field,
    suggestion: options?.suggestion,
  };
}

export function createWarningDetail(
  code: WarningCode | string,
  message: string,
  field?: string
): WarningDetail {
  return {
    code,
    message,
    field,
  };
}

export function createErrorResponse(
  errors: ErrorDetail[],
  options?: { message?: string; context_id?: string; task_id?: string }
): ErrorResponse {
  return {
    status: 'failed',
    message: options?.message || errors[0]?.message || 'An error occurred',
    errors,
    context_id: options?.context_id,
    task_id: options?.task_id,
  };
}

export function isAdcpError(error: unknown): error is AdcpError {
  return error instanceof AdcpError;
}

export function getHttpStatusForError(code: ErrorCode): number {
  switch (code) {
    case 'AUTH_REQUIRED':
    case 'AUTH_INVALID':
    case 'AUTH_EXPIRED':
      return 401;
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'DEPLOYMENT_UNAUTHORIZED':
    case 'AGENT_ACCESS_DENIED':
      return 403;
    case 'SIGNAL_AGENT_SEGMENT_NOT_FOUND':
    case 'AGENT_NOT_FOUND':
    case 'PRODUCT_NOT_FOUND':
    case 'MEDIA_BUY_NOT_FOUND':
    case 'PACKAGE_NOT_FOUND':
    case 'CREATIVE_NOT_FOUND':
    case 'PRINCIPAL_NOT_FOUND':
    case 'FORMAT_NOT_FOUND':
      return 404;
    case 'INVALID_REQUEST':
    case 'FORMAT_INCOMPATIBLE':
    case 'BUDGET_INSUFFICIENT':
    case 'TARGETING_TOO_NARROW':
    case 'POLICY_VIOLATION':
    case 'INVALID_PRICING_OPTION':
    case 'INVALID_DATE_RANGE':
    case 'CONTEXT_REQUIRED':
    case 'INVALID_STATUS_FILTER':
    case 'INVALID_FORMAT':
    case 'FORMAT_MISMATCH':
    case 'MISSING_REQUIRED_ASSET':
    case 'INVALID_ASSET_TYPE':
    case 'ASSET_TOO_LARGE':
    case 'INVALID_DIMENSIONS':
    case 'INVALID_DURATION':
    case 'MANIFEST_VALIDATION_FAILED':
    case 'INVALID_PRICING_MODEL':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    case 'TIMEOUT':
      return 504;
    case 'NOT_IMPLEMENTED':
      return 501;
    case 'ACTIVATION_FAILED':
    case 'ALREADY_ACTIVATED':
    case 'ASSET_PROCESSING_FAILED':
    case 'BRAND_SAFETY_VIOLATION':
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
