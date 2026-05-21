/**
 * Field extractors for the Jobs page.
 *
 * Extracted from `active-job-helpers.tsx` to keep that file under the
 * 500-line limit. Each helper produces one user-facing column value
 * with sensible fallbacks for the various job-source shapes
 * (Prowlarr / MangaDex / Suwayomi / GetComics / direct URL).
 */
import { isRecord } from './job-row-helpers';

const NATIVE_DOWNLOAD_TYPES = new Set(['mangadex_download', 'suwayomi_download', 'getcomics_download']);
const NATIVE_PROTOCOLS: Record<string, string> = {
  mangadex_download: 'API',
  suwayomi_download: 'GraphQL',
  getcomics_download: 'DDL',
};

export function extractClient(
  taskResult: Record<string, unknown> | null,
  taskPayload: Record<string, unknown> | null,
  taskType: unknown,
): string {
  if (taskResult?.['clientType']) return String(taskResult['clientType']);
  if (taskPayload?.['clientType']) return String(taskPayload['clientType']);
  if (typeof taskType === 'string' && NATIVE_DOWNLOAD_TYPES.has(taskType)) return 'Built-in';
  return '-';
}

export function extractProtocol(
  prowlarrResult: Record<string, unknown> | null,
  taskPayload: Record<string, unknown> | null,
  taskType: unknown,
): string {
  if (prowlarrResult?.['protocol']) return String(prowlarrResult['protocol']).toUpperCase();
  if (taskPayload?.['method'] === 'DIRECT_URL' && taskPayload['directUrl']) {
    return String(taskPayload['directUrl']).toLowerCase().includes('nzb') ? 'USENET' : 'TORRENT';
  }
  if (typeof taskType === 'string' && NATIVE_PROTOCOLS[taskType]) return NATIVE_PROTOCOLS[taskType];
  return '-';
}

function extractNativeChapterFileName(
  taskPayload: Record<string, unknown> | null,
  task: Record<string, unknown>,
): string {
  const chapter = task['chapter'] && isRecord(task['chapter']) ? task['chapter'] : null;
  const chapterNumber = chapter?.['chapterNumber'] ?? taskPayload?.['chapterNumber'];
  const chapterTitle = chapter?.['title'];
  if (typeof chapterTitle === 'string' && chapterTitle.length > 0) {
    return typeof chapterNumber === 'number' ? `Ch ${chapterNumber}: ${chapterTitle}` : chapterTitle;
  }
  if (typeof chapterNumber === 'number') return `Chapter ${chapterNumber}`;
  const dest = taskPayload?.['destinationPath'];
  if (typeof dest === 'string') return String(dest).split('/').pop() ?? '-';
  return '-';
}

export function extractFileName(
  taskResult: Record<string, unknown> | null,
  prowlarrResult: Record<string, unknown> | null,
  taskPayload: Record<string, unknown> | null,
  task: Record<string, unknown>,
): string {
  if (taskResult?.['releaseTitle']) return String(taskResult['releaseTitle']);
  if (prowlarrResult?.['title']) return String(prowlarrResult['title']);
  if (taskPayload?.['directUrl']) return decodeURIComponent(String(taskPayload['directUrl']).split('/').pop() ?? '-');
  return extractNativeChapterFileName(taskPayload, task);
}

export function extractErrorMessage(lastError: unknown): string {
  if (!lastError) return 'Unknown error';
  if (typeof lastError === 'string') return lastError;
  if (isRecord(lastError)) return String(lastError['message'] ?? lastError['error'] ?? 'Unknown error');
  return 'Unknown error';
}
