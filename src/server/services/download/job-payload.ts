/**
 * Shared helper for pulling the authoritative chapter-id set from a
 * job's payload. Used by:
 *   - torrent-health.handleProgressFailure (soft-fail scoping)
 *   - jobs.getJobDetail tRPC query (affected-chapters/volumes view)
 *
 * Prowlarr and native dispatchers always write
 * `payload.chapterIds: number[]` when they enqueue a chapter_download
 * job (see prowlarr-handler.ts:147,315). When the field is missing or
 * malformed, callers fall back to a broader sweep.
 */

import type { Prisma } from '@prisma/client';

export function extractChapterIdsFromPayload(payload: Prisma.JsonValue): number[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const candidate = (payload as Record<string, unknown>)['chapterIds'];
  if (!Array.isArray(candidate)) return [];
  const ids: number[] = [];
  for (const v of candidate) {
    if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) ids.push(v);
  }
  return ids;
}
