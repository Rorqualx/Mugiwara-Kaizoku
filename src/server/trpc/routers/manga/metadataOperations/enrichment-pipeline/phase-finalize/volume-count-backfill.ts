/**
 * Backfill Metadata.volumes from the count of Volume rows when the
 * provider claim is missing or wrong. Library survey showed 92.5% of
 * null-volume titles already have populated Volume rows but no count
 * summary on Metadata — mostly from Fandom volume-list extraction
 * filling Volume rows without touching the Manga-level count.
 *
 * iter-B2: treat `volumes = 0` the same as `volumes IS NULL` — both
 * mean "the provider didn't tell us a real count" rather than "this
 * manga literally has zero volumes". The iter-B0 audit found 25/50
 * manga (50% of library) with Metadata.volumes=0 despite having
 * 7-148 Volume rows in DB — Frieren / Hajime no Ippo / Yowamushi
 * Pedal / Black Lagoon / Skip Beat! / ... Without this change the
 * UI badges and external API consumers see 0 even though the rows
 * exist (the StatsSection fix bypasses Metadata.volumes for its
 * counter but downstream views still read it).
 *
 * Runs after `prunePhantomVolumes` so the count reflects real volumes,
 * not wiki-overflow noise. Fill-only when source is missing — never
 * overrides a positive count even if it diverges from DB (those cases
 * need manual review, not automated overwrite).
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export async function backfillMetadataVolumesFromVolumeRows(mangaId: number): Promise<void> {
  try {
    const meta = (await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { Metadata: { select: { id: true, volumes: true } } },
    }))?.Metadata;
    if (!meta) return;
    // iter-B2: 0 is "missing data" not "zero volumes" — backfill it.
    if (meta.volumes !== null && meta.volumes > 0) return;
    const volCount = await prisma.volume.count({ where: { mangaId, number: { gt: 0 } } });
    if (volCount === 0) return;
    await prisma.metadata.update({
      where: { id: meta.id },
      data: { volumes: volCount },
    });
    const prev = meta.volumes === null ? 'null' : String(meta.volumes);
    logger.info(`[enrichmentPipeline] Backfilled Metadata.volumes=${volCount} for manga ${mangaId} (was ${prev})`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to backfill Metadata.volumes for manga ${mangaId} (non-critical)`, err);
  }
}
