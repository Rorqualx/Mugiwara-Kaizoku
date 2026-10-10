// @ts-nocheck - Test builds partial axios configs by hand
import { describe, expect, it } from '@jest/globals';
import axios, { AxiosError, AxiosHeaders, CanceledError } from 'axios';

import {
  abortDeadlineMs,
  applyAbortDeadline,
  installAxiosAbortTimeout,
  normalizeDeadlineError,
} from '@/utils/axios-abort-timeout';

const baseConfig = (extra = {}) => ({ headers: new AxiosHeaders(), url: '/x', ...extra });

describe('axios-abort-timeout', () => {
  describe('abortDeadlineMs', () => {
    it('gives short timeouts fixed headroom and long ones double', () => {
      expect(abortDeadlineMs(1_000)).toBe(16_000);
      expect(abortDeadlineMs(30_000)).toBe(60_000);
    });
  });

  describe('applyAbortDeadline', () => {
    it('adds a signal when the request has a timeout', () => {
      const config = applyAbortDeadline(baseConfig({ timeout: 5_000 }));
      expect(config.signal).toBeDefined();
      expect(config.signal.aborted).toBe(false);
    });

    it('leaves requests without a timeout alone', () => {
      expect(applyAbortDeadline(baseConfig()).signal).toBeUndefined();
      expect(applyAbortDeadline(baseConfig({ timeout: 0 })).signal).toBeUndefined();
    });

    it('never replaces a caller-supplied signal', () => {
      const own = new AbortController().signal;
      expect(applyAbortDeadline(baseConfig({ timeout: 5_000, signal: own })).signal).toBe(own);
    });

    it('skips streamed downloads', () => {
      const config = applyAbortDeadline(baseConfig({ timeout: 5_000, responseType: 'stream' }));
      expect(config.signal).toBeUndefined();
    });
  });

  describe('normalizeDeadlineError', () => {
    it('turns a cancellation from our deadline into an ECONNABORTED timeout', () => {
      const config = applyAbortDeadline(baseConfig({ timeout: 5_000 }));
      const result = normalizeDeadlineError(new CanceledError('canceled', config));
      expect(result).toBeInstanceOf(AxiosError);
      expect(result.code).toBe('ECONNABORTED');
      expect(result.message).toContain('5000ms');
      expect(axios.isCancel(result)).toBe(false);
    });

    it('passes through a cancellation the caller requested', () => {
      const controller = new AbortController();
      const config = baseConfig({ timeout: 5_000, signal: controller.signal });
      const error = new CanceledError('canceled', config);
      expect(normalizeDeadlineError(error)).toBe(error);
    });

    it('passes through unrelated errors', () => {
      const error = new Error('boom');
      expect(normalizeDeadlineError(error)).toBe(error);
    });
  });

  describe('installAxiosAbortTimeout', () => {
    it('attaches the signal on real requests and is idempotent', async () => {
      const seen = [];
      const instance = axios.create({
        timeout: 5_000,
        adapter: (config) => {
          seen.push(config.signal);
          return Promise.resolve({ data: 'ok', status: 200, statusText: 'OK', headers: {}, config });
        },
      });
      expect(installAxiosAbortTimeout(instance)).toBe(instance);
      installAxiosAbortTimeout(instance);

      await instance.get('/a');
      expect(seen).toHaveLength(1);
      expect(seen[0]?.aborted).toBe(false);
      expect(instance.interceptors.request.handlers).toHaveLength(1);
    });

    it('rejects with ECONNABORTED when the adapter is cancelled by the deadline signal', async () => {
      const instance = installAxiosAbortTimeout(
        axios.create({
          timeout: 5_000,
          adapter: (config) => Promise.reject(new CanceledError('canceled', config)),
        })
      );
      await expect(instance.get('/stalled')).rejects.toMatchObject({ code: 'ECONNABORTED' });
    });
  });
});
