/**
 * Disambiguation Page Resolver
 *
 * Detects Fandom disambiguation pages and resolves them to the actual
 * manga content page. During "re-process with Fandom", if the bound URL
 * points to a disambiguation page (e.g., "Attack_on_Titan" instead of
 * "Attack_on_Titan_(Manga)"), the scraper would return 0 volumes/chapters.
 *
 * This module adds disambiguation detection and resolution as Step 1.5
 * in the WikiContentScraper pipeline.
 */

import * as cheerio from 'cheerio';

import {
  fetchPageHtmlViaApi,
  parseFandomUrl,
} from '@/server/services/fandom/utils/mediaWikiApiFetch';

/**
 * Logger interface matching the project-wide logger pattern
 */
interface LoggerInstance {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Result of disambiguation resolution
 */
export interface DisambiguationResult {
  resolved: boolean;
  resolvedUrl?: string;
  resolvedHtml?: string;
  variant?: string;
}

/**
 * Detect if fetched HTML is a disambiguation page
 *
 * Checks for:
 * 1. CSS class markers (.disambig, .disambiguation)
 * 2. Text patterns ("may refer to", "can refer to")
 * 3. Composite heuristic: short content + many links + no infobox + no volume/chapter sections
 */
export function isDisambiguationPageHtml(html: string, _pageTitle: string): boolean {
  const $ = cheerio.load(html);

  // Check CSS class markers
  if ($('.disambig, .disambiguation, .disambiguationpage').length > 0) {
    return true;
  }

  // Check hatnote-style disambiguation markers
  if ($('.hatnote').text().toLowerCase().includes('disambig')) {
    return true;
  }

  // Check text patterns in first few paragraphs
  const introText = $('p').slice(0, 3).text().toLowerCase();
  const disambigPhrases = ['may refer to', 'can refer to', 'might refer to', 'could refer to'];
  const hasDisambigPhrase = disambigPhrases.some((phrase) => introText.includes(phrase));

  if (hasDisambigPhrase) {
    return true;
  }

  // Composite heuristic: short content + many links + no manga-specific sections
  const textContent = $.text();
  const contentLength = textContent.length;
  const linkCount = $('a[href*="/wiki/"]').length;
  const hasInfobox = $('.portable-infobox, .infobox, .wikia-infobox').length > 0;
  const sectionHeaders = $('h2, h3').map((_, el) => $(el).text().toLowerCase()).get();
  const hasMangaSections = sectionHeaders.some(
    (h) => h.includes('volume') || h.includes('chapter') || h.includes('synopsis') || h.includes('plot')
  );

  if (contentLength < 2000 && linkCount > 5 && !hasInfobox && !hasMangaSections) {
    return true;
  }

  return false;
}

/**
 * Resolve a disambiguation page to the actual manga content page
 *
 * Tries variants in order:
 * 1. {Title}_(Manga) via MediaWiki API
 * 2. {Title}_(Series) via MediaWiki API
 * 3. Parse disambiguation links for one containing "manga" or "series"
 */
export async function resolveDisambiguationPage(
  originalUrl: string,
  originalHtml: string,
  log: LoggerInstance
): Promise<DisambiguationResult> {
  const parsed = parseFandomUrl(originalUrl);
  if (!parsed) {
    log.warn('Cannot resolve disambiguation: invalid Fandom URL', { url: originalUrl });
    return { resolved: false };
  }

  const { subdomain, pageTitle } = parsed;

  // Try known variants — Manga first, then Series
  const baseCtx = { subdomain, pageTitle, originalUrl };

  const mangaResult = await tryVariant({ ...baseCtx, suffix: '_(Manga)', label: 'Manga' }, log);
  if (mangaResult) return mangaResult;

  const seriesResult = await tryVariant({ ...baseCtx, suffix: '_(Series)', label: 'Series' }, log);
  if (seriesResult) return seriesResult;

  // Fallback: parse disambiguation page links for manga/series references
  const linkResult = await resolveFromDisambiguationLinks(originalHtml, subdomain, log);
  if (linkResult) {
    return linkResult;
  }

  log.warn('Could not resolve disambiguation page', { url: originalUrl });
  return { resolved: false };
}

/**
 * Context for trying a disambiguation variant
 */
interface VariantContext {
  subdomain: string;
  pageTitle: string;
  suffix: string;
  label: string;
  originalUrl: string;
}

/**
 * Try a single title variant and return a result if found
 */
async function tryVariant(
  ctx: VariantContext,
  log: LoggerInstance
): Promise<DisambiguationResult | null> {
  const variantTitle = `${ctx.pageTitle}${ctx.suffix}`;
  const variantUrl = `https://${ctx.subdomain}.fandom.com/wiki/${encodeURIComponent(variantTitle)}`;

  log.debug('Trying disambiguation variant', { variant: ctx.label, url: variantUrl });

  const html = await fetchPageHtmlViaApi(variantUrl);
  if (html) {
    log.info('Resolved disambiguation to variant page', {
      original: ctx.originalUrl,
      resolved: variantUrl,
      variant: ctx.label,
    });
    return { resolved: true, resolvedUrl: variantUrl, resolvedHtml: html, variant: ctx.label };
  }

  return null;
}

/**
 * Parse disambiguation page HTML for links containing "manga" or "series"
 */
async function resolveFromDisambiguationLinks(
  html: string,
  subdomain: string,
  log: LoggerInstance
): Promise<DisambiguationResult | null> {
  const $ = cheerio.load(html);
  const mangaKeywords = ['manga', 'series', 'comic'];

  // Look for links whose text or href contains manga-related keywords
  const candidates: string[] = [];

  $('a[href*="/wiki/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') ?? '';
    const text = $el.text().toLowerCase();
    const hrefLower = href.toLowerCase();

    const isRelevant = mangaKeywords.some((kw) => text.includes(kw) || hrefLower.includes(kw));
    if (isRelevant && href.startsWith('/wiki/')) {
      const pagePath = href.replace('/wiki/', '');
      candidates.push(decodeURIComponent(pagePath));
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  // Try the first candidate
  const candidateTitle = candidates[0];
  const candidateUrl = `https://${subdomain}.fandom.com/wiki/${encodeURIComponent(candidateTitle ?? '')}`;

  log.debug('Trying disambiguation link candidate', { candidate: candidateTitle, url: candidateUrl });

  const candidateHtml = await fetchPageHtmlViaApi(candidateUrl);
  if (candidateHtml) {
    log.info('Resolved disambiguation via page link', {
      resolved: candidateUrl,
      variant: 'link',
    });
    return { resolved: true, resolvedUrl: candidateUrl, resolvedHtml: candidateHtml, variant: 'link' };
  }

  return null;
}
