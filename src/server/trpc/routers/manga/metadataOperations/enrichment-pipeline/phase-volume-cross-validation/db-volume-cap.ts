/**
 * DB-driven volume cap (iter-MM-8).
 *
 * Many non-canonical Volume write paths (fandom helpers, reconciliation,
 * wikipedia fallback) don't have a UnifiedProviderResults bundle in scope
 * but still need to refuse over-cap volume writes. They use this helper
 * to read the persisted authoritative volume count from Metadata and
 * derive a cap.
 *
 * Order of precedence:
 *   0. A finished series: exactly max(caller value, `Metadata.volumes`).
 *   1. Caller-supplied value (if > 0) wins.
 *   2. Persisted `Metadata.volumes` (AniList anchor).
 *   3. KR-webtoon special case: countryOfOrigin = 'KR' AND volumes = 0
 *      AND format != 'NOVEL'  -> cap = 1 (placeholder only).
 *   4. No signal -> Infinity (no cap; caller decides).
 *
 * Mirrors the audit script's rules so cleanups and the pipeline agree
 * on what counts as "overshoot".
 */

import { prisma } from '@/server/db';

const KR_WEBTOON_CAP = 1;
const OVERSHOOT_FACTOR = 1.1;

export interface VolumeCap {
  cap: number;
  source: 'caller' | 'metadata' | 'kr-webtoon' | 'none';
}

/** Statuses that mean the run has ended: the volume count is final. */
const FINISHED_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED']);

export interface VolumeCapSignal {
  volumes: number | null;
  status: string | null;
  endDate: Date | null;
  country: string | null;
  format: string | null;
}

/**
 * The cap for one title's stored signal and an optional caller hint.
 *
 * A finished series is capped at exactly its volume count. The 1.1x allowance
 * is for a running series whose next volume may not be counted yet; on a
 * finished one it let a "Volume 75" be rebuilt for a 74-volume series (Bleach)
 * by one phase and by the daily sweep, which the phantom prune then deleted on
 * the next refresh, unlinking its chapters each time. A finished series takes
 * the larger of the hint and the stored count: a hint resolved from a sparse
 * source (Tokyo Ghoul: 8 of 14) must not cut real volumes.
 *
 * Pure — no DB.
 */
export function volumeCapFor(signal: VolumeCapSignal | null, callerHint?: number): VolumeCap {
  const hint = callerHint !== undefined && callerHint > 0 ? callerHint : 0;
  const stored = Math.max(0, signal?.volumes ?? 0);
  const finished = Boolean(signal?.endDate) || FINISHED_STATUSES.has(signal?.status ?? '');
  if (finished && (hint > 0 || stored > 0)) {
    return { cap: Math.ceil(Math.max(hint, stored)), source: hint > stored ? 'caller' : 'metadata' };
  }
  if (hint > 0) return { cap: Math.ceil(hint * OVERSHOOT_FACTOR), source: 'caller' };
  if (!signal) return { cap: Infinity, source: 'none' };
  if (stored > 0) return { cap: Math.ceil(stored * OVERSHOOT_FACTOR), source: 'metadata' };
  if (signal.country === 'KR' && signal.format !== 'NOVEL') return { cap: KR_WEBTOON_CAP, source: 'kr-webtoon' };
  return { cap: Infinity, source: 'none' };
}

export async function getVolumeCapForManga(
  mangaId: number,
  callerHint?: number,
): Promise<VolumeCap> {
  const rows = await prisma.$queryRaw<VolumeCapSignal[]>`
    SELECT md.volumes AS volumes, md.status::text AS status, md."endDate" AS "endDate",
           md."countryOfOrigin" AS country, md.format AS format
    FROM "Manga" m JOIN "Metadata" md ON m."metadataId" = md.id
    WHERE m.id = ${mangaId}
  `;
  return volumeCapFor(rows[0] ?? null, callerHint);
}
