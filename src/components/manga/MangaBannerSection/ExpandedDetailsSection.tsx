/**
 * ExpandedDetailsSection Component
 *
 * Renders the expanded details panel containing gallery images, series path,
 * publication dates, AniList stats, alternative titles, provider links,
 * external links, and dynamic sections.
 *
 * Extracted from: MangaBannerSection.tsx (lines 766-1046)
 *
 * @module components/manga/MangaBannerSection/ExpandedDetailsSection
 */

import { Badge, Box, Button, Group, Stack, Text } from '@mantine/core';
import {
  IconCalendar,
  IconCalendarOff,
  IconExternalLink,
  IconEye,
  IconFolder,
  IconPhoto,
  IconTrophy,
} from '@tabler/icons-react';

import { MangaGallery } from '@/components/manga/MangaGallery';
import { logger } from '@/utils/logger';

import type { ExternalLink, MangaMetadata, MangaWithRelations } from './types';

/**
 * Props for ExpandedDetailsSection component
 */
interface ExpandedDetailsSectionProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Extracted metadata from the manga */
  extractedMetadata: MangaMetadata | null;
}

/**
 * Type guard for rawProviderData structure
 */
interface RawProviderData {
  selectedGalleryImages?: string[];
}

function isRawProviderData(data: unknown): data is RawProviderData {
  return data !== null && typeof data === 'object';
}

/**
 * Type guard for externalLinks data structure
 */
interface ExternalLinksData {
  links?: ExternalLink[];
  dynamicSections?: Record<string, string>;
}

function isExternalLinksData(data: unknown): data is ExternalLinksData {
  return data !== null && typeof data === 'object';
}

/**
 * Determines provider name and color from URL
 */
function getProviderInfo(url: string): { name: string; color: string } {
  if (url.includes('anilist.co')) {
    return { name: 'AniList', color: 'cyan' };
  } else if (url.includes('comicvine.gamespot.com')) {
    return { name: 'ComicVine', color: 'green' };
  } else if (url.includes('wikipedia.org')) {
    return { name: 'Wikipedia', color: 'orange' };
  } else if (url.includes('fandom.com')) {
    return { name: 'Fandom', color: 'purple' };
  } else if (url.includes('myanimelist.net')) {
    return { name: 'MyAnimeList', color: 'blue' };
  } else if (url.includes('kitsu.io')) {
    return { name: 'Kitsu', color: 'pink' };
  }
  return { name: 'External', color: 'blue' };
}

/**
 * Gallery Images Section
 */
function GalleryImagesSection({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  try {
    // Source 1: Metadata.galleryImages (auto-collected from volume/chapter covers during enrichment)
    const metadataGallery = (manga.Metadata as Record<string, unknown> | null)?.['galleryImages'];
    const autoImages = Array.isArray(metadataGallery) ? metadataGallery.filter((u): u is string => typeof u === 'string') : [];

    // Source 2: rawProviderData.selectedGalleryImages (manually selected during import wizard)
    let wizardImages: string[] = [];
    if (manga.rawProviderData) {
      const rawData: unknown =
        typeof manga.rawProviderData === 'string'
          ? JSON.parse(manga.rawProviderData)
          : manga.rawProviderData;
      if (isRawProviderData(rawData) && Array.isArray(rawData.selectedGalleryImages)) {
        wizardImages = rawData.selectedGalleryImages.filter((u): u is string => typeof u === 'string');
      }
    }

    // Merge and deduplicate
    const galleryImages = [...new Set([...autoImages, ...wizardImages])];

    if (galleryImages.length === 0) {
      return null;
    }

    return (
      <Box mb="lg">
        <Group mb="xs" gap="xs">
          <IconPhoto size={18} color="violet" />
          <Text size="sm" fw={600} c="gray.3">
            Gallery ({galleryImages.length} images)
          </Text>
        </Group>
        <MangaGallery images={galleryImages} />
      </Box>
    );
  } catch (error) {
    logger.error('[MangaDetailPage] Error parsing rawProviderData for gallery:', error);
    return null;
  }
}

/**
 * Series Path Section
 */
function SeriesPathSection({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  if (!('path' in manga) || typeof manga.path !== 'string') return null;

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        Series Path:
      </Text>
      <Group gap="xs">
        <IconFolder size={18} color="cyan" />
        <Text size="sm" c="gray.4" ff="monospace">
          {manga.path}
        </Text>
      </Group>
    </Box>
  );
}

/**
 * Publication Dates Section
 */
function PublicationDatesSection({
  extractedMetadata,
}: {
  extractedMetadata: MangaMetadata | null;
}): React.ReactNode {
  const startDate = extractedMetadata?.startDate;
  const endDate = extractedMetadata?.endDate;

  if (!startDate && !endDate) return null;

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        Publication Period:
      </Text>
      <Group gap="md">
        {startDate && (
          <Group gap="xs">
            <IconCalendar size={18} color="green" />
            <Text size="sm" c="gray.2">
              Started:{' '}
              {(startDate instanceof Date
                ? startDate
                : new Date(String(startDate))
              ).toLocaleDateString()}
            </Text>
          </Group>
        )}
        {endDate && (
          <Group gap="xs">
            <IconCalendarOff size={18} color="red" />
            <Text size="sm" c="gray.2">
              Ended:{' '}
              {(endDate instanceof Date ? endDate : new Date(String(endDate))).toLocaleDateString()}
            </Text>
          </Group>
        )}
      </Group>
    </Box>
  );
}

/**
 * AniList Stats Section
 */
