/**
 * Error types thrown by the Bedrock attestation SDK.
 *
 * @packageDocumentation
 */

/** Base class for every error the SDK throws. */
export class BedrockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BedrockError';
  }
}

/**
 * Thrown before any request is made when a generation bundle, or the
 * client configuration, is structurally invalid.
 */
export class BedrockValidationError extends BedrockError {
  constructor(message: string) {
    super(message);
    this.name = 'BedrockValidationError';
  }
}

/** Structured detail for a {@link BedrockApiError}. */
export interface BedrockApiErrorDetail {
  /** HTTP status code of the failed response. */
  status: number;
  /** Machine-readable error code from the response envelope, or `null`. */
  code: string | null;
  /** Request identifier from the `x-request-id` response header, or `null`. */
  requestId: string | null;
}

/** Thrown when the Bedrock API responds with a non-2xx status. */
export class BedrockApiError extends BedrockError {
  /** HTTP status code of the failed response. */
  readonly status: number;
  /** Machine-readable error code from the response envelope, or `null`. */
  readonly code: string | null;
  /** Request identifier from the `x-request-id` response header, or `null`. */
  readonly requestId: string | null;

  constructor(message: string, detail: BedrockApiErrorDetail) {
    super(message);
    this.name = 'BedrockApiError';
    this.status = detail.status;
    this.code = detail.code;
    this.requestId = detail.requestId;
  }
}
