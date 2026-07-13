/**
 * Type definitions for the Bedrock attestation SDK.
 *
 * @packageDocumentation
 */

/** The model that produced a generation. */
export interface ModelDescriptor {
  /** Provider slug, e.g. `anthropic`, `openai`, `google`. */
  provider: string;
  /**
   * Exact model name. Pin the specific name and version, not a moving
   * alias, so drift detection stays meaningful.
   */
  name: string;
  /** Model version, when the provider exposes one separately from `name`. */
  version?: string;
  /** Decoding parameters in effect for the call, e.g. `temperature`, `maxTokens`. */
  parameters?: Record<string, unknown>;
}

/** Role of a message in the model input. */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single role-tagged item in the model input, captured verbatim. */
export interface Message {
  /** Who authored the message. */
  role: MessageRole;
  /** The message text, exactly as sent to the model. */
  content: string;
}

/** The responsible individual under SM&CR, recorded as the ledger actor. */
export interface Adviser {
  /** Full name of the adviser. */
  name: string;
  /** The adviser's FCA reference number. */
  fcaRef: string;
}

/** What the model produced. */
export interface GenerationOutput {
  /** The generated content, verbatim. */
  content: string;
  /** Why the model stopped, e.g. `stop`, `length`, `tool-calls`. */
  finishReason?: string;
  /** Tool or function calls the model emitted, when applicable. */
  toolCalls?: unknown[];
}

/** The template that rendered the prompt, when one is used. */
export interface PromptTemplate {
  /** Stable template identifier. */
  id: string;
  /** Template version. */
  version: string;
  /** Hash of the rendered template. */
  hash: string;
}

/** A grounding document supplied to the model. */
export interface RetrievedContext {
  /** Where the context came from, e.g. `intelliflo:factfind`. */
  source: string;
  /** Identifier of the source document, when stored by reference. */
  reference?: string;
  /** Hash of the context content, so it is provable even when stored by reference. */
  hash: string;
  /** The context content inline. Omit for large corpora and rely on `hash`. */
  content?: string;
}

/** A rule evaluated during generation. */
export interface Guardrail {
  /** Rule identifier, e.g. `MAX_EQUITY_ALLOCATION`. */
  rule: string;
  /** Whether the rule fired. */
  triggered: boolean;
  /** Action taken when the rule fired, e.g. `flagged_for_review`. */
  action?: string;
}

/** Token counts reported for the generation. */
export interface Usage {
  /** Input (prompt) tokens consumed. */
  inputTokens: number;
  /** Output (completion) tokens produced. */
  outputTokens: number;
}

/**
 * The generation bundle passed to {@link Bedrock.attest}.
 *
 * Only `correlationId`, `model`, `instructions`, `input` and
 * `output` are required. Everything else is optional, included when
 * your pipeline has it.
 */
export interface Generation {
  /**
   * A stable identifier you already hold that scopes one drafting
   * conversation, e.g. a chat or thread id. Reuse it on every
   * generation in that conversation so Bedrock can group them. A single
   * piece of advice may span several conversations, each with its own
   * id. It need not be globally unique, only stable across the
   * conversation, and it does not have to survive to review time.
   */
  correlationId: string;
  /** The model that produced this generation. */
  model: ModelDescriptor;
  /**
   * The model input for this call: either a single prompt string, or
   * the role-tagged messages sent, in order, verbatim. This is what the
   * model saw for this one call, which may be a single message and need
   * not be a conversation.
   */
  input: string | Message[];
  /** What the model produced. */
  output: GenerationOutput;
  /**
   * System-level instructions the model was given, exactly as sent.
   * Optional, but governance-critical: capture it whenever your call
   * has one.
   */
  instructions?: string;
  /** The responsible individual. When omitted, the record is attributed to the firm credential. */
  adviser?: Adviser;
  /** The CRM client identifier, when your tool has it. */
  clientReference?: string;
  /** The document identifier, on the rare occasion it is known at generation time. */
  documentReference?: string;
  /** `generationId` of a prior generation this one revises, giving an explicit lineage. */
  supersedes?: string;
  /** The template that rendered the prompt, if you use one. */
  promptTemplate?: PromptTemplate;
  /** Grounding documents given to the model. */
  retrievedContext?: RetrievedContext[];
  /** Tool or function definitions the model could call, verbatim. */
  tools?: unknown[];
  /** Rules evaluated during generation. */
  guardrails?: Guardrail[];
  /** Token counts. */
  usage?: Usage;
}

/** The result of a successful {@link Bedrock.attest} call. */
export interface AttestResult {
  /** Identifier of the generation just recorded. */
  generationId: string;
  /** The `correlationId` echoed back from the request. */
  correlationId: string;
  /** SHA-256 of the canonicalised output, stamped by Bedrock. */
  outputHash: string;
  /** ISO 8601 timestamp at which the generation was recorded. */
  recordedAt: string;
}
