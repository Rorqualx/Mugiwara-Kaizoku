/**
 * Fuzzy Title Matching
 *
 * Uses Levenshtein distance and n-gram similarity for fuzzy matching.
 */

/**
 * Calculate Levenshtein distance between two strings
 * Uses optimized space O(n) approach with two rows
 */
export function levenshteinDistance(str1: string, str2: string): number {
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  // Assign to local variables for space optimization
  const shorter = str1.length <= str2.length ? str1 : str2;
  const longer = str1.length <= str2.length ? str2 : str1;

  // Use two rows instead of full matrix to avoid index access issues
  let prevRow: number[] = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  let currRow: number[] = new Array<number>(shorter.length + 1).fill(0);

  for (let i = 1; i <= longer.length; i++) {
    currRow[0] = i;

    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer.charAt(i - 1) === shorter.charAt(j - 1) ? 0 : 1;
      const deletion = (prevRow[j] ?? 0) + 1;
      const insertion = (currRow[j - 1] ?? 0) + 1;
      const substitution = (prevRow[j - 1] ?? 0) + cost;
      currRow[j] = Math.min(deletion, insertion, substitution);
    }

    // Swap rows
    [prevRow, currRow] = [currRow, prevRow];
  }

  // Result is in prevRow after final swap
  return prevRow[shorter.length] ?? 0;
}

/**
 * Calculate similarity score based on Levenshtein distance (0-1)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Generate n-grams from a string
 */
export function generateNgrams(text: string, n: number = 2): Set<string> {
  const ngrams = new Set<string>();
  const normalized = text.toLowerCase();

  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.substring(i, i + n));
  }

  return ngrams;
}

/**
 * Calculate Jaccard similarity between two sets of n-grams (0-1)
 */
export function ngramSimilarity(a: string, b: string, n: number = 2): number {
  const ngramsA = generateNgrams(a, n);
  const ngramsB = generateNgrams(b, n);

  if (ngramsA.size === 0 && ngramsB.size === 0) return 1;
  if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

  let intersection = 0;
  for (const gram of ngramsA) {
    if (ngramsB.has(gram)) intersection++;
  }

  const union = ngramsA.size + ngramsB.size - intersection;
  return intersection / union;
}

/**
 * Combined similarity using both Levenshtein and n-gram methods
 * Weights can be adjusted based on use case
 */
export function combinedSimilarity(
  a: string,
  b: string,
  levenshteinWeight: number = 0.4,
  ngramWeight: number = 0.6
): number {
  const levSim = levenshteinSimilarity(a, b);
  const ngramSim = ngramSimilarity(a, b);
  return levSim * levenshteinWeight + ngramSim * ngramWeight;
}
