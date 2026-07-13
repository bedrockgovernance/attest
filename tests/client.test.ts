import { describe, it, expect, vi, afterEach } from 'vitest';
import { Bedrock, type FetchLike } from '../src/client';
import { BedrockApiError, BedrockError, BedrockValidationError } from '../src/errors';
import type { AttestResult, Generation } from '../src/types';

function validGeneration(): Generation {
  return {
    correlationId: 'chat-123',
    model: { provider: 'anthropic', name: 'claude-opus-4-8' },
    instructions: 'You are helpful.',
    input: [{ role: 'user', content: 'Hello' }],
    output: { content: 'Hi', finishReason: 'stop' },
  };
}

const RESULT: AttestResult = {
  generationId: 'gen-1',
  correlationId: 'chat-123',
  outputHash: 'sha256:abc',
  recordedAt: '2026-07-13T00:00:00.000Z',
};

function okResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Bedrock constructor', () => {
  it('rejects a non-object options', () => {
    expect(() => new Bedrock(null as never)).toThrow(BedrockValidationError);
  });

  it('rejects a missing apiKey', () => {
    expect(() => new Bedrock({ apiKey: '' })).toThrow(/apiKey is required/);
    expect(() => new Bedrock({ apiKey: 123 as unknown as string })).toThrow(BedrockValidationError);
  });

  it('throws when no fetch implementation is available', () => {
    const saved = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      expect(() => new Bedrock({ apiKey: 'key' })).toThrow(BedrockError);
      expect(() => new Bedrock({ apiKey: 'key' })).toThrow(/No fetch implementation/);
    } finally {
      globalThis.fetch = saved;
    }
  });

  it('uses the global fetch by default', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(RESULT));
    const bedrock = new Bedrock({ apiKey: 'key' });
    await bedrock.attest(validGeneration());
    expect(spy).toHaveBeenCalledWith(
      'https://api.bedrockgovernance.com/v1/generations',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('Bedrock.attest', () => {
  it('validates before sending', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>();
    const bedrock = new Bedrock({ apiKey: 'key', fetch: fetchMock });
    await expect(
      bedrock.attest({ ...validGeneration(), correlationId: '' }),
    ).rejects.toBeInstanceOf(BedrockValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the generations endpoint with auth and body, and returns the result', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      okResponse(RESULT),
    );
    const bedrock = new Bedrock({ apiKey: 'bk_test_secret', fetch: fetchMock });

    const generation = validGeneration();
    const result = await bedrock.attest(generation);

    expect(result).toEqual(RESULT);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.bedrockgovernance.com/v1/generations');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      'x-bedrock-key': 'bk_test_secret',
    });
    expect(JSON.parse(init.body as string)).toEqual(generation);
  });

  it('trims a trailing slash from a custom baseUrl', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      okResponse(RESULT),
    );
    const bedrock = new Bedrock({
      apiKey: 'key',
      baseUrl: 'https://api.sandbox.bedrockgovernance.com/',
      fetch: fetchMock,
    });
    await bedrock.attest(validGeneration());
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api.sandbox.bedrockgovernance.com/v1/generations',
    );
  });

  it('throws a BedrockApiError from a structured error envelope', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'API key has been revoked', error: 'API_KEY_REVOKED' }), {
        status: 401,
        headers: { 'x-request-id': 'req-9' },
      }),
    );
    const bedrock = new Bedrock({ apiKey: 'key', fetch: fetchMock });

    await expect(bedrock.attest(validGeneration())).rejects.toMatchObject({
      name: 'BedrockApiError',
      status: 401,
      code: 'API_KEY_REVOKED',
      message: 'API key has been revoked',
      requestId: 'req-9',
    });
  });

  it('falls back to a default message when the envelope lacks fields', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    const bedrock = new Bedrock({ apiKey: 'key', fetch: fetchMock });

    const error = await bedrock.attest(validGeneration()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BedrockApiError);
    expect((error as BedrockApiError).status).toBe(500);
    expect((error as BedrockApiError).code).toBeNull();
    expect((error as BedrockApiError).requestId).toBeNull();
    expect((error as BedrockApiError).message).toBe('Bedrock API request failed with status 500');
  });

  it('handles a non-object JSON error body', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      new Response(JSON.stringify('teapot'), { status: 418 }),
    );
    const bedrock = new Bedrock({ apiKey: 'key', fetch: fetchMock });
    await expect(bedrock.attest(validGeneration())).rejects.toMatchObject({
      status: 418,
      code: null,
      message: 'Bedrock API request failed with status 418',
    });
  });

  it('handles a null JSON error body', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      new Response(JSON.stringify(null), { status: 503 }),
    );
    const bedrock = new Bedrock({ apiKey: 'key', fetch: fetchMock });
    await expect(bedrock.attest(validGeneration())).rejects.toMatchObject({ status: 503, code: null });
  });

  it('handles a non-JSON error body', async () => {
    const fetchMock = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>().mockResolvedValue(
      new Response('<html>gateway timeout</html>', { status: 504 }),
    );
    const bedrock = new Bedrock({ apiKey: 'key', fetch: fetchMock });
    await expect(bedrock.attest(validGeneration())).rejects.toMatchObject({
      status: 504,
      code: null,
      message: 'Bedrock API request failed with status 504',
    });
  });
});