function AniListStatsSection({
  extractedMetadata,
}: {
  extractedMetadata: MangaMetadata | null;
}): React.ReactNode {
  if (!extractedMetadata?.averageScore && !extractedMetadata?.popularity) return null;

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        AniList Stats:
      </Text>
      <Group gap="md">
        {extractedMetadata.averageScore && (
          <Group gap="xs">
            <IconTrophy size={18} color="gold" />
            <Text size="sm" c="gray.2">
              Score: {extractedMetadata.averageScore}%
            </Text>
          </Group>
        )}
        {extractedMetadata.popularity && (
          <Group gap="xs">
            <IconEye size={18} color="cyan" />
            <Text size="sm" c="gray.2">
              Popularity:{' '}
              {typeof extractedMetadata.popularity === 'number'
                ? (extractedMetadata.popularity as number).toLocaleString()
                : String(extractedMetadata.popularity)}
            </Text>
          </Group>
        )}
      </Group>
    </Box>
  );
}

/**
 * Alternative Titles Section
 */
function AlternativeTitlesSection({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  if (!manga.Metadata?.synonyms || manga.Metadata.synonyms.length === 0) return null;

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        Alternative Titles:
      </Text>
      <Stack gap="xs">
        {manga.Metadata.synonyms.map((title: string, index: number) => (
          <Text key={index} size="sm" c="gray.4">
            {title}
          </Text>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Characters Section
 * Shows up to 5 characters with "+X more" indicator
 */
function CharactersSection({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  if (!manga.Metadata?.characters || manga.Metadata.characters.length === 0) return null;

  const characters = manga.Metadata.characters;
  const displayLimit = 5;
  const hasMore = characters.length > displayLimit;

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        Characters:
      </Text>
      <Group gap="xs">
        {characters.slice(0, displayLimit).map((character: string, index: number) => (
          <Badge key={index} size="sm" variant="outline" color="gray">
            {character}
          </Badge>
        ))}
        {hasMore && (
          <Text size="xs" c="dimmed">
            +{characters.length - displayLimit} more
          </Text>
        )}
      </Group>
    </Box>
  );
}

/**
 * Provider Links Section
 */
function ProviderLinksSection({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  if (
    !manga.Metadata?.urls ||
    !Array.isArray(manga.Metadata.urls) ||
    manga.Metadata.urls.length === 0
  ) {
    return null;
  }

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        Provider Links:
      </Text>
      <Group gap="xs">
        {manga.Metadata.urls
          .filter((url: string) => url.startsWith('http://') || url.startsWith('https://'))
          .map((url: string, index: number) => {
          const { name: providerName, color } = getProviderInfo(url);
          return (
            <Button
              key={index}
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              variant="light"
              color={color}
              leftSection={<IconExternalLink size={14} />}
            >
              {providerName}
            </Button>
          );
        })}
      </Group>
    </Box>
  );
}

/**
 * External Links Section
 */
function ExternalLinksSection({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  const externalLinks = manga.Metadata?.externalLinks;
  if (!externalLinks || typeof externalLinks !== 'object' || !('links' in externalLinks)) {
    return null;
  }

  const linksData = externalLinks as unknown;
  if (!isExternalLinksData(linksData)) return null;

  const linksArray = linksData.links;
  if (!linksArray || !Array.isArray(linksArray) || linksArray.length === 0) {
    return null;
  }

  return (
    <Box mb="lg">
      <Text size="sm" fw={600} c="gray.3" mb="xs">
        External Links:
      </Text>
      <Group gap="xs">
        {linksArray
          .filter((link) => link.url.startsWith('http://') || link.url.startsWith('https://'))
          .map((link, index: number) => (
          <Button
            key={index}
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconExternalLink size={14} />}
          >
            {link.site}
          </Button>
        ))}
      </Group>
    </Box>
  );
}

/**
 * Dynamic Sections
 */
function DynamicSections({ manga }: { manga: MangaWithRelations }): React.ReactNode {
  if (!manga.Metadata?.externalLinks) return null;

  try {
    const externalLinksData: unknown =
      typeof manga.Metadata.externalLinks === 'string'
        ? JSON.parse(manga.Metadata.externalLinks)
        : manga.Metadata.externalLinks;

    if (!isExternalLinksData(externalLinksData)) return null;

    const dynamicSections = externalLinksData.dynamicSections;

    if (
      !dynamicSections ||
      typeof dynamicSections !== 'object' ||
      Object.keys(dynamicSections as Record<string, string>).length === 0
    ) {
      return null;
    }

    return (
      <>
        {Object.entries(dynamicSections as Record<string, string>).map(
          ([label, content], index) => (
            <Box key={`dynamic-section-${index}`} mb="lg">
              <Text size="sm" fw={600} c="gray.3" mb="xs">
                {label}:
              </Text>
              <Text c="gray.3" size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {content}
              </Text>
            </Box>
          )
        )}
      </>
    );
  } catch (error) {
    logger.error('[MangaDetailPage] Error parsing externalLinks for dynamic sections:', error);
    return null;
  }
}

/**
 * ExpandedDetailsSection Component
 *
 * Renders all expanded detail sections for the manga banner.
 */
export function ExpandedDetailsSection({
  manga,
  extractedMetadata,
}: ExpandedDetailsSectionProps): React.ReactNode {
  return (
    <>
      <GalleryImagesSection manga={manga} />
      <SeriesPathSection manga={manga} />
      <PublicationDatesSection extractedMetadata={extractedMetadata} />
      <AniListStatsSection extractedMetadata={extractedMetadata} />
      <AlternativeTitlesSection manga={manga} />
      <CharactersSection manga={manga} />
      <ProviderLinksSection manga={manga} />
      <ExternalLinksSection manga={manga} />
      <DynamicSections manga={manga} />
    </>
  );
}
