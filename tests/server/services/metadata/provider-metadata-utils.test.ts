/**
 * @jest-environment node
 *
 * Unit tests for the canonical providerMetadata helpers (structural lesson #3).
 * These pin the exact parse/extract semantics the ~10 previously-duplicated
 * copies relied on, so the consolidation is provably behavior-preserving.
 */

import { describe, it, expect } from '@jest/globals';

import {
  extractBoundProviderId,
  getProviderSection,
  parseProviderMetadata,
  readProviderId,
} from '@/server/services/metadata/provider-metadata-utils';

describe('parseProviderMetadata', () => {
  it('returns a plain object as-is', () => {
    const obj = { anilist: { providerId: '53390' } };
    expect(parseProviderMetadata(obj)).toBe(obj);
  });

  it('parses a JSON-string blob', () => {
    expect(parseProviderMetadata('{"anilist":{"providerId":"53390"}}')).toEqual({
      anilist: { providerId: '53390' },
    });
  });

  it('never throws on malformed JSON — yields {}', () => {
    expect(parseProviderMetadata('{not json')).toEqual({});
  });

  it('rejects arrays, null, and primitives to {}', () => {
    expect(parseProviderMetadata([1, 2])).toEqual({});
    expect(parseProviderMetadata('[1,2]')).toEqual({});
    expect(parseProviderMetadata(null)).toEqual({});
    expect(parseProviderMetadata(42)).toEqual({});
    expect(parseProviderMetadata(undefined)).toEqual({});
  });
});

describe('getProviderSection', () => {
  it('returns the section object when present', () => {
    const pm = { mangadex: { providerId: 'abc' } };
    expect(getProviderSection(pm, 'mangadex')).toEqual({ providerId: 'abc' });
  });

  it('returns null for missing / non-object / array sections', () => {
    expect(getProviderSection({}, 'anilist')).toBeNull();
    expect(getProviderSection({ anilist: 'x' }, 'anilist')).toBeNull();
    expect(getProviderSection({ anilist: null }, 'anilist')).toBeNull();
    expect(getProviderSection({ anilist: [1] }, 'anilist')).toBeNull();
  });
});

describe('readProviderId (parsed map)', () => {
  it('reads a non-empty string id', () => {
    expect(readProviderId({ anilist: { providerId: '53390' } }, 'anilist')).toBe('53390');
  });

  it('coerces a finite numeric id to string', () => {
    expect(readProviderId({ anilist: { providerId: 53390 } }, 'anilist')).toBe('53390');
  });

  it('returns null for empty string, non-finite, missing, or absent section', () => {
    expect(readProviderId({ anilist: { providerId: '' } }, 'anilist')).toBeNull();
    expect(readProviderId({ anilist: { providerId: Number.NaN } }, 'anilist')).toBeNull();
    expect(readProviderId({ anilist: {} }, 'anilist')).toBeNull();
    expect(readProviderId({}, 'anilist')).toBeNull();
  });
});

describe('extractBoundProviderId (raw blob)', () => {
  it('parses then reads from an object blob', () => {
    expect(extractBoundProviderId({ mal: { providerId: 100 } }, 'mal')).toBe('100');
  });

  it('parses then reads from a JSON-string blob', () => {
    expect(extractBoundProviderId('{"kitsu":{"providerId":"k9"}}', 'kitsu')).toBe('k9');
  });

  it('returns null for malformed / absent', () => {
    expect(extractBoundProviderId('nope', 'anilist')).toBeNull();
    expect(extractBoundProviderId(null, 'anilist')).toBeNull();
  });
});
