/**
 * Prowlarr Scoring and Filtering
 *
 * Relevance scoring, result filtering, and metadata enhancement
 * for Prowlarr manga search results.
 *
 * Extracted from: mangaSearch.ts (lines 225-329)
 * Fixes: ESLint complexity violation (line 239, complexity 23 → 10)
 */

import type { ProwlarrSearchResult } from '@/types/prowlarr';
import { parseReleaseTitle } from '@/utils/releaseParser';

import type { ProwlarrApiSearchResult, RelevanceScoredResult } from './prowlarr-types';

/**
 * Filters API results to manga-specific content
 *
 * Checks category IDs, manga keywords, and minimum quality thresholds.
 *
 * @param results - Raw Prowlarr API results
 * @returns Filtered results containing only manga-related content
 */
/**
 * Video/anime indicators — reject releases that are clearly not manga.
 *
 * Covers: codecs (h264/x265/hevc/avc), audio formats (aac/flac/dts), source
 * tags (BD/BluRay/BDRip/DVDRip/WebRip/Web-DL), resolution markers
 * (1080p/720p/480p/2160p/4K/UHD), audio mixing (dual/multi audio,
 * dub/sub variants), TV episode patterns (S01E01, "Episode N", "Season
 * N"), explicit width×height resolution tags (1280x720, 1920x1080), and
 * common video file extensions in the release title (.mkv .mp4 .avi
 * .mov .webm .wmv .m4v .m2ts).
 *
 * Regression: the bug case `Anata mo Robot ni Nararu feat. Kamome Jidou
 * Gasshoudan [1280x720] [TardS]` slipped past the previous regex because
 * `1280x720` isn't `720p`. The added `\d{3,4}\s*[xX×]\s*\d{3,4}` clause
 * catches width×height notation regardless of bracket shape.
 */
// `movie|ova|ona|the\s+movie` rejects anime feature releases (e.g. MTBB's
// `Zoku Owarimonogatari the Movie (v2)`) — manga torrents virtually never
// carry these tags. `\(v\d\)` catches the fansub "release revision"
// convention (always single-digit, always parenthesized) so it can't be
// confused with the manga `v01-v72` volume-pack form below.
const VIDEO_INDICATORS = /\b(?:dual\s*audio|multi\s*audio|[hx]\.?26[45]|hevc|avc|aac|flac|dts|blu-?ray|bd(?:rip)?|dvd(?:rip)?|web-?(?:dl|rip)|hdtv(?:rip)?|1080[pi]|720[pi]|480[pi]|2160[pi]|4k|uhd|hdr10?|10bit|dubbed|subbed|hardsub|softsub|batch|episode|season\s*\d|[se]\d{2}e?\d{2}|\d{3,4}\s*[xX×]\s*\d{3,4}|movie|ova|ona)\b|\.(?:mkv|mp4|avi|mov|webm|wmv|m4v|m2ts|mpg|mpeg)\b/i;

/** Extract numeric category ID — Prowlarr returns either {id: number} objects or plain numbers */
function getCategoryId(cat: unknown): number {
  if (typeof cat === 'number') return cat;
  if (typeof cat === 'object' && cat !== null && 'id' in cat) return (cat as { id: number }).id;
  return 0;
}

// iter-10: expanded to include Nyaa.si's Literature branch (100920/156719/
// 117084/111160) and NZBgeek's Comics bucket (7030) — the category probe
// showed these are where real manga lives. Ordered by manga-signal strength:
// Nyaa Literature English-translated and NZBgeek Comics are the strongest
// positive signals; 7000/7020 are Newznab parents; 5070/8000 kept only so
// miscategorized manga (LimeTorrents, etc.) still surfaces.
const MANGA_CATEGORY_IDS = new Set([7000, 7020, 7030, 5070, 8000, 100920, 156719, 117084, 111160]);

// iter-10: subset of the above — these are "genuine manga only" on the
// indexers we probed. Hits tagged with one of these get a scoring bonus.
const STRONG_MANGA_CATEGORY_IDS = new Set([7030, 156719, 117084, 111160, 7020]);

