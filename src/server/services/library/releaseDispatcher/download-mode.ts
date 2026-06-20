/**
 * Download mode preference — global setting that biases the dispatcher
 * toward volume packs, individual chapters, or the emergent mix.
 *
 * - `mix` (default): current behavior. Native sources dispatch first for
 *   the chapters they can cover, Prowlarr handles the residual. Volume
 *   packs and individual chapters allowed to co-occur.
 * - `prefer-volume`: Prowlarr volume packs get a scoring bonus so they
 *   beat chapter-granularity releases when both cover the same chapter.
 *   Chapters NOT covered by any pack still fall back to native — the
 *   series stays complete.
 * - `prefer-chapter`: chapter-granularity sources go first; native is no
 *   longer pre-empted by the Prowlarr coverage check. Pack candidates get
 *   deprioritized in scoring. Chapters only available via a pack still
 *   download as fallback.
 *
 * Both biased modes are SOFT — they shift scoring and dispatch order,
 * never hard-filter. The user explicitly wants overlap allowed and the
 * series to complete regardless of which mode is selected.
 *
 * @module server/services/library/releaseDispatcher/download-mode
 */

import { getUserConfigValue } from '@/server/services/config/user-config-service';
import type { ScoredSearchResult } from '@/types/quickDownload.types';

/**
 * Renamed from `DownloadMode` to avoid colliding with the Prisma enum of
 * the same name (which classifies trigger type: AUTOMATIC / MANUAL /
 * SCHEDULED / BULK / PACK / AUTO). This is the chapter-vs-volume bias
 * preference, persisted under the config key `download.mode`.
 */
export type DownloadModePreference = 'mix' | 'prefer-volume' | 'prefer-chapter';

export const DEFAULT_DOWNLOAD_MODE: DownloadModePreference = 'mix';

const DOWNLOAD_MODE_CONFIG_KEY = 'download.mode';

/**
 * Read the `download.mode` preference for the initiating user — their per-user
 * override if set, else the admin's global value. Falls back to `'mix'` for any
 * missing/malformed value. Pass userId=undefined for background/system dispatch.
 */
export async function loadDownloadMode(userId?: string): Promise<DownloadModePreference> {
  try {
    const raw = await getUserConfigValue<string>(userId, DOWNLOAD_MODE_CONFIG_KEY, DEFAULT_DOWNLOAD_MODE);
    if (raw === 'prefer-volume' || raw === 'prefer-chapter' || raw === 'mix') {
      return raw;
    }
    return DEFAULT_DOWNLOAD_MODE;
  } catch {
    return DEFAULT_DOWNLOAD_MODE;
  }
}

// Title-shape probes. Both intentionally loose — the goal is bias, not
// classification. A release tagged with both markers (e.g. `Naruto v01 c001`)
// hits both branches and the per-mode logic favors the requested shape.
const VOLUME_MARKER_RE = /\bv(?:ol(?:ume)?)?\.?\s*\d/i;
const COLLECTION_MARKER_RE = /\b(?:complete|full collection|omnibus|tpb)\b/i;
const CHAPTER_MARKER_RE = /\bc(?:h(?:apter)?)?\.?\s*\d/i;

/**
 * Per-release score delta from the active mode preference.
 *
 * Returns 0 for `'mix'` (no bias). For `'prefer-volume'`, volume / collection
 * titles get +40, chapter titles get -15. For `'prefer-chapter'`, chapter
 * titles get +25, volume titles get -20. Magnitudes are calibrated so the
 * underlying reliability signals (seeders, format, indexer reputation) still
 * dominate when the preferred shape isn't available — the bias never makes a
 * 5-seeder release beat a 200-seeder release of the wrong shape, but it does
 * flip the order when scores are close.
 */
export function modeBiasDelta(title: string, mode: DownloadModePreference): number {
  if (mode === 'mix') return 0;
  const hasVolumeMarker = VOLUME_MARKER_RE.test(title) || COLLECTION_MARKER_RE.test(title);
  const hasChapterMarker = CHAPTER_MARKER_RE.test(title);
  if (mode === 'prefer-volume') {
    if (hasVolumeMarker && !hasChapterMarker) return 40;
    if (hasChapterMarker && !hasVolumeMarker) return -15;
    return 0;
  }
  // prefer-chapter
  if (hasChapterMarker && !hasVolumeMarker) return 25;
  if (hasVolumeMarker && !hasChapterMarker) return -20;
  return 0;
}

/**
 * Apply the mode bias to a pre-scored result list and return a new array
 * sorted by adjusted score (highest first). Original entries are not
 * mutated. Pass-through (returns the input array) when `mode === 'mix'`.
 */
export function applyModeBias(
  scored: ScoredSearchResult[],
  mode: DownloadModePreference,
): ScoredSearchResult[] {
  if (mode === 'mix') return scored;
  const adjusted = scored.map((s) => ({
    ...s,
    score: s.score + modeBiasDelta(s.result.title, mode),
  }));
  adjusted.sort((a, b) => b.score - a.score);
  return adjusted;
}
