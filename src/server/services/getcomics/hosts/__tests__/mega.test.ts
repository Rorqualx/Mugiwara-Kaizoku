/**
 * Tests for the MEGA URL parser.
 *
 * Live SDK / decryption / network calls are intentionally NOT tested here
 * — they need real MEGA shares and the megajs SDK, which would be flaky
 * and slow. What we do cover: the two URL formats MEGA supports and the
 * negative case where neither matches.
 */

import { describe, it, expect } from '@jest/globals';

import { classifyMegaError, parseMegaUrl } from '../mega';

describe('parseMegaUrl', () => {
  it('parses the new-format URL (mega.nz/file/ID#KEY)', () => {
    const url = 'https://mega.nz/file/aBcDeFgH#ZyXwVuTsRqPo1234567890';
    expect(parseMegaUrl(url)).toEqual({
      fileId: 'aBcDeFgH',
      key: 'ZyXwVuTsRqPo1234567890',
    });
  });

  it('parses the old-format URL (mega.nz/#!ID!KEY)', () => {
    const url = 'https://mega.nz/#!aBcDeFgH!ZyXwVuTsRqPo1234567890';
    expect(parseMegaUrl(url)).toEqual({
      fileId: 'aBcDeFgH',
      key: 'ZyXwVuTsRqPo1234567890',
    });
  });

  it('parses the old-format URL on the legacy mega.co.nz domain', () => {
    const url = 'https://mega.co.nz/#!aBcDeFgH!ZyXwVuTsRqPo1234567890';
    expect(parseMegaUrl(url)).toEqual({
      fileId: 'aBcDeFgH',
      key: 'ZyXwVuTsRqPo1234567890',
    });
  });

  it('returns null for a non-MEGA URL', () => {
    expect(parseMegaUrl('https://example.com/file.cbz')).toBeNull();
  });

  it('returns null for a malformed MEGA URL with no key', () => {
    expect(parseMegaUrl('https://mega.nz/file/aBcDeFgH')).toBeNull();
  });

  it('returns null for the empty string', () => {
    expect(parseMegaUrl('')).toBeNull();
  });
});

describe('classifyMegaError', () => {
  it('maps EOVERQUOTA error to quota', () => {
    expect(classifyMegaError(new Error('Request failed with EOVERQUOTA'))).toBe('quota');
  });

  it('maps bandwidth-quota messages to quota', () => {
    expect(classifyMegaError(new Error('You have exceeded your bandwidth quota'))).toBe('quota');
  });

  it('maps EEXPIRED to expired', () => {
    expect(classifyMegaError(new Error('Link EEXPIRED'))).toBe('expired');
  });

  it('maps ENOENT to expired (link gone)', () => {
    expect(classifyMegaError(new Error('ENOENT: file not found on MEGA'))).toBe('expired');
  });

  it('maps invalid-key messages to parse_failed', () => {
    expect(classifyMegaError(new Error('Invalid decryption key in URL'))).toBe('parse_failed');
  });

  it('maps decrypt errors to parse_failed', () => {
    expect(classifyMegaError(new Error('Failed to decrypt file header'))).toBe('parse_failed');
  });

  it('falls back to failed for transport / unknown errors', () => {
    expect(classifyMegaError(new Error('ECONNRESET'))).toBe('failed');
    expect(classifyMegaError(new Error('Socket hang up'))).toBe('failed');
    expect(classifyMegaError(new Error('something else'))).toBe('failed');
  });

  it('handles non-Error values', () => {
    expect(classifyMegaError('plain string with quota in it')).toBe('quota');
    expect(classifyMegaError(undefined)).toBe('failed');
  });
});
