/**
 * Volume Metadata Extraction
 *
 * Extracts title, summary, and cover image from ComicVine volume pages.
 * Extracted from: scrapingService.ts (lines 84-205)
 *
 * @module metadata-extractor
 */

import { logger } from '@/utils/logger';

import type { CheerioAPI } from 'cheerio';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract volume number and subtitle from URL
 * Returns { volumeNumber, subtitle } or null if not parseable
 *
 * Uses anchored pattern that finds the LAST volume number in the URL.
 * This handles titles with numbers like "86-eighty-six-2-subtitle" correctly.
 */
function extractVolumeInfoFromUrl(volumeUrl: string): { volumeNumber: number; subtitle: string } | null {
  const urlMatch = volumeUrl.match(/\/([^/]+)\/4000-\d+\/?$/);
  if (!urlMatch?.[1]) return null;

  const urlPart = urlMatch[1];

  // Split the URL part into segments
  // Pattern: series-name-volumeNumber-subtitle (e.g., fire-force-4-fire-bugs)
  // For titles with numbers like "86-eighty-six", we need to find the LAST
  // number that looks like a volume number (1-999), followed by remaining subtitle
  const parts = urlPart.split('-');

  // Find the LAST number that looks like a volume number (1-999)
  // Search from end-1 backwards (last segment is likely subtitle, not volume number)
  let volumeIdx = -1;
  for (let i = parts.length - 2; i >= 1; i--) {
    const part = parts[i];
    if (part === undefined) continue;
    const num = parseInt(part, 10);
    if (!isNaN(num) && num >= 1 && num <= 999) {
      volumeIdx = i;
      break;
    }
  }

  if (volumeIdx === -1) return null;

  const volumePart = parts[volumeIdx];
  if (volumePart === undefined) return null;
  const volumeNumber = parseInt(volumePart, 10);

  // Subtitle is everything after the volume number
  const subtitleParts = parts.slice(volumeIdx + 1);
  const subtitle = subtitleParts.length > 0
    ? subtitleParts
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : '';

  logger.info('[ComicVine Scraper] Extracted volume info from URL:', {
    urlPart,
    volumeNumber,
    subtitle,
  });

  return { volumeNumber, subtitle };
}


/**
 * Extract volume subtitle from page elements
 */
function extractSubtitleFromPage($: CheerioAPI): string {
  let subtitle =
    $('h2.issue-title').text().trim() ||
    $('.issue-subtitle').text().trim() ||
    $('[data-field="subtitle"]').text().trim() ||
    $('.wiki-title-subtitle').text().trim();

  // Skip if it's just "Chapter Titles" or similar navigation text
  if (subtitle.toLowerCase().includes('chapter')) {
    subtitle = '';
  }

  return subtitle;
}

/**
 * Build full volume title from main title and subtitle
 */
function buildVolumeTitle(mainTitle: string, subtitle: string): string {
  if (!subtitle || subtitle.includes(mainTitle)) {
    return mainTitle;
  }

  // Remove any duplicate numbering from subtitle
  const cleanedSubtitle = subtitle.replace(/^#?\d+\s*[-:]?\s*/i, '').trim();
  return cleanedSubtitle ? `${mainTitle}: ${cleanedSubtitle}` : mainTitle;
}

/**
 * Extract volume description/summary from page
 */
function extractVolumeSummary($: CheerioAPI): string {
  let summary = '';

  // 1. Look for description section with h2 header
  const descSection = $('h2')
    .filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text === 'description' || text === 'summary' || text === 'overview';
    })
    .first()
    .next();

  if (descSection.length) {
    summary = descSection.text().trim();
  }

  // 2. Try wiki-content-block sections
  if (!summary) {
    const contentBlock = $('.wiki-content-block, .content-block').first();
    if (contentBlock.length) {
      summary = contentBlock.clone().find('h2').remove().end().text().trim();
    }
  }

  // 3. Look for deck field (short description)
  if (!summary) {
    summary =
      $('[data-field="deck"]').first().text().trim() ||
      $('meta[property="og:description"]').attr('content') ||
      '';
  }

  // 4. Look for italicized summary text (older format)
  if (!summary) {
    summary = $('p em').first().text().trim();
  }

  // Clean up the summary
  if (summary) {
    summary = summary.replace(/\s+/g, ' ').trim();
    if (summary.length > 1000) {
      summary = summary.substring(0, 997) + '...';
    }
  }

  return summary;
}

