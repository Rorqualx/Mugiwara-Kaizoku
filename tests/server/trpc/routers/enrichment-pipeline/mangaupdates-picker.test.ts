import { describe, it, expect } from '@jest/globals';

import { pickBestMUMatch } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangaupdates-fetch';
import type { MUSearchHit } from '@/server/services/mangaupdates/types';

function makeHit(opts: {
  series_id: number;
  title: string;
  hit_title: string;
  votes?: number;
  year?: string;
  type?: string;
}): MUSearchHit {
  const emptyTs = { timestamp: 0, as_rfc3339: '', as_string: '' };
  const emptyRankPos = { week: 0, month: 0, three_months: 0, six_months: 0, year: 0 };
  return {
    hit_title: opts.hit_title,
    record: {
      series_id: opts.series_id,
      title: opts.title,
      url: `https://www.mangaupdates.com/series/x/${opts.series_id}`,
      description: '',
      image: { url: { original: '', thumb: '' }, height: 0, width: 0 },
      type: opts.type ?? 'Manga',
      year: opts.year ?? '2011',
      bayesian_rating: 7,
      rating_votes: opts.votes ?? 100,
      genres: [],
      latest_chapter: 0,
      rank: {
        position: emptyRankPos,
        old_position: emptyRankPos,
        lists: { reading: 0, wish: 0, complete: 0, unfinished: 0, custom: 0 },
      },
      last_updated: emptyTs,
    },
  };
}

describe('pickBestMUMatch — length-ratio penalty applied per-candidate', () => {
  it('picks "Jigokuren - Love in the Hell" via exact hit_title "Love in Hell" — not "Jigoku no Alice"', () => {
    const hits = [
      makeHit({ series_id: 58149401268, title: 'Jigokuren - Love in the Hell', hit_title: 'Love in Hell',  votes: 565, year: '2011' }),
      makeHit({ series_id: 77699823245, title: 'Jigoku no Alice',              hit_title: 'Alice in Hell', votes: 192, year: '2010' }),
      makeHit({ series_id: 56704592154, title: 'Love in Hell (Rita_Pua)',      hit_title: 'Love in Hell (Rita_Pua)', votes: 18, year: '2025', type: 'Thai' }),
      makeHit({ series_id: 50044220689, title: 'Jigokuren - Death Life',       hit_title: 'Love in Hell: Death Life', votes: 69, year: '2015' }),
    ];
    const result = pickBestMUMatch(hits, 'Love in Hell');
    expect(result?.record.series_id).toBe(58149401268);
  });

  it('regression: short canonical "Naruto" beats long sequel/spinoff candidates', () => {
    const hits = [
      makeHit({ series_id: 1, title: 'Naruto',                                              hit_title: 'Naruto',                  votes: 5000 }),
      makeHit({ series_id: 2, title: 'Naruto: Itazura Ninjutsu Densetsu',                  hit_title: 'Naruto: Itazura Ninjutsu', votes: 100 }),
      makeHit({ series_id: 3, title: 'Naruto: The Seventh Hokage and the Scarlet Spring', hit_title: 'Naruto Gaiden',             votes: 200 }),
    ];
    const result = pickBestMUMatch(hits, 'Naruto');
    expect(result?.record.series_id).toBe(1);
  });

  it('regression: short query "DBS" picks canonical long title via exact hit_title match', () => {
    const hits = [
      makeHit({ series_id: 1, title: 'Dragon Ball Super', hit_title: 'DBS',           votes: 1000 }),
      makeHit({ series_id: 2, title: 'DBS Goku Side',     hit_title: 'DBS Goku Side', votes: 50 }),
    ];
    const result = pickBestMUMatch(hits, 'DBS');
    expect(result?.record.series_id).toBe(1);
  });

  it('returns null when all candidates fall below the 0.3 floor', () => {
    const hits = [
      makeHit({ series_id: 999, title: 'Completely Unrelated Title', hit_title: 'Completely Unrelated', votes: 10 }),
    ];
    const result = pickBestMUMatch(hits, 'Foo Bar Baz');
    expect(result).toBeNull();
  });
});
