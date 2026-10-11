/**
 * "Cancel & blocklist" action for the Jobs page.
 *
 * @module components/jobs/active-page/cancel-and-block
 */
import { isRecord } from '@/components/jobs/active-job-helpers';
import type { JobRowData } from '@/components/jobs/active-job-helpers';
import type { JobMutationsReturn } from '@/hooks/jobs/useJobsPage';
import { extractBtihFromMagnet } from '@/utils/magnet';

/** Pull Prowlarr-sourced release hints (guid, indexerId) from the job's raw
 *  payload when present. Native/pack-import jobs return all-undefined and
 *  block by title + mangaId only. */
function extractReleaseHints(data: JobRowData): { guid?: string; indexerId?: string; source?: string } {
  const payload = data.__raw?.['payload'];
  const prowlarrResult = isRecord(payload) && isRecord(payload['prowlarrResult'])
    ? payload['prowlarrResult'] : null;
  const guid = prowlarrResult && typeof prowlarrResult['guid'] === 'string' ? prowlarrResult['guid'] : undefined;
  const indexerIdRaw = prowlarrResult?.['indexerId'];
  const indexerId = typeof indexerIdRaw === 'number' ? String(indexerIdRaw)
    : typeof indexerIdRaw === 'string' ? indexerIdRaw : undefined;
  const source = typeof data.protocol === 'string' && data.protocol.length > 0 ? data.protocol : undefined;
  return {
    ...(guid !== undefined ? { guid } : {}),
    ...(indexerId !== undefined ? { indexerId } : {}),
    ...(source !== undefined ? { source } : {}),
  };
}

/** Block the release first, then cancel — independent of each other so a
 *  block-failure (e.g. duplicate) still cancels the job.
 *
 *  Normalize the `releaseHash` field to the magnet BTIH up-front so the
 *  dispatcher's lookup (which extracts BTIH from the post-redirect
 *  downloadUrl) actually matches on retrigger. Before Fix 1.1 this was
 *  the full magnet URL string and silently never matched. */
export async function runCancelAndBlock(
  data: JobRowData,
  blockRelease: JobMutationsReturn['blockRelease'],
  cancelTask: JobMutationsReturn['cancelTask'],
): Promise<void> {
  const hints = extractReleaseHints(data);
  const releaseHash = hints.guid !== undefined ? extractBtihFromMagnet(hints.guid) : undefined;
  await blockRelease.mutateAsync({
    release: {
      releaseTitle: data.fileName,
      ...(releaseHash !== undefined ? { releaseHash } : {}),
      ...(hints.indexerId !== undefined ? { indexerId: hints.indexerId } : {}),
      ...(data.mangaId !== undefined ? { mangaId: data.mangaId } : {}),
      ...(hints.source !== undefined ? { source: hints.source } : {}),
    },
    reason: 'USER_PREFERENCE',
    reasonDetails: 'Blocked from Jobs page via cancel-and-blocklist',
  }).catch(() => { /* notification already shown by mutation; proceed with cancel */ });
  await cancelTask.mutateAsync({ id: String(data.taskId) });
}
