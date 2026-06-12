/**
 * @jest-environment node
 *
 * Unit tests for the AsyncResult → tRPC boundary unwrappers (audit task #1).
 */

import { describe, it, expect } from '@jest/globals';
import { TRPCError } from '@trpc/server';

import { unwrapResultOrThrow, unwrapResultAsync } from '@/server/trpc/unwrap-result';
import { createSuccessResult, createErrorResult, createLoadingResult } from '@/utils/async-result';

describe('unwrapResultOrThrow', () => {
  it('returns the bare data on success', () => {
    expect(unwrapResultOrThrow(createSuccessResult({ ok: 1 }))).toEqual({ ok: 1 });
  });

  it('throws a TRPCError on error results', () => {
    const result = createErrorResult<{ ok: number }, Error>(new Error('boom'));
    expect(() => unwrapResultOrThrow(result)).toThrow(TRPCError);
  });

  it('maps domain error names to specific codes via toTRPCError', () => {
    const notFound = new Error('Manga');
    notFound.name = 'NotFoundError';
    try {
      unwrapResultOrThrow(createErrorResult<number, Error>(notFound));
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('NOT_FOUND');
    }
  });

  it('treats loading/idle states as internal errors at the boundary', () => {
    try {
      unwrapResultOrThrow(createLoadingResult<number, Error>());
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('INTERNAL_SERVER_ERROR');
    }
  });
});

describe('unwrapResultAsync', () => {
  it('awaits and unwraps success', async () => {
    await expect(
      unwrapResultAsync(Promise.resolve(createSuccessResult('data'))),
    ).resolves.toBe('data');
  });

  it('awaits and throws on error', async () => {
    await expect(
      unwrapResultAsync(Promise.resolve(createErrorResult<string, Error>(new Error('nope')))),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
