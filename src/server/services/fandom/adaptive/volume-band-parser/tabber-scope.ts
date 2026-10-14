/**
 * Tabber scoping for volume bands
 *
 * Fandom list pages use tabbers two ways. Inside each volume they hold the
 * Japanese/English covers (no chapters): those panels are removed so a cover
 * caption is never read as a chapter. Around the whole list they separate the
 * main series from light novels and spin-offs (Demon Slayer, Spy x Family),
 * whose volume numbers restart at 1: those later panels are removed.
 *
 * @module volume-band-parser/tabber-scope
 */

import type { CheerioAPI } from 'cheerio';

/** A later tab with one of these labels holds another series' volumes. */
const SIDE_TAB = /light novel|spin[- ]?off|one[- ]?shot|novel|gaiden|side stor/i;

/**
 * Removes cover-only tab panels and side-series panels from the page in place.
 * Returns the labels of the panels dropped as side series.
 */
export function scopeTabbers($: CheerioAPI): string[] {
  const dropped: string[] = [];
  $('.wds-tabber, .tabber').each((_, tabber) => {
    const $tabber = $(tabber);
    const labels = $tabber
      .find('.wds-tabs__tab-label')
      .map((__, label) => $(label).text().trim())
      .get();
    $tabber.children('.wds-tab__content').each((index, panel) => {
      const $panel = $(panel);
      const hasChapters = $panel.find('li, a[href*="/wiki/Chapter_"]').length > 0;
      if (!hasChapters) {
        $panel.remove();
        return;
      }
      const label = labels[index] ?? '';
      if (index > 0 && SIDE_TAB.test(label)) {
        dropped.push(label);
        $panel.remove();
      }
    });
  });
  return dropped;
}
