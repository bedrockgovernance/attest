/**
 * The Bedrock attestation client.
 *
 * @packageDocumentation
 */

import { BedrockApiError, BedrockError, BedrockValidationError } from './errors';
import { validateGeneration } from './validate';
import type { AttestResult, Generation } from './types';

/**
 * The subset of the Fetch API the client uses. The global `fetch`
 * (Node 18+) satisfies it; pass your own to run on another runtime or
 * to intercept requests in tests.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Options for constructing a {@link Bedrock} client. */
export interface BedrockOptions {
  /**
   * A Bedrock API key. Sent as the `x-bedrock-key` header on every
   * request; Bedrock resolves the firm from it.
   */
  apiKey: string;
  /**
   * Base URL of the Bedrock API. Defaults to the production API. A
   * trailing slash is trimmed.
   */
  baseUrl?: string;
  /** A custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: FetchLike;
}

const DEFAULT_BASE_URL = 'https://api.bedrockgovernance.com';

/**
 * Client for recording AI generations in the Bedrock advice ledger.
 *
 * @example
 * ```ts
 * import { Bedrock } from '@bedrockgovernance/attest';
 *
 * const bedrock = new Bedrock({ apiKey: process.env.BEDROCK_API_KEY! });
 *
 * const { generationId } = await bedrock.attest({
 *   correlationId: chatId,
 *   model: { provider: 'anthropic', name: 'claude-opus-4-8' },
 *   systemPrompt,
 *   messages,
 *   output: { content: draft, finishReason: 'stop' },
 * });
 * ```
 */
export class Bedrock {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;

  constructor(options: BedrockOptions) {
    if (options === null || typeof options !== 'object') {
      throw new BedrockValidationError('options is required');
    }
    if (typeof options.apiKey !== 'string' || options.apiKey.length === 0) {
      throw new BedrockValidationError('apiKey is required and must be a non-empty string');
    }

    const fetchImpl =
      options.fetch ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
    if (fetchImpl === undefined) {
      throw new BedrockError(
        'No fetch implementation found. Pass options.fetch or run on Node 18 or newer.',
      );
    }

    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#fetch = fetchImpl;
  }

  /**
   * Record a generation as an immutable ledger entry.
   *
   * The bundle is validated locally, then posted to `POST
   * /v1/generations`. On a non-2xx response a {@link BedrockApiError}
   * is thrown carrying the status and error code.
   *
   * @param generation - The generation bundle to record.
   * @returns The recorded generation's id, output hash and timestamp.
   * @throws {BedrockValidationError} If the bundle is invalid.
   * @throws {BedrockApiError} If the API responds with a non-2xx status.
   */
  async attest(generation: Generation): Promise<AttestResult> {
    validateGeneration(generation);

    const response = await this.#fetch(`${this.#baseUrl}/v1/generations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bedrock-key': this.#apiKey,
      },
      body: JSON.stringify(generation),
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    return (await response.json()) as AttestResult;
  }
}

/** Build a {@link BedrockApiError} from a failed response. */
async function toApiError(response: Response): Promise<BedrockApiError> {
  let code: string | null = null;
  let message = `Bedrock API request failed with status ${response.status}`;

  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === 'object') {
      const envelope = body as { error?: unknown; message?: unknown };
      if (typeof envelope.error === 'string') {
        code = envelope.error;
      }
      if (typeof envelope.message === 'string') {
        message = envelope.message;
      }
    }
  } catch {
    // Non-JSON error body; keep the status-based default message.
  }

  return new BedrockApiError(message, {
    status: response.status,
    code,
    requestId: response.headers.get('x-request-id'),
  });
}