// iter-10: indexer names that historically return clean manga results.
// Rewarded with a small bonus so they outrank generic trackers on ties.
const MANGA_CORE_INDEXER_PATTERN = /\b(nyaa\.si|nzbgeek|knaben)\b/i;

// iter-10: indexers that returned 0 manga hits in the probe — they're pure
// anime video or unrelated content. Results from these are penalized unless
// they carry an explicit manga category tag.
const ANIME_ONLY_INDEXER_PATTERN = /\b(animetosho|dmhy|shana\s*project|subsplease|torrentdownload|torrentscsv|bangumi\s*moe)\b/i;

export function filterMangaResults(
  results: ProwlarrApiSearchResult[]
): ProwlarrApiSearchResult[] {
  return results.filter(result => {
    // Reject video/anime releases — these are never manga
    if (VIDEO_INDICATORS.test(result.title)) return false;

    // Check if result is in manga-related categories
    // Handles both {id: number} objects and plain numbers from Prowlarr API
    const isMangaCategory = result.categories?.some(cat =>
      MANGA_CATEGORY_IDS.has(getCategoryId(cat))
    ) ?? false;

    // Check if title contains manga/comic keywords. `\bv\d{2,}` (2+ digits)
    // catches manga volume tokens like `v01`, `v100`, `v01-v72`, while
    // refusing single-digit `v1`/`v2` which is the anime fansub release-
    // revision marker (e.g. `(v2)` in `the Movie (v2)`). Real manga vol
    // numbers are virtually always zero-padded — single-digit `v1` without
    // any other manga signal is overwhelmingly the fansub case.
    const hasMangaKeywords = /manga|comic|vol(?:ume)?|chapter|omnibus|cbz|cbr|\bv\d{2,}/i.test(result.title);

    // Check minimum quality (seeders for torrents, skip for usenet)
    const hasMinimumQuality = !result.seeders || result.seeders >= 1;

    return (isMangaCategory || hasMangaKeywords) && hasMinimumQuality;
  });
}

/**
 * Calculates relevance score for search result
 *
 * REFACTORED: Reduced complexity from 23 to ~8 by extracting sub-scoring logic.
 * Fixes ESLint complexity violation at original line 239.
 *
 * Scoring criteria:
 * - Title matching (0-100 points, position-aware)
 * - Manga/comic keywords (0-45 points)
 * - Collection indicators (0-30 points)
 * - Quality indicators (0-30 points)
 *
 * @param result - Prowlarr API search result
 * @param baseMangaTitle - Normalized manga title for matching
 * @returns Relevance score (0-205 points)
 */
export function calculateRelevanceScore(
  result: ProwlarrApiSearchResult,
  baseMangaTitle: string
): number {
  const titleLower = result.title.toLowerCase();
  let score = 0;

  // Title matching (highest priority) — position-aware to avoid author name false positives
  if (titleLower.includes(baseMangaTitle)) {
    score += scoreTitleMatch(titleLower, baseMangaTitle);
  }

  // Keyword scoring
  score += scoreMangaKeywords(result.title);

  // Collection scoring
  score += scoreCollectionIndicators(result.title);

  // Quality scoring
  score += scoreQualityIndicators(result);

  // iter-10: category + indexer provenance scoring
  score += scoreCategoryProvenance(result);

  return score;
}

/**
 * iter-10: score a result based on which category bucket + which indexer it
 * came from. Data-driven from the probe of all 18 configured indexers against
 * two sample queries — Nyaa.si's Literature English-translated and NZBgeek's
 * Comics are the strongest manga signals, while the anime-only trackers are
 * pure noise that the keyword filter alone doesn't fully exclude.
 *
 * iter-13 (REVERTED): tried +25 usenet-protocol boost gated on strong manga
 * category — produced 0 NZB dispatches across n=9 subset. Torrent seeder
 * bonuses (+10/+20) still dominated, and Prowlarr's returning NZBs without
 * the STRONG_MANGA category tag meant the gate never fired. Leaving this
 * comment as a signpost: a flat usenet boost won't work; need either a
 * preference toggle or a different scoring axis.
 */
