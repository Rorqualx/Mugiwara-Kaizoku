/**
 * @jest-environment node
 */
import { collectCandidates, type ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import { runShadowSelection, type ShadowFieldOutcome } from '@/server/services/metadata/selectors/shadow-mode';

import { buildSelectorFragments, selectorVerdict, toClaimJson, type ScalarFragment } from '../claim-run/selector-rows';

function claim(provider: ProviderClaim['provider'], fields: Record<string, unknown>, matchConfidence = 0.9): ProviderClaim {
  return { provider, matchConfidence, fields };
}

function fragmentsFor(claims: ProviderClaim[]): { fragments: ScalarFragment[]; winnerOf: (field: string) => string | null } {
  const shadow = runShadowSelection(collectCandidates(claims));
  return {
    fragments: buildSelectorFragments(claims, shadow),
    winnerOf: (field): string | null => [...shadow.outcomes].find(([f]) => f === field)?.[1].winnerProvider ?? null,
  };
}

function find(fragments: ScalarFragment[], provider: string, field: string): ScalarFragment | undefined {
  return fragments.find(f => f.provider === provider && f.field === field);
}

function decided(partial: Partial<ShadowFieldOutcome>): ShadowFieldOutcome {
  return {
    winnerProvider: 'anilist', winnerValue: 706, confidence: 0.5, confidenceClass: 'persist-with-badge',
    alternatives: [], guardRefused: false, reason: '', ...partial,
  };
}

describe('selector outcome per claim', () => {
  it('marks a provider that gave the winning value as agrees, not as an alternative or dissent', () => {
    const { fragments, winnerOf } = fragmentsFor([
      claim('anilist', { chapters: 706 }),
      claim('kitsu', { chapters: 706 }),
      claim('mangaupdates', { chapters: 250 }),
    ]);

    const winner = winnerOf('chapters');
    const agreeing = winner === 'anilist' ? 'kitsu' : 'anilist';
    expect(['anilist', 'kitsu']).toContain(winner);
    expect(find(fragments, winner ?? '', 'chapters')?.selectorOutcome).toBe('winner');
    expect(find(fragments, agreeing, 'chapters')?.selectorOutcome).toBe('agrees');
    expect(find(fragments, 'mangaupdates', 'chapters')?.selectorOutcome).toBe('dissent');
    expect(find(fragments, 'mangaupdates', 'chapters')?.inWinningGroup).toBe(false);
  });

  it('records a count inside the winner\'s tolerance as dissent with its own value, flagged as in the winning group', () => {
    const { fragments, winnerOf } = fragmentsFor([
      claim('anilist', { chapters: 181 }),
      claim('kitsu', { chapters: 179 }),
    ]);

    const loser = winnerOf('chapters') === 'anilist' ? 'kitsu' : 'anilist';
    const row = find(fragments, loser, 'chapters');
    expect(row?.selectorOutcome).toBe('dissent');
    expect(row?.inWinningGroup).toBe(true);
    expect(row?.value).toBe(loser === 'kitsu' ? 179 : 181);
  });

  it('treats differently spelled statuses as agreeing when the selector normalises them to one value', () => {
    const { fragments, winnerOf } = fragmentsFor([
      claim('anilist', { status: 'FINISHED' }),
      claim('mangadex', { status: 'completed' }),
    ]);

    const other = winnerOf('status') === 'anilist' ? 'mangadex' : 'anilist';
    expect(find(fragments, other, 'status')?.selectorOutcome).toBe('agrees');
    // The stored value is the provider's own spelling, not the normalised one.
    expect(find(fragments, 'mangadex', 'status')?.value).toBe('completed');
  });

  it('marks a value the selector dropped as not_counted instead of crediting it with the winner', () => {
    const { fragments } = fragmentsFor([
      claim('anilist', { chapters: 706, status: 'FINISHED' }),
      claim('kitsu', { chapters: 'N/A', status: 'tba' }),
    ]);

    expect(find(fragments, 'kitsu', 'chapters')?.selectorOutcome).toBe('not_counted');
    expect(find(fragments, 'kitsu', 'status')?.selectorOutcome).toBe('not_counted');
    expect(find(fragments, 'kitsu', 'chapters')?.inWinningGroup).toBeNull();
  });

  it('writes no row for a provider that gave no value for the field', () => {
    const { fragments } = fragmentsFor([
      claim('anilist', { chapters: 60, volumes: 8 }),
      claim('kitsu', { chapters: 60, volumes: null }),
      claim('mangadex', { status: 'completed' }),
    ]);

    expect(find(fragments, 'kitsu', 'volumes')).toBeUndefined();
    expect(find(fragments, 'mangadex', 'volumes')).toBeUndefined();
    expect(find(fragments, 'mangadex', 'chapters')).toBeUndefined();
  });

  it('marks every counted claim of a guard-refused field as refused', () => {
    const outcome = decided({
      guardRefused: true,
      ballots: [
        { provider: 'anilist', normalized: 706, inWinningGroup: true },
        { provider: 'kitsu', normalized: 706, inWinningGroup: true },
      ],
    });
    expect(selectorVerdict('anilist', outcome).outcome).toBe('refused');
    expect(selectorVerdict('kitsu', outcome).outcome).toBe('refused');
  });

  it('marks every counted claim as not_selected when the field has no winner', () => {
    const outcome = decided({
      winnerProvider: null, winnerValue: null,
      ballots: [
        { provider: 'anilist', normalized: 'ONGOING', inWinningGroup: true },
        { provider: 'mangadex', normalized: 'COMPLETED', inWinningGroup: false },
      ],
    });
    expect(selectorVerdict('anilist', outcome).outcome).toBe('not_selected');
    expect(selectorVerdict('mangadex', outcome).outcome).toBe('not_selected');
  });

  it('does not call a non-winner of a ranked or merged field agreeing or dissenting', () => {
    const { fragments, winnerOf } = fragmentsFor([
      claim('anilist', { genres: ['Action', 'Adventure'] }),
      claim('mangaupdates', { genres: ['Action', 'Shounen'] }),
    ]);

    const loser = winnerOf('genres') === 'anilist' ? 'mangaupdates' : 'anilist';
    expect(find(fragments, loser, 'genres')?.selectorOutcome).toBe('not_compared');
  });

  it('keeps a key the selector has no rule for, under its own name, as not_compared', () => {
    const { fragments } = fragmentsFor([claim('anilist', { chapters: 10, staff: [{ name: 'Tite Kubo' }] })]);
    const row = find(fragments, 'anilist', 'staff');
    expect(row?.selectorOutcome).toBe('not_compared');
    expect(row?.fieldConfidence).toBeNull();
  });

  it('stores the same field confidence on every row of a field and each claim\'s own match confidence', () => {
    const { fragments } = fragmentsFor([
      claim('anilist', { chapters: 706 }, 0.95),
      claim('mangaupdates', { chapters: 250 }, 0.8),
    ]);

    const anilist = find(fragments, 'anilist', 'chapters');
    const mangaupdates = find(fragments, 'mangaupdates', 'chapters');
    expect(anilist?.fieldConfidence).toBe(mangaupdates?.fieldConfidence);
    expect(anilist?.matchConfidence).toBe(0.95);
    expect(mangaupdates?.matchConfidence).toBe(0.8);
  });

  it('maps a provider-side alias onto the Metadata column it is voted under', () => {
    const { fragments } = fragmentsFor([claim('kitsu', { chapterCount: 12 })]);
    expect(find(fragments, 'kitsu', 'chapters')?.value).toBe(12);
  });
});

describe('toClaimJson', () => {
  it('returns undefined for a missing value and for one that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(toClaimJson(null)).toBeUndefined();
    expect(toClaimJson(undefined)).toBeUndefined();
    expect(toClaimJson(circular)).toBeUndefined();
  });

  it('stores dates as ISO strings and keeps plain values', () => {
    expect(toClaimJson(new Date('2026-10-12T00:00:00.000Z'))).toBe('2026-10-12T00:00:00.000Z');
    expect(toClaimJson({ a: [1, 'x'] })).toEqual({ a: [1, 'x'] });
  });
});
