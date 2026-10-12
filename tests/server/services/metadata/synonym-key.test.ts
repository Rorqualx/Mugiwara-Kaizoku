/**
 * One synonym key for every writer of `Metadata.synonyms`.
 *
 * Bug protected: the finalize union compared by exact string, the overlay by
 * trimmed lower-case and the list selector by lower-case with folded
 * separators, so "Shingeki no Kyojin" / "SHINGEKI NO KYOJIN" passed the
 * finalize step and 35 of 73 production titles stored case-only duplicates.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/server/db', () => ({
  prisma: { manga: { findUnique: jest.fn() }, metadata: { update: jest.fn() } },
}));

import { dedupeSynonyms, sameSynonymList, synonymKey } from '@/lib/metadata/synonym-key';
import { prisma } from '@/server/db';
import { writeWinnerToColumn } from '@/server/services/metadata/selectors/column-mapping';
import { selectList } from '@/server/services/metadata/selectors/select-list';
import {
  collectProviderSynonyms,
  persistMergedSynonyms,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/merged-synonyms';
import type { UnifiedProviderResults } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

function providers(parts: {
  altTitles?: string[];
  mangaupdates?: string[];
  kitsu?: { canonicalTitle: string; alternativeTitles: string[] };
  mal?: string;
}): UnifiedProviderResults {
  return {
    enrichmentResult: { enrichedData: { manga: { altTitles: parts.altTitles ?? [] } } },
    mangaupdatesResult: parts.mangaupdates ? { alternativeTitles: parts.mangaupdates } : null,
    kitsuResult: parts.kitsu ?? null,
    malResult: parts.mal ? { title: parts.mal } : null,
  } as unknown as UnifiedProviderResults;
}

const findUnique = prisma.manga.findUnique as unknown as jest.Mock;
const update = prisma.metadata.update as unknown as jest.Mock;

function storedSynonyms(synonyms: string[]): void {
  findUnique.mockImplementation(() => Promise.resolve({ metadataId: 7, Metadata: { synonyms } }));
}

describe('synonymKey', () => {
  it('folds Unicode dashes onto the hyphen: "One\u2010Punch Man" and "Death Note \u2013 x" were stored beside their ASCII forms', () => {
    expect(synonymKey('One\u2010Punch Man')).toBe(synonymKey('One-Punch Man'));
    expect(synonymKey('Death Note \u2013 Another Note')).toBe(synonymKey('Death Note - Another Note'));
  });

  it('ignores case, surrounding space, and runs of space, underscore or hyphen', () => {
    const key = synonymKey('Shingeki no Kyojin');
    expect(synonymKey('SHINGEKI NO KYOJIN')).toBe(key);
    expect(synonymKey('  shingeki  no_kyojin ')).toBe(key);
    expect(synonymKey('Shingeki-no-Kyojin')).toBe(key);
  });

  it('folds full-width and compatibility forms (NFKC)', () => {
    expect(synonymKey('ＧＡＮＴＺ')).toBe(synonymKey('Gantz'));
    expect(synonymKey('Kaiju No.８')).toBe(synonymKey('kaiju no.8'));
  });

  it('keeps titles apart that differ in more than case, width or separators', () => {
    expect(synonymKey('進撃の巨人')).not.toBe(synonymKey('Shingeki no Kyojin'));
    expect(synonymKey('Gantz')).not.toBe(synonymKey('Gantz:G'));
    expect(synonymKey('Kaiju No. 8')).not.toBe(synonymKey('Kaiju No.8'));
    expect(synonymKey('Attack on Titan')).not.toBe(synonymKey('Attack on Titan!'));
  });
});

describe('dedupeSynonyms', () => {
  it('keeps the first-seen spelling and the original order', () => {
    expect(dedupeSynonyms(['Attack on Titan', 'ATTACK ON TITAN', '進撃の巨人', 'attack-on-titan', 'AoT']))
      .toEqual(['Attack on Titan', '進撃の巨人', 'AoT']);
  });

  it('drops blanks and non-strings', () => {
    expect(dedupeSynonyms(['', '   ', null, 3, 'A', undefined])).toEqual(['A']);
  });
});

describe('the three synonym writers agree on what a duplicate is', () => {
  const variants = ['Shingeki no Kyojin', 'SHINGEKI NO KYOJIN', 'shingeki_no-kyojin', 'Ｓhingeki no Kyojin'];

  it('finalize union (collectProviderSynonyms) stores one entry, the stored spelling', () => {
    const merged = collectProviderSynonyms(
      [variants[0] as string],
      providers({ altTitles: [variants[1] as string], mangaupdates: [variants[2] as string], mal: variants[3] as string }),
    );
    expect(merged).toEqual(['Shingeki no Kyojin']);
  });

  it('overlay merge (writeWinnerToColumn) stores one entry, the legacy spelling', () => {
    const metadata: Record<string, unknown> = { alternativeTitles: [variants[0]] };
    writeWinnerToColumn('synonyms', { value: variants.slice(1), provider: 'kitsu' }, metadata, {});
    expect(metadata['alternativeTitles']).toEqual(['Shingeki no Kyojin']);
  });

  it('list selector (selectList) keeps one item', () => {
    const result = selectList({
      mangaId: 1,
      field: 'synonyms',
      fieldType: 'list',
      existingValue: null,
      existingProvider: null,
      candidates: [
        { field: 'synonyms', provider: 'anilist', value: variants.slice(0, 2), matchConfidence: 0.95 },
        { field: 'synonyms', provider: 'kitsu', value: variants.slice(2), matchConfidence: 0.95 },
      ],
    });
    expect(result.winner?.value).toEqual(['Shingeki no Kyojin']);
  });
});

describe('persistMergedSynonyms', () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    update.mockImplementation(() => Promise.resolve({}));
  });

  it('writes a list that only shrinks: stored case-duplicates are removed even when providers add nothing', async () => {
    storedSynonyms(['Attack on Titan', 'ATTACK ON TITAN', 'AoT', 'aot']);
    await persistMergedSynonyms(52, providers({ altTitles: ['Attack On Titan'] }));
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { synonyms: ['Attack on Titan', 'AoT'] } });
  });

  it('writes when one duplicate is removed and one title added (same length, different content)', async () => {
    // The old guard compared lengths only, so this change was skipped.
    storedSynonyms(['Gantz', 'GANTZ']);
    await persistMergedSynonyms(44, providers({ mangaupdates: ['ガンツ'] }));
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { synonyms: ['Gantz', 'ガンツ'] } });
  });

  it('does not write when the stored list is already the merged list', async () => {
    storedSynonyms(['Kaiju No.8', '怪獣8号']);
    await persistMergedSynonyms(79, providers({ altTitles: ['KAIJU NO.8'], kitsu: { canonicalTitle: 'Kaiju No.8', alternativeTitles: ['怪獣8号'] } }));
    expect(update).not.toHaveBeenCalled();
  });
});

describe('sameSynonymList', () => {
  it('compares content and order, not length', () => {
    expect(sameSynonymList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameSynonymList(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameSynonymList(['a', 'b'], ['a'])).toBe(false);
  });
});