function scoreCategoryProvenance(result: ProwlarrApiSearchResult): number {
  let delta = 0;
  const hasStrongMangaCat = result.categories?.some(cat =>
    STRONG_MANGA_CATEGORY_IDS.has(getCategoryId(cat))
  ) ?? false;
  if (hasStrongMangaCat) delta += 25;

  const indexer = result.indexer;
  if (MANGA_CORE_INDEXER_PATTERN.test(indexer)) delta += 10;
  if (ANIME_ONLY_INDEXER_PATTERN.test(indexer) && !hasStrongMangaCat) delta -= 20;

  return delta;
}

/**
 * Enhances API result with parsed metadata
 *
 * Parses release title, calculates enhanced relevance score,
 * and maps to domain ProwlarrSearchResult format.
 *
 * @param result - API result with relevance score
 * @returns Enhanced result in domain format
 */
export function enhanceResultWithMetadata(
  result: RelevanceScoredResult
): ProwlarrSearchResult {
  // Parse release title to extract language, quality, format, etc.
  const parsedInfo = parseReleaseTitle(result.title);

  // Enhance relevance score based on language
  let enhancedScore = result.relevanceScore;
  if (parsedInfo.audioLanguage === 'English') enhancedScore += 15;
  if (parsedInfo.audioLanguage === 'Japanese') enhancedScore += 10;
  if (parsedInfo.isOfficial) enhancedScore += 25;

  return {
    guid: result.guid,
    id: 0,
    title: result.title,
    indexerName: result.indexer,
    size: result.size,
    ...(result.seeders !== undefined && { seeders: result.seeders }),
    ...(result.leechers !== undefined && { leechers: result.leechers }),
    protocol: result.protocol ?? 'torrent',
    categories: result.categories ?? [],
    indexerId: result.indexerId ?? 0,
    downloadUrl: result.downloadUrl,
    ...(result.magnetUrl !== undefined && { magnetUrl: result.magnetUrl }),
    ...(result.infoUrl !== undefined && { infoUrl: result.infoUrl }),
    publishDate: result.publishDate ?? '',
    score: enhancedScore,
    // Parsed metadata
    languages: parsedInfo.languages,
    audioLanguage: parsedInfo.audioLanguage,
    subtitleLanguages: parsedInfo.subtitleLanguages,
    isMultiLanguage: parsedInfo.isMultiLanguage,
    isOfficial: parsedInfo.isOfficial,
    quality: parsedInfo.quality,
    format: parsedInfo.format,
    publisher: parsedInfo.publisher,
    tags: parsedInfo.tags
  };
}

// ============================================================================
// Helper Functions (Reduce Complexity)
// ============================================================================

/**
 * Position-aware title match scoring
 *
 * Distinguishes whether the manga name appears as the actual title vs embedded
 * in an author/artist name. Prevents false positives like "Akira Toriyama x
 * Toyotarō - Dragon Ball Super" matching when searching for "Akira".
 *
 * Scoring:
 * - 100: Manga name IS the title (at start, before separators, or exact first segment)
 * - 90:  Manga name appears as title after an author prefix ("Author - MangaName Vol 1")
 * - 50:  Manga name appears somewhere in the title (ambiguous position)
 * - 10:  Manga name is likely part of an author name before a different title
 *
 * @param titleLower - Lowercase release title
 * @param mangaLower - Lowercase normalized manga name
 * @returns Title match score (10-100 points)
 */
