/**
 * Target-page selection for adaptiveParse through the list-page resolver,
 * and the merge of a separate volume-list page into the parsed chapter page.
 *
 * @module orchestrator/list-page-target
 */

import { logger } from '@/utils/logger';

import { resolveListPages, type ListPageResolution } from '../list-page-resolver';

import type { StandardParsedData } from './result-converters';
import type { AdaptiveParserOptions } from '../types';

/** Pages that are never a series' chapter list (single chapter/volume pages, categories). */
const NOT_A_LIST_PAGE_RE = /\/wiki\/(?:Category:|(?:Chapter|Volume|Episode)_\d)/i;

/**
 * Resolve the chapter-list page for an adaptive parse.
 * - Nothing bound: always look the list pages up.
 * - A page is bound: re-check it only when the series title is known (Phase 1),
 *   so a shared wiki's generic list can never displace a series-specific page.
 */
export async function resolveTargetListPages(
  domain: string,
  boundUrl: string | null,
  options: Pick<AdaptiveParserOptions, 'seriesTitle' | 'seriesAltTitles' | 'wikiNameHints' | 'probeTimeoutMs'>,
): Promise<ListPageResolution | null> {
  const base = {
    ...(options.seriesTitle ? { seriesTitle: options.seriesTitle } : {}),
    altTitles: options.seriesAltTitles ?? [],
    nameHints: options.wikiNameHints ?? [],
    timeoutMs: options.probeTimeoutMs,
  };
  if (!boundUrl) return resolveListPages(domain, base);
  if (!options.seriesTitle || !/\/wiki\/./.test(boundUrl) || NOT_A_LIST_PAGE_RE.test(boundUrl)) return null;
  return resolveListPages(domain, { ...base, incumbentUrl: boundUrl });
}

function chapterNumberOf(ch: unknown): number | null {
  if (typeof ch !== 'object' || ch === null) return null;
  const n = (ch as { number?: unknown }).number;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Take the volume list from a separate volume page when it lists more volumes
 * than the chapter page. Chapters without a volume get the volume page's
 * assignment; existing assignments and volume fields are kept.
 */
export async function supplementVolumesFromPage(
  data: StandardParsedData,
  volumePageUrl: string,
  extract: (url: string) => Promise<StandardParsedData | undefined>,
): Promise<void> {
  const vp = await extract(volumePageUrl);
  if (!vp || vp.volumes.length <= data.volumes.length) return;

  const existing = new Map(data.volumes.map(v => [v.number, v]));
  data.volumes.splice(0, data.volumes.length, ...vp.volumes.map(v => ({ ...v, ...existing.get(v.number) })));

  const volumeOf = new Map<number, number>();
  for (const ch of vp.chapters) if (typeof ch.volume === 'number') volumeOf.set(ch.number, ch.volume);
  for (const v of vp.volumes) {
    for (const ch of v.chapters ?? []) {
      const n = chapterNumberOf(ch);
      if (n !== null && !volumeOf.has(n)) volumeOf.set(n, v.number);
    }
  }
  let filled = 0;
  for (const ch of data.chapters) {
    const vol = volumeOf.get(ch.number);
    if (ch.volume === undefined && vol !== undefined) { ch.volume = vol; filled++; }
  }
  logger.info(`[adaptiveParse] Volumes from ${volumePageUrl}: ${data.volumes.length} volumes, ${filled} chapters given a volume`);
}
