/**
 * Binding-as-record (#2): durable provider-binding decisions.
 *
 * The live binding still lives in `Manga.providerMetadata.<provider>` (payload/
 * cache). This module is the DURABLE MEMORY the enrichment loop consults so a
 * wrong auto-binding can be REJECTED and not re-picked on reidentify — the
 * Attack-on-Titan sticky-id loop, where the pipeline kept re-fetching a
 * spinoff's AniList id because nothing remembered it was wrong.
 *
 * Rows are append-only. The current state per (manga, provider) is the latest
 * un-superseded row; rejections are `origin: 'rejected'` rows that stay active
 * (supersededAt IS NULL) until a deliberate manual bind clears them.
 *
 * Every write swallows+logs its own failure — recording provenance must NEVER
 * block or fail enrichment (same contract as `persist-attempt.ts`).
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export type BindingOrigin = 'manual' | 'auto' | 'rejected';

export interface RecordBindingInput {
  mangaId: number;
  /** Lowercase provider id (see the provider registry / SourceName). */
  provider: string;
  providerId: string;
  origin: 'manual' | 'auto';
  score?: number | null;
  reason?: string | null;
}

export interface RecordRejectionInput {
  mangaId: number;
  provider: string;
  /** The entity id that must not be re-picked. */
  providerId: string;
  reason?: string | null;
}

/**
 * Append a manual/auto binding decision. Fire-and-forget — never throws.
 */
export async function recordBinding(input: RecordBindingInput): Promise<void> {
  try {
    await prisma.providerBinding.create({
      data: {
        mangaId: input.mangaId,
        provider: input.provider,
        providerId: input.providerId,
        origin: input.origin,
        score: input.score ?? null,
        reason: input.reason ?? null,
      },
    });
  } catch (err: unknown) {
    logger.warn(
      `ProviderBinding record failed for manga ${input.mangaId}/${input.provider}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Record that `providerId` must not be re-picked for this (manga, provider).
 * Idempotent: a no-op if an active (un-superseded) rejection for that id
 * already exists. Fire-and-forget — never throws.
 */
export async function recordRejection(input: RecordRejectionInput): Promise<void> {
  try {
    const existing = await prisma.providerBinding.findFirst({
      where: {
        mangaId: input.mangaId,
        provider: input.provider,
        providerId: input.providerId,
        origin: 'rejected',
        supersededAt: null,
      },
      select: { id: true },
    });
    if (existing) return; // already rejected — don't pile up duplicate rows

    await prisma.providerBinding.create({
      data: {
        mangaId: input.mangaId,
        provider: input.provider,
        providerId: input.providerId,
        origin: 'rejected',
        reason: input.reason ?? null,
      },
    });
    logger.info(
      `ProviderBinding: rejected ${input.provider} id ${input.providerId} for manga ${input.mangaId}` +
      (input.reason ? ` (${input.reason})` : ''),
    );
  } catch (err: unknown) {
    logger.warn(
      `ProviderBinding rejection failed for manga ${input.mangaId}/${input.provider}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Active (un-superseded) rejected provider ids for a (manga, provider). Used to
 * keep the enrichment matcher from re-picking a known-wrong entity. Returns an
 * empty set on any error — a read failure must not blacklist nothing-or-block.
 */
export async function getRejectedIds(mangaId: number, provider: string): Promise<Set<string>> {
  try {
    const rows = await prisma.providerBinding.findMany({
      where: { mangaId, provider, origin: 'rejected', supersededAt: null },
      select: { providerId: true },
    });
    return new Set(rows.map((r) => r.providerId));
  } catch (err: unknown) {
    logger.warn(
      `ProviderBinding getRejectedIds failed for manga ${mangaId}/${provider}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return new Set();
  }
}

/**
 * Clear (supersede) any active rejection of `providerId` — called when a user
 * deliberately binds that id, so a manual pin always overrides a prior
 * rejection. Fire-and-forget — never throws.
 */
export async function clearRejection(mangaId: number, provider: string, providerId: string): Promise<void> {
  try {
    await prisma.providerBinding.updateMany({
      where: { mangaId, provider, providerId, origin: 'rejected', supersededAt: null },
      data: { supersededAt: new Date() },
    });
  } catch (err: unknown) {
    logger.warn(
      `ProviderBinding clearRejection failed for manga ${mangaId}/${provider}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
