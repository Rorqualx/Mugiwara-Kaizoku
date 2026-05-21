/**
 * Utility functions for ComicVine English Matcher
 */

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalize title for comparison
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[:\-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaccard similarity between two titles
 */
export function calculateSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  if (norm1 === norm2) return 1.0;

  const words1 = new Set(norm1.split(' ').filter((w) => w.length > 1));
  const words2 = new Set(norm2.split(' ').filter((w) => w.length > 1));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Print to stdout (for CLI progress)
 */
export function print(message: string): void {
  process.stdout.write(message);
}

/**
 * Print line to stdout
 */
export function println(message: string): void {
  process.stdout.write(message + '\n');
}

/**
 * Print error to stderr
 */
export function printError(message: string): void {
  process.stderr.write(message + '\n');
}
