/**
 * Post-enrichment hooks
 *
 * Runs after Phase 6 (completeness audit) inside `runEnrichmentPipeline`.
 * Replaces the prior `setTimeout(2000)` trigger in `add-manga-events.ts` that
 * raced enrichment and read zero Chapter rows. By Phase 6, chapter rows are
 * guaranteed to exist, so dispatchers can read `monitored && missing` reliably.
 *
 * Two hooks today:
 * 1. {@link maybeSyncSuwayomiChapters} — pulls Suwayomi-only chapters into
 *    Kaizoku's Chapter table (new rows when no chapterNumber match) so the
 *    dispatcher sees them as native-Suwayomi candidates.
 * 2. {@link maybeTriggerAutoDownload} — kicks the auto-download scheduler
 *    when the manga's `autoDownloadRule.enabled` flag is set. Task #25 will
 *    swap this for `unifiedReleaseSearch.run(mangaId)`.
 */

import { prisma } from '@/server/db';
import { unifiedReleaseSearch } from '@/server/services/library/releaseDispatcher/dispatch';
import { syncSuwayomiChapters } from '@/server/services/suwayomi/chapter-sync';
import { readSuwayomiPluginConfig } from '@/server/services/suwayomi/manga-matcher';
import { logger } from '@/utils/logger';

/**
 * Sync Suwayomi chapters into the local DB if the plugin is enabled and the
 * matcher has run. Source-only chapters materialize as fresh Chapter rows so
 * the dispatcher can pick them up via the `(mangaId, chapterNumber)` dedup key.
 */
export async function maybeSyncSuwayomiChapters(mangaId: number): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { suwayomiPluginConfig: true },
    });
    const cfg = readSuwayomiPluginConfig(manga?.suwayomiPluginConfig ?? null);
    if (!cfg.enabled || cfg.mangaId === undefined) return;
    const result = await syncSuwayomiChapters(mangaId);
    logger.info(`[enrichmentPipeline] Suwayomi sync complete for manga ${mangaId}`, {
      matched: result.matched,
      unmatched: result.unmatched,
      created: result.suwayomiOnly,
    });
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Suwayomi sync failed for manga ${mangaId}`, { err });
  }
}

/**
 * Trigger the unified release search for every user who has an enabled
 * auto-download rule for this manga. Rules are per-user (shared catalog), so a
 * single title may be monitored by several users; we fire one dispatch per
 * owner, attributed to that user (`initiatedByUserId`) so the resulting
 * jobs/downloads land in the right user's queue. Fire and forget — failures
 * log but never block enrichment completion.
 */
export async function maybeTriggerAutoDownload(mangaId: number): Promise<void> {
  try {
    const rules = await prisma.autoDownloadRule.findMany({
      where: { mangaId, enabled: true },
      select: { userId: true },
    });
    if (rules.length === 0) return;
    logger.info(`[enrichmentPipeline] Triggering unified release search for manga ${mangaId} post-enrichment (${rules.length} user rule(s))`);
    for (const rule of rules) {
      unifiedReleaseSearch.run(mangaId, { initiatedByUserId: rule.userId }).catch((err: unknown) => {
        logger.error(`[enrichmentPipeline] unified release search failed for manga ${mangaId} (user ${rule.userId})`, { err });
      });
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] auto-download check failed for manga ${mangaId}`, { err });
  }
}
