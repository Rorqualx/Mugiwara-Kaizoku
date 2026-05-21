/**
 * ChapterList Component
 *
 * Displays a scrollable list of chapters with cover images, titles, descriptions,
 * metadata badges, and selection state. Extracted from VolumesChaptersStep.tsx.
 */

import React, { useCallback } from 'react';

import {
  Stack,
  Paper,
  Group,
  Checkbox,
  Image,
  Text,
  Badge,
  ScrollArea,
  ActionIcon,
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

import { stripHtml } from '@/lib/html-sanitizer';

import { isRecord, hasProperty } from '../index';

import { type VolumeFieldSources } from './SourceSelection';

// ============================================================================
// Types
// ============================================================================

interface ChapterListProps {
  /** Array of chapter data (URLs or chapter objects) */
  allChapterUrls: unknown[];
  /** Currently selected chapters */
  selectedChapters: unknown[];
  /** Setter for selected chapters */
  setSelectedChapters: React.Dispatch<React.SetStateAction<unknown[]>>;
  /** Field-level source preferences (optional) */
  chapterFieldSources?: VolumeFieldSources | undefined;
  /** Metadata from all selected sources (optional) */
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
  /** User-selected sources (only these should be searched) */
  selectedSources?: string[] | undefined;
}

interface ChapterData {
  chapterNumber: string | number;
  chapterId: unknown;
  chapterCover: string | null;
  url: string | undefined;
  title: string | undefined;
  description: string | null;
  releaseDate: string | undefined;
  pageCount: string | number | undefined;
  detailsFetched: boolean;
  /** Chapter prefix (e.g., "Spell" for Dorohedoro, "Chapter" for most manga) */
  prefix: string | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract chapter number from chapter data
 */
function getChapterNumber(chapter: Record<string, unknown>, index: number): string | number {
  const number = hasProperty(chapter, 'number') ? chapter['number'] : undefined;
  const chapterNumberProp = hasProperty(chapter, 'chapterNumber') ? chapter['chapterNumber'] : undefined;

  if (number !== undefined && (typeof number === 'number' || typeof number === 'string')) {
    return number;
  }
  if (chapterNumberProp !== undefined && (typeof chapterNumberProp === 'number' || typeof chapterNumberProp === 'string')) {
    return chapterNumberProp;
  }
  // Use index as fallback (0-indexed for manga with prologue/chapter 0)
  return index;
}

/**
 * Get chapter identifier for selection tracking
 */
function getChapterId(chapter: Record<string, unknown>): unknown {
  const url = hasProperty(chapter, 'url') ? chapter['url'] : undefined;
  return url ?? chapter;
}

/**
 * Extract cover image URL from chapter data
 */
function getChapterCover(chapter: Record<string, unknown>): string | null {
  const coverImageUrl = hasProperty(chapter, 'coverImageUrl') ? chapter['coverImageUrl'] : undefined;
  const coverUrl = hasProperty(chapter, 'coverUrl') ? chapter['coverUrl'] : undefined;
  const coverImage = hasProperty(chapter, 'coverImage') ? chapter['coverImage'] : undefined;
  const cover = hasProperty(chapter, 'cover') ? chapter['cover'] : undefined;

  if (typeof coverImageUrl === 'string') return coverImageUrl;
  if (typeof coverUrl === 'string') return coverUrl;
  if (typeof coverImage === 'string') return coverImage;
  if (typeof cover === 'string') return cover;
  return null;
}

/**
 * Extract all chapter data from a chapter object
 */
function extractChapterData(chapter: Record<string, unknown>, index: number): ChapterData {
  const title = hasProperty(chapter, 'title') ? chapter['title'] : undefined;
  const description = hasProperty(chapter, 'description') ? chapter['description'] : undefined;
  const synopsis = hasProperty(chapter, 'synopsis') ? chapter['synopsis'] : undefined;
  const releaseDate = hasProperty(chapter, 'releaseDate') ? chapter['releaseDate'] : undefined;
  const pageCount = hasProperty(chapter, 'pageCount') ? chapter['pageCount'] : undefined;
  const detailsFetched = hasProperty(chapter, 'detailsFetched') ? chapter['detailsFetched'] : undefined;
  const url = hasProperty(chapter, 'url') ? chapter['url'] : undefined;
  const prefix = hasProperty(chapter, 'prefix') ? chapter['prefix'] : undefined;

  // Get raw description text
  let descriptionText: string | null = null;
  if (typeof description === 'string') descriptionText = description;
  else if (typeof synopsis === 'string') descriptionText = synopsis;

  // Strip HTML tags from description and title (Wikipedia/ComicVine may return HTML)
  const cleanDescription = descriptionText ? stripHtml(descriptionText) : null;
  const cleanTitle = typeof title === 'string' ? stripHtml(title) : undefined;

  return {
    chapterNumber: getChapterNumber(chapter, index),
    chapterId: getChapterId(chapter),
    chapterCover: getChapterCover(chapter),
    url: typeof url === 'string' ? url : undefined,
    title: cleanTitle,
    description: cleanDescription,
    releaseDate: typeof releaseDate === 'string' ? releaseDate : undefined,
    pageCount: typeof pageCount === 'number' || typeof pageCount === 'string' ? pageCount : undefined,
    detailsFetched: Boolean(detailsFetched),
    prefix: typeof prefix === 'string' ? prefix : undefined,
  };
}

// Fallback image for chapters without covers
const FALLBACK_COVER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjM2EzYTNhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjEycHgiPk5vIENvdmVyPC90ZXh0Pjwvc3ZnPg==';

// ============================================================================
// Per-Field Lookup Helpers for Mix-and-Match
// ============================================================================

/** Helper to check if source is "primary" (meaning use base data) */
function isPrimarySource(source: string): boolean {
  return source === 'primary' || source === '';
}

/**
 * Get chapter data from a specific provider's metadata
 * Chapters are nested inside volumes in volumeData
 */
function getChapterFromSource(
  sourceName: string,
  chapterNumber: number | string,
  selectedSourcesMetadata: Record<string, unknown>
): Record<string, unknown> | null {
  const sourceData = selectedSourcesMetadata[sourceName];
  if (!isRecord(sourceData)) return null;

  // Look for volumeData array
  const volumeData = sourceData['volumeData'];
  if (!Array.isArray(volumeData)) return null;

  // Normalize chapter number for comparison
  const targetNum = typeof chapterNumber === 'string' ? parseFloat(chapterNumber) : chapterNumber;

  // Search through all volumes for the chapter
  for (const volume of volumeData) {
    if (!isRecord(volume)) continue;

    const chapters = volume['chapters'];
    if (!Array.isArray(chapters)) continue;

    for (const chapter of chapters) {
      if (!isRecord(chapter)) continue;

      const chNum = hasProperty(chapter, 'number') ? chapter['number'] :
                   hasProperty(chapter, 'chapterNumber') ? chapter['chapterNumber'] : undefined;
      const parsedChNum = typeof chNum === 'string' ? parseFloat(chNum) : chNum;

      if (parsedChNum === targetNum) {
        return chapter;
      }
    }
  }

  return null;
}

/** Extract a string field from chapter data */
function getStringField(chapter: Record<string, unknown> | null, ...fields: string[]): string | null {
  if (!chapter) return null;
  for (const field of fields) {
    const value = chapter[field];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PrimitiveChapterCardProps {
  chapter: unknown;
  index: number;
  isSelected: boolean;
  onToggle: (chapterId: unknown, isSelected: boolean) => void;
}

/**
 * Renders a simple chapter card for primitive (URL string) chapters
 */
const PrimitiveChapterCard: React.FC<PrimitiveChapterCardProps> = React.memo(
  ({ chapter, index, isSelected, onToggle }): JSX.Element => (
    <Paper
      p="xs"
      bg={isSelected ? 'blue.9' : 'dark.9'}
      style={{ cursor: 'pointer' }}
      onClick={() => onToggle(chapter, isSelected)}
    >
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start" gap="md" style={{ flex: 1 }}>
          <Checkbox
            checked={isSelected}
            onChange={() => {}}
            styles={{ input: { cursor: 'pointer' } }}
            mt={4}
          />
          <Text fw={500}>Chapter {index}</Text>
        </Group>
      </Group>
    </Paper>
  )
);

PrimitiveChapterCard.displayName = 'PrimitiveChapterCard';

interface ChapterCardProps {
  data: ChapterData;
  isSelected: boolean;
  onToggle: (chapterId: unknown, isSelected: boolean) => void;
  /** Field-level source preferences (optional) */
  chapterFieldSources?: VolumeFieldSources | undefined;
  /** Metadata from all selected sources (optional) */
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
  /** User-selected sources (only these should be searched) */
  selectedSources?: string[] | undefined;
}

/**
 * Renders a full chapter card with cover, title, description, and metadata
 * Supports per-field lookups from different providers when chapterFieldSources is provided
 */
const ChapterCard: React.FC<ChapterCardProps> = React.memo(
  // eslint-disable-next-line complexity -- Chapter card with per-field provider lookups and conditional rendering
  ({ data, isSelected, onToggle, chapterFieldSources, selectedSourcesMetadata, selectedSources: _selectedSources = [] }): JSX.Element => {
    // Extract fields based on field sources for mix-and-match
    // Use base chapter data as defaults, then override with provider-specific data if available
    let chapterCover: string | null = data.chapterCover;
    let title: string | undefined = data.title;
    let description: string | null = data.description;

    // Only apply per-field lookups if we have field sources
    if (chapterFieldSources && selectedSourcesMetadata) {
      // Cover - uses display source when "primary" is selected
      if (!isPrimarySource(chapterFieldSources.chapterCover)) {
        const coverSourceChapter = getChapterFromSource(
          chapterFieldSources.chapterCover, data.chapterNumber, selectedSourcesMetadata
        );
        chapterCover = coverSourceChapter
          ? getStringField(coverSourceChapter, 'coverImageUrl', 'coverUrl', 'coverImage', 'cover')
          : null;
      }

      // Title - strictly from chapterTitle source only
      // "Primary" means NO automatic population - user must select a specific provider
      if (!isPrimarySource(chapterFieldSources.chapterTitle)) {
        const titleSourceChapter = getChapterFromSource(
          chapterFieldSources.chapterTitle, data.chapterNumber, selectedSourcesMetadata
        );
        title = titleSourceChapter
          ? getStringField(titleSourceChapter, 'title') ?? undefined
          : undefined;
      }

      // Description - strictly from chapterSummary source only
      // "Primary" means NO automatic population - user must select a specific provider
      if (!isPrimarySource(chapterFieldSources.chapterSummary)) {
        const summarySourceChapter = getChapterFromSource(
          chapterFieldSources.chapterSummary, data.chapterNumber, selectedSourcesMetadata
        );
        description = summarySourceChapter
          ? getStringField(summarySourceChapter, 'description', 'synopsis', 'summary')
          : null;
      }
    }

    return (
    <Paper
      p="xs"
      bg={isSelected ? 'blue.9' : 'dark.9'}
      style={{ cursor: 'pointer' }}
      onClick={() => onToggle(data.chapterId, isSelected)}
    >
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start" gap="md" style={{ flex: 1 }}>
          <Checkbox
            checked={isSelected}
            onChange={() => {}}
            styles={{ input: { cursor: 'pointer' } }}
            mt={4}
          />

          {chapterCover ? (
            <Image
              src={chapterCover}
              alt={`${data.prefix ?? 'Chapter'} ${data.chapterNumber} cover`}
              width={60}
              height={80}
              radius="sm"
              fallbackSrc={FALLBACK_COVER}
            />
          ) : null}

          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={500}>
              {data.prefix ?? 'Chapter'} {data.chapterNumber}
              {title ? `: ${title}` : ''}
            </Text>

            {description ? (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {description}
              </Text>
            ) : null}

            <Group gap="xs">
              {data.releaseDate ? (
                <Badge size="xs" variant="light" color="gray">
                  {data.releaseDate}
                </Badge>
              ) : null}
              {data.pageCount ? (
                <Badge size="xs" variant="light" color="blue">
                  {data.pageCount} pages
                </Badge>
              ) : null}
              {data.detailsFetched ? (
                <Badge size="xs" variant="dot" color="green">
                  Details fetched
                </Badge>
              ) : null}
            </Group>
          </Stack>
        </Group>

        {data.url ? (
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={(e) => {
              e.stopPropagation();
              window.open(data.url, '_blank');
            }}
          >
            <IconExternalLink size={16} />
          </ActionIcon>
        ) : null}
      </Group>
    </Paper>
    );
  }
);

ChapterCard.displayName = 'ChapterCard';

// ============================================================================
// Main Component
// ============================================================================

/**
 * ChapterList displays chapters in a scrollable list with selection support
 * Supports per-field lookups from different providers for mix-and-match
 */
export const ChapterList: React.FC<ChapterListProps> = React.memo(
  ({ allChapterUrls, selectedChapters, setSelectedChapters, chapterFieldSources, selectedSourcesMetadata, selectedSources = [] }): JSX.Element => {
    const handleChapterToggle = useCallback(
      (chapterId: unknown, isSelected: boolean): void => {
        if (isSelected) {
          setSelectedChapters((prev) => prev.filter((c) => c !== chapterId));
        } else {
          setSelectedChapters((prev) => [...prev, chapterId]);
        }
      },
      [setSelectedChapters]
    );

    return (
      <ScrollArea h={400}>
        <Stack gap="xs">
          {allChapterUrls.map((chapter: unknown, index: number) => {
            if (!isRecord(chapter)) {
              const isSelected = selectedChapters.includes(chapter);
              return (
                <PrimitiveChapterCard
                  key={`chapter-${index}`}
                  chapter={chapter}
                  index={index}
                  isSelected={isSelected}
                  onToggle={handleChapterToggle}
                />
              );
            }

            const data = extractChapterData(chapter, index);
            const isSelected = selectedChapters.includes(data.chapterId);

            return (
              <ChapterCard
                key={`chapter-${index}`}
                data={data}
                isSelected={isSelected}
                onToggle={handleChapterToggle}
                chapterFieldSources={chapterFieldSources}
                selectedSourcesMetadata={selectedSourcesMetadata}
                selectedSources={selectedSources}
              />
            );
          })}
        </Stack>
      </ScrollArea>
    );
  }
);

ChapterList.displayName = 'ChapterList';
