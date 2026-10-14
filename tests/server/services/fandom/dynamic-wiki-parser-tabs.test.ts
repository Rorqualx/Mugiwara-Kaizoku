/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { describe, it, expect } from '@jest/globals';
import { load } from 'cheerio';

import { extractFromTabs, type TabExtractionResult } from '@/server/services/fandom/dynamic/dynamic-wiki-parser/tab-extractor';
import { extractFromLabelledTabs } from '@/server/services/fandom/dynamic/dynamic-wiki-parser/tab-extractor/labelled-tabs';
import type { PageStructure, VolumeData } from '@/server/services/fandom/dynamic/dynamic-wiki-parser/types';
import { DynamicWikiParser } from '@/server/services/fandom/dynamic/DynamicWikiParser';
import { WikiDataConverter } from '@/server/services/fandom/dynamic/WikiDataConverter';
import { buildChapterEnrichmentMap } from '@/server/trpc/routers/manga/metadataOperations/refresh/fandom-chapter-scraper';

// Why this exists: the legacy tab extractor (DynamicWikiParser, reached from
// FandomService.getMangaInfo and the enrichment pipeline's scraper fallback)
// returned 0 volumes and 0 chapters on every tabbed list page. Their tabs are
// cover-art tabs ("Japanese"/"English"), so the "Volume N" label match never
// hit; there is no `.tabbertab`; and the heading fallback only looked at h2/h3
// while the volume headings are <h4> inside table cells. Before this fix every
// fixture below gave { volumes: [], chapters: [] }.

const URL = 'https://example.fandom.com/wiki/Chapters_and_Volumes';
const FIXTURES = join(__dirname, 'fixtures', 'tabbed-list-pages');

function page(name: string): string {
  return gunzipSync(readFileSync(join(FIXTURES, `${name}.html.gz`))).toString('utf8');
}

async function analyze(html: string): Promise<PageStructure> {
  return new DynamicWikiParser().analyzePageStructure(html, `${URL}?${Math.random()}`);
}

async function tabs(html: string): Promise<TabExtractionResult> {
  return extractFromTabs(load(html), await analyze(html), { html, url: URL });
}

function range(volume: VolumeData | undefined): [number, number] | undefined {
  if (!volume) return undefined;
  const whole = volume.chapters.map(c => Number(c.number)).filter(n => Number.isInteger(n));
  return [Math.min(...whole), Math.max(...whole)];
}

type FixtureCase = [name: string, volumes: number, first: [number, number], last: [number, number]];

describe('extractFromTabs on tabbed list pages', () => {
  it.each<FixtureCase>([
    ['call-of-the-night', 20, [1, 8], [190, 200]],
    ['dr-stone', 26, [1, 7], [224, 232]],
    ['demon-slayer', 23, [1, 7], [197, 205]],
    ['frieren', 15, [1, 7], [138, 147]],
    ['my-hero-academia', 42, [1, 7], [423, 431]],
    ['spy-x-family', 17, [1, 5], [119, 127]],
    ['blue-lock', 40, [1, 4], [347, 354]],
    ['dandadan', 25, [1, 5], [211, 219]],
  ])('%s: %i volumes, each holding its own chapters', async (name, volumeCount, first, last) => {
    const result = await tabs(page(name));
    expect(result.method).toBe('volume_bands');
    expect(result.volumes).toHaveLength(volumeCount);
    expect(range(result.volumes[0])).toEqual(first);
    expect(range(result.volumes[volumeCount - 1])).toEqual(last);
    for (const volume of result.volumes) {
      expect(volume.title).toBe(`Volume ${volume.number}`);
      expect(volume.chapters.every(c => c.volume === volume.number && typeof c.number === 'string')).toBe(true);
    }
  });

  it('nests chapters with a title and an absolute url', async () => {
    const ch = (await tabs(page('demon-slayer'))).volumes[0]?.chapters[2];
    expect(ch).toEqual({ number: '3', title: 'Return by Dawn', url: 'https://example.fandom.com/wiki/Chapter_3', volume: 1 });
  });

  it('keeps chapters not yet in a volume at top level only', async () => {
    const result = await tabs(page('dandadan'));
    const loose = result.chapters.filter(c => c.volume === undefined);
    expect(loose.length).toBe(29);
    expect(result.volumes.some(v => v.chapters.some(c => Number(c.number) >= 220))).toBe(false);
  });

  it('does not read cover-art tabs ("Japanese"/"English") as volumes', () => {
    expect(extractFromLabelledTabs(load(page('call-of-the-night')))).toEqual([]);
  });

  it('finds no volumes when the band parse is rejected (Hunter x Hunter overlaps)', async () => {
    const result = await tabs(page('hunter-x-hunter'));
    expect(result.method).toBe('none');
    expect(result.chapters).toEqual([]);
  });
});

