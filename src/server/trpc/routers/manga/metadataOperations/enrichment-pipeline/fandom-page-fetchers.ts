/**
 * Fandom Page Fetchers
 *
 * Handles fetching and parsing individual Fandom chapter/volume pages
 * for cover images, descriptions, and volume URLs.
 * Extracted from fandom-mediawiki-fallback.ts to keep file sizes manageable.
 */

import { logger } from '@/utils/logger';

/** Fetch chapter covers and descriptions in batches */
export async function fetchChapterCoversInBatches(
  chapterUrlMap: Record<number, string>,
  fetchPageHtml: (url: string) => Promise<string | null>,
): Promise<{ coverMap: Record<number, string>; descriptionMap: Record<number, string> }> {
  const coverMap: Record<number, string> = {};
  const descriptionMap: Record<number, string> = {};
  const BATCH_SIZE = 10;
  const entries = Object.entries(chapterUrlMap);
  let coversFetched = 0;

  logger.info(`[enrichmentPipeline] Fetching chapter covers from ${entries.length} Fandom chapter pages (batched)...`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop -- Sequential batching required for rate limiting
    const batchResults = await Promise.allSettled(
      batch.map(async ([chNumStr, chUrl]) => {
        const chHtml = await fetchPageHtml(chUrl);
        if (!chHtml) return null;
        return parseChapterPage(Number(chNumStr), chHtml);
      }),
    );
    const batchData = collectBatchResults(batchResults);
    Object.assign(coverMap, batchData.coverMap);
    Object.assign(descriptionMap, batchData.descriptionMap);
    coversFetched += Object.keys(batchData.coverMap).length;
  }

  logger.info(
    `[enrichmentPipeline] Fetched ${coversFetched} chapter covers, ${Object.keys(descriptionMap).length} descriptions from Fandom`,
  );

  return { coverMap, descriptionMap };
}

/** Collect settled batch results into cover and description maps */
function collectBatchResults(
  batchResults: PromiseSettledResult<{ chNum: number; coverUrl: string | null; description: string | null } | null>[],
): { coverMap: Record<number, string>; descriptionMap: Record<number, string> } {
  const coverMap: Record<number, string> = {};
  const descriptionMap: Record<number, string> = {};
  for (const batchResult of batchResults) {
    if (batchResult.status !== 'fulfilled' || !batchResult.value) continue;
    const { chNum, coverUrl, description } = batchResult.value;
    if (coverUrl) coverMap[chNum] = coverUrl;
    if (description) descriptionMap[chNum] = description;
  }
  return { coverMap, descriptionMap };
}

/** Parse a single chapter page for cover image and description */
function parseChapterPage(
  chNum: number,
  chHtml: string,
): { chNum: number; coverUrl: string | null; description: string | null } {
  const imgMatch = chHtml.match(
    /portable-infobox[\s\S]*?(?:src|href)="(https:\/\/static\.wikia\.nocookie\.net\/[^"]*(?:\.png|\.jpg|\.jpeg)[^"]*)"/,
  );
  const coverUrl = imgMatch?.[1]?.replace(/\/scale-to-width-down\/\d+/, '') ?? null;
  const description = extractDescription(chHtml);
  return { chNum, coverUrl, description };
}

/** Extract description from chapter page HTML */
function extractDescription(chHtml: string): string | null {
  const allParagraphs = chHtml.match(/<p[^>]*>(.+?)<\/p>/gs);
  if (!allParagraphs || allParagraphs.length < 2) return null;

  const descParts: string[] = [];
  for (let pi = 1; pi < Math.min(allParagraphs.length, 5); pi++) {
    const pText = allParagraphs[pi]
      ?.replace(/<[^>]+>/g, '')
      .replace(/&#\d+;/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\[\d+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (pText && pText.length > 20) descParts.push(pText);
  }
  return descParts.length > 0 ? descParts.join('\n\n') : null;
}

/** Extract volume page URLs from the list page HTML */
export function extractVolumeUrls(html: string, subdomain: string): Record<number, string> {
  const volumeUrlMap: Record<number, string> = {};
  const pattern = /href="(\/wiki\/Volume[_\s%20]+(\d+)[^"]*)"/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const urlPath = match[1];
    const volNum = Number(match[2]);
    if (!isNaN(volNum) && urlPath && !volumeUrlMap[volNum]) {
      volumeUrlMap[volNum] = `https://${subdomain}.fandom.com${urlPath}`;
    }
  }
  return volumeUrlMap;
}

/** Fetch English volume descriptions from Fandom volume pages in batches */
export async function fetchVolumeDescriptionsInBatches(
  volumeUrlMap: Record<number, string>,
  fetchPageHtml: (url: string) => Promise<string | null>,
): Promise<Record<number, string>> {
  const descriptionMap: Record<number, string> = {};
  const BATCH_SIZE = 5;
  const entries = Object.entries(volumeUrlMap);

  logger.info(`[enrichmentPipeline] Fetching volume descriptions from ${entries.length} Fandom volume pages...`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop -- Sequential batching for rate limiting
    const batchResults = await Promise.allSettled(
      batch.map(async ([volNumStr, volUrl]) => {
        const volHtml = await fetchPageHtml(volUrl);
        if (!volHtml) return null;
        const description = extractVolumeDescription(volHtml);
        if (!description) return null;
        return { volNum: Number(volNumStr), description };
      }),
    );
    for (const result of batchResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { volNum, description } = result.value;
      descriptionMap[volNum] = description;
    }
  }

  return descriptionMap;
}

/** Extract English description/summary from a Fandom volume page */
function extractVolumeDescription(volHtml: string): string | null {
  const allParagraphs = volHtml.match(/<p[^>]*>(.+?)<\/p>/gs);
  if (!allParagraphs || allParagraphs.length < 2) return null;

  const descParts: string[] = [];
  for (let pi = 1; pi < Math.min(allParagraphs.length, 6); pi++) {
    const pText = allParagraphs[pi]
      ?.replace(/<[^>]+>/g, '')
      .replace(/&#\d+;/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\[\d+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (pText && pText.length > 30) descParts.push(pText);
  }
  return descParts.length > 0 ? descParts.join('\n\n') : null;
}
