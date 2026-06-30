/**
 * @jest-environment node
 *
 * Guards that a populated AniList endDate is treated as an authoritative terminal
 * signal when resolving the trusted final-chapter ceiling — even when the cached
 * status string is a stale ONGOING.
 *
 * Regression target: Jujutsu Kaisen (final ch 271, endDate 2024-09-30) and
 * Berserk (final ch 383, endDate set) both carried an endDate while their stored
 * status still read ONGOING. The old status-only gate returned trusted:false, so
 * generic phantom chapters 272+/384+ were never capped.
 */
import { resolveTrustedFinalChapter } from '../phase-data-assembly';

import type { UnifiedProviderResults } from '../types';

function resultsWith(metadata: Record<string, unknown>): UnifiedProviderResults {
  return {
    enrichmentResult: { appliedMatch: { metadata } },
  } as unknown as UnifiedProviderResults;
}

describe('resolveTrustedFinalChapter — endDate terminal signal', () => {
  it('trusts the scalar when endDate is set despite a stale ONGOING status', () => {
    const r = resolveTrustedFinalChapter(
      resultsWith({ status: 'ONGOING', chapters: 271, volumes: 30, endDate: '2024-09-30' }),
    );
    expect(r.trusted).toBe(true);
    expect(r.ceiling).toBe(271);
    expect(r.volumeCeiling).toBe(30);
  });

  it('still trusts a terminal status with no endDate', () => {
    const r = resolveTrustedFinalChapter(resultsWith({ status: 'COMPLETED', chapters: 139 }));
    expect(r.trusted).toBe(true);
    expect(r.ceiling).toBe(139);
  });

  it('does NOT trust an ongoing series with neither terminal status nor endDate', () => {
    const r = resolveTrustedFinalChapter(resultsWith({ status: 'ONGOING', chapters: 100 }));
    expect(r.trusted).toBe(false);
    expect(r.ceiling).toBeNull();
  });

  it('ignores an empty-string endDate', () => {
    const r = resolveTrustedFinalChapter(resultsWith({ status: 'ONGOING', chapters: 100, endDate: '' }));
    expect(r.trusted).toBe(false);
  });
});

describe('resolveTrustedFinalChapter — stored-DB fallback', () => {
  it('trusts the stored scalar when live providers report ongoing (Berserk: AniList RELEASING)', () => {
    const r = resolveTrustedFinalChapter(
      resultsWith({ status: 'RELEASING' }), // live AniList: no chapters/endDate
      { endDate: new Date('2025-09-11'), status: 'ONGOING', chapters: 383 },
    );
    expect(r.trusted).toBe(true);
    expect(r.ceiling).toBe(383);
  });

  it('trusts a terminal stored status even without a stored endDate', () => {
    const r = resolveTrustedFinalChapter(
      resultsWith({ status: 'RELEASING' }),
      { endDate: null, status: 'COMPLETED', chapters: 200 },
    );
    expect(r.trusted).toBe(true);
    expect(r.ceiling).toBe(200);
  });

  it('does NOT trust a stored endDate without a stored chapter scalar', () => {
    const r = resolveTrustedFinalChapter(
      resultsWith({ status: 'RELEASING' }),
      { endDate: new Date('2025-09-11'), status: 'ONGOING', chapters: null },
    );
    expect(r.trusted).toBe(false);
    expect(r.ceiling).toBeNull();
  });

  it('does NOT trust an ongoing stored series with no end signal', () => {
    const r = resolveTrustedFinalChapter(
      resultsWith({ status: 'RELEASING' }),
      { endDate: null, status: 'ONGOING', chapters: 400 },
    );
    expect(r.trusted).toBe(false);
  });

  it('prefers the live AniList ceiling over the stored fallback', () => {
    const r = resolveTrustedFinalChapter(
      resultsWith({ status: 'COMPLETED', chapters: 271 }),
      { endDate: new Date('2020-01-01'), status: 'COMPLETED', chapters: 999 },
    );
    expect(r.ceiling).toBe(271);
  });
});
