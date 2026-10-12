import { selectCategorical } from '../select-categorical';
import { selectNumeric } from '../select-numeric';
import { selectString } from '../select-string';

import type { Candidate, SelectorContext } from '../types';

function ctx(field: SelectorContext['field'], fieldType: SelectorContext['fieldType'], candidates: Candidate[]): SelectorContext {
  return { mangaId: 1, field, fieldType, candidates, existingValue: null, existingProvider: null };
}

function cand(field: Candidate['field'], provider: Candidate['provider'], value: unknown): Candidate {
  return { field, provider, value, matchConfidence: 0.95 };
}

describe('selector ballots — how each candidate was counted', () => {
  it('numeric: reports every counted candidate with its parsed value and winning-cluster membership', () => {
    const result = selectNumeric(ctx('chapters', 'numeric', [
      cand('chapters', 'anilist', 706),
      cand('chapters', 'kitsu', '706'),
      cand('chapters', 'mangaupdates', 250),
    ]));

    const byProvider = new Map((result.ballots ?? []).map(b => [b.provider, b]));
    expect(byProvider.get('anilist')).toEqual({ provider: 'anilist', normalized: 706, inWinningGroup: true });
    expect(byProvider.get('kitsu')).toEqual({ provider: 'kitsu', normalized: 706, inWinningGroup: true });
    expect(byProvider.get('mangaupdates')?.inWinningGroup).toBe(false);
  });

  it('numeric: a value within tolerance is in the winning cluster but keeps its own value', () => {
    const result = selectNumeric(ctx('chapters', 'numeric', [
      cand('chapters', 'anilist', 181),
      cand('chapters', 'kitsu', 179),
    ]));

    const values = (result.ballots ?? []).map(b => b.normalized).sort();
    expect(values).toEqual([179, 181]);
    expect((result.ballots ?? []).every(b => b.inWinningGroup)).toBe(true);
  });

  it('numeric: a candidate dropped as non-numeric has no ballot', () => {
    const result = selectNumeric(ctx('chapters', 'numeric', [
      cand('chapters', 'anilist', 706),
      cand('chapters', 'kitsu', 'N/A'),
    ]));
    expect((result.ballots ?? []).map(b => b.provider)).toEqual(['anilist']);
  });

  it('numeric: reports an empty ballot list when no candidate was usable', () => {
    const result = selectNumeric(ctx('chapters', 'numeric', [cand('chapters', 'kitsu', 'N/A')]));
    expect(result.winner).toBeNull();
    expect(result.ballots).toEqual([]);
  });

  it('categorical: ballots carry the normalised value, so different spellings of one status compare equal', () => {
    const result = selectCategorical(ctx('status', 'categorical', [
      cand('status', 'anilist', 'FINISHED'),
      cand('status', 'mangadex', 'completed'),
      cand('status', 'kitsu', 'tba'),
    ]));

    const ballots = result.ballots ?? [];
    expect(ballots.map(b => b.provider).sort()).toEqual(['anilist', 'mangadex']);
    expect(ballots.every(b => b.normalized === 'COMPLETED' && b.inWinningGroup)).toBe(true);
  });

  it('ranked field types report no ballots', () => {
    const result = selectString(ctx('cover', 'string', [cand('cover', 'anilist', 'https://s4.anilist.co/large.jpg')]));
    expect(result.ballots).toBeUndefined();
  });
});
