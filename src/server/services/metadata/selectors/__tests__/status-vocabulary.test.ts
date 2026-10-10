import { MangaPublicationStatus } from '@prisma/client';

import { selectCategorical } from '../select-categorical';

import type { Candidate, SelectorContext } from '../types';

const ENUM_MEMBERS = new Set<string>(Object.values(MangaPublicationStatus));

function ctx(field: SelectorContext['field'], candidates: Candidate[]): SelectorContext {
  return { mangaId: 1, field, fieldType: 'categorical', candidates, existingValue: null, existingProvider: null };
}

/** What a lone provider value normalises to: the winner's value, or null when it abstains. */
function normalized(field: Candidate['field'], value: unknown): unknown {
  const result = selectCategorical(ctx(field, [{ field, provider: 'anilist', value, matchConfidence: 1 }]));
  return result.winner?.value ?? null;
}

describe('status normaliser vocabulary', () => {
  const TABLE: Array<[source: string, raw: unknown, expected: string | null]> = [
    ['anilist', 'FINISHED', 'COMPLETED'],
    ['anilist', 'RELEASING', 'ONGOING'],
    ['anilist', 'NOT_YET_RELEASED', 'UPCOMING'],
    ['anilist', 'CANCELLED', 'CANCELLED'],
    ['anilist', 'HIATUS', 'HIATUS'],
    ['mangadex', 'ongoing', 'ONGOING'],
    ['mangadex', 'completed', 'COMPLETED'],
    ['mangadex', 'hiatus', 'HIATUS'],
    ['mangadex', 'cancelled', 'CANCELLED'],
    ['mal (mapped)', 'UNKNOWN', null],
    ['kitsu', 'current', 'ONGOING'],
    ['kitsu', 'finished', 'COMPLETED'],
    ['kitsu', 'tba', null],
    ['kitsu', 'unreleased', 'UPCOMING'],
    ['kitsu', 'upcoming', 'UPCOMING'],
    ['jikan raw', 'On Hiatus', 'HIATUS'],
    ['jikan raw', 'Not yet published', 'UPCOMING'],
    ['jikan raw', 'Discontinued', 'CANCELLED'],
    ['jikan raw', 'Publishing', 'ONGOING'],
    ['jikan raw', 'Finished', 'COMPLETED'],
    ['mangaupdates (mapped)', 'COMPLETED', 'COMPLETED'],
    ['mangaupdates (mapped)', 'ONGOING', 'ONGOING'],
    ['spelling', 'canceled', 'CANCELLED'],
    ['spelling', '  Complete ', 'COMPLETED'],
    ['spelling', 'not-yet-released', 'UPCOMING'],
    ['placeholder', 'N/A', null],
    ['placeholder', '', null],
    // Free text and near-misses the old half-anchored patterns let through,
    // some of them as strings outside the enum.
    ['mangaupdates raw', '29 Volumes (Discontinued)', null],
    ['mangaupdates raw', '34 Volumes (Complete)\n\n5 Volumes (Ongoing)', null],
    ['near miss', 'finished airing', null],
    ['near miss', 'not ended', null],
    ['near miss', 'unpaused', null],
    ['near miss', 'currently unknown', null],
    ['near miss', 'RELEASED', null],
    ['object key', 'constructor', null],
    ['non-string', 42, null],
    ['non-string', null, null],
  ];

  it.each(TABLE)('%s %p -> %p', (_source, raw, expected) => {
    expect(normalized('status', raw)).toBe(expected);
  });

  it('only ever yields a MangaPublicationStatus member or null', () => {
    for (const [, raw] of TABLE) {
      const value = normalized('status', raw);
      expect(value === null || (typeof value === 'string' && ENUM_MEMBERS.has(value))).toBe(true);
    }
  });
});

describe('other categorical normalisers match whole values only', () => {
  it.each([
    ['format', 'Manga', 'MANGA'],
    ['format', 'graphic novel', 'MANGA'],
    ['format', 'one-shot', 'ONE_SHOT'],
    ['format', 'oneshot', 'ONE_SHOT'],
    ['format', 'light novel', 'NOVEL'],
    // "manga…" prefixes and "…novel" suffixes used to be swallowed.
    ['format', 'manga adaptation', 'MANGA ADAPTATION'],
    ['format', 'visual novel', 'VISUAL NOVEL'],
    ['format', 'one shot collection', 'ONE SHOT COLLECTION'],
    ['contentRating', 'safe', 'safe'],
    ['contentRating', 'Teen', 'suggestive'],
    ['contentRating', 'explicit', 'pornographic'],
    ['contentRating', 'safest', 'safest'],
    ['contentRating', 'premature', 'premature'],
    ['contentRating', 'young adult', 'young adult'],
    ['publicationDemographic', 'Shonen', 'shounen'],
    ['publicationDemographic', 'shojo', 'shoujo'],
    ['publicationDemographic', 'none', null],
    ['publicationDemographic', 'shounen ai', 'shounen ai'],
    ['publicationDemographic', 'mahou shojo', 'mahou shojo'],
  ] as Array<[Candidate['field'], string, string | null]>)('%s %p -> %p', (field, raw, expected) => {
    expect(normalized(field, raw)).toBe(expected);
  });
});
