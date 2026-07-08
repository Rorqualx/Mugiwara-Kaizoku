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
  it('attaches accept for a unanimous numeric field', () => {
    const field = 'chapters';
    const r = selectField({
      mangaId: 0, field, fieldType: getFieldType(field),
      candidates: [{ field, provider: 'anilist', value: 100, matchConfidence: 1 }],
      existingValue: null, existingProvider: null,
    });
    expect(r.winner?.value).toBe(100);
    expect(r.confidenceClass).toBe('accept');
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
