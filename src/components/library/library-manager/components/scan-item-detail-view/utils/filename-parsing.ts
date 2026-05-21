/**
 * Parse chapter/volume number from filename
 * Supports various naming patterns for manga files
 */
export function parseChapterFromFilename(filename: string): {
  chapter?: number;
  volume?: number;
} {
  const result: { chapter?: number; volume?: number } = {};

  // Volume patterns first (more specific)
  const volumePatterns = [
    /[vV](?:ol(?:ume)?)?[.\s-]*(\d+)/,
    /Volume[.\s-]*(\d+)/i
  ];

  // Chapter patterns
  const chapterPatterns = [
    /[cC](?:h(?:apter)?)?[.\s-]*(\d+(?:\.\d+)?)/,
    /Chapter[.\s-]*(\d+(?:\.\d+)?)/i,
    /[#-]\s*(\d+(?:\.\d+)?)/,
    /\s(\d{2,4})(?:\s|$|\.)/
  ];

  for (const pattern of volumePatterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      result.volume = parseInt(match[1], 10);
      break;
    }
  }

  for (const pattern of chapterPatterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      result.chapter = parseFloat(match[1]);
      break;
    }
  }

  return result;
}
