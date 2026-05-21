/**
 * Fandom Chapter URL Template System
 *
 * Extracts reusable URL patterns from scraped chapter URLs or redirect
 * discoveries, then generates URLs for chapters that weren't scraped.
 *
 * Example: Berserk's adaptive parser finds 279 URLs like
 * `/wiki/Episode_1_(Manga)` → extracts template `Episode_{N}_(Manga)` →
 * generates URLs for the missing 111 chapters (280-390).
 *
 * @module enrichment-pipeline/fandom-url-template
 */

import { logger } from '@/utils/logger';

import type { ChapterUrlTemplate } from './types';

/** Minimum fraction of URLs that must match the top pattern */
const MIN_CONFIDENCE = 0.6;
/** Minimum number of URLs that must match to accept a template */
const MIN_MATCH_COUNT = 3;

/**
 * Extract a URL template from scraped chapter URLs.
 *
 * For each (url, chapterNum) pair, strips the base URL to get the wiki
 * page name, replaces the chapter number with `{N}`, and counts
 * occurrences of each resulting pattern.
 *
 * Returns the most common pattern if it covers ≥60% of URLs with ≥3 matches.
 */
export function extractTemplateFromUrls(
  urlMap: Map<string, number>,
  baseUrl: string,
): ChapterUrlTemplate | null {
  if (urlMap.size < MIN_MATCH_COUNT) return null;

  const templateCounts = new Map<string, number>();
  const wikiPrefix = `${baseUrl}/wiki/`;

  for (const [url, chapterNum] of urlMap) {
    if (!Number.isInteger(chapterNum) || chapterNum <= 0) continue;

    const pageName = url.startsWith(wikiPrefix)
      ? url.slice(wikiPrefix.length)
      : extractPageName(url);
    if (!pageName) continue;

    const numStr = String(chapterNum);
    // Only replace the chapter number if it appears in the page name
    if (!pageName.includes(numStr)) continue;

    // Replace the first occurrence of the chapter number with {N}
    const template = pageName.replace(numStr, '{N}');
    // Skip if the template is just "{N}" (no surrounding pattern)
    if (template === '{N}') continue;

    templateCounts.set(template, (templateCounts.get(template) ?? 0) + 1);
  }

  return pickBestTemplate(templateCounts, urlMap.size, baseUrl, 'scraped-urls');
}

/**
 * Extract a URL template from redirect discoveries.
 *
 * For each redirect pair like `{ from: "Chapter_1", to: "Episode 1 (Manga)" }`,
 * URL-encodes the target, replaces the chapter number with `{N}`, and
 * counts occurrences.
 */
export function extractTemplateFromRedirects(
  redirects: Array<{ from: string; to: string }>,
  subdomain: string,
): ChapterUrlTemplate | null {
  if (redirects.length < MIN_MATCH_COUNT) return null;

  const templateCounts = new Map<string, number>();

  for (const redirect of redirects) {
    const match = redirect.from.match(/^Chapter\s+(\d+)$/i);
    if (!match?.[1]) continue;
    const num = parseInt(match[1], 10);
    if (isNaN(num) || num <= 0) continue;

    // Convert redirect target to wiki page name format
    const pageName = redirect.to.replace(/ /g, '_');
    const numStr = String(num);

    if (!pageName.includes(numStr)) continue;

    const template = pageName.replace(numStr, '{N}');
    if (template === '{N}') continue;

    templateCounts.set(template, (templateCounts.get(template) ?? 0) + 1);
  }

  const baseUrl = `https://${subdomain}.fandom.com`;
  return pickBestTemplate(templateCounts, redirects.length, baseUrl, 'redirect-discovery');
}

/**
 * Generate URLs for chapters not already in `existingUrls` using the template.
 *
 * Substitutes `{N}` in the template for each chapter number and builds
 * the full URL: `{baseUrl}/wiki/{template}`.
 */
export function generateUrlsFromTemplate(
  template: ChapterUrlTemplate,
  chapterNumbers: number[],
  existingUrls: Map<string, number>,
): Map<string, number> {
  const existingNums = new Set(existingUrls.values());
  const generated = new Map<string, number>();

  for (const num of chapterNumbers) {
    if (!Number.isInteger(num) || num <= 0) continue;
    if (existingNums.has(num)) continue;

    const pageName = template.template.replace('{N}', String(num));
    const url = `${template.baseUrl}/wiki/${pageName}`;
    generated.set(url, num);
  }

  if (generated.size > 0) {
    logger.info(
      `[fandomUrlTemplate] Generated ${generated.size} URLs from template "${template.template}" (source: ${template.source})`,
    );
  }

  return generated;
}

/** Pick the most common template if it meets confidence + count thresholds */
function pickBestTemplate(
  templateCounts: Map<string, number>,
  totalUrls: number,
  baseUrl: string,
  source: ChapterUrlTemplate['source'],
): ChapterUrlTemplate | null {
  if (templateCounts.size === 0) return null;

  let bestTemplate = '';
  let bestCount = 0;
  for (const [tmpl, count] of templateCounts) {
    if (count > bestCount) {
      bestTemplate = tmpl;
      bestCount = count;
    }
  }

  const confidence = totalUrls > 0 ? bestCount / totalUrls : 0;

  if (confidence < MIN_CONFIDENCE || bestCount < MIN_MATCH_COUNT) {
    logger.debug(
      `[fandomUrlTemplate] Template "${bestTemplate}" rejected: confidence=${confidence.toFixed(2)}, matches=${bestCount}/${totalUrls}`,
    );
    return null;
  }

  logger.info(
    `[fandomUrlTemplate] Extracted template "${bestTemplate}" (confidence=${confidence.toFixed(2)}, matches=${bestCount}/${totalUrls}, source=${source})`,
  );

  return {
    template: bestTemplate,
    baseUrl,
    confidence,
    confirmedAt: new Date().toISOString(),
    source,
    matchCount: bestCount,
  };
}

/** Extract page name from a full Fandom URL */
function extractPageName(url: string): string | null {
  const wikiIndex = url.indexOf('/wiki/');
  if (wikiIndex === -1) return null;
  return url.slice(wikiIndex + '/wiki/'.length);
}
