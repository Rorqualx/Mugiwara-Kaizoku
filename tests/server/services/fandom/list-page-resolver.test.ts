/**
 * @jest-environment node
 *
 * Fandom list-page discovery. The fixtures are cut from the live Sakamoto Days
 * wiki (2026-10-13): "Chapters and Volumes" (volumes 1-6) and the "Sakamoto
 * Days (Manga)" overview article that the series-title resolver used to pick.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  buildCandidateTitles,
  isDedicatedWiki,
  measureListPageContent,
  pickListPages,
  resolveListPages,
  type ListPageCandidate,
} from '@/server/services/fandom/adaptive/list-page-resolver';

const FIX = join(__dirname, 'fixtures', 'list-pages');
const CV_HTML = readFileSync(join(FIX, 'sakamoto-chapters-and-volumes.html'), 'utf8');
const OVERVIEW_HTML = readFileSync(join(FIX, 'sakamoto-manga-overview.html'), 'utf8');

const cand = (title: string, chapters: number, volumes: number): ListPageCandidate => ({
  title, url: `https://x.fandom.com/wiki/${title.replace(/ /g, '_')}`, chapters, volumes,
});

describe('measureListPageContent', () => {
  it('counts the chapters and volume headings of a Chapters and Volumes table', () => {
    const m = measureListPageContent(CV_HTML);
    expect(m.volumes).toBe(6);
    expect(m.chapters).toBeGreaterThanOrEqual(50);
  });

  it('finds no volume list on the series overview article', () => {
    const m = measureListPageContent(OVERVIEW_HTML);
    expect(m.volumes).toBe(0);
    expect(m.chapters).toBeLessThan(measureListPageContent(CV_HTML).chapters);
  });

  it('ignores chapter mentions in article prose and footnotes (a character page is not a chapter list)', () => {
    const prose = Array.from({ length: 30 }, (_, i) => `<p>In Chapter ${i + 1} he fights.<sup class="reference"><a href="#n">[${i}]</a></sup></p>`).join('');
    const m = measureListPageContent(`<div class="mw-parser-output">${prose}</div>`);
    expect(m.chapters).toBe(0);
  });

  it('keeps a chapter list written as a paragraph inside a table cell (Dorohedoro "Curse N")', () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Curse ${i + 1} - <a href="/wiki/Chapter_${i + 1}">Title</a><br />`).join('\n');
    const html = `<div class="mw-parser-output"><table><tr><td><p><b><a href="/wiki/Volume_1">Volume 1</a></b><br />${lines}</p></td></tr></table></div>`;
    expect(measureListPageContent(html)).toEqual({ chapters: 12, volumes: 1 });
  });

  it('reads "Act N" chapters (Pluto) and /wiki/Volume_N links (Demon Slayer) as list entries', () => {
    const acts = Array.from({ length: 10 }, (_, i) => `<li>Act ${i + 1}&#160;: "T"</li>`).join('');
    const vols = [1, 2, 3].map(n => `<a href="/wiki/Volume_${n}" title="Volume ${n}">Cruelty</a>`).join('');
    expect(measureListPageContent(`<table><tr><td><ul>${acts}</ul></td><td>${vols}</td></tr></table>`)).toEqual({ chapters: 10, volumes: 3 });
  });

  it('counts a numbered "001. Title" list as chapters only when it is a real list', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `<li>${String(i + 1).padStart(3, '0')}. Title ${i + 1}</li>`).join('');
    expect(measureListPageContent(`<ul>${rows}</ul>`).chapters).toBe(12);
    expect(measureListPageContent('<ul><li>1. Introduction</li><li>2. Plot</li></ul>').chapters).toBe(0);
  });
});

describe('isDedicatedWiki', () => {
  it('treats "Sakamoto Days Wiki" as Sakamoto Days\' own wiki', () => {
    expect(isDedicatedWiki('Sakamoto Days Wiki', 'sakamoto-days.fandom.com', ['Sakamoto Days'])).toBe(true);
  });

  it('treats the Attack on Titan wiki as shared for the Lost Girls spin-off', () => {
    expect(isDedicatedWiki('Attack on Titan Wiki', 'attackontitan.fandom.com', ['Attack on Titan: Lost Girls'])).toBe(false);
  });

  it('treats the JoJo wiki as shared for Steel Ball Run', () => {
    expect(isDedicatedWiki("JoJo's Bizarre Wiki", 'jojo.fandom.com', ["JoJo's Bizarre Adventure: Part 7–Steel Ball Run"])).toBe(false);
  });

  it('ignores a mixed-script synonym that would shrink to "jojo" ("JOJO的奇妙冒险 第七部 飙马野郎")', () => {
    expect(isDedicatedWiki("JoJo's Bizarre Wiki", 'jojo.fandom.com', ['JOJO的奇妙冒险 第七部 飙马野郎', 'SBR'])).toBe(false);
  });

  it('matches the wiki through an alt title (Call of the Night Wiki for Yofukashi no Uta)', () => {
    expect(isDedicatedWiki('Call of the Night Wiki', 'call-of-the-night.fandom.com', ['Yofukashi no Uta', 'Call of the Night'])).toBe(true);
    expect(isDedicatedWiki('Call of the Night Wiki', 'call-of-the-night.fandom.com', ['Yofukashi no Uta'])).toBe(false);
  });

  it('matches the wiki subdomain when the sitename is a nickname (hunterxhunter.fandom.com is "Hunterpedia")', () => {
    expect(isDedicatedWiki('Hunterpedia', 'hunterxhunter.fandom.com', ['Hunter x Hunter'])).toBe(true);
  });
});

describe('buildCandidateTitles', () => {
  it('straightens a typographic apostrophe so "Journey’s End" finds the wiki page "Journey\'s End (Manga)"', () => {
    expect(buildCandidateTitles('Frieren: Beyond Journey’s End', [], false)).toContain("Frieren: Beyond Journey's End (Manga)");
  });

  it('names pages after synonyms only on the series\' own wiki', () => {
    expect(buildCandidateTitles('Yofukashi no Uta', [], true, ['Call of the Night'])).toContain('Call of the Night (Manga)');
    expect(buildCandidateTitles('Yofukashi no Uta', [], false, ['Call of the Night'])).not.toContain('Call of the Night (Manga)');
    expect(buildCandidateTitles('Yofukashi no Uta', [], false, ['Call of the Night'])).not.toContain('Chapters and Volumes');
  });
});

describe('pickListPages', () => {
  it('prefers the page listing the most chapters over the overview article', () => {
    const picked = pickListPages([cand('Sakamoto Days (Manga)', 24, 0), cand('Chapters and Volumes', 278, 28)]);
    expect(picked?.chapterPage.title).toBe('Chapters and Volumes');
    expect(picked?.volumePage.title).toBe('Chapters and Volumes');
  });

  it('reports a separate volume page when the chapter page lacks the volumes', () => {
    const picked = pickListPages([cand('List of Chapters', 300, 0), cand('List of Volumes', 120, 30)]);
    expect(picked?.chapterPage.title).toBe('List of Chapters');
    expect(picked?.volumePage.title).toBe('List of Volumes');
  });

  it('keeps a bound page unless another lists clearly more chapters', () => {
    const bound = cand('Tokyo Ghoul (manga)', 140, 14);
    expect(pickListPages([bound, cand('Story Arcs', 150, 14)], bound.url)?.chapterPage).toBe(bound);
    const stub = cand('Jujutsu Kaisen', 30, 2);
    expect(pickListPages([stub, cand('Chapters and Volumes', 272, 30)], stub.url)?.chapterPage.title).toBe('Chapters and Volumes');
  });

  it('at equal chapters prefers the list page over the series article, bound or not', () => {
    // Demon Slayer / Dr. STONE: the "(Manga)" article counts the same chapters
    // from its navigation box, without titles (Dr. STONE's box files 15 in volume 3).
    const article = cand('Dr. Stone (Manga)', 232, 28);
    const list = cand('Chapters and Volumes', 232, 27);
    expect(pickListPages([article, list])?.chapterPage).toBe(list);
    const bound = cand('Kimetsu no Yaiba (Manga)', 205, 23);
    expect(pickListPages([bound, cand('Chapters and Volumes', 205, 23)], bound.url)?.chapterPage.title).toBe('Chapters and Volumes');
    // A list page with fewer chapters still does not displace the bound article.
    expect(pickListPages([bound, cand('Chapters and Volumes', 190, 23)], bound.url)?.chapterPage).toBe(bound);
  });

  it('returns null when no page names 10 chapters or 3 volumes', () => {
    expect(pickListPages([cand('Chapters', 4, 1), cand('Volumes', 0, 2)])).toBeNull();
  });
});

describe('resolveListPages (MediaWiki API, mocked)', () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input));
      calls.push(url.searchParams.toString());
      const p = url.searchParams;
      const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
      if (p.get('meta') === 'siteinfo') return json({ query: { general: { sitename: 'Sakamoto Days Wiki' } } });
      if (p.get('titles')) {
        const asked = (p.get('titles') ?? '').split('|');
        const exists = new Set(['Sakamoto Days (Manga)', 'Chapters and Volumes']);
        return json({ query: { pages: asked.map((t, i) => (exists.has(t) ? { pageid: 100 + i, ns: 0, title: t } : { ns: 0, title: t, missing: true })) } });
      }
      if (p.get('list') === 'search') return json({ query: { search: [{ title: 'Chapter 1' }, { title: 'Chapters and Volumes' }] } });
      if (p.get('action') === 'parse') {
        const page = p.get('page');
        if (page === 'Chapters and Volumes') return json({ parse: { title: page, text: CV_HTML } });
        if (page === 'Sakamoto Days (Manga)') return json({ parse: { title: page, text: OVERVIEW_HTML } });
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => { globalThis.fetch = realFetch; });

  it('finds Chapters and Volumes for Sakamoto Days although "Sakamoto Days (Manga)" exists', async () => {
    const r = await resolveListPages('sakamoto-days.fandom.com', { seriesTitle: 'Sakamoto Days' });
    expect(r?.chapterPageUrl).toBe('https://sakamoto-days.fandom.com/wiki/Chapters_and_Volumes');
    expect(r?.volumePageUrl).toBe(r?.chapterPageUrl);
    expect(r?.dedicatedWiki).toBe(true);
  });

  it('replaces a bound overview page with the list page that holds the chapters', async () => {
    const bound = 'https://sakamoto-days.fandom.com/wiki/Sakamoto_Days_(Manga)';
    const r = await resolveListPages('sakamoto-days.fandom.com', { seriesTitle: 'Sakamoto Days', incumbentUrl: bound });
    expect(r?.chapterPageUrl).toBe('https://sakamoto-days.fandom.com/wiki/Chapters_and_Volumes');
  });

  it('keeps a bound Chapters_and_Volumes URL exactly as stored', async () => {
    const bound = 'https://sakamoto-days.fandom.com/wiki/Chapters_and_Volumes';
    const r = await resolveListPages('sakamoto-days.fandom.com', { seriesTitle: 'Sakamoto Days', incumbentUrl: bound });
    expect(r?.chapterPageUrl).toBe(bound);
  });

  it('asks for every naming variant in one titles query with redirects followed', async () => {
    await resolveListPages('sakamoto-days.fandom.com', { seriesTitle: 'Sakamoto Days' });
    const titleQueries = calls.filter(c => c.includes('titles='));
    expect(titleQueries).toHaveLength(1);
    expect(titleQueries[0]).toContain('redirects=1');
    expect(decodeURIComponent(titleQueries[0] ?? '').replace(/\+/g, ' ')).toContain('Chapters and Volumes');
  });

  it('on a shared wiki never measures the generic list pages of the parent series', async () => {
    (globalThis.fetch as unknown as jest.Mock<(i: unknown) => Promise<Response>>).mockImplementationOnce(
      async () => new Response(JSON.stringify({ query: { general: { sitename: 'Attack on Titan Wiki' } } })),
    );
    const r = await resolveListPages('attackontitan.fandom.com', { seriesTitle: 'Attack on Titan: Lost Girls' });
    const asked = calls.filter(c => c.includes('titles=')).map(c => decodeURIComponent(c).replace(/\+/g, ' ')).join(' ');
    expect(asked).not.toContain('|Chapters and Volumes|');
    expect(calls.some(c => c.includes('list=search'))).toBe(false);
    expect(r).toBeNull();
  });
});
