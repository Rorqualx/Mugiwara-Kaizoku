/**
 * `Metadata.fieldAlternatives` reflects the latest enrichment run.
 *
 * Bugs protected:
 *  - the overlay sent every unkept list item (dozens of tags or synonyms)
 *    while the schema allows 8 per field, and the persister dropped the WHOLE
 *    payload on validation failure, without a log line — 46 titles empty;
 *  - a run with no dissent sent nothing, so the previous run's alternatives
 *    stayed in the column — 11 titles stale.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({ realtimeEmitter: { emitMangaUpdate: jest.fn() } }));

import { prisma } from '@/server/db';
import { MetadataPersistenceService } from '@/server/services/metadata/metadata-persister';
import { applySelectorCutover, stashFieldAlternatives } from '@/server/services/metadata/selectors/cutover-overlay';
import type { ShadowFieldOutcome, ShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';
import {
  MAX_FIELD_ALTERNATIVES,
  fieldAlternativesSchema,
  parseFieldAlternatives,
  sanitizeFieldAlternatives,
} from '@/types/domain/field-alternatives-types';

function alt(i: number, confidence = 0.5): { provider: 'mangadex'; value: string; confidence: number } {
  return { provider: 'mangadex', value: `item-${i}`, confidence };
}

function outcome(partial: Partial<ShadowFieldOutcome>): ShadowFieldOutcome {
  return {
    winnerProvider: 'anilist',
    winnerValue: ['kept'],
    confidence: 0.9,
    confidenceClass: 'persist',
    alternatives: [],
    guardRefused: false,
    reason: 'test',
    ...partial,
  } as ShadowFieldOutcome;
}

function shadow(outcomes: Array<[string, ShadowFieldOutcome]>): ShadowSelection {
  return { outcomes: new Map(outcomes), refusedFields: [] } as unknown as ShadowSelection;
}

/** Persist `metadata` over a stored row and return the Metadata update data. */
async function persistOver(
  storedAlternatives: unknown,
  metadata: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const captured: { row: Record<string, unknown> } = { row: {} };
  const stored = {
    id: 100, cover: '/c.jpg', summary: 's', genres: [], authors: [], artists: [], tags: [], themes: [],
    synonyms: [], urls: [], status: 'ONGOING', fieldAlternatives: storedAlternatives,
  };
  const manga = { id: 1, metadataId: 100, Metadata: stored, providerMetadata: {} };
  const tx = {
    manga: { findUnique: jest.fn(() => Promise.resolve(manga)), update: jest.fn(() => Promise.resolve(manga)) },
    metadata: {
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        captured.row = args.data;
        return Promise.resolve({ id: 100 });
      }),
      update: jest.fn((args: { data: Record<string, unknown> }) => {
        captured.row = args.data;
        return Promise.resolve({ ...stored, ...args.data });
      }),
    },
  };
  (prisma.$transaction as unknown as jest.Mock).mockImplementation(
    (callback: unknown) => (callback as (client: typeof tx) => Promise<unknown>)(tx),
  );
  await new MetadataPersistenceService().persistMetadata({
    mangaId: 1, metadata: { title: 'T', ...metadata } as never, metadataProvenance: {},
  });
  return captured.row;
}

describe('applySelectorCutover — fieldAlternatives cap', () => {
  it('keeps at most MAX_FIELD_ALTERNATIVES per field, highest confidence first, so the payload passes the schema', () => {
    const many = Array.from({ length: 40 }, (_, i) => alt(i, i / 100));
    const result = applySelectorCutover(
      shadow([['cover', outcome({ winnerValue: '/kept.jpg', alternatives: many })]]), {}, {},
    );
    const covers = result.fieldAlternatives['cover'] ?? [];
    expect(covers).toHaveLength(MAX_FIELD_ALTERNATIVES);
    expect(covers.map(a => a.value)).toEqual(['item-39', 'item-38', 'item-37', 'item-36', 'item-35', 'item-34', 'item-33', 'item-32']);
    expect(fieldAlternativesSchema.safeParse(result.fieldAlternatives).success).toBe(true);
  });

  it('caps the alternatives of an abstained objective field too', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...alt(i), value: i }));
    const result = applySelectorCutover(
      shadow([['chapters', outcome({ winnerProvider: null, winnerValue: null, alternatives: many })]]), {}, {},
    );
    expect(result.fieldAlternatives['chapters']).toHaveLength(MAX_FIELD_ALTERNATIVES);
  });
});

