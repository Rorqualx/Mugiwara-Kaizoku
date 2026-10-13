/**
 * @jest-environment node
 */
import type { ClientDownloadService } from '@/server/services/download/clientDownload';
import { handleProgressFailure } from '@/server/services/download/downloadManager/torrent-health';

import type { PrismaClient } from '@prisma/client';

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/server/services/pipeline/pipeline-event-bus', () => ({ pipelineEventBus: { emit: jest.fn() } }));
jest.mock('@/server/services/realtime', () => ({ realtimeEmitter: {} }));
jest.mock('@/server/services/release-blocklist/blocklist-manager', () => ({ autoBlockFailedRelease: jest.fn() }));
jest.mock('@/server/services/download/download-monitor/chapter-manager', () => ({ resetChaptersToPending: jest.fn() }));
jest.mock('@/server/services/download/download-monitor/pack-import-retry', () => ({ runPackImportWithRetry: jest.fn() }));
jest.mock('@/server/services/download/download-monitor/retry-handler', () => ({ attemptDownloadRetry: jest.fn(), extractReleaseUrl: jest.fn() }));
jest.mock('@/server/services/download/retry', () => ({
  DownloadFailureReason: { STALLED: 'STALLED', NO_SEEDS: 'NO_SEEDS' },
  // The job lookup below returns null, so the retry path stops right after removal.
  getRetryService: (): { getRetryConfig: () => Promise<unknown> } => ({ getRetryConfig: () => Promise.resolve({}) }),
}));

function setup(): { prisma: PrismaClient; client: ClientDownloadService; removeDownload: jest.Mock } {
  const removeDownload = jest.fn(() => Promise.resolve());
  const client = { removeDownload } as unknown as ClientDownloadService;
  const prisma = { jobs: { findFirst: jest.fn(() => Promise.resolve(null)) } } as unknown as PrismaClient;
  return { prisma, client, removeDownload };
}

const base = {
  mangaId: 1,
  downloadId: '42',
  clientType: 'transmission',
  reason: 'stalled',
  failureReason: 'STALLED' as never,
  releaseName: 'Some Manga Pack',
};

describe('handleProgressFailure: removing the failed torrent', () => {
  it('deletes the partial data of a torrent that never finished', async () => {
    const { prisma, client, removeDownload } = setup();
    await handleProgressFailure(prisma, client, 1n, 'p', { ...base, progress: 63 });
    expect(removeDownload).toHaveBeenCalledWith('transmission', '42', true);
  });

  it('keeps the files of a torrent that reached 100% so reconciliation can import them', async () => {
    const { prisma, client, removeDownload } = setup();
    await handleProgressFailure(prisma, client, 1n, 'p', { ...base, progress: 100 });
    expect(removeDownload).toHaveBeenCalledWith('transmission', '42', false);
  });
});
