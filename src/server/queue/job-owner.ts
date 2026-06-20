import { prisma } from '@/server/db';

/**
 * Resolve the initiating user of a job.
 *
 * Worker-context rows (PackDownload, DownloadHistory) are created long after
 * the originating tRPC request has gone, so they can't read the session. They
 * do carry the originating `jobId`, so they inherit ownership from the job that
 * triggered them. Returns `null` for unowned/system jobs or a missing job —
 * a NULL-owned operational row is visible only to admins (see
 * `_shared/library-access.ts` `ownerScopeWhere`).
 */
export async function getJobOwnerUserId(
  jobId: bigint | number | string,
): Promise<string | null> {
  let id: bigint;
  try {
    id = typeof jobId === 'bigint' ? jobId : BigInt(jobId);
  } catch {
    return null;
  }
  const job = await prisma.jobs.findFirst({
    where: { id },
    select: { initiated_by_user_id: true },
  });
  return job?.initiated_by_user_id ?? null;
}
