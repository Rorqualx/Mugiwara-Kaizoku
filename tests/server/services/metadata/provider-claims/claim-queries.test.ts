/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import {
  getLastGoodClaimFrom,
  getLatestClaimsFrom,
  pruneOldClaimRunsIn,
  writeClaimRunTo,
  type ClaimDb,
} from '@/server/services/metadata/provider-claims/claim-queries';
import {
  CLAIM_RUNS_KEPT_PER_TITLE,
  FETCH_FIELD,
  type ClaimFetchOutcome,
  type ClaimRow,
  type ClaimRunBatch,
} from '@/server/services/metadata/provider-claims/claim-types';

import { createFakeClaimDb, type FakeClaimDb } from './fake-claim-db';

const MANGA = 73;

function fetchRow(provider: string, outcome: ClaimFetchOutcome): ClaimRow {
  return {
    provider, kind: 'fetch', field: FETCH_FIELD, providerRecordId: null, value: null, fetchOutcome: outcome,
    selectorOutcome: null, inWinningGroup: null, matchConfidence: null, fieldConfidence: null, detail: null,
  };
}

function scalarRow(provider: string, field: string, value: number, outcome: ClaimFetchOutcome): ClaimRow {
  return {
    provider, kind: 'scalar', field, providerRecordId: null, value, fetchOutcome: outcome,
    selectorOutcome: 'winner', inWinningGroup: true, matchConfidence: 0.9, fieldConfidence: 0.5, detail: null,
  };
}

/** A run at minute `n`, so runs sort by their number. */
function batch(n: number, rows: ClaimRow[], mangaId: number = MANGA): ClaimRunBatch {
  return { mangaId, runId: `run-${mangaId}-${n}`, startedAt: new Date(Date.UTC(2026, 9, 12, 0, n)), rows };
}

/** Write a run and wait for the retention delete the write itself does not wait for. */
async function writeAndSettle(db: ClaimDb, run: ClaimRunBatch): Promise<void> {
  const result = await writeClaimRunTo(db, run);
  await result.retention;
}

/** Write runs 1..count in order, one fetch row each. */
async function writeRuns(fake: FakeClaimDb, count: number): Promise<void> {
  for (let n = 1; n <= count; n++) {
    // eslint-disable-next-line no-await-in-loop -- runs are written in order on purpose
    await writeAndSettle(fake.db, batch(n, [fetchRow('anilist', 'ok')]));
  }
}

function runsLeft(fake: FakeClaimDb): string[] {
  return [...new Set(fake.rows.map(r => r.runId))].sort();
}

describe('writing a run', () => {
  it('writes every row of a run in a single insert, stamped with the run id and start time', async () => {
    const fake = createFakeClaimDb();
    const run = batch(1, [fetchRow('anilist', 'ok'), scalarRow('anilist', 'chapters', 706, 'ok')]);

    expect((await writeClaimRunTo(fake.db, run)).written).toBe(2);

    expect(fake.calls.createMany).toBe(1);
    expect(fake.rows.map(r => r.runId)).toEqual(['run-73-1', 'run-73-1']);
    expect(fake.rows.every(r => r.createdAt.getTime() === run.startedAt.getTime())).toBe(true);
  });

  it('does not touch the database for a run with no rows', async () => {
    const fake = createFakeClaimDb();
    expect((await writeClaimRunTo(fake.db, batch(1, []))).written).toBe(0);
    expect(fake.calls.createMany).toBe(0);
  });

  it('reports 0 rows instead of throwing when the insert fails', async () => {
    const fake = createFakeClaimDb();
    fake.failOn('createMany');
    const result = await writeClaimRunTo(fake.db, batch(1, [fetchRow('anilist', 'ok')]));
    expect(result.written).toBe(0);
    await expect(result.retention).resolves.toBe(0);
  });

  it('still reports the rows written when retention fails afterwards, and retention never rejects', async () => {
    const fake = createFakeClaimDb();
    fake.failOn('groupBy');
    const result = await writeClaimRunTo(fake.db, batch(1, [fetchRow('anilist', 'ok')]));
    expect(result.written).toBe(1);
    await expect(result.retention).resolves.toBe(0);
    expect(fake.rows).toHaveLength(1);
  });

  it('returns from the write before the retention delete has run', async () => {
    const fake = createFakeClaimDb();
    await writeRuns(fake, CLAIM_RUNS_KEPT_PER_TITLE);
    fake.slowRetention(30);

    const result = await writeClaimRunTo(fake.db, batch(CLAIM_RUNS_KEPT_PER_TITLE + 1, [fetchRow('anilist', 'ok')]));

    // The insert is done and one run is over the limit, yet nothing is deleted yet.
    expect(result.written).toBe(1);
    expect(fake.calls.deleteMany).toBe(0);
    await expect(result.retention).resolves.toBe(1);
    expect(fake.calls.deleteMany).toBe(1);
  });
});

