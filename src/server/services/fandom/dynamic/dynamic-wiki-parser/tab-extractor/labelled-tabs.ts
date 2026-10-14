/**
 * Dynamic Wiki Parser - Volume-Labelled Tabs
 *
 * Fallback for tabbers whose tabs are volumes: a "Volume 3" tab holds that
 * volume, a "Volumes 1-10" tab holds a run of volumes under their own
 * headings. Reads modern Fandom tabbers (`.wds-tabber` with
 * `.wds-tabs__tab-label` / `.wds-tab__content`) and the legacy tabber
 * (`.tabbertab[title]`). Tabs labelled anything else ("Japanese",
 * "English", "Light Novels") are not volumes and are skipped.
 *
 * @module dynamic-wiki-parser/tab-extractor/labelled-tabs
 */

import { extractVolumesUnderHeadings } from './heading-sections';
import { extractVolumeDataFromContent } from './volume-content';

import type { VolumeData } from '../types';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/** "Volume 3", "Vol. 3", "Volumes 1-10", "Volume 11–20", "Volumes 21 to 30". */
const VOLUME_LABEL = /^\s*Vol(?:ume)?s?\.?\s*(\d+)(?:\s*(?:[-–—]|to)\s*(\d+))?\s*$/i;

export interface TabPanel {
  label: string;
  $panel: Cheerio<Element>;
}

/** Every tab panel on the page with its own label (nested tabbers keep their own labels). */
export function tabPanels($: CheerioAPI): TabPanel[] {
  const panels: TabPanel[] = [];
  $('.wds-tabber').each((_, tabber) => {
    const $tabber = $(tabber);
    const labels = $tabber
      .find('.wds-tabs__tab-label')
      .filter((__, label) => $(label).closest('.wds-tabber').get(0) === tabber)
      .map((__, label) => $(label).text().trim())
      .get();
    $tabber.children('.wds-tab__content').each((index, panel) => {
      panels.push({ label: labels[index] ?? '', $panel: $(panel) });
    });
  });
  $('.tabbertab').each((_, panel) => {
    const $panel = $(panel);
    panels.push({ label: ($panel.attr('title') ?? $panel.attr('data-title') ?? '').trim(), $panel });
  });
  return panels;
}

/** Volumes from tabs labelled as a volume or a range of volumes. */
export function extractFromLabelledTabs($: CheerioAPI): VolumeData[] {
  const volumes: VolumeData[] = [];
  const add = (volume: VolumeData | null): void => {
    if (volume && !volumes.some(v => v.number === volume.number)) volumes.push(volume);
  };
  for (const { label, $panel } of tabPanels($)) {
    const match = VOLUME_LABEL.exec(label);
    if (!match?.[1]) continue;
    if (match[2] !== undefined) {
      extractVolumesUnderHeadings($, $panel).forEach(add);
    } else {
      add(extractVolumeDataFromContent($, $panel, Number(match[1]), label));
    }
  }
  return volumes.sort((a, b) => a.number - b.number);
}
