/**
 * Stage 2 — Publisher-filtered discovery for verify-comicvine-corpus.
 *
 * When Stage 1 (direct API validation of the existing corpus ID) fails
 * (placeholder ID), this module finds the correct ComicVine volume by
 * searching ComicVine and filtering by `expectedPublisher` from the corpus
 * entry. This is more rigorous than the language-aware matcher because:
 *
 *   1. It searches with a larger limit (40 results instead of 20)
 *   2. It filters candidates by the expected publisher (case-insensitive
 *      substring match either way), which the matcher does not do
 *   3. It picks the highest count_of_issues among publisher-matched results
 *      (= the most complete edition, usually the canonical English release)
 *   4. It cross-validates the picked candidate's name against ALL AniList
 *      title variants via dice coefficient ≥ 0.7
 *
 * The matcher itself is iter 2's fix target — using it here would just
 * propagate its known quality issues into the corpus.
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import type { ComicVineVolume } from '@/server/services/comicvine/service';

const PUBLISHER_DISCOVERY_TITLE_SIMILARITY = 0.7;

/** Bigram dice coefficient — duplicated from main verifier for module independence. */
function diceCoefficient(a: string, b: string): number {
  const x = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const y = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigramsA = new Set<string>();
  for (let i = 0; i < x.length - 1; i++) bigramsA.add(x.slice(i, i + 2));
  let intersection = 0;
  for (let i = 0; i < y.length - 1; i++) {
    if (bigramsA.has(y.slice(i, i + 2))) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + (y.length - 1));
}

function bestSimilarityVsAniList(volumeName: string, anilist: AniListMangaDetails): number {
  const variants = [
    anilist.title.english,
    anilist.title.romaji,
    anilist.title.native,
    ...(anilist.synonyms ?? []),
  ].filter((t): t is string => typeof t === 'string' && t.length > 0);
  let best = 0;
  for (const v of variants) {
    const score = diceCoefficient(volumeName, v);
    if (score > best) best = score;
  }
  return best;
}

interface ScoredCandidate {
  volumeId: number;
  name: string;
  publisher: string;
  countOfIssues: number;
  titleSim: number;
}

export interface DiscoveryResult {
  volumeId: number;
  name: string;
  publisher: string;
  countOfIssues: number;
  titleSim: number;
  /** True if the picked candidate matched the expected publisher */
  publisherMatched: boolean;
}

function publisherMatches(candidatePublisher: string, expectedPublisher: string): boolean {
  if (!candidatePublisher || !expectedPublisher) return false;
  const a = candidatePublisher.toLowerCase();
  const b = expectedPublisher.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function scoreCandidates(volumes: ComicVineVolume[], anilist: AniListMangaDetails): ScoredCandidate[] {
  const scored: ScoredCandidate[] = [];
  for (const v of volumes) {
    const name = v.name ?? '';
    if (!name) continue;
    const titleSim = bestSimilarityVsAniList(name, anilist);
    if (titleSim < PUBLISHER_DISCOVERY_TITLE_SIMILARITY) continue;
    scored.push({
      volumeId: v.id,
      name,
      publisher: v.publisher?.name ?? '',
      countOfIssues: v.count_of_issues ?? 0,
      titleSim,
    });
  }
  return scored;
}

function pickBestCandidate(
  scored: ScoredCandidate[],
  expectedPublisher: string | undefined,
): DiscoveryResult | null {
  if (scored.length === 0) return null;

  // Prefer candidates matching the expected publisher
  if (expectedPublisher) {
    const matching = scored.filter((c) => publisherMatches(c.publisher, expectedPublisher));
    if (matching.length > 0) {
      matching.sort((a, b) => b.countOfIssues - a.countOfIssues);
      const best = matching[0];
      if (best) return { ...best, publisherMatched: true };
    }
  }

  // Fallback: highest count_of_issues among title-similar candidates
  scored.sort((a, b) => b.countOfIssues - a.countOfIssues);
  const best = scored[0];
  return best ? { ...best, publisherMatched: false } : null;
}

/**
 * Search ComicVine and pick the best canonical volume for a manga title.
 * Returns null if no candidate has sufficient title similarity.
 */
export async function discoverViaPublisher(
  title: string,
  expectedPublisher: string | undefined,
  anilist: AniListMangaDetails,
): Promise<DiscoveryResult | null> {
  const { comicvineService } = await import('@/server/services/comicvine/service');
  const volumes = await comicvineService.searchBasicVolumes(title, 0, 40);
  if (volumes.length === 0) return null;
  const scored = scoreCandidates(volumes, anilist);
  return pickBestCandidate(scored, expectedPublisher);
}
