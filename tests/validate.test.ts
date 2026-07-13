import { describe, it, expect } from 'vitest';
import { validateGeneration } from '../src/validate';
import { BedrockValidationError } from '../src/errors';
import type { Generation } from '../src/types';

function valid(): Generation {
  return {
    correlationId: 'chat-123',
    model: { provider: 'anthropic', name: 'claude-opus-4-8' },
    instructions: 'You are a suitability report assistant.',
    input: [{ role: 'user', content: 'Draft a report.' }],
    output: { content: '## Report', finishReason: 'stop' },
  };
}

describe('validateGeneration', () => {
  it('accepts a valid bundle', () => {
    expect(() => validateGeneration(valid())).not.toThrow();
  });

  it('accepts a single prompt string as input', () => {
    expect(() => validateGeneration({ ...valid(), input: 'Extract the risk profile.' })).not.toThrow();
  });

  it('accepts a bundle without instructions', () => {
    const { instructions: _instructions, ...withoutInstructions } = valid();
    expect(() => validateGeneration(withoutInstructions as Generation)).not.toThrow();
  });

  it('rejects a non-object generation', () => {
    expect(() => validateGeneration(null as unknown as Generation)).toThrow(BedrockValidationError);
    expect(() => validateGeneration(42 as unknown as Generation)).toThrow(/must be an object/);
  });

  it('rejects a missing correlationId', () => {
    expect(() => validateGeneration({ ...valid(), correlationId: undefined as unknown as string })).toThrow(
      /correlationId/,
    );
  });

  it('rejects an empty correlationId', () => {
    expect(() => validateGeneration({ ...valid(), correlationId: '' })).toThrow(/correlationId/);
  });

  it('rejects a non-object model', () => {
    expect(() => validateGeneration({ ...valid(), model: null as never })).toThrow(/model is required/);
  });

  it('rejects a missing model.provider', () => {
    expect(() =>
      validateGeneration({ ...valid(), model: { provider: '', name: 'x' } }),
    ).toThrow(/model.provider/);
  });

  it('rejects a missing model.name', () => {
    expect(() =>
      validateGeneration({ ...valid(), model: { provider: 'anthropic', name: undefined as unknown as string } }),
    ).toThrow(/model.name/);
  });

  it('rejects a non-string instructions', () => {
    expect(() =>
      validateGeneration({ ...valid(), instructions: 5 as unknown as string }),
    ).toThrow(/instructions must be a string/);
  });

  it('rejects an empty input string', () => {
    expect(() => validateGeneration({ ...valid(), input: '' })).toThrow(/input must be a non-empty/);
  });

  it('rejects an input that is neither string nor array', () => {
    expect(() =>
      validateGeneration({ ...valid(), input: 42 as unknown as Generation['input'] }),
    ).toThrow(/input must be a non-empty/);
  });

  it('rejects an empty input array', () => {
    expect(() => validateGeneration({ ...valid(), input: [] })).toThrow(/input must be a non-empty/);
  });

  it('rejects a non-object input message', () => {
    expect(() =>
      validateGeneration({ ...valid(), input: [null as never] }),
    ).toThrow(/input\[0\] must be an object/);
  });

  it('rejects an invalid input message role', () => {
    expect(() =>
      validateGeneration({
        ...valid(),
        input: [{ role: 'system', content: 'ok' }, { role: 'robot' as never, content: 'x' }],
      }),
    ).toThrow(/input\[1\].role/);
  });

  it('rejects a non-string input message content', () => {
    expect(() =>
      validateGeneration({
        ...valid(),
        input: [{ role: 'user', content: 123 as unknown as string }],
      }),
    ).toThrow(/input\[0\].content/);
  });

  it('rejects a non-object output', () => {
    expect(() => validateGeneration({ ...valid(), output: null as never })).toThrow(/output is required/);
  });

  it('rejects a non-string output.content', () => {
    expect(() =>
      validateGeneration({ ...valid(), output: { content: 99 as unknown as string } }),
    ).toThrow(/output.content/);
  });
});
