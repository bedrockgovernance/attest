/**
 * Runtime validation of the generation bundle.
 *
 * Only the required fields are checked at runtime; optional fields are
 * left to the type system. The goal is a clear, early error instead of
 * a rejected HTTP request when a mandatory field is missing.
 *
 * @packageDocumentation
 */

import { BedrockValidationError } from './errors';
import type { Generation, MessageRole } from './types';

const MESSAGE_ROLES: ReadonlySet<MessageRole> = new Set<MessageRole>([
  'system',
  'user',
  'assistant',
  'tool',
]);

/** Assert a value is a non-empty string, throwing otherwise. */
function requireNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BedrockValidationError(`${field} is required and must be a non-empty string`);
  }
}

/** Assert a value is a string (empty allowed), throwing otherwise. */
function requireString(value: unknown, field: string): void {
  if (typeof value !== 'string') {
    throw new BedrockValidationError(`${field} is required and must be a string`);
  }
}

/**
 * Validate a generation bundle before it is sent.
 *
 * @param generation - The bundle to validate.
 * @throws {BedrockValidationError} If a required field is missing or of
 *   the wrong type.
 */
export function validateGeneration(generation: Generation): void {
  if (generation === null || typeof generation !== 'object') {
    throw new BedrockValidationError('generation is required and must be an object');
  }

  requireNonEmptyString(generation.correlationId, 'correlationId');

  if (generation.model === null || typeof generation.model !== 'object') {
    throw new BedrockValidationError('model is required and must be an object');
  }
  requireNonEmptyString(generation.model.provider, 'model.provider');
  requireNonEmptyString(generation.model.name, 'model.name');

  if (generation.instructions !== undefined && typeof generation.instructions !== 'string') {
    throw new BedrockValidationError('instructions must be a string when provided');
  }

  validateInput(generation.input);

  if (generation.output === null || typeof generation.output !== 'object') {
    throw new BedrockValidationError('output is required and must be an object');
  }
  requireString(generation.output.content, 'output.content');
}

/** Validate the `input` field: a non-empty string, or a non-empty array of messages. */
function validateInput(input: unknown): void {
  if (typeof input === 'string') {
    if (input.length === 0) {
      throw new BedrockValidationError('input must be a non-empty string or a non-empty array of messages');
    }
    return;
  }

  if (!Array.isArray(input) || input.length === 0) {
    throw new BedrockValidationError('input must be a non-empty string or a non-empty array of messages');
  }

  input.forEach((message, index) => {
    if (message === null || typeof message !== 'object') {
      throw new BedrockValidationError(`input[${index}] must be an object`);
    }
    if (!MESSAGE_ROLES.has(message.role)) {
      throw new BedrockValidationError(
        `input[${index}].role must be one of system, user, assistant, tool`,
      );
    }
    requireString(message.content, `input[${index}].content`);
  });
}
