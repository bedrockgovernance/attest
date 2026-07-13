import { describe, it, expect, vi } from 'vitest';
import { attestMiddleware } from '../src/ai-sdk';
import type { Bedrock } from '../src/client';
import type { Generation } from '../src/types';

/** Flush pending microtasks so the fire-and-forget attest settles. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function stubBedrock(attest = vi.fn().mockResolvedValue(undefined)): {
  bedrock: Bedrock;
  attest: typeof attest;
} {
  return { bedrock: { attest } as unknown as Bedrock, attest };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(mw: ReturnType<typeof attestMiddleware>, opts: any): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return (mw.wrapGenerate as unknown as (o: any) => Promise<unknown>)(opts);
}

const MODEL = { provider: 'anthropic', modelId: 'claude-opus-4-8' };

describe('attestMiddleware', () => {
  it('is a v2 middleware exposing wrapGenerate', () => {
    const { bedrock } = stubBedrock();
    const mw = attestMiddleware({ bedrock, correlationId: 'chat-1' });
    expect(mw.middlewareVersion).toBe('v2');
    expect(typeof mw.wrapGenerate).toBe('function');
  });

  it('records a fully mapped generation and returns the model result unchanged', async () => {
    const { bedrock, attest } = stubBedrock();
    const mw = attestMiddleware({
      bedrock,
      correlationId: 'chat-1',
      clientReference: 'CLI-1',
      documentReference: 'DOC-1',
      adviser: { name: 'Jane Smith', fcaRef: 'JXS01234' },
    });

    const result = {
      content: [
        { type: 'text', text: 'Answer' },
        { type: 'tool-call', toolCallId: 't1', toolName: 'lookup', input: '{}' },
      ],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    const params = {
      temperature: 0.2,
      maxOutputTokens: 4096,
      prompt: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }, { type: 'file', data: 'x' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hi' }, { type: 'text' }] },
      ],
    };

    const returned = await run(mw, { doGenerate: () => Promise.resolve(result), params, model: MODEL });
    expect(returned).toBe(result);

    const generation = attest.mock.calls[0]![0] as Generation;
    expect(generation).toEqual({
      correlationId: 'chat-1',
      clientReference: 'CLI-1',
      documentReference: 'DOC-1',
      adviser: { name: 'Jane Smith', fcaRef: 'JXS01234' },
      model: {
        provider: 'anthropic',
        name: 'claude-opus-4-8',
        parameters: { temperature: 0.2, maxTokens: 4096 },
      },
      instructions: 'You are helpful.',
      input: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ],
      output: {
        content: 'Answer',
        finishReason: 'stop',
        toolCalls: [{ toolCallId: 't1', toolName: 'lookup', input: '{}' }],
      },
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it('omits parameters, usage and toolCalls when absent', async () => {
    const { bedrock, attest } = stubBedrock();
    const mw = attestMiddleware({ bedrock, correlationId: 'chat-2' });

    const result = {
      content: [{ type: 'text', text: 'Answer' }],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: undefined },
    };
    const params = { prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }] };

    await run(mw, { doGenerate: () => Promise.resolve(result), params, model: MODEL });

    const generation = attest.mock.calls[0]![0] as Generation;
    expect(generation.model.parameters).toBeUndefined();
    expect(generation.usage).toBeUndefined();
    expect(generation.output.toolCalls).toBeUndefined();
    expect(generation.instructions).toBeUndefined();
    expect(generation.input).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('reports background attestation failures through onError', async () => {
    const failure = new Error('network down');
    const { bedrock } = stubBedrock(vi.fn().mockRejectedValue(failure));
    const onError = vi.fn();
    const mw = attestMiddleware({ bedrock, correlationId: 'chat-3', onError });

    const params = { prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }] };
    const result = { content: [], finishReason: 'stop', usage: {} };
    await run(mw, { doGenerate: () => Promise.resolve(result), params, model: MODEL });
    await flush();

    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('swallows attestation failures when no onError is given', async () => {
    const { bedrock } = stubBedrock(vi.fn().mockRejectedValue(new Error('nope')));
    const mw = attestMiddleware({ bedrock, correlationId: 'chat-4' });

    const params = { prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }] };
    const result = { content: [], finishReason: 'stop', usage: {} };
    await expect(
      run(mw, { doGenerate: () => Promise.resolve(result), params, model: MODEL }),
    ).resolves.toBe(result);
    await flush();
  });
});
