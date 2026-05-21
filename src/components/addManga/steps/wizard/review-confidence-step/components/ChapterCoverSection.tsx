/* eslint-disable complexity -- Complex component with multiple data processing paths */

/**
 * ChapterCoverSection Component
 *
 * Renders chapter covers from selected volumes and individual chapters.
 */

import React from 'react';

import {
  Stack,
  Paper,
  Group,
  Text,
  Image,
  Badge,
  ScrollArea,
  Box,
} from '@mantine/core';

import { isRecord } from '@/lib/type-guards';
import { logger } from '@/utils/logger';
import { isString, isNumber } from '@/utils/validation/type-guards';

interface ChapterCoverSectionProps {
  selectedVolumes: (number | string)[];
  volumesData: {
    volumes: unknown[] | undefined;
    totalVolumes: number | undefined;
    totalChapters: number | undefined;
  };
  allChapterUrls: unknown[] | undefined;
  chapterMetadataCache: Map<string, unknown>;
  chapterDisplaySource: string | undefined;
  provider: string;
}

const ChapterCoverSection: React.FC<ChapterCoverSectionProps> = ({
  selectedVolumes,
  volumesData,
  allChapterUrls,
  chapterMetadataCache,
  chapterDisplaySource,
  provider,
}): JSX.Element | null => {
  // Collect all chapter covers from selected volumes and individual chapters
  const chapterCoversMap = new Map<string, Record<string, unknown>>();

  // Add chapters from selected volumes
  if (selectedVolumes.length > 0 && volumesData.volumes) {
    volumesData.volumes.forEach((volume: unknown) => {
      if (!isRecord(volume)) return;

      const volumeNumber = volume["volumeNumber"] ?? volume["number"];
      const volumeChapters = volume["chapters"];

      if (isNumber(volumeNumber) && selectedVolumes.includes(volumeNumber) && Array.isArray(volumeChapters)) {
        volumeChapters.forEach((chapter: unknown) => {
          if (!isRecord(chapter)) return;

          const chapterUrl = chapter["url"];
          const chapterUrlStr = isString(chapterUrl) ? chapterUrl : '';

          // First check if we have cached metadata for this chapter
          const cachedMetadata = chapterUrlStr ? chapterMetadataCache.get(chapterUrlStr) : null;
          const cachedMetadataRecord = isRecord(cachedMetadata) ? cachedMetadata : null;

          // Use cached chapter cover if available, then chapter's own cover
          const cachedCover = cachedMetadataRecord?.["coverImageUrl"];
          const coverUrl = cachedCover ?? chapter["coverImageUrl"] ?? chapter["coverUrl"];

          if (coverUrl) {
            // Use same priority as step 3 (ChapterList): number -> chapterNumber
            const chapterNumberValue = chapter["number"] ?? chapter["chapterNumber"];
            const chapterKey = chapterUrlStr.length > 0 ? chapterUrlStr : `ch-${String(chapterNumberValue)}`;

            logger.debug('[ChapterCoverSection] Chapter from volume', {
              volumeNumber,
              chapterNumber: chapter["number"],
              chapterChapterNumber: chapter["chapterNumber"],
              chapterNumberValue
            });

            const cachedTitle = cachedMetadataRecord?.["title"];
            const chapterTitle = chapter["title"];
            const title = cachedTitle ?? chapterTitle ?? `Chapter ${String(chapterNumberValue)}`;

            const cachedSummary = cachedMetadataRecord?.["summary"];
            const cachedDescription = cachedMetadataRecord?.["description"];
            const chapterSummary = chapter["summary"];
            const chapterDescription = chapter["description"];
            const summary = cachedSummary ?? cachedDescription ?? chapterSummary ?? chapterDescription;

            chapterCoversMap.set(chapterKey, {
              title,
              summary,
              number: chapter["number"],
              chapterNumber: chapter["chapterNumber"],
              coverUrl,
              volumeNumber,
              source: 'volume',
              hasCachedCover: !!cachedCover
            });
          }
        });
      }
    });
  }

  // Add individually selected chapters with covers (but don't duplicate)
  if (allChapterUrls && allChapterUrls.length > 0) {
    allChapterUrls.forEach((chapter: unknown) => {
      // Skip if chapter is undefined or null
      if (!isRecord(chapter)) return;

      const chapterUrl = chapter["url"];
      const chapterUrlStr = isString(chapterUrl) ? chapterUrl : '';
      // Use same priority as step 3 (ChapterList): number -> chapterNumber
      const chapterNumberValue = chapter["number"] ?? chapter["chapterNumber"];
      const chapterKey = chapterUrlStr.length > 0 ? chapterUrlStr : `ch-${String(chapterNumberValue)}`;

      logger.debug('[ChapterCoverSection] Individual chapter', {
        chapterNumber: chapter["number"],
        chapterChapterNumber: chapter["chapterNumber"],
        chapterNumberValue
      });

      // Only add if not already added from volumes
      if (!chapterCoversMap.has(chapterKey)) {
        // Check cached metadata first
        const cachedMetadata = chapterUrlStr.length > 0 ? chapterMetadataCache.get(chapterUrlStr) : null;
        const cachedMetadataRecord = isRecord(cachedMetadata) ? cachedMetadata : null;

        const cachedCover = cachedMetadataRecord?.["coverImageUrl"];
        const coverUrl = cachedCover ?? chapter["coverImageUrl"] ?? chapter["coverUrl"];

        if (coverUrl) {
          const cachedTitle = cachedMetadataRecord?.["title"];
          const chapterTitle = chapter["title"];
          const title = cachedTitle ?? chapterTitle ?? `Chapter ${String(chapterNumberValue)}`;

          const cachedSummary = cachedMetadataRecord?.["summary"];
          const cachedDescription = cachedMetadataRecord?.["description"];
          const chapterSummary = chapter["summary"];
          const chapterDescription = chapter["description"];
          const summary = cachedSummary ?? cachedDescription ?? chapterSummary ?? chapterDescription;

          // Use same priority as step 3 (ChapterList): number -> chapterNumber
          const chapterNum = chapter["number"] ?? chapter["chapterNumber"];

          chapterCoversMap.set(chapterKey, {
            title,
            summary,
            number: chapter["number"],
            chapterNumber: chapterNum,
            volumeNumber: chapter["volume"],
            coverUrl,
            source: 'individual',
            hasCachedCover: !!cachedCover
          });
        }
      }
    });
  }

  const chapterCovers = Array.from(chapterCoversMap.values());

  // Debug logging
  if (chapterCovers.length > 0) {
    logger.info('[ChapterCoverSection] Found chapter covers:', {
      totalChapterCovers: chapterCovers.length,
      fromVolumes: chapterCovers.filter(ch => isRecord(ch) && ch["source"] === 'volume').length,
      fromIndividual: chapterCovers.filter(ch => isRecord(ch) && ch["source"] === 'individual').length
    });
  }

  // Determine the chapter source to display
  const displayChapterSource = chapterDisplaySource === 'primary' || !chapterDisplaySource ? provider : chapterDisplaySource;
  const chapterSourceLabel = displayChapterSource ? displayChapterSource.toUpperCase() : 'UNKNOWN';

  if (chapterCovers.length === 0) return null;

  return (
    <Paper p="sm">
      <Stack gap="sm">
        <Group>
          <Text size="sm" fw={500}>Chapter Covers</Text>
          <Badge size="sm" variant="light" color="cyan">
            {chapterCovers.length} chapters
          </Badge>
          {/* Source badge for chapters */}
          <Badge size="sm" variant="filled" color="grape">
            {chapterSourceLabel}
          </Badge>
          {chapterCovers.filter(ch => isRecord(ch) && ch["source"] === 'volume').length > 0 && (
            <Badge size="sm" variant="dot" color="blue">
              From volumes
            </Badge>
          )}
          {chapterCovers.filter(ch => isRecord(ch) && ch["source"] === 'individual').length > 0 && (
            <Badge size="sm" variant="dot" color="teal">
              Individual
            </Badge>
          )}
        </Group>
        <ScrollArea h={180} type="hover">
          <Group gap="md">
            {chapterCovers.map((chapter: unknown, index: number) => {
              if (!isRecord(chapter)) return null;

              const coverUrl = chapter["coverUrl"];
              const title = chapter["title"];
              const chapterNumber = chapter["chapterNumber"];
              const number = chapter["number"];
              const hasCachedCover = chapter["hasCachedCover"];
              const volumeNumber = chapter["volumeNumber"];
              const summary = chapter["summary"];

              const coverUrlStr = isString(coverUrl) ? coverUrl : '';
              // Use same priority as step 3 (ChapterList): number -> chapterNumber -> index (0-indexed for prologue/ch 0)
              const chapterNumFallback = number ?? chapterNumber ?? index;
              const titleStr = isString(title) ? title : `Ch ${String(chapterNumFallback)}`;
              const summaryStr = isString(summary) ? summary : '';

              logger.debug('[ChapterCoverSection] Render chapter', {
                index,
                number,
                chapterNumber,
                chapterNumFallback,
                formula: 'number ?? chapterNumber ?? index'
              });

              return (
                <Stack key={index} gap={4} align="center">
                  <Box style={{ position: 'relative' }}>
                    <Image
                      src={coverUrlStr}
                      alt={titleStr}
                      width={90}
                      height={135}
                      radius="sm"
                      fit="contain"
                      fallbackSrc="/cover-not-found.jpg"
                    />
                    {/* Indicator for cached/fetched chapter cover */}
                    {!!hasCachedCover && (
                      <Badge
                        size="xs"
                        color="green"
                        variant="filled"
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4
                        }}
                      >
                        checkmark
                      </Badge>
                    )}
                    {/* FIXED: Use strict equality instead of != */}
                    {volumeNumber !== null && volumeNumber !== undefined && (
                      <Badge
                        size="xs"
                        color="blue"
                        variant="filled"
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4
                        }}
                      >
                        V{String(volumeNumber)}
                      </Badge>
                    )}
                  </Box>
                  <Text
                    size="xs"
                    fw={500}
                    ta="center"
                    style={{
                      maxWidth: 90
                    }}
                  >
                    {titleStr}
                  </Text>
                  {summaryStr.length > 0 && (
                    <Text
                      size="xs"
                      c="dimmed"
                      lineClamp={2}
                      ta="center"
                      style={{
                        maxWidth: 90
                      }}
                    >
                      {summaryStr}
                    </Text>
                  )}
                </Stack>
              );
            })}
          </Group>
        </ScrollArea>
      </Stack>
    </Paper>
  );
};

ChapterCoverSection.displayName = 'ChapterCoverSection';

export { ChapterCoverSection };
