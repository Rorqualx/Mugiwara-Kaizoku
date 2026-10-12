/**
 * Per-provider claims store — the queries, against whichever client is passed.
 *
 * Kept free of `@/server/db` so a standalone script (which must not import
 * it) and the unit tests can run the same code against their own client.
 * `claim-store.ts` binds these to the application's client.
 *
 * Writes never throw: recording what providers said must not fail or block an
 * enrichment (same contract as `binding-record.ts`).
 *
 * Reads DO throw on a database error. A caller must be able to tell "no claim
 * stored" (null) from "could not look" — the distinction this table exists
 * to keep.
 */

import { Prisma, type PrismaClient } from '@prisma/client';

import { logger } from '@/utils/logger';

import {
  CLAIM_RUNS_KEPT_PER_TITLE,
  FETCH_FIELD,
  type ClaimJson,
  type ClaimRow,
  type ClaimRunBatch,
  type LatestClaims,
  type StoredClaim,
} from './claim-types';

/** The one model these queries touch. */
export type ClaimDb = Pick<PrismaClient, 'metadataProviderClaim'>;

const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

const CLAIM_SELECT = {
  mangaId: true, runId: true, provider: true, kind: true, field: true, providerRecordId: true,
  value: true, fetchOutcome: true, selectorOutcome: true, inWinningGroup: true,
  matchConfidence: true, fieldConfidence: true, detail: true, createdAt: true,
} as const;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function jsonColumn(value: ClaimJson | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value ?? Prisma.DbNull;
}

function toCreateInput(batch: ClaimRunBatch, row: ClaimRow): Prisma.MetadataProviderClaimCreateManyInput {
  return {
    mangaId: batch.mangaId,
    runId: batch.runId,
    provider: row.provider,
    kind: row.kind,
    field: row.field,
    providerRecordId: row.providerRecordId,
    value: jsonColumn(row.value),
    fetchOutcome: row.fetchOutcome,
    selectorOutcome: row.selectorOutcome,
    inWinningGroup: row.inWinningGroup,
    matchConfidence: row.matchConfidence,
    fieldConfidence: row.fieldConfidence,
    detail: jsonColumn(row.detail),
    createdAt: batch.startedAt,
  };
}

/**
 * Delete every run of this title older than the newest `keep`. Never throws.
 * Returns the number of rows deleted.
 */
export async function pruneOldClaimRunsIn(
  db: ClaimDb,
  mangaId: number,
  keep: number = CLAIM_RUNS_KEPT_PER_TITLE,
): Promise<number> {
  try {
    const stale = await db.metadataProviderClaim.groupBy({
      by: ['runId'],
      where: { mangaId },
      _max: { createdAt: true, id: true },
      orderBy: [{ _max: { createdAt: 'desc' } }, { _max: { id: 'desc' } }],
      skip: keep,
    });
    if (stale.length === 0) return 0;
    const deleted = await db.metadataProviderClaim.deleteMany({
      where: { mangaId, runId: { in: stale.map(run => run.runId) } },
    });
    return deleted.count;
  } catch (err: unknown) {
    logger.warn(`Provider-claim retention failed for manga ${mangaId}: ${errorText(err)}`);
    return 0;
  }
}

/**
 * Write one run's rows in a single insert, then apply retention. Never
 * throws. Returns the number of rows written (0 when the write failed).
 */
export async function writeClaimRunTo(db: ClaimDb, batch: ClaimRunBatch): Promise<number> {
  if (batch.rows.length === 0) return 0;
  let written = 0;
  try {
    const result = await db.metadataProviderClaim.createMany({
      data: batch.rows.map(row => toCreateInput(batch, row)),
    });
    written = result.count;
  } catch (err: unknown) {
    logger.warn(`Provider-claim write failed for manga ${batch.mangaId} run ${batch.runId}: ${errorText(err)}`);
    return 0;
  }
  await pruneOldClaimRunsIn(db, batch.mangaId);
  return written;
}

/** Every row of the most recent run recorded for this title, or null when none is stored. */
export async function getLatestClaimsFrom(db: ClaimDb, mangaId: number): Promise<LatestClaims | null> {
  const newest = await db.metadataProviderClaim.findFirst({
    where: { mangaId },
    orderBy: NEWEST_FIRST,
    select: { runId: true, createdAt: true },
  });
  if (!newest) return null;
  const claims: StoredClaim[] = await db.metadataProviderClaim.findMany({
    where: { mangaId, runId: newest.runId },
    orderBy: [{ provider: 'asc' }, { kind: 'asc' }, { field: 'asc' }],
    select: CLAIM_SELECT,
  });
  return { runId: newest.runId, createdAt: newest.createdAt, claims };
}

/**
 * What `provider` said about `field` in the most recent run where its fetch
 * outcome was `ok`.
 *
 * Null when the provider has never answered `ok` for this title, and also
 * when it did answer in that run but made no claim for the field — a provider
 * that answers and no longer states a value has withdrawn it, so an older
 * run's value is not returned in its place.
 */
export async function getLastGoodClaimFrom(
  db: ClaimDb,
  mangaId: number,
  provider: string,
  field: string,
): Promise<StoredClaim | null> {
  const lastGoodFetch = await db.metadataProviderClaim.findFirst({
    where: { mangaId, provider, kind: 'fetch', field: FETCH_FIELD, fetchOutcome: 'ok' },
    orderBy: NEWEST_FIRST,
    select: { runId: true },
  });
  if (!lastGoodFetch) return null;
  return db.metadataProviderClaim.findFirst({
    where: { mangaId, runId: lastGoodFetch.runId, provider, field, kind: { not: 'fetch' } },
    orderBy: NEWEST_FIRST,
    select: CLAIM_SELECT,
  });
}
