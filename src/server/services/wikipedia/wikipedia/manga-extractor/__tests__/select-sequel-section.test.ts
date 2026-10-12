/**
 * @jest-environment node
 *
 * "List of Tokyo Ghoul chapters" holds Tokyo Ghoul and then Tokyo Ghoul:re.
 * The chapter-list alias sent Tokyo Ghoul:re to that page and the main-series
 * filter kept the first series, so the sequel was given the parent's 143
 * chapters and volume ranges. These tests guard the selection of the sequel's
 * own section.
 */
import { filterToMainSeriesContent, selectSequelSection } from '@/server/services/shared/parsing-utils';

const volumes = (count: number, firstChapter: number): string =>
  Array.from({ length: count }, (_, i) => `<tr><th id="vol${i + 1}">${i + 1}</th><td><ol start="${firstChapter + i * 10}"><li>c</li></ol></td></tr>`).join('');

const SHARED_PAGE = [
  '<div class="mw-heading mw-heading2"><h2 id="Tokyo_Ghoul"><i>Tokyo Ghoul</i></h2></div>',
  `<table data-series="parent">${volumes(14, 1)}</table>`,
  '<div class="mw-heading mw-heading3"><h3 id="One-shot">One-shot</h3></div>',
  '<div class="mw-heading mw-heading2"><h2 id="Tokyo_Ghoul:re"><i>Tokyo Ghoul:re</i></h2></div>',
  `<table data-series="sequel">${volumes(16, 1)}</table>`,
  '<div class="mw-heading mw-heading2"><h2 id="Side_stories">Side stories</h2></div>',
  `<table data-series="side">${volumes(1, 1)}</table>`,
].join('\n');

describe('selectSequelSection', () => {
  it("returns the sequel's section only: neither the parent's volumes nor the side stories after it", () => {
    const section = selectSequelSection(SHARED_PAGE, 'Tokyo Ghoul:re');
    expect(section).not.toBeNull();
    expect(section).toContain('data-series="sequel"');
    expect(section).not.toContain('data-series="parent"');
    expect(section).not.toContain('data-series="side"');
    expect(section?.match(/id="vol\d+"/g)).toHaveLength(16);
  });

  it('matches the heading whatever the case or surrounding markup', () => {
    expect(selectSequelSection(SHARED_PAGE, '  tokyo ghoul:RE ')).toContain('data-series="sequel"');
  });

  it('returns null for the first series on the page, which keeps the main-series filter', () => {
    expect(selectSequelSection(SHARED_PAGE, 'Tokyo Ghoul')).toBeNull();
    const main = filterToMainSeriesContent(SHARED_PAGE, 'Tokyo Ghoul');
    expect(main.match(/id="vol\d+"/g)).toHaveLength(14);
  });

  it('returns null when no heading carries the title', () => {
    expect(selectSequelSection(SHARED_PAGE, 'Tokyo Ghoul: Jack')).toBeNull();
    expect(selectSequelSection(SHARED_PAGE, '')).toBeNull();
  });

  it('returns null on a single-series page even when a heading repeats the title', () => {
    const single = `<h2 id="Volumes">Bleach</h2><table>${volumes(3, 1)}</table>`;
    expect(selectSequelSection(single, 'Bleach')).toBeNull();
  });
});
