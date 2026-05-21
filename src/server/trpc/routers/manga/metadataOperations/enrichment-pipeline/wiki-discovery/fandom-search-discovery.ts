/**
 * Tier 4 of Fandom URL discovery — MediaWiki search API on Fandom.
 *
 * Tries the primary title first, falls back to alt titles, then walks the
 * top N results and accepts the first that passes validation. Extracted from
 * `wiki-discovery.ts/discoverFandomWikiUrl` to keep that orchestrator under
 * the 100-line/complexity limits.
 */

import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const log = logger.child('FandomSearchDiscovery');

type Validator = (url: string) => Promise<{ valid: boolean; reason: string }>;

export async function discoverViaFandomSearch(
  title: string,
  altTitles: string[],
  validate: Validator,
): Promise<string | null> {
  const { fandomSearchService } = await import('@/server/services/fandom/fandomSearchService');

  let searchResult = await fandomSearchService.searchAllWikis(title);

  if ((!isSuccess(searchResult) || searchResult.data.results.length === 0) && altTitles.length > 0) {
    for (const altTitle of altTitles.slice(0, 3)) {
      log.info(`Primary title "${title}" failed, trying alt: "${altTitle}"`);
      // eslint-disable-next-line no-await-in-loop -- Sequential fallback search with early return
      searchResult = await fandomSearchService.searchAllWikis(altTitle);
      if (isSuccess(searchResult) && searchResult.data.results.length > 0) break;
    }
  }

  if (!isSuccess(searchResult) || searchResult.data.results.length === 0) {
    log.warn(`No Fandom wiki found for "${title}" (tried ${altTitles.length} alt titles)`);
    return null;
  }

  for (const result of searchResult.data.results.slice(0, 5)) {
    // eslint-disable-next-line no-await-in-loop -- sequential validation, early exit on first pass
    const v = await validate(result.url);
    if (v.valid) {
      log.info(`Discovered Fandom wiki via search: ${result.url} (${v.reason})`);
      return result.url;
    }
    log.info(`Fandom search result rejected: ${result.url} — ${v.reason}`);
  }
  log.warn(`No Fandom wiki passed validation for "${title}"`);
  return null;
}