describe('DynamicWikiParser.extractData', () => {
  async function extract(name: string): Promise<{ method: string; volumes: VolumeData[] }> {
    const html = page(name);
    const parser = new DynamicWikiParser();
    const res = await parser.extractData({ url: URL, title: name, html, structure: await analyze(html) });
    const data = res.data as { volumes: VolumeData[] };
    return { method: res.extractionMethod, volumes: data.volumes };
  }

  it('uses the bands on a hybrid page without mixing in table rows (Demon Slayer)', async () => {
    const { method, volumes } = await extract('demon-slayer');
    expect(method).toBe('volume_bands');
    expect(volumes).toHaveLength(23);
    expect(range(volumes[0])).toEqual([1, 7]);
  });

  it('falls back to the bands when a table page yields no chapters (Kingdom)', async () => {
    const { method, volumes } = await extract('kingdom');
    expect(method).toBe('volume_bands');
    expect(volumes.map(v => v.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(range(volumes[9])).toEqual([97, 107]);
  });

  it('converts to the scraper shape, keeping loose chapters (Dandadan 220+)', async () => {
    const html = page('dandadan');
    const parser = new DynamicWikiParser();
    const extracted = await parser.extractData({ url: URL, title: 'Dandadan', html, structure: await analyze(html) });
    const converted = new WikiDataConverter().convertExtractedData(extracted, URL);
    expect(converted.volumes).toHaveLength(25);
    expect(converted.chapters).toHaveLength(248);
    expect(converted.chapters.filter(c => c.volume === undefined)).toHaveLength(29);
  });
});

describe('volume-labelled tabs and headings (no volume bands)', () => {
  const li = (n: number, title: string): string =>
    `<li><a href="/wiki/Chapter_${n}">Chapter ${n}</a> - ${title}</li>`;

  it('reads a WDS tabber whose tabs are volumes', async () => {
    const html = `<div class="mw-parser-output"><div class="wds-tabber">
      <div class="wds-tabs__wrapper"><ul class="wds-tabs">
        <li class="wds-tabs__tab"><div class="wds-tabs__tab-label"><a>Volume 1</a></div></li>
        <li class="wds-tabs__tab"><div class="wds-tabs__tab-label"><a>Volume 2</a></div></li>
      </ul></div>
      <div class="wds-tab__content"><p>ISBN 978-1-23</p><ul>${li(1, 'Start')}${li(2, 'Next')}</ul></div>
      <div class="wds-tab__content"><ul>${li(3, 'Third')}</ul></div>
    </div></div>`;
    const result = await tabs(html);
    expect(result.method).toBe('labelled_tabs');
    expect(result.volumes.map(v => [v.number, v.chapters.map(c => c.number)])).toEqual([[1, ['1', '2']], [2, ['3']]]);
    expect(result.volumes[0]?.chapters[0]?.title).toBe('Start');
    expect(result.volumes[0]?.isbn).toBe('978-1-23');
    expect(result.chapters).toHaveLength(3);
  });

  it('reads a legacy tabber and a "Volumes 1-10" range tab with headings', async () => {
    const html = `<div class="mw-parser-output"><div class="tabber">
      <div class="tabbertab" title="Volume 1"><ul>${li(1, 'One')}</ul></div>
      <div class="tabbertab" title="Volumes 2-3">
        <h3>Volume 2</h3><ul>${li(2, 'Two')}</ul>
        <h3>Volume 3: Finale</h3><ul>${li(3, 'Three')}${li(4, 'Four')}</ul>
      </div>
    </div></div>`;
    const result = await tabs(html);
    expect(result.method).toBe('labelled_tabs');
    expect(result.volumes.map(v => [v.number, v.chapters.map(c => c.number)])).toEqual([
      [1, ['1']], [2, ['2']], [3, ['3', '4']],
    ]);
    expect(result.volumes[2]?.title).toBe('Volume 3: Finale');
  });

  it('reads <h4> volume headings inside table cells', async () => {
    // Two volumes: too few for the band parser, so the heading fallback runs.
    const row = (v: number, chapters: string): string =>
      `<tr><td><h4><span id="Volume_${v}"><a href="/wiki/Volume_${v}">Volume ${v}</a></span></h4></td><td>May 1, 2020</td></tr>`
      + `<tr><td colspan="3"><ul>${chapters}</ul></td></tr>`;
    const html = `<div class="mw-parser-output"><h2>Volumes</h2><table><tbody>
      ${row(1, li(1, 'A') + li(2, 'B'))}${row(2, li(3, 'C'))}
    </tbody></table></div>`;
    const result = await tabs(html);
    expect(result.method).toBe('volume_headings');
    expect(result.volumes.map(v => [v.number, v.chapters.map(c => c.number)])).toEqual([[1, ['1', '2']], [2, ['3']]]);
    expect(result.volumes[0]?.releaseDate).toBe('May 1, 2020');
  });
});

describe('buildChapterEnrichmentMap', () => {
  it('keeps a .5 chapter separate from the whole chapter', () => {
    // The scraper hands over string numbers (WikiDataConverter's ChapterInfo.number is string | number).
    const scraped: unknown = { chapters: [{ number: '6', title: 'Six' }, { number: '6.5', title: 'Bonus' }] };
    const map = buildChapterEnrichmentMap(scraped as Parameters<typeof buildChapterEnrichmentMap>[0]);
    expect(map[6]?.title).toBe('Six');
    expect(map[6.5]?.title).toBe('Bonus');
  });
});
