/**
 * AI SDK middleware that notarises every model call automatically.
 *
 * Wrap a language model with {@link attestMiddleware} and each
 * `generateText` / `streamText` call records a generation, with no
 * change to your generation code. The attestation is posted in the
 * background after the model responds, so it never adds latency.
 *
 * @packageDocumentation
 */

import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Middleware,
} from '@ai-sdk/provider';

import type { Bedrock } from './client';
import type { Adviser, Generation, GenerationOutput, Message, ModelDescriptor } from './types';

/** Options for {@link attestMiddleware}. */
export interface AttestMiddlewareOptions {
  /** The Bedrock client the attestation is posted through. */
  bedrock: Bedrock;
  /**
   * A stable identifier scoping this drafting conversation, applied to
   * every generation the wrapped model produces. See
   * {@link Generation.correlationId}.
   */
  correlationId: string;
  /** The CRM client identifier, when known. */
  clientReference?: string;
  /** The document identifier, on the rare occasion it is known upfront. */
  documentReference?: string;
  /** The responsible individual. */
  adviser?: Adviser;
  /**
   * Called if the background attestation fails. The wrapped model call
   * itself always succeeds regardless; use this to log or alert. When
   * omitted, failures are logged with `console.warn` so they stay
   * discoverable.
   */
  onError?: (error: unknown) => void;
}

/** A content part carrying text, in either a prompt message or a result. */
interface TextPart {
  type: string;
  text?: unknown;
}

/** A tool-call content part in a generation result. */
interface ToolCallPart {
  type: string;
  toolCallId?: unknown;
  toolName?: unknown;
  input?: unknown;
}

/**
 * Build the AI SDK middleware.
 *
 * @param options - The Bedrock client and the metadata to attach to
 *   every generation.
 * @returns A `LanguageModelV2Middleware` to pass to `wrapLanguageModel`.
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from 'ai';
 * import { anthropic } from '@ai-sdk/anthropic';
 * import { attestMiddleware } from '@bedrockgovernance/attest/ai-sdk';
 *
 * const model = wrapLanguageModel({
 *   model: anthropic('claude-opus-4-8'),
 *   middleware: attestMiddleware({ bedrock, correlationId, adviser }),
 * });
 * ```
 */
export function attestMiddleware(options: AttestMiddlewareOptions): LanguageModelV2Middleware {
  return {
    middlewareVersion: 'v2',
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const result = await doGenerate();
      const onErrorHandler = options.onError ?? ((error: unknown) => {
        // Default: warn so attestation failures are discoverable by default.
        // eslint-disable-next-line no-console
        console.warn('attest: background attestation failed', error);
      });
      options.bedrock
        .attest(buildGeneration(options, params, model, result))
        .catch(onErrorHandler);
      return result;
    },
  };
}

/** Concatenate the text of every `text` part in a content array. */
function collectText(parts: readonly unknown[]): string {
  let text = '';
  for (const part of parts) {
    const candidate = part as TextPart;
    if (candidate.type === 'text' && typeof candidate.text === 'string') {
      text += candidate.text;
    }
  }
  return text;
}

/** Map the model's decoding parameters into a {@link ModelDescriptor}. */
function toModelDescriptor(
  model: LanguageModelV2,
  params: LanguageModelV2CallOptions,
): ModelDescriptor {
  const parameters: Record<string, unknown> = {};
  if (params.temperature !== undefined) {
    parameters.temperature = params.temperature;
  }
  if (params.maxOutputTokens !== undefined) {
    parameters.maxTokens = params.maxOutputTokens;
  }

  const descriptor: ModelDescriptor = { provider: model.provider, name: model.modelId };
  if (Object.keys(parameters).length > 0) {
    descriptor.parameters = parameters;
  }
  return descriptor;
}

/** Split the AI SDK prompt into system instructions and the input messages. */
function toPrompt(params: LanguageModelV2CallOptions): {
  instructions?: string;
  input: Message[];
} {
  const systemParts: string[] = [];
  const input: Message[] = [];

  for (const message of params.prompt) {
    if (message.role === 'system') {
      systemParts.push(message.content);
    } else {
      input.push({
        role: message.role,
        content: collectText(message.content as readonly unknown[]),
      });
    }
  }

  const prompt: { instructions?: string; input: Message[] } = { input };
  if (systemParts.length > 0) {
    prompt.instructions = systemParts.join('\n\n');
  }
  return prompt;
}

/** Build a {@link GenerationOutput} from the model's result. */
function toOutput(result: Awaited<ReturnType<LanguageModelV2['doGenerate']>>): GenerationOutput {
  const output: GenerationOutput = {
    content: collectText(result.content),
    finishReason: result.finishReason,
  };

  const toolCalls: Array<{ toolCallId: unknown; toolName: unknown; input: unknown }> = [];
  for (const part of result.content) {
    const candidate = part as ToolCallPart;
    if (candidate.type === 'tool-call') {
      toolCalls.push({
        toolCallId: candidate.toolCallId,
        toolName: candidate.toolName,
        input: candidate.input,
      });
    }
  }
  if (toolCalls.length > 0) {
    output.toolCalls = toolCalls;
  }

  return output;
}

/** Assemble a {@link Generation} from the middleware inputs. */
function buildGeneration(
  options: AttestMiddlewareOptions,
  params: LanguageModelV2CallOptions,
  model: LanguageModelV2,
  result: Awaited<ReturnType<LanguageModelV2['doGenerate']>>,
): Generation {
  const { instructions, input } = toPrompt(params);

  const generation: Generation = {
    correlationId: options.correlationId,
    clientReference: options.clientReference,
    documentReference: options.documentReference,
    adviser: options.adviser,
    model: toModelDescriptor(model, params),
    input,
    output: toOutput(result),
  };

  if (instructions !== undefined) {
    generation.instructions = instructions;
  }

  if (result.usage.inputTokens !== undefined && result.usage.outputTokens !== undefined) {
    generation.usage = {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    };
  }

  return generation;
}
