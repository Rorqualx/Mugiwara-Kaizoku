/**
 * Regression tests for the shared magnet helpers.
 *
 * Both the dispatcher (`prowlarr-handler`) and the UI's Cancel & Blocklist
 * (`pages/jobs/active.tsx`) normalize hashes through these helpers, so a
 * regression here silently breaks hash-based blocking on either side.
 */

import { describe, it, expect } from '@jest/globals';

import { extractBtihFromMagnet, normalizeReleaseHashForStorage } from '../magnet';

describe('extractBtihFromMagnet', () => {
  it('pulls a 40-char hex BTIH out of a single-tracker magnet', () => {
    const magnet =
      'magnet:?xt=urn:btih:92f673a0a573cfd2fd117b22574e7d2147da71bd' +
      '&dn=Akira+Failing+in+Love+v01-02+(2026)+(Digital)+(Rillant)' +
      '&tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce';
    expect(extractBtihFromMagnet(magnet)).toBe('92f673a0a573cfd2fd117b22574e7d2147da71bd');
  });

  it('lowercases an uppercase hex BTIH for consistent storage', () => {
    const magnet = 'magnet:?xt=urn:btih:4E45647859738A161933EB5908AF17CDBBF625BB&dn=foo';
    expect(extractBtihFromMagnet(magnet)).toBe('4e45647859738a161933eb5908af17cdbbf625bb');
  });

  it('accepts a 32-char base32 BTIH', () => {
    // base32 form (RFC 4648 alphabet without padding) — some older indexers emit this.
    const magnet = 'magnet:?xt=urn:btih:abcdefghijklmnopqrstuvwxyz234567&dn=bar';
    expect(extractBtihFromMagnet(magnet)).toBe('abcdefghijklmnopqrstuvwxyz234567');
  });

  it('keeps the first btih when a v1+v2 hybrid magnet has both btih and btmh', () => {
    // Hybrid hash magnets list btih first, btmh second. We only support v1
    // (btih); btmh must be ignored, not accidentally captured.
    const magnet =
      'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567' +
      '&xt=urn:btmh:1220caf1e1129775db8b0721a8c5a3a8f6e9bd00ddc55ad7d0cb1f6e7c1e8d4f1b3a5';
    expect(extractBtihFromMagnet(magnet)).toBe('0123456789abcdef0123456789abcdef01234567');
  });

  it('returns undefined for a Prowlarr HTTP download URL', () => {
    const httpUrl =
      'http://192.168.50.185:9696/16/download?apikey=xxx&link=base64payload&file=Some+Release';
    expect(extractBtihFromMagnet(httpUrl)).toBeUndefined();
  });

  it('returns undefined for an https indexer URL', () => {
    expect(extractBtihFromMagnet('https://nyaa.si/view/2114645')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(extractBtihFromMagnet('')).toBeUndefined();
  });

  it('returns undefined when the magnet has no xt=urn:btih clause', () => {
    // Spec-malformed magnet (no xt) — defensive: don't throw, just no-op.
    expect(extractBtihFromMagnet('magnet:?dn=something&tr=udp%3A%2F%2Ftracker')).toBeUndefined();
  });
});

describe('normalizeReleaseHashForStorage', () => {
  it('returns the BTIH when input is a magnet URI (write-side ↔ lookup-side parity)', () => {
    const magnet = 'magnet:?xt=urn:btih:92f673a0a573cfd2fd117b22574e7d2147da71bd&dn=foo';
    expect(normalizeReleaseHashForStorage(magnet)).toBe('92f673a0a573cfd2fd117b22574e7d2147da71bd');
  });

  it('returns undefined for null / undefined / empty inputs', () => {
    expect(normalizeReleaseHashForStorage(null)).toBeUndefined();
    expect(normalizeReleaseHashForStorage(undefined)).toBeUndefined();
    expect(normalizeReleaseHashForStorage('')).toBeUndefined();
  });

  it('returns undefined for non-magnet URLs (Usenet/DDL release sources)', () => {
    // Auto-block used to base64-truncate these into the hash column — a
    // signature that never matched the dispatcher's BTIH lookup. We now
    // store no hash at all and rely on title/group/pattern matching.
    expect(normalizeReleaseHashForStorage('https://example.com/release.nzb')).toBeUndefined();
    expect(normalizeReleaseHashForStorage('http://prowlarr.local/download?id=42')).toBeUndefined();
  });
});
