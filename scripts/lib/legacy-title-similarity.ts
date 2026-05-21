/**
 * @quality-check-skip
 *
 * Legacy title-similarity functions, preserved for one-off ComicVine research
 * scripts (`search-comicvine-*.ts`, `baseline-parser-test.ts`,
 * `test-comicvine-matching.ts`). The production matcher uses Sørensen-Dice
 * in `enrichment-pipeline/matching/` — these scripts predate that migration
 * and are kept so they remain reproducible. Do not use in new code.
 */

function stripTitlePatterns(title: string): string {
  return title
    .replace(/\s+Part\s+\d+\b/gi, '')
    .replace(/\s+Part\s+(?:I{1,3}|IV|VI{0,3}|IX|X{0,3})\b/gi, '')
    .replace(/\s*\(\d{4}\)/g, '')
    .replace(/\s*-?\s*(?:Digital|HD|Complete|Omnibus|Colored|Full Color|Manga)\s*$/gi, '')
    .trim();
}

export function normalizeTitle(title: string): string {
  return stripTitlePatterns(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fillCell(dp: number[][], i: number, j: number, s1: string, s2: string): void {
  const cur = dp[i];
  const prev = dp[i - 1];
  if (!cur || !prev) return;
  if (s1[i - 1] === s2[j - 1]) {
    cur[j] = prev[j - 1] ?? 0;
    return;
  }
  cur[j] = Math.min(
    (prev[j] ?? 0) + 1,
    (cur[j - 1] ?? 0) + 1,
    (prev[j - 1] ?? 0) + 1,
  );
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) { const row = dp[i]; if (row) row[0] = i; }
  for (let j = 0; j <= n; j++) { const row = dp[0]; if (row) row[j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      fillCell(dp, i, j, s1, s2);
    }
  }
  return dp[m]?.[n] ?? 0;
}

function levenshteinSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshteinDistance(s1, s2) / maxLen;
}

function jaccardSimilarity(s1: string, s2: string): number {
  const w1 = new Set(s1.split(' ').filter((w) => w.length > 0));
  const w2 = new Set(s2.split(' ').filter((w) => w.length > 0));
  if (w1.size === 0 && w2.size === 0) return 1.0;
  if (w1.size === 0 || w2.size === 0) return 0.0;
  const inter = new Set([...w1].filter((w) => w2.has(w)));
  const union = new Set([...w1, ...w2]);
  return inter.size / union.size;
}

function containsSimilarity(s1: string, s2: string): number {
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }
  return 0;
}

function wordContainmentSimilarity(s1: string, s2: string): number {
  const w1 = s1.split(' ').filter((w) => w.length > 1);
  const w2 = s2.split(' ').filter((w) => w.length > 1);
  if (w1.length === 0 || w2.length === 0) return 0;
  const [shorter, longer] = w1.length <= w2.length ? [w1, w2] : [w2, w1];
  const matched = shorter.filter((word) =>
    longer.some((w) => w === word || w.includes(word) || word.includes(w)),
  ).length;
  if (matched === shorter.length) return 0.85 + (0.15 * shorter.length / longer.length);
  return matched / shorter.length * 0.7;
}

export function calculateTitleSimilarity(t1: string, t2: string): number {
  const n1 = normalizeTitle(t1);
  const n2 = normalizeTitle(t2);
  if (n1 === n2) return 1.0;
  const wc = wordContainmentSimilarity(n1, n2);
  if (wc >= 0.85) {
    const j = jaccardSimilarity(n1, n2);
    return Math.max(wc * 0.7 + j * 0.3, 0.80);
  }
  const lev = levenshteinSimilarity(n1, n2);
  const j = jaccardSimilarity(n1, n2);
  const c = containsSimilarity(n1, n2);
  let sim = lev * 0.5 + j * 0.3 + c * 0.2;
  if (wc > 0.5) sim = Math.max(sim, wc * 0.8);
  return Math.min(sim, 1.0);
}
