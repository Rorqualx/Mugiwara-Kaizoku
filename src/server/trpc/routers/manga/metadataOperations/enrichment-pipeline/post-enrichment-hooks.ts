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
import { recordRejection } from '@/server/services/metadata/binding-record';
import {
  detectImplausibleCount,
  PLAUSIBILITY_ANCHORS,
  type CountCandidate,
} from '@/server/services/metadata/plausibility-check';
import { parseProviderMetadata, readProviderId } from '@/server/services/metadata/provider-metadata-utils';
import { syncSuwayomiChapters } from '@/server/services/suwayomi/chapter-sync';
import { readSuwayomiPluginConfig } from '@/server/services/suwayomi/manga-matcher';
import { logger } from '@/utils/logger';

import { resolveExpectedChapterCount } from './phase-volume-cross-validation/chapter-consensus-resolver';
import { resolveExpectedVolumeCount } from './phase-volume-cross-validation/consensus-resolver';

import type { UnifiedProviderResults } from './types';
import type { Prisma } from '@prisma/client';

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

const nonAnchorCandidates = (raw: Array<{ source: string; count: number }>): CountCandidate[] =>
  raw
    .filter(r => !PLAUSIBILITY_ANCHORS.has(r.source))
    .map(r => ({ provider: r.source, value: r.count }));

/**
 * Positive plausibility: ≥2 non-anchor sources agree with the stored count
 * (within 15%). Used to CLEAR a flag only on real evidence — never on mere
 * absence of detection, since a wrong binding can contaminate the witnesses
 * (e.g. MangaDex cross-referenced to the same wrong entity via links.al).
 */
function isCorroborated(stored: number | null | undefined, candidates: CountCandidate[]): boolean {
  if (stored === null || stored === undefined || stored <= 0) return false;
  const agree = candidates.filter(c => Math.abs(c.value - stored) <= 0.15 * stored).length;
  return agree >= 2;
}

/**
 * Flag the manga for reidentification when its persisted volume/chapter count is
 * implausibly low vs a non-anchor consensus — the signature of a wrong provider
 * binding (e.g. Attack on Titan stored as 2 volumes). Sets/clears
 * `providerMetadata.bindingReview`; never overwrites the count itself (the fix
 * is a rebind, not a silent value change). Fire-and-forget — failures log only.
 *
 * Reuses the pipeline's own consensus resolvers for candidate extraction; volume
 * coverage is thinner (mangadex/wikipedia) than the periodic flag-sweep, which
 * remains the thorough backstop for the existing library.
 */
export async function maybePlausibilityCheck(
  mangaId: number,
  result: UnifiedProviderResults,
): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { providerMetadata: true, Metadata: { select: { volumes: true, chapters: true } } },
    });
    if (!manga) return;

    const storedVol = manga.Metadata?.volumes ?? null;
    const storedChap = manga.Metadata?.chapters ?? null;

    // The volume resolver only surfaces mangadex/wikipedia; add Kitsu's
    // independent volumeCount so volumes have more non-anchor witnesses (the
    // chapter resolver already includes kitsu + mangaupdates).
    const volCandidates = nonAnchorCandidates(resolveExpectedVolumeCount(result).raw);
    const kitsuVol = result.kitsuResult?.volumeCount;
    if (typeof kitsuVol === 'number' && kitsuVol > 0) {
      volCandidates.push({ provider: 'kitsu', value: kitsuVol });
    }
    const chapCandidates = nonAnchorCandidates(resolveExpectedChapterCount(result).raw);

    const finding =
      detectImplausibleCount('volumes', storedVol, volCandidates)
      ?? detectImplausibleCount('chapters', storedChap, chapCandidates);

    const pm = parseProviderMetadata(manga.providerMetadata);
    const hadFlag = 'bindingReview' in pm;

    if (finding) {
      const merged = { ...pm, bindingReview: { ...finding, detectedAt: new Date().toISOString() } };
      await prisma.manga.update({
        where: { id: mangaId },
        data: { providerMetadata: merged as Prisma.InputJsonValue },
      });
      logger.warn(`[enrichmentPipeline] binding-review flag set for manga ${mangaId} — suspected wrong binding`, { finding });

      // Binding-as-record: the implausibly-low count means the current anchor
      // (AniList) is bound to the wrong entity. Record a durable REJECTION of
      // that id so the next reidentify re-runs the matcher instead of re-fetching
      // the stuck id (the Attack-on-Titan loop). Reversible via a manual bind.
      const boundAlId = readProviderId(pm, 'anilist');
      if (boundAlId) {
        await recordRejection({
          mangaId,
          provider: 'anilist',
          providerId: boundAlId,
          reason: `plausibility: ${finding.field} ${finding.stored} vs consensus ${finding.consensus} (${finding.ratio}x)`,
        });
      }
    } else if (hadFlag) {
      // Clear ONLY on positive corroboration of the flagged field — not on mere
      // absence of detection (contaminated witnesses can hide the problem).
      const flag = pm['bindingReview'] as { field?: string } | undefined;
      const corroborated = flag?.field === 'chapters'
        ? isCorroborated(storedChap, chapCandidates)
        : isCorroborated(storedVol, volCandidates);
      if (corroborated) {
        const cleared = { ...pm };
        delete cleared['bindingReview'];
        await prisma.manga.update({
          where: { id: mangaId },
          data: { providerMetadata: cleared as Prisma.InputJsonValue },
        });
        logger.info(`[enrichmentPipeline] binding-review flag cleared for manga ${mangaId} — counts now corroborated`);
      }
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] plausibility check failed for manga ${mangaId}`, { err });
  }
}