describe('applySelectorCutover — list fields', () => {
  it('stores no alternatives for a list field: its unkept items are not rejected values (title 52 showed seven stored synonyms as rejected)', () => {
    const unkept = Array.from({ length: 5 }, (_, i) => alt(i, 0.02));
    const result = applySelectorCutover(
      shadow([
        ['synonyms', outcome({ winnerValue: ['Shingeki no Kyojin'], alternatives: unkept })],
        ['tags', outcome({ winnerValue: ['Action'], alternatives: unkept })],
        ['cover', outcome({ winnerValue: '/kept.jpg', alternatives: [alt(9, 0.4)] })],
      ]), {}, {},
    );
    expect(Object.keys(result.fieldAlternatives)).toEqual(['cover']);
  });
});

describe('stashFieldAlternatives', () => {
  it('sends {} when two providers reported and none dissented, so a stale column is cleared (11 titles held an earlier run\'s alternatives)', () => {
    const metadata: Record<string, unknown> = {};
    expect(stashFieldAlternatives(metadata, {}, 2)).toBe(true);
    expect(metadata['fieldAlternatives']).toEqual({});
  });

  it('sends nothing when only one provider reported: an outage cannot dissent and must not erase the stored cover alternatives', () => {
    const metadata: Record<string, unknown> = {};
    expect(stashFieldAlternatives(metadata, {}, 1)).toBe(false);
    expect('fieldAlternatives' in metadata).toBe(false);
  });

  it('always sends a run that has dissent, and does nothing without a metadata record', () => {
    const metadata: Record<string, unknown> = {};
    const dissent = { cover: [alt(1)] };
    expect(stashFieldAlternatives(metadata, dissent, 1)).toBe(true);
    expect(metadata['fieldAlternatives']).toBe(dissent);
    expect(stashFieldAlternatives(undefined, dissent, 3)).toBe(false);
  });
});

describe('sanitizeFieldAlternatives', () => {
  it('cuts an over-long field to the cap and reports it, leaving the other fields intact', () => {
    const result = sanitizeFieldAlternatives({
      status: [{ provider: 'mal', value: 'FINISHED', confidence: 0.4 }],
      tags: Array.from({ length: 30 }, (_, i) => alt(i)),
    });
    expect(result?.truncatedFields).toEqual(['tags']);
    expect(result?.rejectedFields).toEqual([]);
    expect(result?.value['tags']).toHaveLength(MAX_FIELD_ALTERNATIVES);
    expect(result?.value['status']).toEqual([{ provider: 'mal', value: 'FINISHED', confidence: 0.4 }]);
  });

  it('drops only the field with a malformed entry and reports it', () => {
    const result = sanitizeFieldAlternatives({
      status: [{ provider: 'mal', value: 'FINISHED', confidence: 0.4 }],
      volumes: [{ provider: 'kitsu', value: 34, confidence: 1.7 }],
      cover: 'not-a-list',
    });
    expect(result?.rejectedFields.sort()).toEqual(['cover', 'volumes']);
    expect(Object.keys(result?.value ?? {})).toEqual(['status']);
  });

  it('returns {} for an empty payload and null for a non-object', () => {
    expect(sanitizeFieldAlternatives({})).toEqual({ value: {}, truncatedFields: [], rejectedFields: [] });
    expect(sanitizeFieldAlternatives('x')).toBeNull();
    expect(sanitizeFieldAlternatives([])).toBeNull();
  });
});

describe('persister — fieldAlternatives column', () => {
  const stale = { status: [{ provider: 'mal', value: 'ONGOING', confidence: 0.3 }] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes the valid fields when one field is over the cap, instead of dropping the whole payload', async () => {
    const row = await persistOver(null, {
      fieldAlternatives: {
        status: [{ provider: 'mal', value: 'FINISHED', confidence: 0.4 }],
        synonyms: Array.from({ length: 26 }, (_, i) => alt(i)),
      },
    });
    const written = row['fieldAlternatives'] as Record<string, unknown[]>;
    expect(written['status']).toHaveLength(1);
    expect(written['synonyms']).toHaveLength(MAX_FIELD_ALTERNATIVES);
  });

  it('writes {} when the run produced no alternatives, replacing what an earlier run stored', async () => {
    const row = await persistOver(stale, { fieldAlternatives: {} });
    expect(row['fieldAlternatives']).toEqual({});
  });

  it('leaves the column alone when the caller sends no fieldAlternatives key (not an enrichment run)', async () => {
    const row = await persistOver(stale, {});
    expect('fieldAlternatives' in row).toBe(false);
  });
});

describe('readers treat {} like null', () => {
  it('parseFieldAlternatives({}) has no entry for any field, as with null', () => {
    const empty = parseFieldAlternatives({});
    expect(empty).toEqual({});
    expect(empty?.['cover'] ?? []).toEqual([]);
    expect(parseFieldAlternatives(null)?.['cover'] ?? []).toEqual([]);
  });
});
