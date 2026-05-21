/**
 * Sync Metadata.status → Manga.publicationStatus and stamp lastChecked /
 * lastSyncAt on every successful enrichment. Without this, the entire library
 * sits at `publicationStatus = UNKNOWN` even when the joined Metadata row
 * correctly says ONGOING / COMPLETED / etc. — observable as the "Status:
 * Unknown" badge in the UI for every manga.
 */

import { MangaPublicationStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const log = logger.child('mangaStatusSync');

/** Lift a Metadata.status string into the MangaPublicationStatus enum. */
function mapToPublicationStatus(metadataStatus: string | null | undefined): MangaPublicationStatus | null {
  if (!metadataStatus) return null;
  switch (metadataStatus.toUpperCase()) {
    case 'ONGOING':
    case 'RELEASING':
      return MangaPublicationStatus.ONGOING;
    case 'COMPLETED':
    case 'FINISHED':
      return MangaPublicationStatus.COMPLETED;
    case 'HIATUS':
      return MangaPublicationStatus.HIATUS;
    case 'CANCELLED':
    case 'CANCELED':
      return MangaPublicationStatus.CANCELLED;
    case 'NOT_YET_PUBLISHED':
    case 'NOT_YET_RELEASED':
      return MangaPublicationStatus.NOT_YET_PUBLISHED;
    case 'UPCOMING':
      return MangaPublicationStatus.UPCOMING;
    default:
      return null;
  }
}

/**
 * Pull the joined Metadata.status (if any) and apply it to Manga.publicationStatus.
 * Always stamps lastChecked + lastSyncAt regardless of whether status changed —
 * those timestamps mark "enrichment ran to completion", not "data changed".
 */
export async function syncMangaStatusFromMetadata(mangaId: number): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { publicationStatus: true, Metadata: { select: { status: true } } },
    });
    if (!manga) return;

    const now = new Date();
    const next = mapToPublicationStatus(manga.Metadata?.status);

    const data: { lastChecked: Date; lastSyncAt: Date; updatedAt: Date; publicationStatus?: MangaPublicationStatus } = {
      lastChecked: now,
      lastSyncAt: now,
      updatedAt: now,
    };
    if (next !== null && next !== manga.publicationStatus) {
      data.publicationStatus = next;
    }

    await prisma.manga.update({ where: { id: mangaId }, data });

    if (data.publicationStatus !== undefined) {
      log.info(`Synced publicationStatus for manga ${mangaId}: ${manga.publicationStatus} → ${data.publicationStatus}`);
    }
  } catch (err: unknown) {
    log.warn(`Manga status sync failed for ${mangaId}`, { err });
  }
}
