/**
 * Field-review markers.
 *
 * When the consensus selector commits an OBJECTIVE field (volumes/chapters/
 * status) at low confidence, or abstains on it, we record a review marker on
 * `Manga.providerMetadata.fieldReview` so the manga-detail badge can surface
 * "low-confidence / needs review" for that field. This is the field-level
 * companion to the series-level `providerMetadata.bindingReview` flag.
 *
 * Subjective/list fields (rating, tags, genres) are excluded — they disagree
 * by nature, so a review marker there would be pure noise.
 *
 * The marker set is REPLACED each enrichment (unlike bindingReview): field
 * confidence is self-computed by the selector, not witness-contaminated, so a
 * full rebuild correctly self-clears fields that now resolve confidently.
 */


import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

/** Objective fields whose low-confidence/abstain state is worth surfacing. */
export const OBJECTIVE_REVIEW_FIELDS = new Set(['volumes', 'chapters', 'status']);

export type FieldReviewState = 'low-confidence' | 'abstained';

export interface FieldReviewEntry {
  state: FieldReviewState;
  /** Winner confidence (present for low-confidence commits). */
  confidence?: number;
}

export type FieldReviewMap = Record<string, FieldReviewEntry>;

function parseProviderMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/**
 * Merge-write the current field-review set onto `providerMetadata.fieldReview`,
 * or delete the key when empty. Fire-and-forget — failures log only.
 */
export async function writeFieldReview(mangaId: number, review: FieldReviewMap): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { providerMetadata: true },
    });
    if (!manga) return;

    const pm = parseProviderMetadata(manga.providerMetadata);
    const hasEntries = Object.keys(review).length > 0;
    const hadKey = 'fieldReview' in pm;
    if (!hasEntries && !hadKey) return; // nothing to write or clear

    const merged: Record<string, unknown> = { ...pm };
    if (hasEntries) merged['fieldReview'] = review;
    else delete merged['fieldReview'];

    await prisma.manga.update({
      where: { id: mangaId },
      data: { providerMetadata: merged as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.warn(`[fieldReview] write failed for manga ${mangaId}`, { err });
  }
}
