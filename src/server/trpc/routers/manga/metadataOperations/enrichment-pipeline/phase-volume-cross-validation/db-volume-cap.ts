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

export async function getVolumeCapForManga(
  mangaId: number,
  callerHint?: number,
): Promise<VolumeCap> {
  if (callerHint !== undefined && callerHint > 0) {
    return { cap: Math.ceil(callerHint * OVERSHOOT_FACTOR), source: 'caller' };
  }
  const rows = await prisma.$queryRaw<Array<{ volumes: number | null; country: string | null; format: string | null }>>`
    SELECT md.volumes AS volumes, md."countryOfOrigin" AS country, md.format AS format
    FROM "Manga" m JOIN "Metadata" md ON m."metadataId" = md.id
    WHERE m.id = ${mangaId}
  `;
  const row = rows[0];
  if (!row) return { cap: Infinity, source: 'none' };
  if (row.volumes !== null && row.volumes > 0) {
    return { cap: Math.ceil(row.volumes * OVERSHOOT_FACTOR), source: 'metadata' };
  }
  if (row.country === 'KR' && row.format !== 'NOVEL' && (row.volumes === 0 || row.volumes === null)) {
    return { cap: KR_WEBTOON_CAP, source: 'kr-webtoon' };
  }
  return { cap: Infinity, source: 'none' };
}
