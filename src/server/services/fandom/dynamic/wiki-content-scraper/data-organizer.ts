/**
 * WikiContentScraper Data Organizer Module
 *
 * Organizes chapters into volumes based on volume numbers.
 *
 * Extracted from: WikiContentScraper.ts lines 551-569
 */

import type { VolumeInfo, ChapterInfo } from './types';

/**
 * Organizes orphaned chapters into their respective volumes
 *
 * @param volumes - Array of volumes to organize chapters into
 * @param chapters - Array of chapters to organize
 */
export function organizeChaptersIntoVolumes(
  volumes: VolumeInfo[],
  chapters: ChapterInfo[]
): void {
  // Group chapters by volume number
  for (const chapter of chapters) {
    if (chapter.volume) {
      const volume = volumes.find(v => v.number === chapter.volume);
      if (volume && !volume.chapters.find(c => c.number === chapter.number)) {
        volume.chapters.push(chapter);
      }
    }
  }

  // Sort chapters within each volume
  for (const volume of volumes) {
    volume.chapters.sort((a, b) => {
      const aNum = typeof a.number === 'string' ? parseFloat(a.number) : a.number;
      const bNum = typeof b.number === 'string' ? parseFloat(b.number) : b.number;
      return aNum - bNum;
    });
  }
}
