/**
 * B2: confidence-class propagation + fieldReview recording.
 */

import { selectField } from '@/server/services/metadata/selectors';
import { applySelectorCutover } from '@/server/services/metadata/selectors/cutover-overlay';
import type { ShadowFieldOutcome, ShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';
import { getFieldType } from '@/server/services/metadata/selectors/types';

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

function outcome(partial: Partial<ShadowFieldOutcome>): ShadowFieldOutcome {
  return {
    winnerProvider: 'anilist',
    winnerValue: 100,
    confidence: 0.5,
    confidenceClass: 'persist-with-badge',
    alternatives: [{ provider: 'mal', value: 50, confidence: 0.4 }],
    guardRefused: false,
    reason: '',
    ...partial,
  };
}

function runCutover(entries: Array<[string, Partial<ShadowFieldOutcome>]>): ReturnType<typeof applySelectorCutover> {
  const outcomes = new Map<MetadataField, ShadowFieldOutcome>(
    entries.map(([f, o]) => [f as MetadataField, outcome(o)]),
  );
  const shadow: ShadowSelection = { outcomes, refusedFields: [] };
  return applySelectorCutover(shadow, {}, {});
}

describe('selectField confidenceClass', () => {
  const field = 'chapters';
  const classify = (providers: Array<'anilist' | 'mal' | 'mangadex' | 'kitsu'>): string => selectField({
    mangaId: 0, field, fieldType: getFieldType(field),
    candidates: providers.map(provider => ({ field, provider, value: 100, matchConfidence: 1 })),
    existingValue: null, existingProvider: null,
  }).confidenceClass;

  it('commits a single-source numeric field with a review badge, not a clean accept', () => {
    const r = selectField({
      mangaId: 0, field, fieldType: getFieldType(field),
      candidates: [{ field, provider: 'anilist', value: 100, matchConfidence: 1 }],
      existingValue: null, existingProvider: null,
    });
    expect(r.winner?.value).toBe(100);
    expect(r.confidence).toBeCloseTo(0.6, 10);
    expect(r.confidenceClass).toBe('persist-with-badge');
  });

  it('attaches accept once two independent sources agree', () => {
    expect(classify(['anilist', 'mangadex'])).toBe('accept');
    expect(classify(['anilist', 'mangadex', 'kitsu'])).toBe('accept');
  });

  it('treats AniList + MAL as one witness (MAL is fetched through AniList)', () => {
    expect(classify(['anilist', 'mal'])).toBe('persist-with-badge');
    expect(classify(['anilist', 'mal', 'mangadex'])).toBe('accept');
  });
});

describe('applySelectorCutover fieldReview', () => {
  it('flags an objective field committed at low confidence', () => {
    const res = runCutover([['chapters', { confidenceClass: 'persist-with-badge', confidence: 0.5 }]]);
    expect(res.fieldReview['chapters']).toEqual({ state: 'low-confidence', confidence: 0.5 });
  });

  it('flags an abstained objective field and captures its alternatives', () => {
    const res = runCutover([['chapters', { winnerProvider: null, confidenceClass: 'reject' }]]);
    expect(res.fieldReview['chapters']).toEqual({ state: 'abstained' });
    expect(res.fieldAlternatives['chapters']).toHaveLength(1);
  });

  it('does NOT flag a subjective field (rating) even at low confidence', () => {
    const res = runCutover([['rating', { confidenceClass: 'persist-with-badge', confidence: 0.5 }]]);
    expect(res.fieldReview['rating']).toBeUndefined();
  });

  it('does NOT flag an objective field committed confidently (accept)', () => {
    const res = runCutover([['status', { winnerValue: 'FINISHED', confidenceClass: 'accept' }]]);
    expect(res.fieldReview['status']).toBeUndefined();
  });
});

describe('applySelectorCutover abstention keeps the stored value', () => {
  const abstainedStatus: Partial<ShadowFieldOutcome> = {
    winnerProvider: null, winnerValue: null, confidenceClass: 'reject', confidence: 0.488,
    alternatives: [
      { provider: 'anilist', value: 'RELEASING', confidence: 0.78 },
      { provider: 'mangaupdates', value: 'HIATUS', confidence: 0.55 },
    ],
  };

  function cutover(
    field: string,
    o: Partial<ShadowFieldOutcome>,
    legacy: Record<string, unknown>,
    stored?: Record<string, unknown>,
  ): { res: ReturnType<typeof applySelectorCutover>; metadata: Record<string, unknown>; provenance: Record<string, string> } {
    const outcomes = new Map<MetadataField, ShadowFieldOutcome>([[field as MetadataField, outcome(o)]]);
    const metadata = { ...legacy };
    const provenance: Record<string, string> = Object.fromEntries(Object.keys(legacy).map(k => [k, 'anilist']));
    const res = applySelectorCutover({ outcomes, refusedFields: [] }, metadata, provenance, stored);
    return { res, metadata, provenance };
  }

  it('withholds an abstained status when one is stored, and flags it', () => {
    const { res, metadata, provenance } = cutover('status', abstainedStatus, { status: 'ONGOING', title: 'T' }, { status: 'HIATUS' });
    // No key → the persister keeps the stored HIATUS and its provenance.
    expect(metadata).toEqual({ title: 'T' });
    expect(provenance).toEqual({ title: 'anilist' });
    expect(res.fieldReview['status']).toEqual({ state: 'abstained' });
    expect(res.fieldAlternatives['status']).toHaveLength(2);
  });

  it('falls back to the legacy value when nothing is stored', () => {
    for (const stored of [undefined, {}, { status: null }, { status: 'UNKNOWN' }]) {
      const { res, metadata, provenance } = cutover('status', abstainedStatus, { status: 'ONGOING' }, stored);
      expect(metadata['status']).toBe('ONGOING');
      expect(provenance['status']).toBe('anilist');
      expect(res.fieldReview['status']).toEqual({ state: 'abstained' });
    }
  });

  it('withholds abstained counts under both spellings the persister reads', () => {
    const abstained = { winnerProvider: null, winnerValue: null, confidenceClass: 'reject' as const };
    const { metadata } = cutover('chapters', abstained, { chapters: 200, chapterCount: 200, volumes: 5 }, { chapters: 100 });
    expect(metadata).toEqual({ volumes: 5 });
    const zero = cutover('chapters', abstained, { chapters: 200 }, { chapters: 0 });
    expect(zero.metadata['chapters']).toBe(200);
  });

  it('leaves non-objective fields and undisputed abstentions on the legacy value', () => {
    const abstained = { winnerProvider: null, winnerValue: null, confidenceClass: 'reject' as const };
    expect(cutover('format', abstained, { format: 'MANGA' }, { format: 'NOVEL' }).metadata['format']).toBe('MANGA');
    const noDissent = cutover('status', { ...abstained, alternatives: [] }, { status: 'ONGOING' }, { status: 'HIATUS' });
    expect(noDissent.metadata['status']).toBe('ONGOING');
  });
});
