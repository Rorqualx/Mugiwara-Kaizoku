/**
 * Chapter-count helpers.
 *
 * Tiny utilities for extracting/computing total chapter counts from scraped
 * Fandom HTML payloads. Extracted from the now-deleted `refreshService.ts`
 * because the `fandom-enhanced` router still needs them after Phase 1's legacy
 * retirement.
 */
import { logger } from '@/utils/logger';

/** Calculate total chapter count from HTML or volumes — text-pattern first, sum-of-volumes second. */
export function calculateTotalChapters(html: string, volumes: unknown[]): number {
  const chapterMatch: RegExpMatchArray | null =
    html.match(/(\d+)\s+chapters?/i) ?? html.match(/has\s+(\d+)\s+chapters?/i);

  if (chapterMatch?.[1]) {
    const count = parseInt(chapterMatch[1], 10);
    logger.info(`Extracted chapter count from text: ${count}`);
    return count;
  }

  const count = volumes.reduce((sum: number, vol: unknown) => {
    if (typeof vol !== 'object' || vol === null) {
      return sum;
    }
    const chapters = (vol as Record<string, unknown>)['chapters'];
    return sum + (Array.isArray(chapters) ? chapters.length : 0);
  }, 0);

  logger.info(`Calculated chapter count from volumes: ${count}`);
  return count;
}
