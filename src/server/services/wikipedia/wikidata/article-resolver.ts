/**
 * Wikidata Article Resolver
 *
 * Resolves AniList/MAL IDs to English Wikipedia article titles via Wikidata SPARQL.
 * Uses properties:
 *   - P8731: AniList manga ID
 *   - P4086: MyAnimeList manga ID
 *   - sitelinks -> enwiki: English Wikipedia article title
 */

import { logger } from '@/utils/logger';

const log = logger.child('WikidataResolver');

const USER_AGENT = 'MugiwaraKaizoku/1.0 (manga-metadata-enrichment)';
const TIMEOUT_MS = 10000;

/** Allowed Wikidata property IDs for external ID queries */
const ALLOWED_PROPERTIES = new Set(['P8731', 'P4086']);

interface SparqlResult {
  results?: {
    bindings?: Array<{
      articleTitle?: { value: string };
    }>;
  };
}

/**
 * Build the full Wikidata SPARQL endpoint URL for a given query.
 * Always targets the official query.wikidata.org endpoint.
 */
function buildSparqlUrl(sparqlQuery: string): string {
  return `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}`;
}

/**
 * Resolve an AniList manga ID to an English Wikipedia article title via Wikidata.
 * Returns the article title (e.g., "Berserk (manga)") or null if not found.
 */
export async function resolveWikipediaTitle(
  anilistId?: number,
  malId?: number,
): Promise<string | null> {
  if (!anilistId && !malId) return null;

  if (anilistId) {
    const title = await queryByProperty('P8731', String(anilistId));
    if (title) return title;
  }

  if (malId) {
    const title = await queryByProperty('P4086', String(malId));
    if (title) return title;
  }

  return null;
}

/** Query Wikidata SPARQL for the English Wikipedia article title by external ID property */
async function queryByProperty(
  property: string,
  value: string,
): Promise<string | null> {
  if (!ALLOWED_PROPERTIES.has(property)) return null;
  // Sanitize value to digits only (AniList/MAL IDs are numeric)
  const sanitized = value.replace(/\D/g, '');
  if (!sanitized) return null;

  const sparql = `
    SELECT ?articleTitle WHERE {
      ?item wdt:${property} "${sanitized}" .
      ?article schema:about ?item ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?articleTitle .
    } LIMIT 1
  `.trim();

  const url = buildSparqlUrl(sparql);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      log.debug(`Wikidata SPARQL ${property}=${sanitized}: HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as SparqlResult;
    const title = data.results?.bindings?.[0]?.articleTitle?.value;

    if (title) {
      log.info(`Wikidata resolved ${property}=${sanitized} -> "${title}"`);
    }

    return title ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.debug(`Wikidata SPARQL failed for ${property}=${sanitized}: ${msg}`);
    return null;
  }
}