/**
 * Extract cover image URL from page
 */
function extractCoverImage($: CheerioAPI): string | undefined {
  return (
    $('.issue-cover img').attr('src') ||
    $('img.cover-image').attr('src') ||
    $('.wiki-image img').first().attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    $('[data-field="image"] img').attr('src') ||
    $('.imgboxart img').first().attr('src')
  );
}

/**
 * Extract concepts/themes from ComicVine page sidebar
 * ComicVine stores themes as "Concepts" in the sidebar (e.g., Action, Adventure, Supernatural)
 */
function extractConcepts($: CheerioAPI): string[] {
  const concepts: string[] = [];

  // Try multiple selector patterns for concepts section
  // Pattern 1: Look for "Concepts" header and its associated list
  $('h3, h4').each((_, header) => {
    const headerText = $(header).text().toLowerCase().trim();
    if (headerText === 'concepts' || headerText.includes('concept')) {
      // Get the next sibling list or div with links
      const nextList = $(header).next('ul, div');
      nextList.find('a').each((__, link) => {
        const conceptName = $(link).text().trim();
        if (conceptName && !concepts.includes(conceptName)) {
          concepts.push(conceptName);
        }
      });
    }
  });

  // Pattern 2: Look for data-field="concepts" section
  $('[data-field="concepts"] a, .concepts-list a').each((_, link) => {
    const conceptName = $(link).text().trim();
    if (conceptName && !concepts.includes(conceptName)) {
      concepts.push(conceptName);
    }
  });

  // Pattern 3: Look for wiki sidebar items with concept links
  // ComicVine often has sidebar sections like "Object", "Concept", etc.
  $('.wiki-details dt').each((_, dt) => {
    const labelText = $(dt).text().toLowerCase().trim();
    if (labelText.includes('concept')) {
      const dd = $(dt).next('dd');
      dd.find('a').each((__, link) => {
        const conceptName = $(link).text().trim();
        if (conceptName && !concepts.includes(conceptName)) {
          concepts.push(conceptName);
        }
      });
    }
  });

  // Pattern 4: Look for sidebar list items under "Concepts"
  $('.aside-content, .wiki-sidebar').find('a[href*="/concept/"]').each((_, link) => {
    const conceptName = $(link).text().trim();
    if (conceptName && !concepts.includes(conceptName)) {
      concepts.push(conceptName);
    }
  });

  // Pattern 5: Generic sidebar parsing - look for list after "Concepts" text
  $('*:contains("Concepts")').each((_, el) => {
    // Only process if it's a short heading-like element
    const text = $(el).clone().children().remove().end().text().trim();
    if (text === 'Concepts') {
      $(el).parent().find('a').each((__, link) => {
        const href = $(link).attr('href') ?? '';
        // Only include links that look like concept links
        if (href.includes('/concept/') || href.includes('/4015-')) {
          const conceptName = $(link).text().trim();
          if (conceptName && !concepts.includes(conceptName)) {
            concepts.push(conceptName);
          }
        }
      });
    }
  });

  if (concepts.length > 0) {
    logger.info('[ComicVine Scraper] Extracted concepts:', { concepts });
  }

  return concepts;
}

/**
 * Extract genres from ComicVine page
 * ComicVine may have genre information in certain sections
 */
function extractGenres($: CheerioAPI): string[] {
  const genres: string[] = [];

  // Look for genre-related sections
  $('h3, h4').each((_, header) => {
    const headerText = $(header).text().toLowerCase().trim();
    if (headerText === 'genres' || headerText === 'genre') {
      const nextList = $(header).next('ul, div');
      nextList.find('a').each((__, link) => {
        const genreName = $(link).text().trim();
        if (genreName && !genres.includes(genreName)) {
          genres.push(genreName);
        }
      });
    }
  });

  // Look for data-field="genres"
  $('[data-field="genres"] a').each((_, link) => {
    const genreName = $(link).text().trim();
    if (genreName && !genres.includes(genreName)) {
      genres.push(genreName);
    }
  });

  return genres;
}

