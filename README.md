# @bedrockgovernance/attest

> Record what an AI model was asked and what it produced, at the moment
> of generation, as an immutable entry in the
> [Bedrock](https://bedrockgovernance.com) advice ledger.

`@bedrockgovernance/attest` captures a **generation**, the event of a
model producing text that helps shape a piece of financial advice, and
notarises it into the firm's ledger. Where CRM integrations ingest the
*finished* advice document after it exists, attestation captures the
model call at its source: the system prompt, the conversation, the
retrieved context, the guardrails, and the output, hashed and chained
at the instant they are used.

The client has no runtime dependencies. The optional AI SDK middleware
lives in a separate entry point (`@bedrockgovernance/attest/ai-sdk`), so
importing the core never pulls in the AI SDK.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Install

```sh
npm install @bedrockgovernance/attest
```

## Quickstart

### Attest explicitly

Hand Bedrock the generation bundle yourself:

```ts
import { Bedrock } from '@bedrockgovernance/attest';

const bedrock = new Bedrock({ apiKey: process.env.BEDROCK_API_KEY! });

const { generationId } = await bedrock.attest({
  // A stable id you already hold that scopes this drafting
  // conversation, e.g. a chat or thread id. Reuse it on every
  // generation in the same conversation so they group together.
  correlationId: chatId,
  clientReference: 'CLI-41269355',
  adviser: { name: 'Jane Smith', fcaRef: 'JXS01234' },
  model: { provider: 'anthropic', name: 'claude-opus-4-8' },
  instructions,
  input,
  retrievedContext,
  output: { content: draft, finishReason: 'stop' },
});
```

Only `correlationId`, `model`, `input` and `output` are required.
`input` is what the model saw for this call: a single prompt string, or
the role-tagged messages sent. `instructions` (the system prompt) is
optional but worth including whenever your call has one. Everything else
is optional too, included when your pipeline has it.

### Attest automatically with the AI SDK

Wrap your model once and every `generateText` / `streamText` call is
notarised, with no change to your generation code:

```ts
import { wrapLanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { attestMiddleware } from '@bedrockgovernance/attest/ai-sdk';

const model = wrapLanguageModel({
  model: anthropic('claude-opus-4-8'),
  middleware: attestMiddleware({ bedrock, correlationId: chatId, adviser }),
});
```

The middleware posts the attestation in the background after the model
responds, so it never adds latency to the call. Attestation failures
are surfaced through an optional `onError` callback and never affect the
model result.

## Grouping generations

A single piece of advice is rarely one model call, and the calls are
often exploratory chat turns rather than drafts of the final document.
`correlationId` is how you group them: pass a stable id you already own
(a chat, thread, or case id) on every `attest()` call that belongs to
the same conversation. It does not need to be globally unique, only
stable across the conversation. Bedrock stitches conversations into a
piece of advice on the platform side, so the id does not have to survive
to review time.

## API

- `new Bedrock({ apiKey, baseUrl?, fetch? })` — construct a client. The
  `apiKey` is sent as the `x-bedrock-key` header. `baseUrl` defaults to
  the production API; `fetch` defaults to the global `fetch` (Node 18+).
- `bedrock.attest(generation)` — validate the bundle and record it via
  `POST /v1/generations`. Resolves to `{ generationId, correlationId,
  outputHash, recordedAt }`.
- `attestMiddleware(options)` (from `@bedrockgovernance/attest/ai-sdk`) —
  an AI SDK `LanguageModelV2Middleware` that attests every call.
- `validateGeneration(generation)` — the same local validation `attest`
  runs, exported for reuse.

**Errors:** `BedrockValidationError` (invalid bundle or config, thrown
before any request), `BedrockApiError` (non-2xx response, carrying
`status`, `code` and `requestId`), and their base `BedrockError`.

## License

[Apache 2.0](./LICENSE). See [`SECURITY.md`](./SECURITY.md) for
vulnerability reporting.
