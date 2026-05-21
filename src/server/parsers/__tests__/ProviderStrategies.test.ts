/**
 * Provider Strategy Tests with Real Data Samples
 * 
 * Tests each provider strategy with actual HTML samples
 * to ensure accurate data extraction.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import * as _cheerio from 'cheerio';

import { UnifiedProviderAdapter } from '../UnifiedProviderAdapter';

import type { ProviderType } from '../types';

/**
 * Test type for section results
 */
interface Section {
  title: string;
  [key: string]: unknown;
}

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
describe('Provider Strategy Tests', () => {
  let adapter: UnifiedProviderAdapter;
  beforeEach(() => {
    adapter = new UnifiedProviderAdapter();
  });
  // MangaDex strategy removed - provider deprecated
  describe('Fandom Strategy', () => {
    const fandomHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Monkey D. Luffy | One Piece Wiki | Fandom</title>
        </head>
        <body>
          <div class="page-header">
            <h1 class="page-header__title">Monkey D. Luffy</h1>
          </div>
          <aside class="portable-infobox pi-background">
            <h2 class="pi-item pi-item-spacing pi-title">Monkey D. Luffy</h2>
            <div class="pi-item pi-image">
              <img src="https://static.wikia.nocookie.net/onepiece/luffy.png" alt="Luffy">
            </div>
            <section class="pi-item pi-group">
              <div class="pi-item pi-data" data-source="jname">
                <h3 class="pi-data-label">Japanese Name</h3>
                <div class="pi-data-value">モンキー・D・ルフィ</div>
              </div>
              <div class="pi-item pi-data" data-source="rname">
                <h3 class="pi-data-label">Romanized Name</h3>
                <div class="pi-data-value">Monkī Dī Rufi</div>
              </div>
              <div class="pi-item pi-data" data-source="ename">
                <h3 class="pi-data-label">Official English Name</h3>
                <div class="pi-data-value">Monkey D. Luffy</div>
              </div>
              <div class="pi-item pi-data" data-source="first">
                <h3 class="pi-data-label">Debut</h3>
                <div class="pi-data-value">Chapter 1; Episode 1</div>
              </div>
              <div class="pi-item pi-data" data-source="affiliation">
                <h3 class="pi-data-label">Affiliations</h3>
                <div class="pi-data-value">Straw Hat Pirates</div>
              </div>
              <div class="pi-item pi-data" data-source="occupation">
                <h3 class="pi-data-label">Occupations</h3>
                <div class="pi-data-value">Pirate; Captain</div>
              </div>
            </section>
          </aside>
          <div class="mw-parser-output">
            <p>Monkey D. Luffy, also known as "Straw Hat Luffy", is the main protagonist of the manga and anime, One Piece.</p>
            <h2>Appearance</h2>
            <p>Luffy is a young man of average height with shaggy black hair...</p>
            <h2>Personality</h2>
            <p>Luffy's personality is like that of a child, in the sense that he tends to go to the extremes...</p>
            <h2>Abilities and Powers</h2>
            <p>As captain of the Straw Hat Pirates, Luffy has immense physical strength...</p>
            <h3>Devil Fruit</h3>
            <p>Luffy gained the powers of the Gomu Gomu no Mi...</p>
          </div>
        </body>
      </html>
    `;
    it('should extract character name from Fandom wiki', async () => {
      const result = await adapter.parse(fandomHtml, 'FANDOM' as ProviderType);
      expect(result.title).toContain('Monkey D. Luffy');
    });
    it('should extract infobox data', async () => {
      const result = await adapter.parse(fandomHtml, 'FANDOM' as ProviderType);
      expect(result.metadata).toBeDefined();
      if (isRecord(result.metadata)) {
        expect(result.metadata['japaneseName']).toBe('モンキー・D・ルフィ');
        expect(result.metadata['debut']).toContain('Chapter 1');
        expect(result.metadata['affiliation']).toContain('Straw Hat Pirates');
      }
    });
    it('should extract main content sections', async () => {
      const result = await adapter.parse(fandomHtml, 'FANDOM' as ProviderType);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('main protagonist');
      expect(result.sections).toBeDefined();
      if (result.sections) {
        expect(result.sections).toContainEqual(expect.objectContaining({ title: 'Appearance' }));
        expect(result.sections).toContainEqual(expect.objectContaining({ title: 'Personality' }));
      }
    });
    it('should extract character image', async () => {
      const result = await adapter.parse(fandomHtml, 'FANDOM' as ProviderType);
      expect(result.images).toBeDefined();
      if (result.images) {
        expect(result.images.length).toBeGreaterThan(0);
        expect(result.images[0]).toContain('luffy.png');
      }
    });
  });
  describe('Wikipedia Strategy', () => {
    const wikipediaHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>One Piece - Wikipedia</title>
        </head>
        <body>
          <h1 id="firstHeading" class="firstHeading">One Piece</h1>
          <div id="bodyContent">
            <div id="mw-content-text">
              <table class="infobox">
                <tbody>
                  <tr>
                    <th colspan="2" class="infobox-above">One Piece</th>
                  </tr>
                  <tr>
                    <td colspan="2" class="infobox-image">
                      <img src="//upload.wikimedia.org/wikipedia/en/one_piece_vol_1.png" alt="One Piece Volume 1">
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Genre</th>
                    <td class="infobox-data">Adventure, Fantasy</td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Written by</th>
                    <td class="infobox-data">Eiichiro Oda</td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Published by</th>
                    <td class="infobox-data">Shueisha</td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Magazine</th>
                    <td class="infobox-data">Weekly Shōnen Jump</td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Demographic</th>
                    <td class="infobox-data">Shōnen</td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Original run</th>
                    <td class="infobox-data">July 22, 1997 – present</td>
                  </tr>
                  <tr>
                    <th scope="row" class="infobox-label">Volumes</th>
                    <td class="infobox-data">106</td>
                  </tr>
                </tbody>
              </table>
              <p><b>One Piece</b> is a Japanese manga series written and illustrated by Eiichiro Oda.</p>
              <p>The story follows the adventures of Monkey D. Luffy, a young man whose body gained the properties of rubber...</p>
              <h2>Plot</h2>
              <p>The series begins with the execution of Gol D. Roger...</p>
              <h2>Publication</h2>
              <p>One Piece has been serialized in Shueisha's shōnen manga magazine Weekly Shōnen Jump since July 1997...</p>
              <h2>Media</h2>
              <h3>Anime</h3>
              <p>Toei Animation produced an anime television series based on the manga...</p>
              <h2>Reception</h2>
              <p>One Piece has received critical acclaim for its storytelling, characterization, and humor...</p>
            </div>
          </div>
        </body>
      </html>
    `;
    it('should extract title from Wikipedia', async () => {
      const result = await adapter.parse(wikipediaHtml, 'WIKIPEDIA' as ProviderType);
      expect(result.title).toBe('One Piece');
    });
    it('should extract infobox information', async () => {
      const result = await adapter.parse(wikipediaHtml, 'WIKIPEDIA' as ProviderType);
      expect(result.metadata).toBeDefined();
      if (isRecord(result.metadata)) {
        expect(result.metadata['author']).toBe('Eiichiro Oda');
        expect(result.metadata['publisher']).toBe('Shueisha');
        expect(result.metadata['magazine']).toBe('Weekly Shōnen Jump');
        expect(result.metadata['volumes']).toBe('106');
        expect(result.metadata['genre']).toContain('Adventure');
      }
    });
    it('should extract main article content', async () => {
      const result = await adapter.parse(wikipediaHtml, 'WIKIPEDIA' as ProviderType);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('Japanese manga series');
      expect(result.content).toContain('Monkey D. Luffy');
    });
    it('should extract article sections', async () => {
      const result = await adapter.parse(wikipediaHtml, 'WIKIPEDIA' as ProviderType);
      expect(result.sections).toBeDefined();
      if (result.sections) {
        expect((result.sections as unknown as Section[]).map(s => s.title)).toContain('Plot');
        expect((result.sections as unknown as Section[]).map(s => s.title)).toContain('Publication');
        expect((result.sections as unknown as Section[]).map(s => s.title)).toContain('Reception');
      }
    });
  });
  describe('MyAnimeList Strategy', () => {
    const malHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>One Piece - MyAnimeList.net</title>
        </head>
        <body>
          <div class="contentWrapper">
            <h1 class="h1-manga-title">
              <span itemprop="name">One Piece</span>
            </h1>
            <div class="leftside">
              <div class="manga-image">
                <img src="https://cdn.myanimelist.net/images/manga/one_piece.jpg" alt="One Piece">
              </div>
              <div class="information">
                <span class="dark_text">Type:</span> Manga<br>
                <span class="dark_text">Volumes:</span> Unknown<br>
                <span class="dark_text">Chapters:</span> Unknown<br>
                <span class="dark_text">Status:</span> Publishing<br>
                <span class="dark_text">Published:</span> Jul 22, 1997 to ?<br>
                <span class="dark_text">Genres:</span> Adventure, Comedy, Drama<br>
                <span class="dark_text">Authors:</span> Oda, Eiichiro (Story & Art)<br>
                <span class="dark_text">Serialization:</span> Shounen Jump (Weekly)
              </div>
              <div class="statistics">
                <span class="dark_text">Score:</span> 9.01<br>
                <span class="dark_text">Ranked:</span> #3<br>
                <span class="dark_text">Popularity:</span> #2
              </div>
            </div>
            <div class="rightside">
              <div class="synopsis" itemprop="description">
                Gol D. Roger, a man referred to as the "Pirate King," is set to be executed by the World Government...
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    it('should extract manga title from MAL', async () => {
      const result = await adapter.parse(malHtml, 'MYANIMELIST' as ProviderType);
      expect(result.title).toBe('One Piece');
    });
    it('should extract publication information', async () => {
      const result = await adapter.parse(malHtml, 'MYANIMELIST' as ProviderType);
      expect(result.metadata).toBeDefined();
      if (isRecord(result.metadata)) {
        expect(result.metadata['type']).toBe('Manga');
        expect(result.metadata['status']).toBe('Publishing');
        expect(result.metadata['published']).toContain('Jul 22, 1997');
      }
    });
    it('should extract genres', async () => {
      const result = await adapter.parse(malHtml, 'MYANIMELIST' as ProviderType);
      expect(result.genres).toBeDefined();
      if (result.genres) {
        expect(result.genres).toContain('Adventure');
        expect(result.genres).toContain('Comedy');
        expect(result.genres).toContain('Drama');
      }
    });
    it('should extract statistics', async () => {
      const result = await adapter.parse(malHtml, 'MYANIMELIST' as ProviderType);
      expect(result.statistics).toBeDefined();
      if (isRecord(result.statistics)) {
        expect(result.statistics['score']).toBe('9.01');
        expect(result.statistics['ranked']).toBe('#3');
        expect(result.statistics['popularity']).toBe('#2');
      }
    });
    it('should extract synopsis', async () => {
      const result = await adapter.parse(malHtml, 'MYANIMELIST' as ProviderType);
      expect(result.synopsis).toBeDefined();
      expect(result.synopsis).toContain('Pirate King');
    });
  });
  describe('AniList Strategy', () => {
    const aniListHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>One Piece · AniList</title>
          <meta property="og:title" content="One Piece">
          <meta property="og:description" content="Gold Roger was known as the Pirate King...">
          <meta property="og:image" content="https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/one-piece.jpg">
        </head>
        <body>
          <div class="media">
            <div class="header">
              <h1>One Piece</h1>
              <div class="native-title">ONE PIECE</div>
            </div>
            <div class="data">
              <div class="data-set">
                <div class="type">Format</div>
                <div class="value">Manga</div>
              </div>
              <div class="data-set">
                <div class="type">Status</div>
                <div class="value">Releasing</div>
              </div>
              <div class="data-set">
                <div class="type">Start Date</div>
                <div class="value">Jul 22, 1997</div>
              </div>
              <div class="data-set">
                <div class="type">Average Score</div>
                <div class="value">90%</div>
              </div>
              <div class="data-set">
                <div class="type">Popularity</div>
                <div class="value">125,234</div>
              </div>
              <div class="data-set">
                <div class="type">Chapters</div>
                <div class="value">Unknown</div>
              </div>
              <div class="data-set">
                <div class="type">Volumes</div>
                <div class="value">Unknown</div>
              </div>
            </div>
            <div class="description">
              Gold Roger was known as the Pirate King, the strongest and most infamous being to have sailed the Grand Line...
            </div>
            <div class="tags">
              <span class="tag">Adventure</span>
              <span class="tag">Comedy</span>
              <span class="tag">Drama</span>
              <span class="tag">Fantasy</span>
              <span class="tag">Shounen</span>
              <span class="tag">Pirates</span>
              <span class="tag">Superpowers</span>
            </div>
          </div>
        </body>
      </html>
    `;
    it('should extract manga title from AniList', async () => {
      const result = await adapter.parse(aniListHtml, 'ANILIST' as ProviderType);
      expect(result.title).toBe('One Piece');
    });
    it('should extract native title', async () => {
      const result = await adapter.parse(aniListHtml, 'ANILIST' as ProviderType);
      expect(result.nativeTitle).toBe('ONE PIECE');
    });
    it('should extract manga data', async () => {
      const result = await adapter.parse(aniListHtml, 'ANILIST' as ProviderType);
      expect(result.metadata).toBeDefined();
      if (isRecord(result.metadata)) {
        expect(result.metadata['format']).toBe('Manga');
        expect(result.metadata['status']).toBe('Releasing');
        expect(result.metadata['startDate']).toContain('Jul 22, 1997');
      }
    });
    it('should extract statistics', async () => {
      const result = await adapter.parse(aniListHtml, 'ANILIST' as ProviderType);
      expect(result.statistics).toBeDefined();
      if (isRecord(result.statistics)) {
        expect(result.statistics['averageScore']).toBe('90%');
        expect(result.statistics['popularity']).toBe('125,234');
      }
    });
    it('should extract tags', async () => {
      const result = await adapter.parse(aniListHtml, 'ANILIST' as ProviderType);
      expect(result.tags).toBeDefined();
      if (result.tags) {
        expect(result.tags).toContain('Adventure');
        expect(result.tags).toContain('Pirates');
        expect(result.tags).toContain('Shounen');
      }
    });
    it('should extract cover image from meta tags', async () => {
      const result = await adapter.parse(aniListHtml, 'ANILIST' as ProviderType);
      expect(result.coverImage).toBe('https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/one-piece.jpg');
    });
  });
  describe('Generic/Fallback Strategy', () => {
    const genericHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>One Piece Manga - Read Online</title>
          <meta name="description" content="Read One Piece manga online for free">
          <meta property="og:image" content="https://example.com/cover.jpg">
        </head>
        <body>
          <div class="container">
            <h1>One Piece</h1>
            <div class="manga-info">
              <p><strong>Author:</strong> Eiichiro Oda</p>
              <p><strong>Status:</strong> Ongoing</p>
              <p><strong>Genres:</strong> Adventure, Comedy, Drama</p>
            </div>
            <div class="description">
              <h2>Description</h2>
              <p>The story follows Monkey D. Luffy...</p>
            </div>
            <div class="chapters">
              <h2>Chapters</h2>
              <ul>
                <li><a href="/chapter/1">Chapter 1</a></li>
                <li><a href="/chapter/2">Chapter 2</a></li>
                <li><a href="/chapter/3">Chapter 3</a></li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;
    it('should extract basic information using generic strategy', async () => {
      const result = await adapter.parse(genericHtml, 'GENERIC' as ProviderType);
      expect(result.title).toBeTruthy();
    });
    it('should attempt to extract author', async () => {
      const result = await adapter.parse(genericHtml, 'GENERIC' as ProviderType);
      expect(result.author).toContain('Eiichiro Oda');
    });
    it('should extract meta description', async () => {
      const result = await adapter.parse(genericHtml, 'GENERIC' as ProviderType);
      expect(result.description).toBeDefined();
    });
    it('should extract cover image from meta tags', async () => {
      const result = await adapter.parse(genericHtml, 'GENERIC' as ProviderType);
      expect(result.coverImage).toBe('https://example.com/cover.jpg');
    });
    it('should find chapter links', async () => {
      const result = await adapter.parse(genericHtml, 'GENERIC' as ProviderType);
      expect(result.chapters).toBeDefined();
      if (result.chapters) {
        expect(result.chapters.length).toBeGreaterThan(0);
      }
    });
  });
  describe('Edge Cases and Error Handling', () => {
    it('should handle empty HTML gracefully', async () => {
      const result = await adapter.parse('', 'GENERIC' as ProviderType);
      expect(result).toBeDefined();
      expect(result.title).toBe('');
    });
    it('should handle malformed HTML', async () => {
      const malformedHtml = '<html><body><h1>Title without closing';
      const result = await adapter.parse(malformedHtml, 'GENERIC' as ProviderType);
      expect(result).toBeDefined();
    });
    it('should handle missing elements gracefully', async () => {
      const minimalHtml = '<html><body><p>Some text</p></body></html>';
      const result = await adapter.parse(minimalHtml, 'GENERIC' as ProviderType);
      expect(result).toBeDefined();
      expect(result.title).toBe('');
    });
    it('should handle non-English content', async () => {
      const japaneseHtml = `
        <html>
          <body>
            <h1>ワンピース</h1>
            <p>作者: 尾田栄一郎</p>
          </body>
        </html>
      `;
      const result = await adapter.parse(japaneseHtml, 'GENERIC' as ProviderType);
      expect(result).toBeDefined();
      expect(result.title).toBe('ワンピース');
    });
    it('should extract data even with different HTML structures', async () => {
      const alternativeHtml = `
        <html>
          <body>
            <article>
              <header>
                <h2 class="title">One Piece</h2>
              </header>
              <section class="info">
                <dl>
                  <dt>Author</dt>
                  <dd>Eiichiro Oda</dd>
                  <dt>Status</dt>
                  <dd>Ongoing</dd>
                </dl>
              </section>
            </article>
          </body>
        </html>
      `;
      const result = await adapter.parse(alternativeHtml, 'GENERIC' as ProviderType);
      expect(result).toBeDefined();
      expect(result.title).toBeTruthy();
    });
  });
});