/**
 * Per-provider claims store — bound to the application's database client.
 *
 * See `claim-queries.ts` for the queries and their contracts: writes never
 * throw; reads throw on a database error and return null only for "nothing
 * stored".
 */

import { prisma } from '@/server/db';

import { getLastGoodClaimFrom, getLatestClaimsFrom, writeClaimRunTo } from './claim-queries';

import type { ClaimRunBatch, LatestClaims, StoredClaim } from './claim-types';

/** Write one run's rows in a single insert and apply retention. Never throws. */
export async function writeClaimRun(batch: ClaimRunBatch): Promise<number> {
  return writeClaimRunTo(prisma, batch);
}

/** Every row of the most recent run recorded for this title, or null when none is stored. */
export async function getLatestClaims(mangaId: number): Promise<LatestClaims | null> {
  return getLatestClaimsFrom(prisma, mangaId);
}

/**
 * What `provider` said about `field` in the most recent run where its fetch
 * outcome was `ok` (null when it never was, or made no claim for the field
 * in that run).
 *
 * Nothing in the pipeline calls this: carrying a claim over a failed fetch is
 * a selection rule, and that rule is not built.
 */
export async function getLastGoodClaim(mangaId: number, provider: string, field: string): Promise<StoredClaim | null> {
  return getLastGoodClaimFrom(prisma, mangaId, provider, field);
}