function scoreTitleMatch(titleLower: string, mangaLower: string): number {
  // Split on common author-title separators: " - ", " – ", " — ", " x "
  const segments = titleLower.split(/\s+[-–—]\s+|\s+x\s+/);
  const firstSegment = segments[0]?.trim() ?? titleLower;
  const hasMultipleSegments = segments.length > 1;

  // Case 1: First segment is exactly the manga name
  // e.g., "akira - deluxe edition vol 1-6"
  if (firstSegment === mangaLower) {
    return 100;
  }

  // Case 2: Title starts with manga name followed by metadata (volume/chapter info, brackets)
  if (titleLower.startsWith(mangaLower)) {
    const rest = titleLower.slice(mangaLower.length).trim();

    // What follows is volume/chapter info, brackets, digits, or nothing → title match
    if (rest === '' || /^(v\d|vol|ch|manga|comic|complete|full|\d|\[|\()/.test(rest)) {
      return 100;
    }

    // Extra words before a separator then a different title → likely author name
    // e.g., "akira toriyama - dragon ball super"
    if (hasMultipleSegments && firstSegment.length > mangaLower.length) {
      return 10;
    }
  }

  // Case 3: Manga name matches a segment after the first separator
  // e.g., "eiichiro oda - one piece vol 1" → "one piece" is in second segment
  if (hasMultipleSegments) {
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i]?.trim() ?? '';
      if (seg === mangaLower || seg.startsWith(`${mangaLower} `)) {
        return 90;
      }
    }
  }

  // Case 4: Manga name in first segment with more segments after → likely author
  // e.g., "katsuhiro akira otomo - some title"
  if (firstSegment.includes(mangaLower) && hasMultipleSegments) {
    return 10;
  }

  // Case 5: Manga name appears somewhere in the title (ambiguous position)
  return 50;
}

/**
 * Scores manga-related keywords in title
 *
 * Helper to reduce complexity in calculateRelevanceScore.
 *
 * @param title - Release title
 * @returns Keyword score (0-45 points)
 */
function scoreMangaKeywords(title: string): number {
  let score = 0;
  if (/manga/i.test(title)) score += 20;
  if (/comic/i.test(title)) score += 15;
  if (/vol(?:ume)?/i.test(title)) score += 10;
  if (/chapter/i.test(title)) score += 10;
  return score;
}

/**
 * Scores collection indicators in title
 *
 * Helper to reduce complexity in calculateRelevanceScore.
 * Checks for complete packs, volume ranges, and chapter ranges.
 *
 * @param title - Release title
 * @returns Collection score (0-30 points)
 */
function scoreCollectionIndicators(title: string): number {
  // Pattern 1: Explicit keywords (complete, full, all, collection)
  if (/complete|full|all|collection/i.test(title)) {
    return 30;
  }

  // Pattern 2: Large volume ranges (10+ volumes)
  const volumeScore = scoreVolumeRange(title);
  if (volumeScore > 0) return volumeScore;

  // Pattern 3: Large chapter ranges (50+ chapters)
  // Only check if not already matched by volume/keyword patterns
  if (!/v(?:ol(?:ume)?\.?)?\s*\d+\s*-\s*\d+/i.test(title)) {
    return scoreChapterRange(title);
  }

  return 0;
}

/**
 * Scores volume range indicators
 *
 * Helper to reduce complexity in scoreCollectionIndicators.
 *
 * @param title - Release title
 * @returns Volume range score (0-30 points)
 */
function scoreVolumeRange(title: string): number {
  const match = title.match(/v(?:ol(?:ume)?\.?)?\s*(\d+)\s*-\s*(\d+)/i);
  if (!match) return 0;

  const start = parseInt(match[1] ?? '0', 10);
  const end = parseInt(match[2] ?? '0', 10);
  const count = end - start + 1;

  if (count >= 10) return 30; // Significant collection
  if (count >= 5) return 15;  // Moderate pack
  return 0;
}

/**
 * Scores chapter range indicators
 *
 * Helper to reduce complexity in scoreCollectionIndicators.
 *
 * @param title - Release title
 * @returns Chapter range score (0-20 points)
 */
function scoreChapterRange(title: string): number {
  const match = title.match(/(?:ch(?:apter)?\.?\s*)?(\d+)\s*-\s*(\d+)/i);
  if (!match) return 0;

  const start = parseInt(match[1] ?? '0', 10);
  const end = parseInt(match[2] ?? '0', 10);
  const count = end - start + 1;

  if (count >= 50) return 20; // Large chapter pack
  return 0;
}

/**
 * Scores quality indicators (seeders, digital format)
 *
 * Helper to reduce complexity in calculateRelevanceScore.
 *
 * @param result - Prowlarr API search result
 * @returns Quality score (0-30 points)
 */
function scoreQualityIndicators(result: ProwlarrApiSearchResult): number {
  let score = 0;
  if (/digital/i.test(result.title)) score += 5;
  if (result.seeders && result.seeders > 5) score += 10;
  if (result.seeders && result.seeders > 20) score += 20;
  return score;
}
