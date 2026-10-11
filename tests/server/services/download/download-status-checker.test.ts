// @ts-nocheck - Test file uses a stub download service
import { describe, expect, it, jest } from '@jest/globals';

import {
  checkDownloadStatus,
  isDownloadComplete,
} from '@/server/services/download/download-monitor/download-status-checker';
import { createErrorResult, createSuccessResult, isError, isSuccess } from '@/utils/async-result';

/**
 * ClientDownloadService.getDownloadStatus passes the client's AsyncResult
 * through. It used to wrap it a second time, so the checker validated the
 * wrapper and read `status: 'success'` as the download state — completion was
 * never observed.
 */
const serviceReturning = (result) => ({ getDownloadStatus: jest.fn(() => Promise.resolve(result)) });

describe('checkDownloadStatus', () => {
  it('reports the client status of a finished download', async () => {
    const service = serviceReturning(createSuccessResult({
      id: 'abc', name: 'Title v01', status: 'SEEDING', progress: 100,
      downloadSpeed: 0, totalSize: 10, downloadedSize: 10, savePath: '/downloads/Title v01',
    }));

    const result = await checkDownloadStatus(service, 'transmission', 'abc');

    expect(isSuccess(result)).toBe(true);
    expect(result.data.status).toBe('SEEDING');
    expect(isDownloadComplete(result.data.status)).toBe(true);
    expect(result.data.savePath).toBe('/downloads/Title v01');
  });

  it('reports progress and speed of a running download', async () => {
    const service = serviceReturning(createSuccessResult({
      id: 'abc', name: 'Title v01', status: 'DOWNLOADING', progress: 55,
      downloadSpeed: 2_000_000, totalSize: 10, downloadedSize: 5,
    }));

    const result = await checkDownloadStatus(service, 'transmission', 'abc');

    expect(result.data.status).toBe('DOWNLOADING');
    expect(result.data.progress).toBe(55);
    expect(isDownloadComplete(result.data.status)).toBe(false);
  });

  it('surfaces a client error instead of treating it as a status', async () => {
    const service = serviceReturning(createErrorResult(new Error('Download with ID abc not found')));

    const result = await checkDownloadStatus(service, 'sabnzbd', 'abc');

    expect(isError(result)).toBe(true);
    expect(result.error.message).toContain('not found');
  });
});
