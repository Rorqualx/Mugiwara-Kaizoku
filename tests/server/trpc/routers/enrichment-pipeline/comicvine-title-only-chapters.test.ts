/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';

import { extractComicVineChapters } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/enrichment-result-builder';

jest.mock('@/server/db', () => ({ prisma: {} }));

type ComicVineInput = Parameters<typeof extractComicVineChapters>[0];

const issue = (n: number, lines: string[]): Record<string, unknown> => ({
  id: n,
  issue_number: String(n),
  description: `<h4>Chapter Titles</h4><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`,
});
const numbers = (issues: Array<Record<string, unknown>>): string[] =>
  extractComicVineChapters({ issues } as unknown as ComicVineInput).map(c => String(c['chapterNumber']));

describe('extractComicVineChapters — a title-only line after numbered chapters', () => {
  // Why this exists: Attack on Titan's last volume lists "Episode 135" to
  // "Episode 138" and then "Final Episode: Toward the Tree on That Hill". The
  // unnumbered line took the running count of every line parsed so far (144)
  // instead of 139, creating a chapter past the end of the series.
  it('continues from the last numbered chapter', () => {
    expect(numbers([
      issue(1, ['Episode 1: A', 'Episode 2: B', 'Episode 3: C']),
      issue(2, ['Episode 135: X', 'Episode 136: Y', 'Final Episode: Z']),
    ])).toEqual(['1', '2', '3', '135', '136', '137']);
  });

  it('leaves a title-only line between numbered chapters on the running index', () => {
    expect(numbers([issue(1, ['Episode 1: A', 'Side Story', 'Episode 2: B'])])).toEqual(['1', '2', '2']);
  });

  it('still uses the running index when a volume has no numbered chapter', () => {
    expect(numbers([issue(1, ['Alpha', 'Beta']), issue(2, ['Gamma', 'Delta'])])).toEqual(['1', '2', '3', '4']);
  });
});
