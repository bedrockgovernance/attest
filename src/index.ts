/**
 * `@bedrockgovernance/attest` -- record what an AI model was asked and
 * what it produced, at the moment of generation, as an immutable entry
 * in the Bedrock advice ledger.
 *
 * The AI SDK middleware lives in a separate entry point,
 * `@bedrockgovernance/attest/ai-sdk`, so this module has no dependency
 * on the AI SDK.
 *
 * @packageDocumentation
 */

export { Bedrock, type BedrockOptions, type FetchLike } from './client';
export {
  BedrockError,
  BedrockValidationError,
  BedrockApiError,
  type BedrockApiErrorDetail,
} from './errors';
export { validateGeneration } from './validate';
export {
  type Adviser,
  type AttestResult,
  type Generation,
  type GenerationOutput,
  type Guardrail,
  type Message,
  type MessageRole,
  type ModelDescriptor,
  type PromptTemplate,
  type RetrievedContext,
  type Usage,
} from './types';
