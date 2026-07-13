import { describe, it, expect } from 'vitest';
import { BedrockApiError, BedrockError, BedrockValidationError } from '../src/errors';

describe('BedrockError', () => {
  it('carries the message and name', () => {
    const error = new BedrockError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');
    expect(error.name).toBe('BedrockError');
  });
});

describe('BedrockValidationError', () => {
  it('extends BedrockError', () => {
    const error = new BedrockValidationError('bad input');
    expect(error).toBeInstanceOf(BedrockError);
    expect(error).toBeInstanceOf(BedrockValidationError);
    expect(error.name).toBe('BedrockValidationError');
    expect(error.message).toBe('bad input');
  });
});

describe('BedrockApiError', () => {
  it('extends BedrockError and exposes the detail', () => {
    const error = new BedrockApiError('nope', { status: 429, code: 'RATE_LIMITED', requestId: 'req-1' });
    expect(error).toBeInstanceOf(BedrockError);
    expect(error).toBeInstanceOf(BedrockApiError);
    expect(error.name).toBe('BedrockApiError');
    expect(error.message).toBe('nope');
    expect(error.status).toBe(429);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.requestId).toBe('req-1');
  });

  it('allows null code and requestId', () => {
    const error = new BedrockApiError('server error', { status: 500, code: null, requestId: null });
    expect(error.code).toBeNull();
    expect(error.requestId).toBeNull();
  });
});
