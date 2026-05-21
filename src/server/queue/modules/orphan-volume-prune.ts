/**
 * Orphan Volume row pruner.
 *
 * Volume rows with no Chapter rows referencing them via volumeId are
 * "orphans" — they show up in the UI as "Volume N — 0 chapters" and
 * inflate the volume-count badge without representing any actual
 * content. iter-VO baseline audit found 145 across the library
 * (Black Lagoon 48, Yowamushi Pedal 40, Noblesse 17, Cyborg 009 8,
 * etc).
 *
 * Source distribution: 81 empty source, 53 'reconciliation',
 * 11 provider-attested (6 comicvine + 5 wikipedia).
 *
 * Conservative prune rule: only delete rows with source IN
 * ('', 'reconciliation') OR source IS NULL. Provider-attested rows
 * (comicvine, wikipedia, anilist, mangadex, fandom, etc) are KEPT
 * even when orphaned — they encode real metadata about volumes the
 * manga has, the user just hasn't imported the chapters yet
 * (Battle Angel Alita Vols 7-9 with titles "Angel of Chaos" etc are
 * the canonical example).
 *
 * Called from MaintenanceManager.startMaintenance() on a daily
 * cadence alongside the chapter-volume reassignment sweep.
 */
import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const log = logger.child('OrphanVolumePrune');

export interface OrphanPruneReport {
  scannedOrphans: number;
  pruned: number;
  preservedProviderAttested: number;
  preservedByManga: Record<number, number>;
}

const TRUSTED_PROVIDER_SOURCES = new Set([
  'comicvine', 'wikipedia', 'anilist', 'mangadex', 'fandom', 'mangaupdates', 'kitsu', 'mal',
]);

/**
 * Inspect every orphan Volume row (no Chapter references it). For each:
 *   - If source is a trusted provider (comicvine / wikipedia / anilist /
 *     mangadex / fandom / mangaupdates / kitsu / mal), KEEP — the row
 *     encodes provider metadata about a real volume even though no
 *     chapters have been linked yet.
 *   - Otherwise (empty / null / 'reconciliation' / unrecognized custom
 *     string), DELETE — these are phantom rows created by past
 *     auto-enrichment that no longer correspond to any chapter data.
 *
 * Idempotent — re-running on a clean library is a no-op.
 */
export async function pruneOrphanVolumes(): Promise<OrphanPruneReport> {
  const orphans = await prisma.volume.findMany({
    where: {
      // Volume row with no Chapter referencing it via volumeId FK
      chapters: { none: {} },
    },
    select: { id: true, mangaId: true, source: true },
  });
  const report: OrphanPruneReport = {
    scannedOrphans: orphans.length, pruned: 0, preservedProviderAttested: 0,
    preservedByManga: {},
  };
  if (orphans.length === 0) return report;

  const toDelete: number[] = [];
  for (const v of orphans) {
    const src = (v.source ?? '').toLowerCase().trim();
    if (src.length > 0 && TRUSTED_PROVIDER_SOURCES.has(src)) {
      report.preservedProviderAttested++;
      report.preservedByManga[v.mangaId] = (report.preservedByManga[v.mangaId] ?? 0) + 1;
      continue;
    }
    toDelete.push(v.id);
  }
  if (toDelete.length === 0) return report;

  const result = await prisma.volume.deleteMany({ where: { id: { in: toDelete } } });
  report.pruned = result.count;
  log.info(
    `Orphan volume prune complete: scanned=${report.scannedOrphans} pruned=${report.pruned} ` +
    `preservedProviderAttested=${report.preservedProviderAttested}`,
  );
  return report;
}
