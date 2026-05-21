/**
 * useChapterCovers Hook
 *
 * Custom React hook for updating mediaGallery with chapter cover images
 * when chapters are selected.
 */

import * as React from 'react';

import { isRecord, hasProperty, type Logger } from '../index';

/** Parameters for the useChapterCovers hook */
export interface UseChapterCoversParams {
  selectedChapters: unknown[];
  volumesData: unknown;
  setMediaGallery: React.Dispatch<React.SetStateAction<unknown>> | undefined;
  logger: Logger;
}

/** Extract cover URL from a chapter object */
function extractCoverFromChapter(chapter: unknown): string | null {
  if (!isRecord(chapter)) return null;
  const coverUrl = hasProperty(chapter, 'coverUrl') ? chapter['coverUrl'] : undefined;
  const coverImage = hasProperty(chapter, 'coverImage') ? chapter['coverImage'] : undefined;
  const image = hasProperty(chapter, 'image') ? chapter['image'] : undefined;
  const thumbnail = hasProperty(chapter, 'thumbnail') ? chapter['thumbnail'] : undefined;
  if (typeof coverUrl === 'string') return coverUrl;
  if (typeof coverImage === 'string') return coverImage;
  if (typeof image === 'string') return image;
  if (typeof thumbnail === 'string') return thumbnail;
  return null;
}

/** Check if a chapter matches any selected chapter */
function isChapterSelected(ch: unknown, selectedChapters: unknown[]): boolean {
  if (!isRecord(ch)) return false;
  return selectedChapters.some((selected: unknown) => {
    if (!isRecord(selected)) return false;
    const selectedUrl = hasProperty(selected, 'url') ? selected['url'] : undefined;
    const chUrl = hasProperty(ch, 'url') ? ch['url'] : undefined;
    const selectedNum = hasProperty(selected, 'chapterNumber') ? selected['chapterNumber'] : undefined;
    const chNum = hasProperty(ch, 'chapterNumber') ? ch['chapterNumber'] : undefined;
    const selectedTitle = hasProperty(selected, 'title') ? selected['title'] : undefined;
    const chTitle = hasProperty(ch, 'title') ? ch['title'] : undefined;
    return selectedUrl === chUrl || selectedNum === chNum || selectedTitle === chTitle;
  });
}

/** Extract chapter covers from a volumes array */
function extractCoversFromVolumesArray(
  volumes: unknown[],
  selectedChapters: unknown[],
  existingCovers: string[]
): string[] {
  const covers: string[] = [];
  volumes.forEach((volume: unknown) => {
    if (!isRecord(volume)) return;
    const chapters = hasProperty(volume, 'chapters') && Array.isArray(volume['chapters'])
      ? volume['chapters'] : null;
    if (!chapters) return;
    chapters.forEach((ch: unknown) => {
      if (!isRecord(ch) || !isChapterSelected(ch, selectedChapters)) return;
      const coverUrl = hasProperty(ch, 'coverUrl') ? ch['coverUrl'] : undefined;
      const coverImage = hasProperty(ch, 'coverImage') ? ch['coverImage'] : undefined;
      const image = hasProperty(ch, 'image') ? ch['image'] : undefined;
      const allCovers = [...existingCovers, ...covers];
      if (typeof coverUrl === 'string' && !allCovers.includes(coverUrl)) {
        covers.push(coverUrl);
      } else if (typeof coverImage === 'string' && !allCovers.includes(coverImage)) {
        covers.push(coverImage);
      } else if (typeof image === 'string' && !allCovers.includes(image)) {
        covers.push(image);
      }
    });
  });
  return covers;
}

/** Extract covers from volumesData structure */
function extractCoversFromVolumes(
  volumesData: unknown,
  selectedChapters: unknown[],
  existingCovers: string[]
): string[] {
  const volumesDataObj = isRecord(volumesData) ? volumesData : null;
  if (!volumesDataObj) return [];
  const covers: string[] = [];
  // Check Fandom volumes
  const fandom = hasProperty(volumesDataObj, 'fandom') && isRecord(volumesDataObj['fandom'])
    ? volumesDataObj['fandom'] : null;
  const fandomVolumes = fandom && hasProperty(fandom, 'volumes') && Array.isArray(fandom['volumes'])
    ? fandom['volumes'] : null;
  if (fandomVolumes) {
    covers.push(...extractCoversFromVolumesArray(fandomVolumes, selectedChapters, [...existingCovers, ...covers]));
  }
  // Check regular volumes
  const regularVolumes = hasProperty(volumesDataObj, 'volumes') && Array.isArray(volumesDataObj['volumes'])
    ? volumesDataObj['volumes'] : null;
  if (regularVolumes) {
    covers.push(...extractCoversFromVolumesArray(regularVolumes, selectedChapters, [...existingCovers, ...covers]));
  }
  return covers;
}

/** Hook to update mediaGallery with chapter cover images when chapters are selected */
export function useChapterCovers(params: UseChapterCoversParams): void {
  const { selectedChapters, volumesData, setMediaGallery, logger } = params;

  React.useEffect(() => {
    if (selectedChapters.length === 0) return;

    // Extract cover URLs from selected chapters
    const chapterCovers: string[] = [];
    selectedChapters.forEach((chapter: unknown) => {
      const cover = extractCoverFromChapter(chapter);
      if (cover) chapterCovers.push(cover);
    });

    // Also check volumesData for chapter covers
    chapterCovers.push(...extractCoversFromVolumes(volumesData, selectedChapters, chapterCovers));

    // Update mediaGallery with chapter covers
    if (chapterCovers.length > 0 && setMediaGallery) {
      logger.info('[useChapterCovers] Updating mediaGallery with chapter covers:', {
        count: chapterCovers.length,
        covers: chapterCovers,
      });
      setMediaGallery((prev: unknown) => {
        const prevObj = isRecord(prev) ? prev : {};
        return { ...prevObj, chapterCovers };
      });
    }
  }, [selectedChapters, volumesData, setMediaGallery, logger]);
}
