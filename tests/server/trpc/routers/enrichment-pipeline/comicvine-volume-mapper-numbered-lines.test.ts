/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';

import type { ComicVineIssue } from '@/server/services/comicvine/service';
import { mapComicVineIssuesToVolumes } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/comicvine-volume-mapper';

function issue(issueNumber: number, first: number, last: number, after = ''): ComicVineIssue {
  const items = [];
  for (let n = first; n <= last; n++) items.push(`<li>Chapter #${String(n).padStart(3, '0')}: Title ${n}</li>`);
  return {
    id: issueNumber,
    issue_number: String(issueNumber),
    description: `<h4>Chapter Titles</h4><ul>${items.join('')}</ul>${after}`,
  } as unknown as ComicVineIssue;
}

describe('mapComicVineIssuesToVolumes — "Chapter #NNN:" lists with release-date lines', () => {
  // Why this exists: refreshing Tokyo Ghoul in production gave volumes 9–14
  // ranges 15 chapters too high (volume 9 = 95–104 instead of 80–89). The
  // "#" hid the chapter numbers, and "Print Edition - June 16, 2015" lines
  // under the list were counted as chapters, so the running total slid.
  const issues = [
    issue(1, 1, 9, '<h4>Release Dates</h4><ul><li>Digital Edition - March 17, 2015</li><li>Print Edition - June 16, 2015</li></ul>'),
    issue(2, 10, 19, '<h4>Release Dates</h4><ul><li>Digital - May 19, 2015</li><li>Print - August 19, 2015</li></ul>'),
    issue(3, 20, 29),
  ];

  it('reads the range from the numbered chapters and stops at the release dates', () => {
    const volumes = mapComicVineIssuesToVolumes(issues);
    expect(volumes.map(v => [v['startChapter'], v['endChapter'], v['chapterCount']])).toEqual([
      ['1', '9', 9],
      ['10', '19', 10],
      ['20', '29', 10],
    ]);
  });

  it('counts an unnumbered final chapter after the numbered ones', () => {
    // Attack on Titan volume 34: dropping "Final Episode" ended the volume at
    // 138, and chapter 139 then got a volume 35 of its own.
    const final = {
      id: 34,
      issue_number: '34',
      description: '<h4>Chapter Titles</h4><ul><li>Episode 135: The Battle of Heaven and Earth</li><li>Episode 136: Dedicate Your Heart</li>'
        + '<li>Episode 137: Titans</li><li>Episode 138: A Long Dream</li><li>Final Episode: Toward the Tree on That Hill</li></ul>',
    } as unknown as ComicVineIssue;
    const [volume] = mapComicVineIssuesToVolumes([final]);
    expect([volume?.['startChapter'], volume?.['endChapter'], volume?.['chapterCount']]).toEqual(['135', '139', 5]);
  });

  it('still counts every line when the list has no chapter numbers at all', () => {
    const untitled = {
      id: 1,
      issue_number: '1',
      description: '<h4>Chapter Titles</h4><ul><li>Tragedy</li><li>Incubation</li><li>Starved</li></ul>',
    } as unknown as ComicVineIssue;
    const [volume] = mapComicVineIssuesToVolumes([untitled]);
    expect([volume?.['startChapter'], volume?.['endChapter'], volume?.['chapterCount']]).toEqual(['1', '3', 3]);
  });
});
