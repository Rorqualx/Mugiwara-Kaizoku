/**
 * iter-GC2 — GetComics enqueue path.
 *
 * GetComics adapter emits pack-granularity candidates whose payload
 * carries the detail-page URL (the getcomics.org listing page). To
 * dispatch them, we have to resolve the detail page → DDL link
 * (MediaFire / MEGA / Zippyshare / etc.) and create a job with the
 * resolved URL — the queue handler at `queue/handlers/getcomics.ts`
 * expects a fully-resolved `downloadUrl`.
 *
 * Fail-soft: if DDL resolution returns no links or errors, return
 * false. The caller (`enqueueNativeCandidate` in dispatch.ts) records
 * a failed attempt via iter-EX so the chapter falls through to
 * Prowlarr on the next dispatch cycle.
 */
import { JobType, NativeDownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { queueManager } from '@/server/queue/queueManager';
import { getGetComicsService } from '@/server/services/getcomics';
import type { GetComicsCandidatePayload } from '@/server/services/library/indexerSearch/adapters/getcomics-adapter';
import type { ReleaseCandidate } from '@/server/services/library/indexerSearch/types';
import { resolveChapterDestination } from '@/server/services/library/releaseDispatcher/dispatch';
import { createActiveNativeDownload } from '@/server/services/library/releaseDispatcher/native-download-guard';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';


const log = logger.child('GetComicsEnqueue');

export async function enqueueGetComicsCandidate(
  candidate: ReleaseCandidate,
  mangaId: number,
  chapterRowId: number,
  chapterNumber: number,
): Promise<boolean> {
  const payload = candidate.payload as GetComicsCandidatePayload;
  if (!payload.detailPageUrl) {
    log.warn('Skipping GetComics enqueue: candidate payload has no detailPageUrl', {
      mangaId, chapterRowId,
    });
    return false;
  }

  // 1. Resolve the detail page → list of DDL mirrors.
  const service = getGetComicsService();
  const detailResult = await service.getDownloadLinks(payload.detailPageUrl);
  if (!isSuccess(detailResult)) {
    log.info('GetComics enqueue: detail-page resolution failed (fail-soft)', {
      mangaId, chapterRowId, detailPageUrl: payload.detailPageUrl,
    });
    return false;
  }
  // Match the older downloadManager handler's behavior — pick the first link.
  // Site's own list-ordering puts the main download first, mirrors after.
  const [selectedLink] = detailResult.data.downloadLinks;
  if (selectedLink === undefined) {
    log.info('GetComics enqueue: detail page has no download links (fail-soft)', {
      mangaId, chapterRowId, detailPageUrl: payload.detailPageUrl,
    });
    return false;
  }

  // 2. Resolve a destination path on disk.
  const destinationPath = await resolveChapterDestination(mangaId, chapterNumber);
  if (destinationPath === null) {
    log.warn('Skipping GetComics enqueue: manga has no resolvable library path', {
      mangaId, chapterRowId,
    });
    return false;
  }

  // 3. Create NativeDownload tracking row. Pattern mirrors enqueueMangaDex /
  //    enqueueSuwayomi (same try/rollback so a queue-enqueue failure doesn't
  //    leave an orphan QUEUED row behind).
  const dl = await createActiveNativeDownload({
    mangaId,
    chapterId: chapterRowId,
    chapterNumber,
    sourceType: 'GETCOMICS',
    destinationPath,
  });
  if (dl === null) return false;

  try {
    await queueManager.enqueue(
      JobType.getcomics_download,
      {
        mangaId,
        chapterId: chapterRowId,
        downloadUrl: selectedLink.url,
        fileName: `${payload.title}.cbz`,
        destPath: destinationPath,
      },
      // Surface manga/chapter on FK columns so the Jobs page renders
      // the manga title + chapter row instead of "System Task".
      { mangaId, chapterId: chapterRowId },
    );
  } catch (err: unknown) {
    await prisma.nativeDownload.update({
      where: { id: dl.id },
      data: {
        status: NativeDownloadStatus.CANCELLED,
        error: `Failed to enqueue companion job: ${err instanceof Error ? err.message : String(err)}`,
        endTime: new Date(),
      },
    });
    throw err;
  }
  log.info('GetComics enqueue: queued download job', {
    mangaId, chapterRowId, chapterNumber, detailPageUrl: payload.detailPageUrl,
    selectedMirrorHost: selectedLink.host,
  });
  return true;
}
