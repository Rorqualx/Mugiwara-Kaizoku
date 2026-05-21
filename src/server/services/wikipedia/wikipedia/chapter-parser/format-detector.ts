/**
 * Chapter List Format Detector
 *
 * Single-pass detection of chapter list format used on a Wikipedia page.
 * Produces ChapterListFormatHints that are threaded downstream so individual
 * functions don't need to independently probe the HTML structure.
 *
 * Reuses the same regex patterns already used in tryOrderedListExtraction,
 * countOlListChapters, and extractChapterMatches.
 */

import type { ChapterListFormatHints, PageStructureHints } from '@/server/services/wikipedia/wikipedia/types';

/**
 * Detect the chapter list format used in the given HTML.
 *
 * Scans all `<ol>` blocks and numbered-text patterns in a single pass
 * to classify the page's primary chapter listing format.
 *
 * @param html - Full HTML content of the Wikipedia chapter page
 * @returns Format hints for downstream functions
 */
export function detectChapterListFormat(html: string): ChapterListFormatHints {
  const hints: ChapterListFormatHints = {
    primaryFormat: 'unknown',
    hasOlStartLists: false,
    hasBareOlWithQuotedTitles: false,
    hasBareOlWithoutQuotedTitles: false,
    olStartChapterCount: 0,
    bareOlQuotedChapterCount: 0,
    numberedTextChapterCount: 0,
    onePieceChapterCount: 0,
  };

  // 1. Scan all <ol> blocks (same regex as tryOrderedListExtraction)
  const olPattern = /<ol(?:\s+start="(\d+)")?(?:\s[^>]*)?>(?!<li[^>]*>\s*<sup)([\s\S]*?)<\/ol>/gi;
  for (const olMatch of html.matchAll(olPattern)) {
    const fullTag = olMatch[0].slice(0, olMatch[0].indexOf('>') + 1);
    if (fullTag.includes('class="references"') || fullTag.includes('class="reflist"')) continue;
    const listContent = olMatch[2] ?? '';

    if (olMatch[1] !== undefined) {
      // <ol start="N">
      hints.hasOlStartLists = true;
      hints.olStartChapterCount += [...listContent.matchAll(/<li>/gi)].length;
    } else {
      // Bare <ol> — check for quoted titles
      const quotedPattern = /<li>[^<]*?[\u0022\u201C\u201D][^\u0022\u201C\u201D<]+[\u0022\u201C\u201D]/gi;
      const quotedCount = [...listContent.matchAll(quotedPattern)].length;
      if (quotedCount > 0) {
        hints.hasBareOlWithQuotedTitles = true;
        hints.bareOlQuotedChapterCount += quotedCount;
      } else {
        hints.hasBareOlWithoutQuotedTitles = true;
      }
    }
  }

  // 2. Scan for numbered-text pattern (same regex as extractChapterMatches)
  hints.numberedTextChapterCount = [...html.matchAll(/(\d{1,3})\.\s*["""]([^"""]+)["""]?/g)].length;

  // 3. Scan for One Piece style pattern (same regex as tryOnePieceStyleExtraction)
  // Pattern: "Chapter Title" (Japanese, Romaji) — excludes CSS-like content
  const onePiecePattern = /"([^"]+)"\s*\([^)]+\)/g;
  for (const match of html.matchAll(onePiecePattern)) {
    const content = match[1];
    if (content && !content.includes(':') && !content.includes(';') && !content.includes('{')) {
      hints.onePieceChapterCount++;
    }
  }

  // 4. Determine primary format
  const olTotal = hints.olStartChapterCount + hints.bareOlQuotedChapterCount;
  if (olTotal > hints.numberedTextChapterCount && olTotal > hints.onePieceChapterCount) {
    hints.primaryFormat = hints.hasOlStartLists ? 'ol-start' : 'bare-ol-quoted';
  } else if (hints.numberedTextChapterCount > 0 && hints.numberedTextChapterCount >= hints.onePieceChapterCount) {
    hints.primaryFormat = 'numbered-text';
  } else if (hints.onePieceChapterCount > 0) {
    hints.primaryFormat = 'one-piece';
  }

  return hints;
}

/**
 * Detect page-level structure: volume marker format, count, and edition layout.
 *
 * Consolidates the 4-pattern volume marker probe that was previously inline
 * in parseChapterTables. Scans once and returns hints for downstream use.
 *
 * @param html - Full HTML content of the Wikipedia chapter page
 * @returns Page structure hints including volume prefix and count
 */
export function detectPageStructure(html: string): PageStructureHints {
  const hints: PageStructureHints = {
    volumeMarkerFormat: 'none',
    volumeIdPrefix: 'vol',
    volumeCount: 0,
    hasDualEditions: false,
  };

  // Pattern 1: id="vol1", id="vol2" (standard — JJK, Berserk, AoT)
  let markers: RegExpMatchArray[] = [...html.matchAll(/id="vol(\d+)"/g)];
  if (markers.length > 0) {
    hints.volumeMarkerFormat = 'id-vol';
    hints.volumeIdPrefix = 'vol';
    const beforeDedup = markers.length;
    markers = deduplicateMarkers(markers);
    hints.hasDualEditions = markers.length < beforeDedup;
    hints.volumeCount = markers.length;
    return hints;
  }

  // Pattern 2: id="Volume_1", id="Volume_2" (alternative)
  markers = [...html.matchAll(/id="Volume_(\d+)"/gi)];
  if (markers.length > 0) {
    hints.volumeMarkerFormat = 'id-volume';
    hints.volumeIdPrefix = 'Volume_';
    markers = deduplicateMarkers(markers);
    hints.volumeCount = markers.length;
    return hints;
  }

  // Pattern 3: <th>Volume 1</th> headers
  markers = [...html.matchAll(/<th[^>]*>(?:Vol\.?|Volume)\s*(\d+)<\/th>/gi)];
  if (markers.length > 0) {
    hints.volumeMarkerFormat = 'th-volume';
    hints.volumeIdPrefix = 'vol'; // these don't have id attrs, keep default
    markers = deduplicateMarkers(markers);
    hints.volumeCount = markers.length;
    return hints;
  }

  // Pattern 4: rowspan (Fire Force style)
  const rowspanMatches = [...html.matchAll(/<t[hd][^>]*rowspan=["']?\d+["']?[^>]*>(\d+)<\/t[hd]>/g)];
  if (rowspanMatches.length > 0) {
    const uniqueVolumes = new Set(rowspanMatches.map(m => m[1]).filter(Boolean));
    hints.volumeMarkerFormat = 'rowspan';
    hints.volumeIdPrefix = 'vol'; // rowspan doesn't use id attrs
    hints.volumeCount = uniqueVolumes.size;
    return hints;
  }

  return hints;
}

/** Deduplicate markers by volume number (keep first occurrence only) */
function deduplicateMarkers(markers: RegExpMatchArray[]): RegExpMatchArray[] {
  const seen = new Set<string>();
  return markers.filter(m => {
    const num = m[1] ?? '';
    if (seen.has(num)) return false;
    seen.add(num);
    return true;
  });
}