describe('retention', () => {
  it('keeps the newest N runs of a title when a run is written and deletes the older ones', async () => {
    const fake = createFakeClaimDb();
    const total = CLAIM_RUNS_KEPT_PER_TITLE + 3;
    await writeRuns(fake, total);

    const left = runsLeft(fake);
    expect(left).toHaveLength(CLAIM_RUNS_KEPT_PER_TITLE);
    expect(left).not.toContain('run-73-1');
    expect(left).not.toContain('run-73-3');
    expect(left).toContain('run-73-4');
    expect(left).toContain(`run-73-${total}`);
  });

  it('deletes the OLDEST runs: with a limit of 2, the two most recent of five survive', async () => {
    const fake = createFakeClaimDb();
    await writeRuns(fake, 5);

    await expect(pruneOldClaimRunsIn(fake.db, MANGA, 2)).resolves.toBe(3);

    expect(runsLeft(fake)).toEqual(['run-73-4', 'run-73-5']);
  });

  it('keeps the most recently started runs even when they were inserted first', async () => {
    const fake = createFakeClaimDb();
    // Inserted newest-first, so "newest" cannot be mistaken for "inserted last".
    for (const n of [5, 4, 3, 2, 1]) {
      // eslint-disable-next-line no-await-in-loop -- insertion order is the point of the test
      await fake.db.metadataProviderClaim.createMany({
        data: [{ ...fetchRow('anilist', 'ok'), mangaId: MANGA, runId: `run-73-${n}`, createdAt: batch(n, []).startedAt }] as never,
      });
    }

    await pruneOldClaimRunsIn(fake.db, MANGA, 2);

    expect(runsLeft(fake)).toEqual(['run-73-4', 'run-73-5']);
  });

  it('never deletes another title\'s runs', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('anilist', 'ok')], 78));
    await writeAndSettle(fake.db, batch(2, [fetchRow('anilist', 'ok')]));
    await writeAndSettle(fake.db, batch(3, [fetchRow('anilist', 'ok')]));

    await expect(pruneOldClaimRunsIn(fake.db, MANGA, 1)).resolves.toBe(1);

    expect(runsLeft(fake)).toEqual(['run-73-3', 'run-78-1']);
  });
});

describe('getLatestClaims', () => {
  it('returns only the rows of the most recent run', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [scalarRow('anilist', 'chapters', 700, 'ok')]));
    await writeAndSettle(fake.db, batch(2, [fetchRow('anilist', 'ok'), scalarRow('anilist', 'chapters', 706, 'ok')]));

    const latest = await getLatestClaimsFrom(fake.db, MANGA);

    expect(latest?.runId).toBe('run-73-2');
    expect(latest?.claims).toHaveLength(2);
    expect(latest?.claims.find(c => c.kind === 'scalar')?.value).toBe(706);
  });

  it('returns null for a title with no recorded run', async () => {
    const fake = createFakeClaimDb();
    await expect(getLatestClaimsFrom(fake.db, MANGA)).resolves.toBeNull();
  });

  it('throws on a database error rather than reporting "nothing stored"', async () => {
    const fake = createFakeClaimDb();
    fake.failOn('findFirst');
    await expect(getLatestClaimsFrom(fake.db, MANGA)).rejects.toThrow('fake findFirst failure');
  });
});

describe('getLastGoodClaim', () => {
  it('skips a newer run whose fetch failed and returns the claim from the last ok run', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('mal', 'ok'), scalarRow('mal', 'chapters', 686, 'ok')]));
    await writeAndSettle(fake.db, batch(2, [fetchRow('mal', 'failed')]));

    const claim = await getLastGoodClaimFrom(fake.db, MANGA, 'mal', 'chapters');

    expect(claim?.runId).toBe('run-73-1');
    expect(claim?.value).toBe(686);
  });

  it('does not count a gated fetch as good, even though its discarded claim is stored', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('fandom', 'ok'), scalarRow('fandom', 'highestChapter', 140, 'ok')]));
    await writeAndSettle(fake.db, batch(2, [fetchRow('fandom', 'gated'), scalarRow('fandom', 'highestChapter', 700, 'gated')]));

    const claim = await getLastGoodClaimFrom(fake.db, MANGA, 'fandom', 'highestChapter');

    expect(claim?.value).toBe(140);
  });

  it.each(['partial', 'unknown'] as const)('does not count a %s fetch as good', async (outcome) => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('fandom', 'ok'), scalarRow('fandom', 'highestChapter', 686, 'ok')]));
    await writeAndSettle(fake.db, batch(2, [fetchRow('fandom', outcome), scalarRow('fandom', 'highestChapter', 110, outcome)]));

    const claim = await getLastGoodClaimFrom(fake.db, MANGA, 'fandom', 'highestChapter');

    expect(claim?.runId).toBe('run-73-1');
    expect(claim?.value).toBe(686);
  });

  it('returns null when the provider answered ok in its latest good run but made no claim for the field', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('kitsu', 'ok'), scalarRow('kitsu', 'volumes', 74, 'ok')]));
    await writeAndSettle(fake.db, batch(2, [fetchRow('kitsu', 'ok'), scalarRow('kitsu', 'chapters', 706, 'ok')]));

    await expect(getLastGoodClaimFrom(fake.db, MANGA, 'kitsu', 'volumes')).resolves.toBeNull();
  });

  it('returns null when the provider has never answered ok for the title', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('mal', 'failed')]));
    await expect(getLastGoodClaimFrom(fake.db, MANGA, 'mal', 'chapters')).resolves.toBeNull();
  });

  it('never returns the fetch row itself as a claim', async () => {
    const fake = createFakeClaimDb();
    await writeAndSettle(fake.db, batch(1, [fetchRow('mal', 'ok')]));
    await expect(getLastGoodClaimFrom(fake.db, MANGA, 'mal', FETCH_FIELD)).resolves.toBeNull();
  });
});