/**
 * Volume metadata extracted from ComicVine page
 */
export interface VolumeMetadata {
  /** ComicVine volume ID (extracted from URL) */
  volumeId: string;

  /** Volume number in the series */
  volumeNumber: number;

  /** Full volume title (includes subtitle if available) */
  volumeTitle: string;

  /** Volume description/summary */
  volumeSummary?: string;

  /** Cover image URL */
  coverImage?: string;

  /** Themes/concepts extracted from the page (e.g., Action, Adventure, Supernatural) */
  themes?: string[];

  /** Genres extracted from the page */
  genres?: string[];
}

/**
 * Extract volume metadata from a ComicVine page
 *
 * @param $ - Cheerio instance loaded with the page HTML
 * @param volumeUrl - URL of the ComicVine volume page
 * @returns Volume metadata including title, summary, and cover image
 */
export function extractVolumeMetadata(
  $: CheerioAPI,
  volumeUrl: string
): VolumeMetadata {
  // Extract main title
  const mainTitle =
    $('h1').first().text().trim() ||
    $('h2.wiki-title, .wiki-page-header h1, h1[data-field="name"]')
      .first()
      .text()
      .trim();

  // PRIORITY: Extract volumeNumber from URL first (most reliable)
  // URL pattern: /fire-force-4-fire-bugs/4000-XXXXX/ where 4 is the volume number
  const urlInfo = extractVolumeInfoFromUrl(volumeUrl);

  // Extract subtitle (use URL info if available, otherwise try page elements)
  let volumeSubtitle = urlInfo?.subtitle ?? '';
  if (!volumeSubtitle) {
    volumeSubtitle = extractSubtitleFromPage($);
  }

  // Build full volume title
  const volumeTitle = buildVolumeTitle(mainTitle, volumeSubtitle);

  // Extract volume ID
  const volumeMatch = volumeUrl.match(/\/4000-(\d+)\//);
  const volumeId = volumeMatch?.[1] ?? '';

  // PRIORITY: Use URL-extracted volumeNumber (correct), NOT title-parsed number (could be issue #)
  // Example: URL "fire-force-4-fire-bugs" = Volume 4, but page title "#16" = Issue number (wrong!)
  let volumeNumber = urlInfo?.volumeNumber ?? 0;

  // Only fall back to title parsing if URL didn't provide a number
  if (volumeNumber === 0) {
    const volumeNumberMatch =
      volumeTitle.match(/(?:Volume|Vol\.?|#)\s*(\d+)/i) ?? volumeTitle.match(/\b(\d+)\b/);
    volumeNumber = volumeNumberMatch?.[1]
      ? parseInt(volumeNumberMatch[1], 10)
      : 1;
    logger.info('[ComicVine Scraper] Fell back to title parsing for volumeNumber:', {
      volumeTitle,
      extractedNumber: volumeNumber,
    });
  }

  // Extract summary and cover
  const volumeSummary = extractVolumeSummary($);
  const coverImage = extractCoverImage($);

  // Extract themes (concepts) and genres from sidebar
  const themes = extractConcepts($);
  const genres = extractGenres($);

  logger.info('[ComicVine Scraper] Processing volume:', {
    volumeId,
    volumeNumber,
    volumeTitle,
    hasSummary: !!volumeSummary,
    hasCoverImage: !!coverImage,
    themesCount: themes.length,
    genresCount: genres.length,
  });

  const result: VolumeMetadata = {
    volumeId,
    volumeNumber,
    volumeTitle,
  };
  if (volumeSummary) result.volumeSummary = volumeSummary;
  if (coverImage) result.coverImage = coverImage;
  if (themes.length > 0) result.themes = themes;
  if (genres.length > 0) result.genres = genres;
  return result;
}
