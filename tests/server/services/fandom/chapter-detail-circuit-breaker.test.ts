/**
 * @jest-environment node
 *
 * The chapter-detail breaker used to re-open on every failure past the
 * threshold: with 75 requests in flight it logged "Opening circuit" once per
 * failure and pushed its open time forward each time, delaying recovery.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

import { CircuitBreaker } from '@/server/services/fandom/chapter-detail/circuit-breaker';
import { CIRCUIT_BREAKER_CONFIG } from '@/server/services/fandom/chapter-detail/constants';
import { CircuitState } from '@/server/services/fandom/chapter-detail/types';
import { logger } from '@/utils/logger';

describe('CircuitBreaker', () => {
  let errorSpy: ReturnType<typeof jest.spyOn>;
  let nowSpy: ReturnType<typeof jest.spyOn>;
  let now = 1_000_000;

  beforeEach(() => {
    now = 1_000_000;
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    nowSpy.mockRestore();
  });

  const openingLogs = (): number =>
    errorSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes('Opening circuit')).length;

  it('logs "Opening circuit" once when failures keep arriving from requests already in flight', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < CIRCUIT_BREAKER_CONFIG.threshold + 60; i++) breaker.update(false);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(openingLogs()).toBe(1);
  });

  it('does not push the open time forward on later failures, so the recovery test still starts one timeout after opening', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < CIRCUIT_BREAKER_CONFIG.threshold; i++) breaker.update(false);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // A straggler fails just before the timeout would elapse.
    now += CIRCUIT_BREAKER_CONFIG.timeout - 1;
    breaker.update(false);

    now += 2;
    expect(breaker.check()).toBe(true);
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('still re-opens, with a fresh open time, when the recovery test fails', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < CIRCUIT_BREAKER_CONFIG.threshold; i++) breaker.update(false);
    now += CIRCUIT_BREAKER_CONFIG.timeout + 1;
    expect(breaker.check()).toBe(true);

    breaker.update(false);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.check()).toBe(false);
    now += CIRCUIT_BREAKER_CONFIG.timeout + 1;
    expect(breaker.check()).toBe(true);
  });

  it('opens again after a reset and a new run of failures (once per opening, not once per lifetime)', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < CIRCUIT_BREAKER_CONFIG.threshold; i++) breaker.update(false);
    breaker.reset();
    for (let i = 0; i < CIRCUIT_BREAKER_CONFIG.threshold; i++) breaker.update(false);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(openingLogs()).toBe(2);
  });
});
